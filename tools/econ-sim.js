// Monte Carlo economy sim for Pixel Hunt's arsenal.
//   node tools/econ-sim.js            summary + sampled table
//   node tools/econ-sim.js --table    every purchase
//   node tools/econ-sim.js --fit      re-fit the price CURVE in js/economy.js
//   node tools/econ-sim.js --balance  compare weapons at equal investment
//   node tools/econ-sim.js --scores   simulated Classic scores at checkpoints (rounds 5/10/15/20/25/30)
//   node tools/econ-sim.js --boss-rates  mid-game Meadow R10 boss clear rate (target ~87%)
//   node tools/econ-sim.js --survival  per-round reach/clear rates (default Meadow; --map=lake --n=2000)
//   node tools/econ-sim.js --perks    compare each perk on vs off at a matching stage
// The "average player" model: aim accuracy falls with target speed/size/erratic paths; ammo, fire rate
// and reload give more attempts per target; run ends after N escapes TOTAL (Lucky Feather: 3/4/5); a perfect round
// gives one X back. Checkpoints every 5 rounds: a game is either fresh (round 1) or continues from the checkpoint,
// whichever pays more for that gear level (checkpoint = best round reached, rounded down to a multiple of 5).
const fs = require('fs'), path = require('path');
const ECON_PATH = path.join(__dirname, '../js/economy.js');
let E = require(ECON_PATH);
const rnd = Math.random;
const T = id => E.TRACKS.find(t => t.id === id);
const V = (lv, id) => T(id).val[lv[id] || 0];
// Human tap-to-reload lag is off by default so the fitted ~6 games/purchase curve stays put.
// --perks turns it on so Auto Reload (and manual reloads) can be measured fairly.
let HUMAN_RELOAD = 0;
const GROUND = new Set(['deer', 'wolf', 'coyote', 'rabbit', 'roadrunner', 'swimgoose', 'eyes']);
function P(lv, id) {
  const tr = T(id); if (!tr) return 0;
  const n = lv[id] | 0;
  return tr.val[Math.min(Math.max(0, n), tr.val.length - 1)];
}
function gunMods(w, lv) {
  const cap0 = V(lv, w + '.cap'), rel0 = V(lv, w + '.reload');
  const reserve = (lv['perk.reserve'] | 0) ? P(lv, 'perk.reserve') : 0;
  const cap = cap0 + (w === 'laser' ? reserve * 0.35 : reserve);
  const loader = (lv['perk.loader'] | 0) ? P(lv, 'perk.loader') : 1;
  const delay = (lv['perk.auto'] | 0) ? P(lv, 'perk.auto') : HUMAN_RELOAD;
  return { cap, reload: rel0 * loader + delay };
}
function ctxSlow(lv, ctx) {
  if (!lv || !ctx || !(lv['perk.bullet'] | 0)) return 1;
  const bt = P(lv, 'perk.bullet');
  if (bt < 1 && (ctx.boss || (ctx.missRun | 0) >= (ctx.maxMiss || 3) - 1)) return bt;
  return 1;
}
function applyPerkWorld(s, kind, lv, ctx) {
  if (!s || !lv) return s;
  if (GROUND.has(kind) && (lv['perk.deer'] | 0)) {
    const m = Math.max(0.15, P(lv, 'perk.deer'));
    s.speed *= m; s.Tw /= m;
  }
  const bt = ctxSlow(lv, ctx);
  if (bt < 1) { s.speed *= bt; s.Tw /= bt; }
  if (kind === 'egg' && (lv['perk.eggsnipe'] | 0)) {
    const m = P(lv, 'perk.eggsnipe');
    s.Tw *= Math.sqrt(m);
    s.scale *= 1.08;
  }
  return s;
}
function critEV(lv, wId) {
  let p = 0;
  if (wId === 'handgun') p = 1 - (1 - p) * (1 - (V(lv, 'handgun.crit') || 0));
  if (lv['perk.crit'] | 0) p = 1 - (1 - p) * (1 - P(lv, 'perk.crit'));
  return 1 + p;
}
function dropStreak(lv, streak) {
  if (!(lv['perk.combo'] | 0)) return 0;
  const v = P(lv, 'perk.combo');
  if (v >= 99) return 0;
  return Math.max(0, streak - v);
}
function comboPay(lv) {
  if (!(lv['perk.combo'] | 0)) return 1;
  const tr = T('perk.combo');
  if (!tr || !tr.pay) return 1;
  return tr.pay[Math.min(lv['perk.combo'] | 0, tr.pay.length - 1)] || 1;
}
function isGroundKind(kind) { return GROUND.has(kind); }
function deerCashMul(lv, kind) {
  if (!(lv['perk.deer'] | 0) || !isGroundKind(kind)) return 1;
  const tr = T('perk.deer');
  if (!tr || !tr.cash) return 1;
  return tr.cash[Math.min(lv['perk.deer'] | 0, tr.cash.length - 1)] || 1;
}
function deerMercyOf(lv) {
  if (!(lv['perk.deer'] | 0)) return 0;
  const tr = T('perk.deer');
  if (!tr || !tr.mercy) return 0;
  return tr.mercy[Math.min(lv['perk.deer'] | 0, tr.mercy.length - 1)] || 0;
}
function eggBossMul(lv) {
  if (!(lv['perk.eggsnipe'] | 0)) return 1;
  const l = lv['perk.eggsnipe'] | 0;
  return 1 + 0.10 + 0.05 * Math.max(0, l - 1);
}

function aim(radius, scale, speed, erratic) {
  return Math.min(0.97, Math.max(0.02, 1.05 * Math.pow(radius / 5, 0.4) * Math.pow(scale / 1.5, 0.6) * Math.pow(26 / speed, 0.55) * (1 - 0.25 * erratic)));
}
function attempts(Tw, cap, reload, shotT) {
  const cycle = cap * shotT + reload, t = Math.max(0, Tw - shotT);
  return Math.min(6, 1 + Math.floor(t / cycle) * cap + Math.min(cap - 1, Math.floor((t % cycle) / shotT)));
}
function usePersist(lv) {
  return HUMAN_RELOAD > 0 || (lv && ((lv['perk.auto'] | 0) || (lv['perk.loader'] | 0) || (lv['perk.reserve'] | 0)));
}
// Carry magazine state from target to target so reload lag actually costs attempts.
function persistentAttempts(Tw, cap, reload, shotT, ammo) {
  cap = Math.max(1, cap);
  if (!ammo) return attempts(Tw, cap, reload, shotT);
  if (ammo.v == null) ammo.v = cap;
  let t = 0, n = 0;
  t += ammo.t || 0; ammo.t = 0;
  while (t < Tw && n < 8) {
    if (ammo.v <= 0) {
      ammo.v = cap;
      t += reload;
      if (t >= Tw) { ammo.t = t - Tw; break; }
    }
    t += shotT;
    n++; ammo.v--;
  }
  return n;
}
function shotAttempts(Tw, cap, reload, shotT, ammo, lv) {
  if (usePersist(lv) && ammo) return persistentAttempts(Tw, cap, reload, shotT, ammo);
  return attempts(Tw, cap, reload, shotT);
}
// probability that the equipped weapon kills a target, plus per-kill modifiers

