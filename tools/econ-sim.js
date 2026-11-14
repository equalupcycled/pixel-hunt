// Monte Carlo economy sim for Pixel Hunt's arsenal.
//   node tools/econ-sim.js            summary + sampled table
//   node tools/econ-sim.js --table    every purchase
//   node tools/econ-sim.js --fit      re-fit the price CURVE in js/economy.js
//   node tools/econ-sim.js --balance  compare weapons at equal investment
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

function aim(radius, scale, speed, erratic) {
  return Math.min(0.97, Math.max(0.02, 1.05 * Math.pow(radius / 5, 0.4) * Math.pow(scale / 1.5, 0.6) * Math.pow(26 / speed, 0.55) * (1 - 0.25 * erratic)));
}
function attempts(Tw, cap, reload, shotT) {
  const cycle = cap * shotT + reload, t = Math.max(0, Tw - shotT);
  return Math.min(6, 1 + Math.floor(t / cycle) * cap + Math.min(cap - 1, Math.floor((t % cycle) / shotT)));
}
// probability that the equipped weapon kills a target, plus per-kill modifiers
function weaponTry(w, lv, d, kind, slow, st, ammo) {
  const g = k => V(lv, w + '.' + k);
  // Flyers cross left -> right: on-screen time = (linger + 0.7s) x Eye; apparent speed = crossing speed + vertical zig.
  const cross = (d.life * (kind === 'gold' ? 0.8 : 1) + 0.7) / (kind === 'gold' ? Math.sqrt(1.35) : 1);
  const speed = (kind === 'deer' ? d.deerSpeed * 0.8 : Math.hypot(202 / (cross * st.eye), d.speed * 0.6 * (kind === 'gold' ? 1.35 : 1))) * (slow ? 0.38 : 1);
  const scale = kind === 'deer' ? 1.6 : d.scale * (kind === 'gold' ? 0.85 : 1);
  const er = kind === 'deer' ? 0 : d.erratic;
  const Tw = (kind === 'deer' ? 180 / d.deerSpeed : cross) * st.eye / Math.min(d.conc, 3) * (slow ? 2.2 : 1);
  let p = 0, extra = 0;
  if (w === 'shotgun') p = 1 - Math.pow(1 - aim(g('choke'), scale, speed, er), attempts(Tw, g('cap'), g('reload'), 0.45));
  else if (w === 'handgun') p = 1 - Math.pow(1 - aim(g('sights'), scale, speed, er) * 0.8, attempts(Tw, g('cap'), g('reload'), 0.26));
  else if (w === 'rifle') { p = 1 - Math.pow(1 - aim(g('caliber'), scale, speed, er) * 1.3, attempts(Tw, g('cap'), g('reload'), 0.5)); extra = d.conc > 1 ? Math.min(0.4, 0.11 * (g('pierce') - 1)) : 0; }
  else if (w === 'bow') { const lead = 1 - 0.15 * Math.min(1, speed / 110); p = 1 - Math.pow(1 - aim(g('tip'), scale, speed, er) * lead * 1.35, attempts(Tw, g('cap'), g('reload'), 0.3 + g('draw'))); extra = d.conc > 1 ? 0.08 * (g('pierce') - 1) : 0; }
  else if (w === 'mg') {
    const rate = g('rate'), r = 3 + (12 - g('spread')) * 0.2;
    if (ammo.v < 4) { ammo.v = g('cap'); ammo.t += g('reload'); }
    const Tl = Math.max(0.2, Tw - ammo.t); ammo.t = 0;
    const n = Math.min(12, Math.floor(Tl / rate), ammo.v), a = aim(r, scale, speed, er) * 0.45;
    p = 1 - Math.pow(1 - a, n); ammo.v -= Math.max(1, Math.round(p > 0.5 ? Math.min(n, 1 / Math.max(a, 0.05)) : n));
    extra = Math.min(0.35, 0.07 * (d.conc - 1));
  } else if (w === 'laser') {
    const dwell = g('power'), k = Math.pow(speed / 40, 0.7) * (1 + er) * Math.pow(1.5 / scale, 0.5) / Math.pow(g('width') / 2, 0.5);
    if (ammo.v < dwell * 2) { ammo.v = g('cap'); ammo.t += g('reload'); }
    const Tl = Math.max(0.2, Tw - ammo.t); ammo.t = 0;
    const need = dwell * k * 1.6;
    p = 1 - Math.exp(-Math.min(Tl, ammo.v) / need); ammo.v -= Math.min(ammo.v, need * 1.2);
    extra = Math.min(0.3, 0.06 * (d.conc - 1));
  }
  return { p, extra };
}
function weaponOf(w) { return E.WEAPONS.find(x => x.id === w); }
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
  while (alive && r < cap) {
    r++; const d0 = E.difficulty(r); const d = Object.assign({}, d0, { speed: d0.speed * M.speed, deerSpeed: d0.deerSpeed * M.speed, life: d0.life * M.life * (M.dark ? 0.9 + 0.1 * (lv.flashlight || 0) / 4 : 1), scale: d0.scale * M.size });
    if (r % E.BOSS_EVERY === 0) { // boss: needs bossHp hits within bossTime
      const hp = E.bossHp(r), pr = weaponTry(W.id, lv, d, 'deer', false, st, { v: 999, t: 0 }).p;
      const shots = E.bossTime(r) * (W.id === 'mg' || W.id === 'laser' ? 1.6 : 1.1) * pr;
      if (shots >= hp || rnd() < shots / hp * 0.5) cash += E.bossCash(r) * st.mm * M.cash * W.cash; else { missRun++; if (missRun >= st.maxMiss) { alive = false; break; } }
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
    for (let i = 0; i < d.count && alive; i++) {
      const x = rnd(); let kind = 'bird';
      if (golds > 0) { kind = 'gold'; golds--; }
      else if (r > 1) { if (x < d.deer) kind = 'deer'; else if (x < d.deer + d.decoy) kind = 'decoy'; else if (x < d.deer + d.decoy + d.gold) kind = 'gold'; else if (rnd() < 0.3) kind = 'blue'; }
      if (kind === 'decoy') { if (rnd() < (W.id === 'mg' ? 0.16 : 0.08)) cash -= Math.min(cash, E.decoyPenalty(r)); continue; }
      total++;
      const slow = focusLeft > 0; if (slow) focusLeft--;
      let { p, extra } = weaponTry(W.id, lv, d, kind, slow, st, ammo);
      if (boost > 0) { p = Math.min(0.98, p + 0.25); boost--; }
      const pay = (k, m) => E.killCash(k, r, st.mm, m) * M.cash * W.cash * (k === 'deer' && W.deerBonus ? W.deerBonus : 1) * (k === 'gold' && W.goldBonus ? W.goldBonus : 1);
      if (rnd() < p) {
        hits++; streak++;
        let c = pay(kind, Math.min(streak, 5));
        if (W.id === 'handgun') c *= 1 + V(lv, 'handgun.crit');
        cash += c;
        if (rnd() < extra) { cash += pay('bird', Math.min(streak, 5)); i++; hits++; total++; }
        time += d.life * 0.35 / d.conc + d.interval / d.conc;
      } else {
        time += d.life / d.conc;
        if (tb > 0 && rnd() < Math.min(1, tb) * 0.85) { tb -= 1; cash += pay(kind, 1) * E.TURRET_CASH; continue; }
        if (missRun === st.maxMiss - 1 && flak > 0) { flak--; hits++; cash += pay(kind, 1) * 1.5; continue; }
        if (missRun === st.maxMiss - 1 && decoys > 0) { decoys--; boost = 5; }
        missRun++; if (W.id !== 'bow') streak = 0;
        if (missRun >= st.maxMiss) alive = false;
      }
    }
    time += 3.6;
    if (alive) { cash += E.roundBonus(r, hits === total); if (hits === total && missRun > 0) missRun--; }
  }
  return { cash, rounds: r - start + 1, reached: r, time };
}
function bestMap(lv) { return E.MAPS.filter(m => !m.w || lv['map.' + m.id]).slice(-1)[0].id; }
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
