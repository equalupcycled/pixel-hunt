// Pixel Hunt - persistent progression: bank, upgrades, missions, achievements, daily reward, stats.
'use strict';
window.Meta = (() => {
  const E = window.ECON;
  const KEY = 'pixelhunt.save.v1';
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const dayStr = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const def = () => ({
    v: 10, bank: 0, lv: Object.fromEntries(E.TRACKS.map(t => [t.id, 0])),
    stats: { runs: 0, kills: 0, gold: 0, deer: 0, perfect: 0, multi: 0, bestRound: 0, bestStreak: 0, shots: 0, hits: 0, earned: 0, bosses: 0, turretKills: 0 },
    missions: [], mDone: 0, ach: {}, daily: { last: null, day: -1 }, ads: { date: null, doubles: 0 },
    equip: { primary: 'shotgun', secondary: null, turrets: [], skin: 'classic', cross: 'white', map: 'meadow' },
    cosm: ['classic', 'white'], bestByMap: {}, bestClassic: 0, roundByMap: {}, ckpt: {}, ckptRun: {},
    cleared: {}, bestInfinityByMap: {}, roundInfinityByMap: {}, ckptInf: {},
    infBank: 0, infLv: Object.fromEntries(E.TRACKS.map(t => [t.id, 0])),
    infEquip: { primary: 'shotgun', secondary: null, turrets: [] },
    infByMap: {},
    autoBoostUntil: 0,
    adFree: false, adFreeSession: '',
  });
  function merge(d, s) { for (const k in s) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && d[k] && typeof d[k] === 'object') merge(d[k], s[k]); else d[k] = s[k]; } return d; }
  let save = def();
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) {
      // v1 -> v2 migration: shotgun tracks moved under "shotgun.*"
      if (!s.v && s.lv) {
        const map = { gun: 'shotgun.cap', reload: 'shotgun.reload', choke: 'shotgun.choke' };
        for (const k in map) if (k in s.lv) { s.lv[map[k]] = s.lv[k]; delete s.lv[k]; }
        s.v = 2;
      }
      save = merge(def(), s);
      // clamp campaign levels; Infinity levels may go past the original cap (except unlocks / turret pads / maps)
      E.TRACKS.forEach(t => { save.lv[t.id] = Math.max(0, Math.min(t.val.length - 1, save.lv[t.id] | 0)); });
      Object.keys(save.lv).forEach(k => { if (k.startsWith('map.')) return; if (!E.TRACKS.find(t => t.id === k)) delete save.lv[k]; });
      // v2 -> v3: Infinity / map-clear fields. Anyone who already reached the clear round is granted the clear (and Infinity).
      save.cleared = save.cleared || {};
      save.bestInfinityByMap = save.bestInfinityByMap || {};
      save.roundInfinityByMap = save.roundInfinityByMap || {};
      save.ckptInf = save.ckptInf || {};
      save.ckptRun = save.ckptRun || {};
      E.MAPS.forEach(m => {
        if ((save.roundByMap[m.id] || 0) >= E.CLEAR_ROUND && !save.cleared[m.id]) save.cleared[m.id] = 'migrated';
        if ((save.ckpt[m.id] || 0) > E.CLEAR_ROUND) save.ckpt[m.id] = E.CLEAR_ROUND;
      });
      // v3 -> v4: shared Infinity wallet + upgrade tree, starting from the free shotgun. Campaign lv/bank/equip are left alone.
      save.infBank = save.infBank || 0;
      save.infLv = save.infLv || {};
      E.TRACKS.forEach(t => {
        const n = Math.max(0, save.infLv[t.id] | 0);
        save.infLv[t.id] = E.cappedTrack(t) ? Math.min(t.val.length - 1, n) : n;
      });
      Object.keys(save.infLv).forEach(k => { if (!E.TRACKS.find(t => t.id === k)) delete save.infLv[k]; });
      save.infEquip = save.infEquip || { primary: 'shotgun', secondary: null, turrets: [] };
      if (!save.infEquip.primary) save.infEquip.primary = 'shotgun';
      if (!Array.isArray(save.infEquip.turrets)) save.infEquip.turrets = [];
      // v4 -> v5: Perks tracks (perk.*) are new late-game upgrades. Missing keys start at 0 on both trees.
      E.TRACKS.filter(tr => tr.group === 'perk').forEach(tr => {
        if (save.lv[tr.id] == null) save.lv[tr.id] = 0;
        if (save.infLv[tr.id] == null) save.infLv[tr.id] = 0;
      });
      save.v = Math.max(save.v || 2, 5);
      // v5 -> v6: wall-clock Auto Reload ad boost expiry (shared across Classic / Infinity).
      if (save.autoBoostUntil == null || !isFinite(+save.autoBoostUntil)) save.autoBoostUntil = 0;
      else save.autoBoostUntil = Math.max(0, +save.autoBoostUntil);
      save.v = Math.max(save.v || 2, 6);
      // v6 -> v7: dedicated weapon/turret damage tracks (*.dmg). Missing keys start at 0.
      E.TRACKS.filter(tr => tr.k === 'dmg' || tr.id.endsWith('.dmg')).forEach(tr => {
        if (save.lv[tr.id] == null) save.lv[tr.id] = 0;
        if (save.infLv[tr.id] == null) save.infLv[tr.id] = 0;
      });
      save.v = Math.max(save.v || 2, 7);
      // v7 -> v8: maps unlock by clearing the previous map, not by purchase or "own N upgrades".
      // Keep access to any map already bought (lv['map.*']) or already played. Do not refund.
      save.v = Math.max(save.v || 2, 8);
      // v8 -> v9: per-device Remove Ads flag.
      if (save.adFree == null) save.adFree = false;
      else save.adFree = !!save.adFree;
      if (save.adFreeSession == null) save.adFreeSession = '';
      else save.adFreeSession = String(save.adFreeSession || '');
      save.v = Math.max(save.v || 2, 9);
      // v9 -> v10: Infinity wallet/upgrades/equip are per map. Shared v4-v9 progress
      // moves to Meadow, or to the only Infinity map the player actually ran if that's trackable.
      save.infByMap = save.infByMap || {};
      if ((save.v || 0) < 10) {
        const lvUsed = save.infLv && Object.keys(save.infLv).some(k => (save.infLv[k] | 0) > 0);
        const eq = save.infEquip || {};
        const eqUsed = (eq.primary && eq.primary !== 'shotgun') || !!eq.secondary || (eq.turrets && eq.turrets.length);
        const sharedUsed = (save.infBank | 0) > 0 || lvUsed || eqUsed;
        if (sharedUsed) {
          const played = E.MAPS.filter(m =>
            (save.bestInfinityByMap && (save.bestInfinityByMap[m.id] | 0) > 0) ||
            (save.roundInfinityByMap && (save.roundInfinityByMap[m.id] | 0) > 0) ||
            (save.ckptInf && (save.ckptInf[m.id] | 0) > 0)
          );
          const dest = played.length === 1 ? played[0].id : 'meadow';
          const lv = Object.assign({}, save.infLv || {});
          E.TRACKS.forEach(tr => { if (lv[tr.id] == null) lv[tr.id] = 0; });
          save.infByMap[dest] = {
            bank: save.infBank | 0,
            lv,
            equip: {
              primary: (eq.primary || 'shotgun'),
              secondary: eq.secondary || null,
              turrets: Array.isArray(eq.turrets) ? eq.turrets.slice() : []
            }
          };
          save.infBank = 0;
          save.infLv = Object.fromEntries(E.TRACKS.map(tr => [tr.id, 0]));
          save.infEquip = { primary: 'shotgun', secondary: null, turrets: [] };
        }
      }
      E.MAPS.forEach(m => {
        const sl = save.infByMap[m.id];
        if (!sl) return;
        sl.bank = Math.max(0, sl.bank | 0);
        sl.lv = sl.lv || {};
        E.TRACKS.forEach(tr => {
          const n = Math.max(0, sl.lv[tr.id] | 0);
          sl.lv[tr.id] = E.cappedTrack(tr) ? Math.min(tr.val.length - 1, n) : n;
        });
        sl.equip = sl.equip || { primary: 'shotgun', secondary: null, turrets: [] };
        if (!sl.equip.primary) sl.equip.primary = 'shotgun';
        if (!Array.isArray(sl.equip.turrets)) sl.equip.turrets = [];
      });
      save.v = Math.max(save.v || 2, 10);
    }
  } catch (e) {}
  try { const ob = +localStorage.getItem('pixelhunt.best') || 0; if (ob && !save.bestByMap.meadow) save.bestByMap.meadow = ob; } catch (e) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };

  // ---------- upgrades ----------
  // mode: 'campaign' uses bank/lv/equip; 'infinity' uses a per-map wallet + tree (infByMap[map]).
  let mode = 'campaign';
  const setMode = m => { mode = m === 'infinity' ? 'infinity' : 'campaign'; };
  const isInf = () => mode === 'infinity';
  function blankInfLv() { return Object.fromEntries(E.TRACKS.map(tr => [tr.id, 0])); }
  function blankInfEquip() { return { primary: 'shotgun', secondary: null, turrets: [] }; }
  function infOf(id) {
    const mid = id || (save.equip && save.equip.map) || 'meadow';
    if (!save.infByMap) save.infByMap = {};
    if (!save.infByMap[mid]) save.infByMap[mid] = { bank: 0, lv: blankInfLv(), equip: blankInfEquip() };
    const sl = save.infByMap[mid];
    sl.lv = sl.lv || blankInfLv();
    sl.equip = sl.equip || blankInfEquip();
    if (!sl.equip.primary) sl.equip.primary = 'shotgun';
    if (!Array.isArray(sl.equip.turrets)) sl.equip.turrets = [];
    sl.bank = Math.max(0, sl.bank | 0);
    return sl;
  }
  const levels = () => isInf() ? infOf().lv : save.lv;
  const activeEquip = () => isInf() ? infOf().equip : save.equip;
  const bank = () => isInf() ? infOf().bank : save.bank;
  function setBank(n) { n = Math.max(0, Math.round(n)); if (isInf()) infOf().bank = n; else save.bank = n; }
  function addBank(n) { setBank(bank() + n); }
  function withMode(m, fn) { const prev = mode; setMode(m); try { return fn(); } finally { mode = prev; } }
  const track = id => E.TRACKS.find(t => t.id === id);
  const levelOf = id => levels()[id] || 0;
  const totalBought = () => E.TRACKS.reduce((a, t) => a + (levels()[t.id] | 0), 0);
  const maxed = t => {
    if (isInf()) return E.cappedTrack(t) && levelOf(t.id) >= t.val.length - 1;
    return levelOf(t.id) >= t.val.length - 1;
  };
  const eligible = t => {
    if (isInf() && t.group === 'map') return false;
    if (totalBought() < (t.req || 0)) return false;
    if (t.needsMap && !hasMap(t.needsMap)) return false;
    if (t.needs) {
      if (String(t.needs).startsWith('map.')) {
        if (!hasMap(t.needs.slice(4))) return false;
      } else if (levelOf(t.needs) <= 0) return false;
    }
    return true;
  };
  const owns = w => { const d = E.WEAPONS.find(x => x.id === w); return d && (!d.ownW || levelOf('own.' + w) > 0); };
  const hasTurret = id => levelOf('own.' + id) > 0;
  const playedMap = (s, id) => !!(
    (s.roundByMap && (s.roundByMap[id] | 0) > 0) ||
    (s.bestByMap && (s.bestByMap[id] | 0) > 0) ||
    (s.roundInfinityByMap && (s.roundInfinityByMap[id] | 0) > 0) ||
    (s.bestInfinityByMap && (s.bestInfinityByMap[id] | 0) > 0) ||
    (s.cleared && s.cleared[id]) ||
    (s.ckpt && (s.ckpt[id] | 0) > 0) ||
    (s.ckptInf && (s.ckptInf[id] | 0) > 0)
  );
  const hasMap = id => {
    const maps = E.MAPS;
    const i = maps.findIndex(m => m.id === id);
    if (i < 0) return false;
    if (i === 0) return true; // Meadow is always open
    const prev = maps[i - 1].id;
    if (save.cleared && save.cleared[prev]) return true;
    if ((save.lv['map.' + id] | 0) > 0) return true; // legacy purchase — keep access, no refund
    if (playedMap(save, id)) return true; // already hunted here
    return false;
  };
  const isCleared = id => !!save.cleared[id];
  function markCleared(id) {
    if (save.cleared[id]) return false;
    save.cleared[id] = dayStr(); persist(); return true;
  }
  function clearProgress(id) {
    const need = E.CLEAR_ROUND, cur = Math.min(need, save.roundByMap[id] || 0);
    return { cur, need, done: isCleared(id) };
  }
  const costOf = t => (isInf() ? E.infCost : E.cost)(t, levelOf(t.id), totalBought());
  const val = id => {
    const t = track(id);
    return isInf() ? E.infVal(t, levelOf(id)) : t.val[Math.min(levelOf(id), t.val.length - 1)];
  };
  function cheapestNext() {
    const o = E.TRACKS.filter(t => !maxed(t) && eligible(t) && t.group !== 'map').map(t => ({ t, c: costOf(t) })).sort((a, b) => a.c - b.c)[0]
      || E.TRACKS.filter(t => !maxed(t) && eligible(t)).map(t => ({ t, c: costOf(t) })).sort((a, b) => a.c - b.c)[0];
    return o || { t: null, c: E.cost(E.TRACKS[0], 6, E.TOTAL_LEVELS) };
  }
  const anyAffordable = () => E.TRACKS.some(t => !maxed(t) && eligible(t) && costOf(t) <= bank());
  function buy(id) {
    const t = track(id); if (!t || maxed(t) || !eligible(t)) return false;
    if (isInf() && t.group === 'map') return false;
    const c = costOf(t); if (bank() < c) return false;
    setBank(bank() - c); levels()[id] = levelOf(id) + 1;
    if (t.group === 'turret' && t.unlock) mountTurret(t.of, true);
    if (id === 'turret.slots') { const eq = activeEquip(); const free = E.TURRETS.filter(x => hasTurret(x.id) && !eq.turrets.includes(x.id)); if (free[0]) mountTurret(free[0].id, true); }
    persist();
    return true;
  }
  function equipWeapon(w, slot = 'primary') {
    if (!owns(w)) return false;
    const eq = activeEquip();
    if (slot === 'secondary' && !(levelOf('loadout') > 0)) return false;
    const other = slot === 'primary' ? 'secondary' : 'primary';
    if (eq[other] === w) eq[other] = eq[slot];
    eq[slot] = w;
    if (eq.primary == null) eq.primary = 'shotgun';
    persist(); return true;
  }
  function mountTurret(id, on) {
    const eq = activeEquip();
    const list = eq.turrets.filter(x => x !== id), slots = val('turret.slots');
    if (on && hasTurret(id)) { if (list.length >= slots) { if (!slots) { eq.turrets = list; return false; } list.shift(); } list.push(id); }
    eq.turrets = list; persist(); return true;
  }
  function buyCosmetic(kind, id) {
    const list = kind === 'skin' ? E.SKINS : E.CROSSHAIRS, it = list.find(x => x.id === id);
    if (!it) return false;
    if (!save.cosm.includes(id)) { if (save.bank < it.cost) return false; save.bank -= it.cost; save.cosm.push(id); }
    save.equip[kind === 'skin' ? 'skin' : 'cross'] = id; persist(); return true;
  }
  function selectMap(id) { if (!hasMap(id)) return false; save.equip.map = id; persist(); return true; }

  // ---------- missions (3 active, Jetpack-Joyride style) ----------
  const MT = {
    kills_run: { scope: 'run', txt: n => `Hit ${n} targets in one run`, n: t => 12 + 5 * t },
    gold:      { scope: 'total', txt: n => `Shoot ${n} golden bird${n > 1 ? 's' : ''}`, n: t => 2 + t },
    deer:      { scope: 'total', txt: n => `Bag ${n} ground animals (deer, wolves...)`, n: t => 2 + 2 * t },
    round:     { scope: 'run', txt: n => `Reach round ${n}`, n: t => 6 + t },
    streak:    { scope: 'run', txt: n => `Get a ${n}-hit streak`, n: t => 6 + 2 * t },
    score_run: { scope: 'run', txt: n => `Score ${fmt(n)} in one run`, n: t => E.nice(60000 * Math.pow(1 + t, 1.6)) },
    multi:     { scope: 'total', txt: n => `Get ${n} double kill${n > 1 ? 's' : ''}`, n: t => 1 + Math.floor(t / 2) },
    perfect:   { scope: 'total', txt: n => `Clear ${n} perfect rounds`, n: t => 2 + t },
    clean:     { scope: 'run', txt: n => `Reach round ${n} without hitting a lovebird`, n: t => 5 + t },
    boss:      { scope: 'total', txt: n => `Defeat ${n} boss${n > 1 ? 'es' : ''}`, n: t => 1 + Math.floor(t / 3) },
    turret:    { scope: 'total', txt: n => `Get ${n} turret kills`, n: t => 5 + 3 * t, needs: () => save.equip.turrets.length > 0 },
  };
  const tier = () => Math.floor(save.mDone / 3);
  const missionReward = () => Math.max(100, E.nice(withMode('campaign', () => cheapestNext()).c * E.MISSION_PCT));
  function newMission() {
    const used = save.missions.map(m => m.type);
    const pool = Object.keys(MT).filter(k => !used.includes(k) && (!MT[k].needs || MT[k].needs()));
    const type = pool[Math.floor(Math.random() * pool.length)];
    return { type, n: MT[type].n(tier()), p: 0 };
  }
  save.missions = save.missions.filter(m => MT[m.type]);
  while (save.missions.length < 3) save.missions.push(newMission());
  const missionText = m => MT[m.type].txt(m.n);

  // ---------- achievements (one-time) ----------
  const ACH = [
    { id: 'first', name: 'First Blood', txt: 'Hit your first bird', r: 200, f: s => s.kills >= 1 },
    { id: 'r5', name: 'Warming Up', txt: 'Reach round 5', r: 500, f: s => s.bestRound >= 5 },
    { id: 'r10', name: 'Seasoned', txt: 'Reach round 10', r: 2000, f: s => s.bestRound >= 10 },
    { id: 'r15', name: 'Veteran', txt: 'Reach round 15', r: 8000, f: s => s.bestRound >= 15 },
    { id: 'r20', name: 'Legend', txt: 'Reach round 20', r: 30000, f: s => s.bestRound >= 20 },
    { id: 'st10', name: 'On Fire', txt: '10-hit streak', r: 1500, f: s => s.bestStreak >= 10 },
    { id: 'st25', name: 'Unstoppable', txt: '25-hit streak', r: 8000, f: s => s.bestStreak >= 25 },
    { id: 'g10', name: 'Golden Touch', txt: 'Shoot 10 golden birds', r: 2000, f: s => s.gold >= 10 },
    { id: 'd25', name: 'Deer Hunter', txt: 'Bag 25 deer', r: 4000, f: s => s.deer >= 25 },
    { id: 'k1000', name: 'Thousand Club', txt: 'Hit 1,000 targets', r: 10000, f: s => s.kills >= 1000 },
    { id: 'm5', name: 'Two Birds', txt: '5 double kills', r: 1500, f: s => s.multi >= 5 },
    { id: 'runs50', name: 'Dedicated', txt: 'Play 50 runs', r: 6000, f: s => s.runs >= 50 },
    { id: 'gun6', name: 'Drum Roll', txt: 'Unlock the Drum Mag', r: 0, f: () => save.lv['shotgun.cap'] >= 6 },
    { id: 'boss1', name: 'Boss Slayer', txt: 'Defeat a boss', r: 3000, f: s => s.bosses >= 1 },
    { id: 'boss10', name: 'Boss Hunter', txt: 'Defeat 10 bosses', r: 20000, f: s => s.bosses >= 10 },
    { id: 'arsenal', name: 'Arsenal', txt: 'Own every weapon', r: 25000, f: () => E.WEAPONS.every(w => owns(w.id)) },
    { id: 'turret25', name: 'Automated', txt: '25 turret kills', r: 5000, f: s => s.turretKills >= 25 },
    { id: 'maps', name: 'Explorer', txt: 'Unlock every map', r: 30000, f: () => E.MAPS.every(m => hasMap(m.id)) },
    { id: 'night10', name: 'Night Owl', txt: 'Reach round 10 on Night Hunt', r: 15000, f: () => (save.roundByMap.night || 0) >= 10 },
    { id: 'clear1', name: 'Map Master', txt: 'Clear a map (beat the round 30 boss)', r: 25000, f: () => Object.keys(save.cleared).length >= 1 },
    { id: 'clearall', name: 'World Hunter', txt: 'Clear every map', r: 100000, f: () => E.MAPS.every(m => save.cleared[m.id]) },
    { id: 'inf10', name: 'Endless Hunt', txt: 'Reach round 10 in Infinity', r: 15000, f: () => Object.values(save.roundInfinityByMap).some(n => n >= 10) },
    { id: 'max', name: 'Fully Loaded', txt: 'Max every upgrade', r: 0, f: () => totalBought() >= E.TOTAL_LEVELS },
  ];

  // ---------- run tracking & events ----------
  let run = null, notices = [];
  function startRun(o) { // o.base = rounds skipped by starting from a checkpoint (run missions count rounds played)
    run = { kills: 0, round: 0, streak: 0, score: 0, clean: true, cleanRound: 0, base: (o && o.base) || 0 };
    save.missions.forEach(m => { if (MT[m.type].scope === 'run') m.p = 0; });
  }
  function progressOf(m) {
    switch (m.type) {
      case 'kills_run': return run ? run.kills : 0;
      case 'round': return run ? run.round : 0;
      case 'streak': return run ? run.streak : 0;
      case 'score_run': return run ? run.score : 0;
      case 'clean': return run ? run.cleanRound : 0;
      default: return m.p;
    }
  }
  function check() {
    const s = save.stats;
    save.missions.forEach((m, i) => {
      if (MT[m.type].scope === 'run') m.p = Math.max(m.p, progressOf(m));
      if (m.p >= m.n) {
        const r = missionReward();
        save.bank += r; save.mDone++;
        notices.push({ kind: 'mission', text: 'MISSION COMPLETE', sub: missionText(m), reward: r });
        save.missions[i] = null;
      }
    });
    save.missions = save.missions.filter(Boolean);
    while (save.missions.length < 3) save.missions.push(newMission());
    ACH.forEach(a => {
      if (!save.ach[a.id] && a.f(s)) {
        save.ach[a.id] = dayStr(); save.bank += a.r;
        notices.push({ kind: 'ach', text: 'ACHIEVEMENT: ' + a.name, sub: a.txt, reward: a.r });
      }
    });
  }
  function event(type, d = {}) {
    const s = save.stats;
    if (!run) startRun();
    if (type === 'kill') {
      run.kills++; s.kills++; s.hits++;
      if (d.kind === 'gold') { s.gold++; save.missions.forEach(m => m.type === 'gold' && m.p++); }
      if (d.kind === 'deer' || d.ground) { s.deer++; save.missions.forEach(m => m.type === 'deer' && m.p++); }
      run.streak = Math.max(run.streak, d.streak || 0); s.bestStreak = Math.max(s.bestStreak, d.streak || 0);
      run.score = d.score || run.score;
    } else if (type === 'shot') { s.shots++; }
    else if (type === 'multi') { s.multi++; save.missions.forEach(m => m.type === 'multi' && m.p++); run.score = d.score || run.score; }
    else if (type === 'decoy') { run.clean = false; }
    else if (type === 'roundStart') { run.round = d.round - run.base; if (run.clean) run.cleanRound = run.round; s.bestRound = Math.max(s.bestRound, d.round); }
    else if (type === 'boss') { s.bosses++; save.missions.forEach(m => m.type === 'boss' && m.p++); }
    else if (type === 'turretKill') { s.turretKills++; save.missions.forEach(m => m.type === 'turret' && m.p++); }
    else if (type === 'roundClear') { if (d.perfect) { s.perfect++; save.missions.forEach(m => m.type === 'perfect' && m.p++); } run.score = d.score || run.score; }
    check();
  }
  function endRun(o) {
    const m = o.map || save.equip.map;
    const ranked = o.ranked !== false;
    if (o.cleared && !o.infinity && !o.skipCleared) markCleared(m);
    if (o.deferScore) { check(); persist(); return; }
    if (o.infinity) {
      if (ranked) save.bestInfinityByMap[m] = Math.max(save.bestInfinityByMap[m] || 0, o.score || 0);
      save.roundInfinityByMap[m] = Math.max(save.roundInfinityByMap[m] || 0, o.round || 0);
    } else {
      if (ranked) {
        save.bestByMap[m] = Math.max(save.bestByMap[m] || 0, o.score || 0);
        save.bestClassic = Math.max(save.bestClassic || 0, o.score || 0);
      }
      save.roundByMap[m] = Math.max(save.roundByMap[m] || 0, o.round || 0);
    }
    if (!o.skipStats) { save.stats.runs++; save.stats.earned += Math.max(0, o.earned || 0); }
    check(); persist(); }
  function takeNotices() { const n = notices; notices = []; if (n.length) persist(); return n; }

  // ---------- daily login calendar ----------
  function dailyStatus() {
    const today = dayStr();
    if (save.daily.last === today) return { available: false, day: save.daily.day };
    const y = new Date(); y.setDate(y.getDate() - 1);
    const day = save.daily.last === dayStr(y) ? (save.daily.day + 1) % 7 : 0;
    return { available: true, day };
  }
  const dailyAmount = day => Math.max(100, E.nice(withMode('campaign', () => cheapestNext()).c * E.DAILY_PCT[day]));
  function claimDaily(mult = 1) {
    const st = dailyStatus(); if (!st.available) return 0;
    const amt = dailyAmount(st.day) * mult;
    save.bank += amt; save.daily = { last: dayStr(), day: st.day }; persist();
    return amt;
  }

  // ---------- rewarded "double earnings" cap ----------
  function doublesLeft() { if (save.ads.date !== dayStr()) { save.ads = { date: dayStr(), doubles: 0 }; } return E.DOUBLE_ADS_PER_DAY - save.ads.doubles; }
  function useDouble(amount) { if (doublesLeft() <= 0) return false; save.ads.doubles++; addBank(amount); persist(); return true; }


  // ---------- Auto Reload rewarded boost (15 real wall-clock minutes) ----------
  let nowFn = () => Date.now();
  const AUTO_BOOST_MS = 15 * 60 * 1000;
  let boostMs = AUTO_BOOST_MS;
  function now() { return nowFn(); }
  function setNow(fnOrMs) {
    if (typeof fnOrMs === 'function') nowFn = fnOrMs;
    else if (fnOrMs == null) nowFn = () => Date.now();
    else { const n = +fnOrMs; nowFn = () => n; }
  }
  function setAutoBoostMs(ms) { boostMs = (ms > 0) ? +ms : AUTO_BOOST_MS; return boostMs; }
  function autoBoostUntil() { return +save.autoBoostUntil || 0; }
  function autoBoostLeft() { return Math.max(0, autoBoostUntil() - now()); }
  function autoBoostActive() { return autoBoostLeft() > 0; }
  function grantAutoBoost() { save.autoBoostUntil = now() + boostMs; persist(); return save.autoBoostUntil; }
  function clearAutoBoost() { save.autoBoostUntil = 0; persist(); }
  function ownsAutoReload() { return levelOf('perk.auto') > 0; }

  if (save.equip && !hasMap(save.equip.map)) {
    const owned = E.MAPS.filter(m => hasMap(m.id));
    save.equip.map = (owned[owned.length - 1] || E.MAPS[0]).id;
  }


  const isAdFree = () => !!save.adFree || !!window.ADS_OFF; // ADS_OFF: store build with no ad SDK yet
  function grantAdFree(source) {
    save.adFree = true;
    save.adFreeSession = String(source || 'simulated');
    persist();
    return true;
  }
  function clearAdFree() { save.adFree = false; save.adFreeSession = ''; persist(); }

  return {
    get save() { return save; }, persist, track, val, maxed, costOf, totalBought, cheapestNext, anyAffordable, buy,
    eligible, owns, hasTurret, hasMap, isCleared, markCleared, clearProgress, equipWeapon, mountTurret, buyCosmetic, selectMap,
    setMode, get mode() { return mode; }, isInf, bank, setBank, addBank, levelOf, activeEquip, withMode, infOf,
    MT, ACH, missionText, missionReward, progressOf, startRun, event, endRun, takeNotices,
    dailyStatus, dailyAmount, claimDaily, doublesLeft, useDouble,
    now, setNow, AUTO_BOOST_MS, setAutoBoostMs, autoBoostUntil, autoBoostLeft, autoBoostActive, grantAutoBoost, clearAutoBoost, ownsAutoReload,
    isAdFree, grantAdFree, clearAdFree,
    reset() { save = def(); mode = 'campaign'; while (save.missions.length < 3) save.missions.push(newMission()); persist(); },
  };
})();