function gunDmg(w, lv) {
  return (T(w + '.dmg') ? V(lv, w + '.dmg') : 1) || 1;
}
function needHitsFor(w, lv, kind, ctx) {
  if (ctx && ctx.hitOnly) return 1;
  return E.hitsNeeded(E.kindHp(kind), gunDmg(w, lv));
}
function weaponTry(w, lv, d, kind, slow, st, ammo, ctx) {
  const g = k => V(lv, w + '.' + k);
  const mods = gunMods(w, lv);
  const kHits = needHitsFor(w, lv, kind, ctx);
  // Flyers cross left -> right: on-screen time = (linger + 0.7s) x Eye; apparent speed = crossing speed + vertical zig.
  const cross = (d.life * (kind === 'gold' ? 0.8 : 1) + 0.7) / (kind === 'gold' ? Math.sqrt(1.35) : 1);
  let speed = (kind === 'deer' || GROUND.has(kind) ? d.deerSpeed * 0.8 : Math.hypot(202 / (cross * st.eye), d.speed * 0.6 * (kind === 'gold' ? 1.35 : 1))) * (slow ? 0.38 : 1);
  let scale = (kind === 'deer' || GROUND.has(kind)) ? 1.6 : d.scale * (kind === 'gold' ? 0.85 : 1);
  const er = (kind === 'deer' || GROUND.has(kind)) ? 0 : d.erratic;
  let Tw = (kind === 'deer' || GROUND.has(kind) ? 180 / d.deerSpeed : cross) * st.eye / Math.min(d.conc, 3) * (slow ? 2.2 : 1);
  ({ speed, scale, Tw } = applyPerkWorld({ speed, scale, Tw, er }, kind, lv, ctx));
  let p = 0, extra = 0;
  if (w === 'shotgun') p = atLeastK(aim(g('choke'), scale, speed, er), shotAttempts(Tw, mods.cap, mods.reload, 0.45, ammo, lv), kHits);
  else if (w === 'handgun') p = atLeastK(aim(g('sights'), scale, speed, er) * 0.8, shotAttempts(Tw, mods.cap, mods.reload, 0.26, ammo, lv), kHits);
  else if (w === 'rifle') { p = atLeastK(aim(g('caliber'), scale, speed, er) * 1.3, shotAttempts(Tw, mods.cap, mods.reload, 0.5, ammo, lv), kHits); extra = d.conc > 1 ? Math.min(0.4, 0.11 * (g('pierce') - 1)) : 0; }
  else if (w === 'bow') { const lead = 1 - 0.15 * Math.min(1, speed / 110); p = atLeastK(aim(g('tip'), scale, speed, er) * lead * 1.35, shotAttempts(Tw, mods.cap, mods.reload, 0.3 + g('draw'), ammo, lv), kHits); extra = d.conc > 1 ? 0.08 * (g('pierce') - 1) : 0; }
  else if (w === 'mg') {
    const rate = g('rate'), r = 3 + (12 - g('spread')) * 0.2;
    if (ammo.v < 4) { ammo.v = mods.cap; ammo.t += mods.reload; }
    const Tl = Math.max(0.2, Tw - ammo.t); ammo.t = 0;
    const n = Math.min(12, Math.floor(Tl / rate), ammo.v), a = aim(r, scale, speed, er) * 0.45;
    p = atLeastK(a, n, kHits); ammo.v -= Math.max(1, Math.round(p > 0.5 ? Math.min(n, 1 / Math.max(a, 0.05)) : n));
    extra = Math.min(0.35, 0.07 * (d.conc - 1));
  } else if (w === 'laser') {
    const dwell = g('power'), k = Math.pow(speed / 40, 0.7) * (1 + er) * Math.pow(1.5 / scale, 0.5) / Math.pow(g('width') / 2, 0.5);
    if (ammo.v < dwell * 2) { ammo.v = mods.cap; ammo.t += mods.reload; }
    const Tl = Math.max(0.2, Tw - ammo.t); ammo.t = 0;
    const need = dwell * k * 1.6 * kHits;
    p = 1 - Math.exp(-Math.min(Tl, ammo.v) / need); ammo.v -= Math.min(ammo.v, need * 1.2);
    extra = Math.min(0.3, 0.06 * (d.conc - 1));
  }
  return { p, extra };
}
function weaponOf(w) { return E.WEAPONS.find(x => x.id === w); }

const MAP_SET = {
  meadow: { fly: [['bird', 0.7], ['blue', 0.3]], ground: ['deer'] },
  lake: { fly: [['bird', 0.55], ['goose', 0.45]], ground: ['swimgoose'] },
  snow: { fly: [['owl', 1]], ground: ['rabbit', 'wolf'] },
  desert: { fly: [['vulture', 1]], ground: ['roadrunner', 'coyote'] },
  night: { fly: [['bat', 0.65], ['owl', 0.35]], ground: ['eyes'] },
};
function pickFlyMap(mapId) {
  const set = (MAP_SET[mapId] || MAP_SET.meadow).fly; let x = rnd(), acc = 0;
  for (const [k, p] of set) { acc += p; if (x < acc) return k; }
  return set[0][0];
}
// Shared boss-round model: patrol + escape timer + eggs (no bonus starting flyers).
// tryFn is weaponTry or weaponTryScore.
function simBossFight(wId, lv, d, st, ammo, r, M, mapId, tryFn, missRun) {
  const ctx = { boss: true, missRun: missRun || 0, maxMiss: st.maxMiss || 3 };
  const tm = E.bossTime(r) * (st.eye || 1);
  const hp = E.bossHp(r);
  const pr = tryFn(wId, lv, d, 'deer', false, st, { v: 999, t: 0 }, Object.assign({}, ctx, { hitOnly: true })).p;
  const rate = (wId === 'mg' || wId === 'laser' ? 1.6 : 1.1);
  const dmg = gunDmg(wId, lv);
  const shots = tm * rate * pr;
  const dealt = shots * dmg;
  const killed = dealt >= hp || rnd() < dealt / hp * 0.5;
  const dps = rate * Math.max(0.05, pr) * dmg;
  const fightT = killed ? Math.min(tm, hp / dps) : tm;
  const interval = E.eggInterval(r, M);
  const delay = 1.6 * (st.eye || 1);
  let nEggs = 0;
  if (fightT > delay) nEggs = Math.max(0, Math.round((fightT - delay) / interval + (rnd() - 0.4)));
  const tier = Math.max(1, Math.floor(r / E.BOSS_EVERY));
  nEggs = Math.min(nEggs, 2 + tier);
  const eggMul = (lv['perk.eggsnipe'] | 0) ? P(lv, 'perk.eggsnipe') : 1;
  let cash = 0, score = 0, escapes = 0, birdsKilled = 0, smashed = 0;
  for (let i = 0; i < nEggs; i++) {
    const pEgg = Math.min(0.97, tryFn(wId, lv, d, 'egg', false, st, ammo, ctx).p * 1.28 * (eggMul > 1 ? Math.sqrt(eggMul) : 1));
    if (rnd() < pEgg) {
      smashed++;
      cash += E.eggCash(r) * (st.mm || 1) * M.cash * eggMul;
      score += Math.round(E.eggPts(r) * M.pts * eggMul / 10) * 10;
    } else {
      const kind = pickFlyMap(mapId);
      const pBird = tryFn(wId, lv, d, kind, false, st, ammo, ctx).p;
      if (rnd() < pBird) {
        birdsKilled++;
        const pk = kind === 'swimgoose' ? 'goose' : kind;
        cash += E.killCash(pk, r, st.mm || 1, 1) * M.cash;
        if (E.killPts) score += Math.round(E.killPts(pk, r, 1) * M.pts / 10) * 10;
      } else escapes++;
    }
  }
  return { killed, cash, score, escapes, birdsKilled, smashed, nEggs, fightT };
}

function run(lv, equip, mapId = 'meadow', start = 1) {
  const M = E.MAPS.find(m => m.id === mapId);
  const st = { eye: V(lv, 'eye'), focus: V(lv, 'focus'), focusDur: T('focus').dur[lv.focus || 0], maxMiss: V(lv, 'luck'), mm: V(lv, 'bounty') };
  const W = weaponOf(equip);
  let r = start - 1, cash = 0, time = 0, missRun = 0, streak = 0, alive = true;
  let flak = V(lv, 'gadget.flak'), calls = V(lv, 'gadget.call'), decoys = V(lv, 'gadget.decoy'), boost = 0;
  const slots = V(lv, 'turret.slots');
  const turrets = ['pellet', 'tesla', 'missile'].filter(t => lv['own.' + t]).reverse().slice(0, slots);
  const ammo = { v: 0, t: 0 };
  const cap = (E.CLEAR_ROUND || 90); // campaign ends after the round-30 boss
  let secondLeft = (lv['perk.second'] | 0) ? P(lv, 'perk.second') : 0;
  let deerMercy = deerMercyOf(lv);
  let saveBoost = 0;
  while (alive && r < cap) {
    const roundCash0 = cash;
    r++; const d0 = E.difficulty(r); const d = Object.assign({}, d0, { speed: d0.speed * M.speed, deerSpeed: d0.deerSpeed * M.speed, life: d0.life * M.life * (M.dark ? 0.9 + 0.1 * (lv.flashlight || 0) / 4 : 1), scale: d0.scale * M.size });
    if (r % E.BOSS_EVERY === 0) { // patrol + timer + eggs; leaving or a hatched escape is 1 X
      const b = simBossFight(W.id, lv, d, st, ammo, r, M, mapId, weaponTry, missRun);
      const takeX = (kind) => {
        if (kind && isGroundKind(kind) && deerMercy > 0) { deerMercy--; return false; }
        if (secondLeft > 0) { secondLeft--; saveBoost = 6; return false; }
        missRun++; streak = dropStreak(lv, streak);
        return missRun >= st.maxMiss;
      };
      if (b.killed) cash += E.bossCash(r) * st.mm * M.cash * W.cash * critEV(lv, W.id) * eggBossMul(lv) * comboPay(lv);
      else if (takeX()) { alive = false; break; }
      cash += b.cash;
      let dead = false;
      for (let e = 0; e < b.escapes && !dead; e++) if (takeX()) dead = true;
      if (dead) { alive = false; break; }
      time += 12; continue;
    }
    let hits = 0, total = 0, focusLeft = Math.round(st.focus * st.focusDur / 2.5);
    // turret rescue budget this round
    let tb = 0;
    turrets.forEach(t => {
      if (t === 'pellet') tb += V(lv, 'pellet.ammo') * [0.4, 0.5, 0.58, 0.66][lv['pellet.aim'] || 0] * Math.min(1, 2.5 / V(lv, 'pellet.rate') * 0.5);
      if (t === 'tesla') tb += V(lv, 'tesla.ammo') * (0.75 + 0.15 * (V(lv, 'tesla.chain') - 1)) * (V(lv, 'tesla.range') / 120);
      if (t === 'missile') tb += V(lv, 'missile.ammo') * (0.85 + V(lv, 'missile.blast') / 50) * Math.min(1, 5 / V(lv, 'missile.rate') * 0.6);
    });
    let golds = (calls > 0 && r >= 4) ? (calls--, 3) : 0;
    const extraDeer = (r >= 4 && (lv['perk.deer'] | 0)) ? 2 : 0;
    for (let i = 0; i < d.count + extraDeer && alive; i++) {
      const x = rnd(); let kind = 'bird';
      if (i >= d.count) kind = 'deer';
      else if (golds > 0) { kind = 'gold'; golds--; }
      else if (r > 1) { if (x < d.deer) kind = 'deer'; else if (x < d.deer + d.decoy) kind = 'decoy'; else if (x < d.deer + d.decoy + d.gold) kind = 'gold'; else if (rnd() < 0.3) kind = 'blue'; }
      if (kind === 'decoy') { if (rnd() < (W.id === 'mg' ? 0.16 : 0.08)) cash -= Math.min(cash, E.decoyPenalty(r)); continue; }
      total++;
      const slow = focusLeft > 0; if (slow) focusLeft--;
      const ctx = { missRun, maxMiss: st.maxMiss, boss: false };
      let { p, extra } = weaponTry(W.id, lv, d, kind, slow, st, ammo, ctx);
      if (boost > 0) { p = Math.min(0.98, p + 0.25); boost--; }
      if (saveBoost > 0) { p = Math.min(0.98, p + 0.22); saveBoost--; }
      const pay = (k, m) => E.killCash(k, r, st.mm, m) * M.cash * W.cash * (k === 'deer' && W.deerBonus ? W.deerBonus : 1) * (k === 'gold' && W.goldBonus ? W.goldBonus : 1) * deerCashMul(lv, k);
      if (rnd() < p) {
        hits++; streak++;
        let c = pay(kind, Math.min(streak, 5)) * critEV(lv, W.id) * comboPay(lv);
        cash += c;
        if (rnd() < extra) { cash += pay('bird', Math.min(streak, 5)) * critEV(lv, W.id) * comboPay(lv); i++; hits++; total++; }
        time += d.life * 0.35 / d.conc + d.interval / d.conc;
      } else {
        time += d.life / d.conc;
        if (tb > 0 && rnd() < Math.min(1, tb) * 0.85) { tb -= 1; cash += pay(kind, 1) * E.TURRET_CASH; continue; }
        if (missRun === st.maxMiss - 1 && flak > 0) { flak--; hits++; cash += pay(kind, 1) * 1.5; continue; }
        if (missRun === st.maxMiss - 1 && decoys > 0) { decoys--; boost = 5; }
        if (isGroundKind(kind) && deerMercy > 0) { deerMercy--; continue; }
        if (secondLeft > 0) { secondLeft--; saveBoost = 6; continue; }
        missRun++; streak = dropStreak(lv, streak);
        if (missRun >= st.maxMiss) alive = false;
      }
    }
    time += 3.6;
    if (alive) {
      cash += E.roundBonus(r, hits === total) * comboPay(lv); if (hits === total && missRun > 0) missRun--;
      const earned = Math.max(0, cash - roundCash0);
      if ((lv['perk.magnet'] | 0) && earned > 0) cash += Math.max(1, Math.round(earned * P(lv, 'perk.magnet')));
    }
  }
  return { cash, rounds: r - start + 1, reached: r, time };
}
function hasMapLv(lv, id, cleared) {
  const i = E.MAPS.findIndex(m => m.id === id);
  if (i < 0) return false;
  if (i === 0) return true;
  if (lv['map.' + id]) return true;
  if (cleared && cleared[E.MAPS[i - 1].id]) return true;
  return false;
}
function bestMap(lv, cleared) { return E.MAPS.filter(m => hasMapLv(lv, m.id, cleared)).slice(-1)[0].id; }
function avgFrom(lv, equip, n, map, start) {
  let c = 0, r = 0, t = 0; const reached = [];
  for (let i = 0; i < n; i++) { const o = run(lv, equip, map, start); c += o.cash; r += o.rounds; t += o.time; reached.push(o.reached); }
  return { cash: c / n, rounds: r / n, time: t / n, reached };
}
function avg(lv, equip, n = 80, map = bestMap(lv)) {
  const fresh = avgFrom(lv, equip, n, map, 1);
  // checkpoint the player has saved: best of their last ~8 runs, rounded down to a multiple of 5
  const rs = fresh.reached.sort((a, b) => b - a), ck = Math.floor(rs[Math.floor(rs.length / 8)] / 5) * 5;
  if (ck < 5) return Object.assign(fresh, { from: 1 });
  const cont = avgFrom(lv, equip, n, map, ck);
  return cont.cash > fresh.cash ? Object.assign(cont, { from: ck }) : Object.assign(fresh, { from: 1 });
}
const owned = lv => E.WEAPONS.filter(w => !w.ownW || lv['own.' + w.id]).map(w => w.id);
function bestWeapon(lv) {
  let best = null;
  for (const w of owned(lv)) { const e = avg(lv, w, 50); if (!best || e.cash > best.e.cash) best = { w, e }; }
  return best;
}
// Purchase ORDER (independent of the price curve): unlocks are bought as soon as their milestone is met,
// otherwise the cheapest relative price among: equipped weapon, newest weapon, gear, turrets, gadgets.
function plan() {
  const lv = {}; E.TRACKS.forEach(t => lv[t.id] = 0);
  let n = 0, equip = 'shotgun', newest = 'shotgun', est = avg(lv, equip);
  const steps = [];
  const avail = t => lv[t.id] < t.val.length - 1 && n >= (t.req || 0) && (!t.needs || lv[t.needs]);
  while (n < E.TOTAL_LEVELS) {
    const all = E.TRACKS.filter(avail);
    let pick = all.find(t => t.unlock);
    if (!pick && (lv['turret.slots'] || 0) === 0 && T('turret.slots') && avail(T('turret.slots'))) pick = T('turret.slots');
    if (!pick) {
      const focus = all.filter(t => t.group !== 'weapon' || t.of === equip || t.of === newest);
      const pool = focus.length ? focus : all;
      pool.sort((a, b) => a.w * (1 + E.PER_LEVEL * lv[a.id]) - b.w * (1 + E.PER_LEVEL * lv[b.id]));
      pick = pool[0];
    }
    steps.push({ n, id: pick.id, name: pick.name + (pick.unlock ? '' : ' ' + (lv[pick.id] + 1)), w: pick.w, lvl: lv[pick.id], estCash: est.cash, rounds: est.rounds, time: est.time, equip });
    lv[pick.id]++; n++;
    if (pick.unlock && pick.group === 'weapon') newest = pick.of;
    if (pick.group === 'weapon' || pick.group === 'map' || n % 8 === 0) { const b = bestWeapon(lv); equip = b.w; est = b.e; } else est = avg(lv, equip);
  }
  return { steps, lv };
}
// Play it out with a bank: runs, side income (missions ~1 per 2 runs at 10% of next price, daily every ~6 runs).
function playout(steps, { ads = false } = {}) {
  let bank = 0, runs = 0, hours = 0, day = 0, dayRun = 0;
  const rows = [];
  for (const s of steps) {
    const c = E.cost({ w: s.w }, s.lvl, s.n);
    let k = 0;
    while (bank < c) {
      const cash = s.estCash * (0.6 + rnd() * 0.8);
      bank += cash * (ads && dayRun < E.DOUBLE_ADS_PER_DAY ? 2 : 1); runs++; k++; hours += s.time / 3600;
      if (runs % 2 === 0) bank += c * E.MISSION_PCT;
      if (++dayRun >= 6) { dayRun = 0; bank += c * E.DAILY_PCT[day++ % 7]; }
    }
    bank -= c;
    rows.push({ ...s, cost: c, runs: k, hours });
  }
  return { rows, runs, hours };
}
function smooth(a, win) { return a.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - win); j <= Math.min(a.length - 1, i + win); j++) { s += a[j]; c++; } return s / c; }); }

const args = process.argv.slice(2);
if (!args.includes('--scores') && !args.includes('--boss-rates') && !args.includes('--perks') && !args.includes('--survival')) {
const { steps } = plan();
if (args.includes('--fit')) {
  const TARGET = 5.0; // cheapest w=1 purchase = 5 average runs of earnings (missions & daily bring it to ~3.5-4 games)
  let e = steps.map(s => s.estCash);
  e = e.map((x, i) => smooth(e, Math.min(4, Math.floor(i / 3)))[i]); for (let i = 1; i < e.length; i++) e[i] = Math.max(e[i], e[i - 1]);
  const curve = e.map(x => +(TARGET * x / E.BASE).toFixed(3)); curve.push(curve[curve.length - 1] * 1.02);
  let src = fs.readFileSync(ECON_PATH, 'utf8');
  src = src.replace(/\/\*CURVE\*\/[\s\S]*?\/\*END\*\//, `/*CURVE*/const CURVE = [${curve.join(', ')}];/*END*/`);
  fs.writeFileSync(ECON_PATH, src);
  console.log('fitted CURVE with', curve.length, 'points; first', curve.slice(0, 5), 'last', curve.slice(-3));
  delete require.cache[require.resolve(ECON_PATH)]; E = require(ECON_PATH);
}
if (args.includes('--balance')) {
  console.log('Avg run $ / rounds by weapon at equal investment (gear+turrets at same level):');
  for (const frac of [0.25, 0.5, 1]) {
    const lv = {}; E.TRACKS.forEach(t => lv[t.id] = t.unlock ? 1 : Math.round((t.val.length - 1) * frac));
    if (frac < 1) { lv['own.laser'] = 1; }
    const line = E.WEAPONS.map(w => { const a = avg(lv, w.id, 150, 'meadow'); return `${w.id}:$${Math.round(a.cash)}/r${a.rounds.toFixed(1)}`; });
    console.log(`  upgrades ${frac * 100}%:`, line.join('  '));
  }
  // early-round vs late-round effectiveness (kill chance on a round-3 bird vs a round-14 bird) at 50% upgrades
  const lv = {}; E.TRACKS.forEach(t => lv[t.id] = t.unlock ? 1 : Math.round((t.val.length - 1) * 0.5));
  const st = { eye: V(lv, 'eye') };
  for (const r of [3, 8, 14, 20]) {
    const d = E.difficulty(r);
    console.log(`  round ${r} hit%:`, E.WEAPONS.map(w => `${w.id}:${Math.round(weaponTry(w.id, lv, d, 'bird', false, st, { v: 999, t: 0 }).p * 100)}`).join(' '),
      ' gold:', E.WEAPONS.map(w => `${w.id}:${Math.round(weaponTry(w.id, lv, d, 'gold', false, st, { v: 999, t: 0 }).p * 100)}`).join(' '));
  }
}
const out = playout(steps), outAds = playout(steps, { ads: true });
const rs = out.rows.map(r => r.runs);
const pct = q => { const s = [...rs].sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
console.log(`purchases=${E.TOTAL_LEVELS} games=${out.runs} hours=${out.hours.toFixed(1)} games/purchase avg=${(out.runs / rs.length).toFixed(2)} p10=${pct(0.1)} median=${pct(0.5)} p90=${pct(0.9)} | with 2x ads: games=${outAds.runs} hours=${outAds.hours.toFixed(1)} avg=${(outAds.runs / rs.length).toFixed(2)}`);
const unl = out.rows.filter(r => r.id.startsWith('own.') || r.id.startsWith('map.') || r.id === 'turret.slots' && r.lvl === 0 || r.id === 'loadout');
console.log('Milestones:'); unl.forEach(r => console.log(`  #${r.n + 1} ${r.name.padEnd(22)} $${r.cost.toLocaleString()} at ~${r.hours.toFixed(1)}h (equipped then: ${r.equip})`));
console.log('#   | purchase                 | cost       | avg run $ | games | rounds | min/run | hours | weapon');
const pick = args.includes('--table') ? out.rows : out.rows.filter((r, i) => i % 15 === 0 || i === out.rows.length - 1);
pick.forEach(r => console.log(`${String(r.n + 1).padStart(3)} | ${r.name.padEnd(24)} | ${String(r.cost.toLocaleString()).padStart(10)} | ${String(Math.round(r.estCash)).padStart(9)} | ${String(r.runs).padStart(5)} | ${r.rounds.toFixed(1).padStart(6)} | ${(r.time / 60).toFixed(1).padStart(7)} | ${r.hours.toFixed(1).padStart(5)} | ${r.equip}`));


// Infinity early-game: start from the free shotgun and a $0 wallet (maps stay campaign-only).
// In-cap costs match Classic, so the first re-upgrades should still take about 6 games each.
function planInf(maxBuys) {
  const lv = {}; E.TRACKS.forEach(t => lv[t.id] = 0);
  let n = 0, equip = 'shotgun', newest = 'shotgun', est = avg(lv, equip);
  const steps = [];
  const maxed = t => E.cappedTrack(t) ? lv[t.id] >= t.val.length - 1 : false;
  const avail = t => !maxed(t) && t.group !== 'map' && n >= (t.req || 0) && (!t.needs || lv[t.needs]);
  while (steps.length < maxBuys) {
    const all = E.TRACKS.filter(avail);
    if (!all.length) break;
    let pick = all.find(t => t.unlock);
    if (!pick && (lv['turret.slots'] || 0) === 0 && T('turret.slots') && avail(T('turret.slots'))) pick = T('turret.slots');
    if (!pick) {
      const focus = all.filter(t => t.group !== 'weapon' || t.of === equip || t.of === newest);
      const pool = focus.length ? focus : all;
      pool.sort((a, b) => a.w * (1 + E.PER_LEVEL * lv[a.id]) - b.w * (1 + E.PER_LEVEL * lv[b.id]));
      pick = pool[0];
    }
    const cost = E.infCost(pick, lv[pick.id], n);
    steps.push({ n, id: pick.id, name: pick.name + (pick.unlock ? '' : ' ' + (lv[pick.id] + 1)), w: pick.w, lvl: lv[pick.id], estCash: est.cash, rounds: est.rounds, time: est.time, equip, cost });
    lv[pick.id]++; n++;
    if (pick.unlock && pick.group === 'weapon') newest = pick.of;
    if (pick.group === 'weapon' || n % 8 === 0) { const b = bestWeapon(lv); equip = b.w; est = b.e; } else est = avg(lv, equip);
  }
  return { steps };
}
function playoutInf(steps, { ads = false } = {}) {
  let bank = 0, runs = 0, hours = 0, day = 0, dayRun = 0;
  const rows = [];
  for (const s of steps) {
    const c = s.cost;
    let k = 0;
    while (bank < c) {
      const cash = s.estCash * (0.6 + rnd() * 0.8);
      bank += cash * (ads && dayRun < E.DOUBLE_ADS_PER_DAY ? 2 : 1); runs++; k++; hours += s.time / 3600;
      if (runs % 2 === 0) bank += c * E.MISSION_PCT;
      if (++dayRun >= 6) { dayRun = 0; bank += c * E.DAILY_PCT[day++ % 7]; }
    }
    bank -= c;
    rows.push({ ...s, runs: k, hours });
  }
  return { rows, runs, hours };
}
if (!args.includes('--fit') && !args.includes('--balance')) {
  const { steps: infSteps } = planInf(40);
  const infOut = playoutInf(infSteps);
  const irs = infOut.rows.map(r => r.runs);
  const ipct = q => { const s = [...irs].sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
  console.log(`Infinity early (first ${irs.length} purchases, shared wallet, start from shotgun): games=${infOut.runs} hours=${infOut.hours.toFixed(1)} games/purchase avg=${(infOut.runs / irs.length).toFixed(2)} p10=${ipct(0.1)} median=${ipct(0.5)} p90=${ipct(0.9)}`);
  const first = infOut.rows[0], mid = infOut.rows[Math.min(9, infOut.rows.length - 1)];
  console.log(`  first buy ${first.name} $${first.cost.toLocaleString()} in ${first.runs} games; 10th ${mid.name} $${mid.cost.toLocaleString()} in ${mid.runs} games`);
}

} // end default economy/infinity report

// ---------- checkpoint score report (Classic, fresh runs from round 1) ----------
// Uses the game's actual scoring rules (killPts, map pts, weapon pts, turret pts,
// boss pts, perfect-round bonus, multi-shot bonus, decoy penalty). Kill/miss
// chances follow this file's existing player model, plus map-specific animals.
const KIND_INFO = {
  bird: {}, blue: {}, gold: { spd: 1.35, size: 0.85, life: 0.8 }, decoy: {},
  goose: { hp: 2, size: 1.12, spd: 0.85 },
  owl: { spd: 0.95 }, bat: { size: 0.85, spd: 1.1 },
  vulture: { size: 1.1, spd: 0.9 },
  deer: { g: 1, size: 1.6 }, swimgoose: { g: 1, size: 1.2, hp: 2, spd: 0.45 },
  rabbit: { g: 1, size: 1.25, spd: 0.9 }, wolf: { g: 1, size: 1.5, spd: 1.2, hp: 2 },
  roadrunner: { g: 1, size: 1.25, spd: 1.55 }, coyote: { g: 1, size: 1.5, spd: 1.05, hp: 2 },
  eyes: { g: 1, size: 1 },
  egg: { size: 0.7, spd: 0.55, life: 1.2 },
};
function atLeastK(a, n, k) {
  if (k <= 0) return 1;
  if (n < k || a <= 0) return 0;
  if (a >= 1) return 1;
  let term = Math.pow(1 - a, n), cdf = term;
  for (let i = 1; i < k; i++) { term = term * (n - i + 1) / i * a / (1 - a); cdf += term; }
  return Math.min(1, Math.max(0, 1 - cdf));
}
function tgtStats(d, kind, slow, st, lv, ctx) {
  const K = KIND_INFO[kind] || {};
  let s;
  if (K.g) {
    const spd = d.deerSpeed * (K.spd || 1);
    s = { speed: spd * 0.8 * (slow ? 0.38 : 1), scale: K.size || 1.6, er: 0,
      Tw: (180 / Math.max(8, spd)) * st.eye / Math.min(d.conc, 3) * (slow ? 2.2 : 1), hp: E.kindHp(kind) };
  } else {
    const lifeMul = kind === 'gold' ? 0.8 : (K.life || 1);
    const spdK = kind === 'gold' ? 1.35 : (K.spd || 1);
    const cross = (d.life * lifeMul + 0.7) / (spdK > 1 ? Math.sqrt(spdK) : 1);
    const speed = Math.hypot(202 / (cross * st.eye), d.speed * 0.6 * spdK) * (slow ? 0.38 : 1);
    const scale = d.scale * (kind === 'gold' ? 0.85 : (K.size || 1));
    s = { speed, scale, er: d.erratic, Tw: cross * st.eye / Math.min(d.conc, 3) * (slow ? 2.2 : 1), hp: E.kindHp(kind) };
  }
  return applyPerkWorld(s, kind, lv, ctx);
}
function weaponTryScore(w, lv, d, kind, slow, st, ammo, ctx) {
  const s = tgtStats(d, kind, slow, st, lv, ctx);
  const g = k => V(lv, w + '.' + k);
  const mods = gunMods(w, lv);
  const hp = s.hp || 1;
  const kHits = needHitsFor(w, lv, kind, ctx);
  let p = 0, extra = 0;
  if (w === 'shotgun') { const a = aim(g('choke'), s.scale, s.speed, s.er), n = shotAttempts(s.Tw, mods.cap, mods.reload, 0.45, ammo, lv); p = atLeastK(a, n, kHits); }
  else if (w === 'handgun') { const a = aim(g('sights'), s.scale, s.speed, s.er) * 0.8, n = shotAttempts(s.Tw, mods.cap, mods.reload, 0.26, ammo, lv); p = atLeastK(a, n, kHits); }
  else if (w === 'rifle') { const a = aim(g('caliber'), s.scale, s.speed, s.er) * 1.3, n = shotAttempts(s.Tw, mods.cap, mods.reload, 0.5, ammo, lv); p = atLeastK(a, n, kHits); extra = d.conc > 1 ? Math.min(0.4, 0.11 * (g('pierce') - 1)) : 0; }
  else if (w === 'bow') { const lead = 1 - 0.15 * Math.min(1, s.speed / 110); const a = aim(g('tip'), s.scale, s.speed, s.er) * lead * 1.35, n = shotAttempts(s.Tw, mods.cap, mods.reload, 0.3 + g('draw'), ammo, lv); p = atLeastK(a, n, kHits); extra = d.conc > 1 ? 0.08 * (g('pierce') - 1) : 0; }
  else if (w === 'mg') {
    const rate = g('rate'), r = 3 + (12 - g('spread')) * 0.2;
    if (ammo.v < 4) { ammo.v = mods.cap; ammo.t += mods.reload; }
    const Tl = Math.max(0.2, s.Tw - ammo.t); ammo.t = 0;
    const n = Math.min(12, Math.floor(Tl / rate), ammo.v), a = aim(r, s.scale, s.speed, s.er) * 0.45;
    p = atLeastK(a, n, kHits); ammo.v -= Math.max(1, Math.round(p > 0.5 ? Math.min(n, 1 / Math.max(a, 0.05)) : n));
    extra = Math.min(0.35, 0.07 * (d.conc - 1));
  } else if (w === 'laser') {
    const dwell = g('power'), k = Math.pow(s.speed / 40, 0.7) * (1 + s.er) * Math.pow(1.5 / s.scale, 0.5) / Math.pow(g('width') / 2, 0.5);
    if (ammo.v < dwell * 2) { ammo.v = mods.cap; ammo.t += mods.reload; }
    const Tl = Math.max(0.2, s.Tw - ammo.t); ammo.t = 0;
    const need = dwell * k * 1.6 * kHits;
    const p1need = dwell * k * 1.6;
    p = 1 - Math.exp(-Math.min(Tl, ammo.v) / need); ammo.v -= Math.min(ammo.v, p1need * 1.2);
    extra = Math.min(0.3, 0.06 * (d.conc - 1));
  }
  return { p: Math.min(0.97, Math.max(0, p)), extra };
}
function payKind(k) { return k === 'swimgoose' ? 'goose' : k; }
function addPts(base) { return Math.round(base / 10) * 10; }
function pickGroundMap(mapId) { const g = MAP_SET[mapId].ground; return g[Math.floor(rnd() * g.length)]; }

// Fresh Classic run from round 1. Returns score at the end of each completed round, and
// whether each checkpoint round (5/10/15/20/25/30) was started (in-game ckpt is at START).
function runScoredFrom(lv, equip, mapId, start) { return runScored(lv, equip, mapId, start); }
function runScored(lv, equip, mapId, start) {
  const M = E.MAPS.find(m => m.id === mapId);
  const st = { eye: V(lv, 'eye'), focus: V(lv, 'focus'), focusDur: T('focus').dur[lv.focus || 0], maxMiss: V(lv, 'luck') };
  const W = weaponOf(equip);
  let r = (start || 1) - 1, score = 0, missRun = 0, streak = 0, alive = true;
  let flak = V(lv, 'gadget.flak'), calls = V(lv, 'gadget.call'), decoys = V(lv, 'gadget.decoy'), boost = 0;
  const slots = V(lv, 'turret.slots');
  const turrets = ['pellet', 'tesla', 'missile'].filter(t => lv['own.' + t]).reverse().slice(0, slots);
  const ammo = { v: 0, t: 0 };
  const cap = E.CLEAR_ROUND || 30;
  const endScore = {}, started = {};
  let secondLeft = (lv['perk.second'] | 0) ? P(lv, 'perk.second') : 0;
  let deerMercy = deerMercyOf(lv);
  let saveBoost = 0;
  const award = (kind, byYou, crit) => {
    const pk = payKind(kind);
    const mult = byYou ? Math.min(Math.max(streak, 1), 5) : 1;
    let pts = E.killPts(pk, r, mult) * M.pts * (byYou ? W.pts : E.TURRET_PTS);
    if (crit) pts *= 2;
    if (byYou) pts *= comboPay(lv);
    score += addPts(pts);
  };
  const perkCrit = (lv['perk.crit'] | 0) ? P(lv, 'perk.crit') : 0;
  const hgCrit = equip === 'handgun' ? (V(lv, 'handgun.crit') || 0) : 0;
  const rollCrit = () => {
    const hg = hgCrit && rnd() < hgCrit;
    const pk = perkCrit && rnd() < perkCrit;
    return !!(hg || pk); // never 4x
  };
  while (alive && r < cap) {
    r++;
    const d0 = E.difficulty(r);
    const d = Object.assign({}, d0, {
      speed: d0.speed * M.speed,
      deerSpeed: d0.deerSpeed * M.speed,
      life: d0.life * M.life * (M.dark ? 0.9 + 0.1 * (lv.flashlight || 0) / 4 : 1),
      scale: d0.scale * M.size
    });
    started[r] = true;
    let hits = 0, total = 0, focusLeft = Math.round(st.focus * st.focusDur / 2.5);
    let tb = 0;
    turrets.forEach(t => {
      if (t === 'pellet') tb += V(lv, 'pellet.ammo') * [0.4, 0.5, 0.58, 0.66][lv['pellet.aim'] || 0] * Math.min(1, 2.5 / V(lv, 'pellet.rate') * 0.5);
      if (t === 'tesla') tb += V(lv, 'tesla.ammo') * (0.75 + 0.15 * (V(lv, 'tesla.chain') - 1)) * (V(lv, 'tesla.range') / 120);
      if (t === 'missile') tb += V(lv, 'missile.ammo') * (0.85 + V(lv, 'missile.blast') / 50) * Math.min(1, 5 / V(lv, 'missile.rate') * 0.6);
    });
    let golds = (calls > 0 && r >= 4) ? (calls--, 3) : 0;

    const resolve = (kind, canTurret) => {
      if (kind === 'decoy') {
        if (rnd() < (W.id === 'mg' ? 0.16 : 0.08)) { score -= Math.min(score, 1000 * r); streak = dropStreak(lv, streak); }
        return 'decoy';
      }
      total++;
      const slow = focusLeft > 0; if (slow) focusLeft--;
      const ctx = { missRun, maxMiss: st.maxMiss, boss: false };
      let { p, extra } = weaponTryScore(W.id, lv, d, kind, slow, st, ammo, ctx);
      if (boost > 0) { p = Math.min(0.98, p + 0.25); boost--; }
      if (saveBoost > 0) { p = Math.min(0.98, p + 0.22); saveBoost--; }
      if (rnd() < p) {
        hits++; streak++;
        award(kind, true, rollCrit());
        if (rnd() < extra) {
          const bonusKind = golds > 0 ? 'gold' : pickFlyMap(mapId);
          hits++; total++; streak++;
          award(bonusKind, true, false);
          score += 1000 * 2 * r; // multi (2 kills in one shot)
        }
        return 'hit';
      }
      if (canTurret && tb > 0 && rnd() < Math.min(1, tb) * 0.85) { tb -= 1; hits++; award(kind, false, false); return 'turret'; }
      if (missRun === st.maxMiss - 1 && flak > 0) { flak--; hits++; streak++; award(kind, true, false); return 'flak'; }
      if (missRun === st.maxMiss - 1 && decoys > 0) { decoys--; boost = 5; }
      if (isGroundKind(kind) && deerMercy > 0) { deerMercy--; return 'mercy'; }
      if (secondLeft > 0) { secondLeft--; saveBoost = 6; return 'saved'; }
      missRun++; streak = dropStreak(lv, streak);
      if (missRun >= st.maxMiss) alive = false;
      return 'miss';
    };

    if (r % E.BOSS_EVERY === 0) {
      const b = simBossFight(W.id, lv, d, st, ammo, r, M, mapId, weaponTryScore, missRun);
      const takeX = (kind) => {
        if (kind && isGroundKind(kind) && deerMercy > 0) { deerMercy--; return false; }
        if (secondLeft > 0) { secondLeft--; saveBoost = 6; return false; }
        missRun++; streak = dropStreak(lv, streak);
        return missRun >= st.maxMiss;
      };
      total++;
      if (b.killed) { hits++; score += addPts(20000 * (r / E.BOSS_EVERY) * M.pts); }
      else if (takeX()) { alive = false; break; }
      score += b.score;
      hits += b.birdsKilled; total += b.birdsKilled + b.escapes;
      if (b.escapes) { for (let e = 0; e < b.escapes && alive; e++) if (takeX()) alive = false; }
    } else {
      const queue = [];
      for (let i = 0; i < d.count; i++) {
        const x = rnd(); let k;
        if (r === 1) k = MAP_SET[mapId].fly[0][0];
        else if (golds > 0) { k = 'gold'; golds--; }
        else if (x < d.deer) k = pickGroundMap(mapId);
        else if (x < d.deer + d.decoy) k = 'decoy';
        else if (x < d.deer + d.decoy + d.gold) k = 'gold';
        else k = pickFlyMap(mapId);
        queue.push(k);
      }
      if (r >= 4 && !queue.some(k => KIND_INFO[k] && KIND_INFO[k].g))
        queue[Math.max(0, Math.floor(rnd() * queue.length))] = pickGroundMap(mapId);
      if (r >= 4 && (lv['perk.deer'] | 0)) { queue.push(pickGroundMap(mapId)); queue.push(pickGroundMap(mapId)); }
      for (let i = 0; i < queue.length && alive; i++) resolve(queue[i], true);
    }

    if (alive) {
      const perfect = total > 0 && hits === total;
      if (perfect) { score += 5000 * r; if (missRun > 0) missRun--; }
      endScore[r] = score;
      if (r >= cap) break;
    }
  }
  return { endScore, started, reached: r, alive, score };
}

function emptyLv() { const lv = {}; E.TRACKS.forEach(t => lv[t.id] = 0); return lv; }
function maxedLv() { const lv = {}; E.TRACKS.forEach(t => lv[t.id] = t.group === 'perk' ? 0 : t.val.length - 1); return lv; }
function cheapPlan(maxN, opts) {
  const lv = emptyLv();
  let n = 0, newest = 'shotgun';
  const avail = t => lv[t.id] < t.val.length - 1 && n >= (t.req || 0) && (!t.needs || lv[t.needs]) && ((opts && opts.perks) || t.group !== 'perk');
  while (n < maxN && n < E.TOTAL_LEVELS) {
    const all = E.TRACKS.filter(avail);
    if (!all.length) break;
    let pick = all.find(t => t.unlock);
    if (!pick && (lv['turret.slots'] || 0) === 0 && T('turret.slots') && avail(T('turret.slots'))) pick = T('turret.slots');
    if (!pick) {
      const ownedW = new Set(['shotgun', newest, ...E.WEAPONS.filter(w => lv['own.' + w.id]).map(w => w.id)]);
      const focus = all.filter(t => t.group !== 'weapon' || ownedW.has(t.of));
      const pool = focus.length ? focus : all;
      pool.sort((a, b) => a.w * (1 + E.PER_LEVEL * lv[a.id]) - b.w * (1 + E.PER_LEVEL * lv[b.id]));
      pick = pool[0];
    }
    lv[pick.id]++; n++;
    if (pick.unlock && pick.group === 'weapon') newest = pick.of;
  }
  return { lv, n };
}
function ownedWeapons(lv) { return E.WEAPONS.filter(w => !w.ownW || lv['own.' + w.id]).map(w => w.id); }
function describeLoadout(lv, nLabel) {
  const bits = [];
  bits.push(nLabel);
  bits.push('misses=' + V(lv, 'luck'));
  bits.push('eye x' + V(lv, 'eye'));
  bits.push('focus ' + V(lv, 'focus') + 'x');
  const gadgets = ['gadget.flak', 'gadget.call', 'gadget.decoy'].filter(id => lv[id] > 0).map(id => id.split('.')[1] + lv[id]);
  if (gadgets.length) bits.push(gadgets.join(','));
  bits.push('turret slots ' + V(lv, 'turret.slots'));
  const guns = ownedWeapons(lv).map(w => {
    const cap = lv[w + '.cap'] || 0, parts = [w + ' cap' + cap];
    return parts[0];
  });
  bits.push('owned ' + guns.join(', '));
  const maps = E.MAPS.filter(m => hasMapLv(lv, m.id)).map(m => m.name);
  bits.push('maps ' + maps.join('/'));
  return bits.join(' · ');
}
function pickBestWeapon(lv, mapId, n = 80) {
  let best = null;
  for (const w of ownedWeapons(lv)) {
    let sum = 0;
    for (let i = 0; i < n; i++) { const o = runScored(lv, w, mapId); sum += o.score; }
    const avg = sum / n;
    if (!best || avg > best.avg) best = { w, avg };
  }
  return best.w;
}
function simCell(lv, equip, mapId, n) {
  const CKS = [5, 10, 15, 20, 25, 30];
  const fin = {}, start = {}, sumEnd = {}, sumSeg = {}, nSeg = {};
  CKS.forEach(c => { fin[c] = 0; start[c] = 0; sumEnd[c] = 0; sumSeg[c] = 0; nSeg[c] = 0; });
  for (let i = 0; i < n; i++) {
    const o = runScored(lv, equip, mapId);
    CKS.forEach(c => {
      if (o.started[c]) start[c]++;
      if (o.endScore[c] != null) {
        fin[c]++;
        sumEnd[c] += o.endScore[c];
        const prev = c === 5 ? 0 : o.endScore[c - 5];
        if (c === 5 || prev != null) { sumSeg[c] += o.endScore[c] - (prev || 0); nSeg[c]++; }
      }
    });
  }
  const out = {};
  CKS.forEach(c => {
    out[c] = {
      reach: start[c] / n,          // started the checkpoint round
      finish: fin[c] / n,           // completed the round
      score: fin[c] ? sumEnd[c] / fin[c] : null,
      seg: nSeg[c] ? sumSeg[c] / nSeg[c] : null,
    };
  });
  return out;
}
function fmtN(x) { return x == null ? '—' : Math.round(x).toLocaleString('en-US'); }
function fmtPct(x) { return x == null ? '—' : (x * 100).toFixed(0) + '%'; }
function reportCheckpointScores() {
  const nArg = args.find(a => a.startsWith('--n='));
  const N = nArg ? +nArg.slice(4) : 4000;
  const midN = 40;
  const mid = cheapPlan(midN);
  const stages = [
    { id: 'new', name: 'New (starter shotgun)', lv: emptyLv(), forced: 'shotgun' },
    { id: 'mid', name: 'Mid-game (' + mid.n + ' upgrades)', lv: mid.lv, forced: null },
    { id: 'max', name: 'Late / maxed upgrades', lv: maxedLv(), forced: null },
  ];
  const maps = E.MAPS.map(m => m.id);
  console.log('SIMULATED Classic scores at checkpoints (not live telemetry).');
  console.log('Fresh runs from round 1. N=' + N + ' runs per map × loadout.');
  console.log('Scoring: killPts × map pts × weapon/turret pts, boss 20,000×(round/10)×map pts,');
  console.log('perfect +5,000×round, multi +1,000×kills×round, decoy −1,000×round.');
  console.log('Reach % = started that checkpoint round (the game saves a checkpoint at the START of 5/10/15/20/25/30).');
  console.log('Avg score = mean cumulative score at the END of that round, among runs that finished it.');
  console.log('Segment + = mean score gained in that 5-round block (1–5, 6–10, …), among those who finished the block.');
  console.log('');
  const results = {};
  for (const st of stages) {
    console.log('=== ' + st.name + ' ===');
    console.log('  ' + describeLoadout(st.lv, st.id === 'new' ? '0 upgrades' : st.id === 'mid' ? mid.n + ' upgrades (same order as the economy plan)' : E.TOTAL_LEVELS + ' upgrades, all tracks maxed'));
    const weapons = {};
    for (const mapId of maps) {
      const w = st.forced || pickBestWeapon(st.lv, mapId, 60);
      weapons[mapId] = w;
      const cell = simCell(st.lv, w, mapId, N);
      results[st.id + ':' + mapId] = { w, cell };
    }
    console.log('  Best simulated weapon per map: ' + maps.map(m => (E.MAPS.find(x => x.id === m).name) + '=' + weapons[m]).join(', '));
    console.log('');
    const head = ['Map'.padEnd(8), 'Wpn'.padEnd(8)].concat([5, 10, 15, 20, 25, 30].map(c => ('R' + c).padStart(28)));
    console.log(head.join(' | '));
    for (const mapId of maps) {
      const { w, cell } = results[st.id + ':' + mapId];
      const cols = [E.MAPS.find(m => m.id === mapId).name.padEnd(8), w.padEnd(8)];
      for (const c of [5, 10, 15, 20, 25, 30]) {
        const d = cell[c];
        const s = d.score == null ? '—' : (fmtN(d.score) + ' ' + fmtPct(d.reach) + ' +' + fmtN(d.seg));
        cols.push(s.padStart(28));
      }
      console.log(cols.join(' | '));
    }
    console.log('');
    // also a tighter reach-only reminder when start and finish diverge
    let note = [];
    for (const mapId of maps) {
      const { cell } = results[st.id + ':' + mapId];
      for (const c of [5, 10, 15, 20, 25, 30]) {
        if (cell[c].reach - cell[c].finish >= 0.02)
          note.push(E.MAPS.find(m => m.id === mapId).name + ' R' + c + ' start ' + fmtPct(cell[c].reach) + ' / finish ' + fmtPct(cell[c].finish));
      }
    }
    if (note.length) console.log('  Start vs finish (die during the checkpoint/boss round): ' + note.join('; '));
    console.log('');
  }
  // JSON dump for post-processing
  if (args.includes('--json')) console.log(JSON.stringify({ N, midN, results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { w: v.w, cell: v.cell }])) }));
}
if (args.includes('--scores')) reportCheckpointScores();

function reportBossRates() {
  const N = +(args.find(a => a.startsWith('--n=')) || '--n=5000').slice(4);
  const mid = cheapPlan(40);
  const meadow = 'meadow';
  function rateFromFresh(lv, w, n) {
    let start = 0, fin = 0, killed = 0;
    for (let i = 0; i < n; i++) {
      const o = runScored(lv, w, meadow);
      if (o.started[10]) start++;
      if (o.endScore[10] != null) fin++;
    }
    return { start: start / n, finish: fin / n };
  }
  function rateFromCkpt(lv, w, n) {
    // Begin at the start of round 10 with a clean miss bar (checkpoint / "new player who got here").
    let clear = 0, died = 0, kill = 0;
    for (let i = 0; i < n; i++) {
      const o = runScoredFrom(lv, w, meadow, 10);
      if (o.endScore[10] != null) clear++;
      else died++;
    }
    return { clear: clear / n, die: died / n };
  }
  const midR = rateFromFresh(mid.lv, 'rifle', N);
  const midC = rateFromCkpt(mid.lv, 'rifle', N);
  const newC = rateFromCkpt(emptyLv(), 'shotgun', N);
  console.log('SIMULATED boss-round clear rates (not telemetry). N=' + N);
  console.log('Mid-game (40 upgrades, rifle) Meadow fresh runs: reach R10 ' + (midR.start*100).toFixed(1) + '%  finish/clear R10 ' + (midR.finish*100).toFixed(1) + '%  (target ~87%)');
  console.log('Mid-game starting AT R10 with 0 X (checkpoint): clear ' + (midC.clear*100).toFixed(1) + '%');
  console.log('New shotgun starting AT R10 with 0 X (fairness if they get there): clear ' + (newC.clear*100).toFixed(1) + '%');
}
if (args.includes('--boss-rates')) reportBossRates();


function reportSurvival() {
  const N = +(args.find(a => a.startsWith('--n=')) || '--n=2000').slice(4);
  const mapId = (args.find(a => a.startsWith('--map=')) || '--map=meadow').slice(6);
  const marks = [10, 15, 20, 25, 30];
  const mid = cheapPlan(40);
  const typ = cheapPlan(90);
  const typGun = pickBestWeapon(typ.lv, mapId, 60);
  const stages = [
    { id: 'new', name: 'New (starter shotgun)', lv: emptyLv(), gun: 'shotgun' },
    { id: 'mid', name: 'Mid-game (40 upgrades, rifle)', lv: mid.lv, gun: 'rifle' },
    { id: 'typical', name: 'Typical progress (90 upgrades)', lv: typ.lv, gun: typGun },
  ];
  const pct = x => (x * 100).toFixed(1) + '%';
  console.log('SIMULATED Classic survival (not telemetry). Map=' + mapId + '  N=' + N + ' fresh runs from R1.');
  console.log('Reach = started that round. Clear = finished the round (started next, or alive at R30).');
  console.log('Drop = share of players who started r but did not clear it (single-round wipe).');
  // difficulty dump
  console.log('');
  console.log('Difficulty (raw, before map speed/life/size):');
  console.log('r  count speed  conc  life  errat  scale  intvl  deer  deerSp  decoy');
  for (let r = 1; r <= 30; r++) {
    const d = E.difficulty(r, mapId);
    const row = [r, d.count, d.speed, d.conc, d.life, d.erratic, d.scale, d.interval, d.deer, d.deerSpeed, d.decoy]
      .map((v, i) => i === 0 ? String(v).padStart(2) : (typeof v === 'number' ? v.toFixed(2).padStart(7) : String(v)));
    console.log(row.join(' '));
  }
  const tables = {};
  stages.forEach(st => {
    const reach = {}, clear = {}, drop = {};
    for (let r = 1; r <= 30; r++) reach[r] = clear[r] = 0;
    let loadW = st.gun;
    if (!loadW) {
      // typ.weapon may be set by cheapPlan
      loadW = st.gun;
    }
    for (let i = 0; i < N; i++) {
      const o = runScored(st.lv, st.gun, mapId);
      for (let r = 1; r <= 30; r++) {
        if (o.started[r]) reach[r]++;
        const cleared = !!(o.started[r + 1] || (o.alive && o.reached >= r));
        if (o.started[r] && cleared) clear[r]++;
      }
    }
    console.log('');
    console.log(st.name + (st.gun ? ' [' + st.gun + ']' : '') + ':');
    console.log('  r   reach   clear   drop');
    const row = { reach: {}, clear: {}, drop: {} };
    for (let r = 1; r <= 30; r++) {
      const rr = reach[r] / N, cc = clear[r] / N;
      const dr = reach[r] ? 1 - (clear[r] / reach[r]) : 0;
      row.reach[r] = rr; row.clear[r] = cc; row.drop[r] = dr;
      const mark = marks.includes(r) || (r >= 10 && r <= 15) ? ' *' : '';
      if (marks.includes(r) || (r >= 9 && r <= 16) || r === 1 || r % 5 === 0)
        console.log('  ' + String(r).padStart(2) + '  ' + pct(rr).padStart(6) + '  ' + pct(cc).padStart(6) + '  ' + pct(dr).padStart(6) + mark);
    }
    // flag big single-round drop-offs after R10 among those who arrived
    const cliffs = [];
    for (let r = 11; r <= 30; r++) {
      if (row.drop[r] >= 0.18 && row.reach[r] >= 0.05) cliffs.push('R' + r + ' drop ' + pct(row.drop[r]));
    }
    if (cliffs.length) console.log('  Notable drops after R10: ' + cliffs.join(', '));
    else console.log('  No single-round drop >=18% after R10 (among arrivals, reach>=5%).');
    tables[st.id] = row;
  });
  if (args.includes('--json')) console.log(JSON.stringify({ mapId, N, tables }));
}
if (args.includes('--survival')) reportSurvival();

function reportPerks() {
  HUMAN_RELOAD = 0.85; // model tap lag so Auto Reload is measurable
  const N = +(process.argv.find(a => a.startsWith('--n=')) || '--n=800').slice(4);
  const NB = Math.max(800, Math.round(N * 1.5));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const pct = x => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
  const pp = x => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' pp';
  function clone(lv) { return Object.assign({}, lv); }
  function withPerk(lv, id, level) { const o = clone(lv); o[id] = level; return o; }
  function gun(lv) {
    if (lv['own.rifle']) return 'rifle';
    if (lv['own.handgun']) return 'handgun';
    return 'shotgun';
  }
  function meanRun(lv, w, map, start, n) {
    let cash = 0, rounds = 0, reached = 0;
    for (let i = 0; i < n; i++) {
      const o = run(lv, w, map, start);
      cash += o.cash; rounds += o.rounds; reached += o.reached;
    }
    return { cash: cash / n, rounds: rounds / n, reached: reached / n };
  }
  function bossClear(lv, w, map, start, n) {
    let clear = 0;
    for (let i = 0; i < n; i++) {
      const o = runScored(lv, w, map, start);
      if (o.endScore[start] != null) clear++;
    }
    return clear / n;
  }
  function passBar(dR, dC, dB) {
    const okR = dR >= 0.10;
    const okC = dC >= 0.15;
    const okB = dB != null && (dB >= 0.08 || dB >= 0.15 * Math.max(0.05, 1)); // +8pp is the clear bar
    return okR || okC || (dB != null && dB >= 0.08);
  }
  console.log('SIMULATED perk impact (not telemetry). Human reload lag ' + HUMAN_RELOAD + 's without Auto Reload.');
  console.log('Bar: about +10% avg rounds, or +15% earnings, or a clearly higher boss clear (~+8 pp). L1 must pass.');
  console.log('N=' + N + ' runs, N=' + NB + ' boss trials. Same loadout with vs without the perk.\n');

  const rows = [];
  for (const perk of E.PERKS) {
    const stageN = Math.max(perk.req || 0, 40);
    const base = cheapPlan(stageN);
    const lv0 = base.lv;
    const w = gun(lv0);
    const map = 'meadow';
    // Egg Sniper / Bullet Time / Second Chance also judged at a boss-reaching stage (start at R10).
    const bossy = perk.id === 'perk.eggsnipe' || perk.id === 'perk.bullet' || perk.id === 'perk.second';
    const start = 1;
    const off = meanRun(lv0, w, map, start, N);
    const lv1 = withPerk(lv0, perk.id, 1);
    const on = meanRun(lv1, w, map, start, N);
    const dR = (on.rounds - off.rounds) / Math.max(0.01, off.rounds);
    const dC = (on.cash - off.cash) / Math.max(1, off.cash);
    let offB = null, onB = null, dB = null;
    if (bossy || perk.id === 'perk.deer' || perk.id === 'perk.auto' || perk.id === 'perk.loader' || perk.id === 'perk.reserve') {
      offB = bossClear(lv0, w, map, 10, NB);
      onB = bossClear(lv1, w, map, 10, NB);
      dB = onB - offB;
    }
    // If fresh-run earnings/rounds are muted for a boss-only perk, also compare starting at R10.
    let extra = '';
    if (bossy) {
      const off10 = meanRun(lv0, w, map, 10, N);
      const on10 = meanRun(lv1, w, map, 10, N);
      const dR10 = (on10.rounds - off10.rounds) / Math.max(0.01, off10.rounds);
      const dC10 = (on10.cash - off10.cash) / Math.max(1, off10.cash);
      extra = `  also from R10: rounds ${off10.rounds.toFixed(2)} → ${on10.rounds.toFixed(2)} (${pct(dR10)}), cash $${fmt(off10.cash)} → $${fmt(on10.cash)} (${pct(dC10)})`;
      if (dR < 0.10 && dR10 > dR) { /* prefer the matching boss stage for the pass check if better */ }
      rows.push({ perk, stageN, w, off, on, dR: Math.max(dR, dR10), dC: Math.max(dC, dC10), dB, offB, onB, rawR: dR, rawC: dC, extra, r10: { off: off10, on: on10, dR: dR10, dC: dC10 } });
    } else {
      rows.push({ perk, stageN, w, off, on, dR, dC, dB, offB, onB, extra });
    }
    const row = rows[rows.length - 1];
    const price = E.cost(perk, 0, stageN);
    const ok = passBar(row.dR, row.dC, row.dB);
    const games = price / Math.max(1, off.cash);
    console.log(perk.name + '  L1 $' + fmt(price) + ' at ' + stageN + ' upgrades (' + w + ', Meadow)' + (ok ? '  PASS' : '  FAIL'));
    console.log('  effect: ' + perk.desc(perk.val[1], 1));
    console.log('  fresh runs: rounds ' + off.rounds.toFixed(2) + ' → ' + on.rounds.toFixed(2) + ' (' + pct((on.rounds - off.rounds) / Math.max(0.01, off.rounds)) + '), cash $' + fmt(off.cash) + ' → $' + fmt(on.cash) + ' (' + pct((on.cash - off.cash) / Math.max(1, off.cash)) + ')  (~' + games.toFixed(1) + ' games to afford)');
    if (row.offB != null) console.log('  Meadow R10 start clear: ' + (row.offB * 100).toFixed(1) + '% → ' + (row.onB * 100).toFixed(1) + '% (' + pp(row.dB) + ')');
    if (row.extra) console.log(row.extra);
  }
  const failed = rows.filter(r => !passBar(r.dR, r.dC, r.dB)).map(r => r.perk.name);
  console.log('\nFailed L1 bar: ' + (failed.length ? failed.join(', ') : 'none'));
}

if (args.includes('--perks')) reportPerks();
