// Pixel Hunt - persistent progression: bank, upgrades, missions, achievements, daily reward, stats.
'use strict';
window.Meta = (() => {
  const E = window.ECON;
  const KEY = 'pixelhunt.save.v1';
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const dayStr = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const def = () => ({
    bank: 0, lv: Object.fromEntries(E.TRACKS.map(t => [t.id, 0])),
    stats: { runs: 0, kills: 0, gold: 0, deer: 0, perfect: 0, multi: 0, bestRound: 0, bestStreak: 0, shots: 0, hits: 0, earned: 0 },
    missions: [], mDone: 0, ach: {}, daily: { last: null, day: -1 }, ads: { date: null, doubles: 0 },
  });
  function merge(d, s) { for (const k in s) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && d[k] && typeof d[k] === 'object') merge(d[k], s[k]); else d[k] = s[k]; } return d; }
  let save = def();
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) save = merge(def(), s); } catch (e) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };

  // ---------- upgrades ----------
  const track = id => E.TRACKS.find(t => t.id === id);
  const totalBought = () => Object.values(save.lv).reduce((a, b) => a + b, 0);
  const maxed = t => save.lv[t.id] >= t.val.length - 1;
  const costOf = t => E.cost(t, save.lv[t.id], totalBought());
  const val = id => track(id).val[save.lv[id]];
  function cheapestNext() {
    const o = E.TRACKS.filter(t => !maxed(t)).map(t => ({ t, c: costOf(t) })).sort((a, b) => a.c - b.c)[0];
    return o || { t: null, c: E.cost(E.TRACKS[0], 6, E.TOTAL_LEVELS) };
  }
  const anyAffordable = () => E.TRACKS.some(t => !maxed(t) && costOf(t) <= save.bank);
  function buy(id) {
    const t = track(id); if (maxed(t)) return false;
    const c = costOf(t); if (save.bank < c) return false;
    save.bank -= c; save.lv[id]++; persist();
    return true;
  }

  // ---------- missions (3 active, Jetpack-Joyride style) ----------
  const MT = {
    kills_run: { scope: 'run', txt: n => `Hit ${n} targets in one run`, n: t => 12 + 5 * t },
    gold:      { scope: 'total', txt: n => `Shoot ${n} golden bird${n > 1 ? 's' : ''}`, n: t => 2 + t },
    deer:      { scope: 'total', txt: n => `Bag ${n} deer`, n: t => 2 + 2 * t },
    round:     { scope: 'run', txt: n => `Reach round ${n}`, n: t => 6 + t },
    streak:    { scope: 'run', txt: n => `Get a ${n}-hit streak`, n: t => 6 + 2 * t },
    score_run: { scope: 'run', txt: n => `Score ${fmt(n)} in one run`, n: t => E.nice(60000 * Math.pow(1 + t, 1.6)) },
    multi:     { scope: 'total', txt: n => `Get ${n} double kill${n > 1 ? 's' : ''}`, n: t => 1 + Math.floor(t / 2) },
    perfect:   { scope: 'total', txt: n => `Clear ${n} perfect rounds`, n: t => 2 + t },
    clean:     { scope: 'run', txt: n => `Reach round ${n} without hitting a lovebird`, n: t => 5 + t },
  };
  const tier = () => Math.floor(save.mDone / 3);
  const missionReward = () => Math.max(100, E.nice(cheapestNext().c * E.MISSION_PCT));
  function newMission() {
    const used = save.missions.map(m => m.type);
    const pool = Object.keys(MT).filter(k => !used.includes(k));
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
    { id: 'gun6', name: 'Drum Roll', txt: 'Unlock the Drum Mag', r: 0, f: () => save.lv.gun >= 6 },
    { id: 'max', name: 'Fully Loaded', txt: 'Max every upgrade', r: 0, f: () => totalBought() >= E.TOTAL_LEVELS },
  ];

  // ---------- run tracking & events ----------
  let run = null, notices = [];
  function startRun() {
    run = { kills: 0, round: 0, streak: 0, score: 0, clean: true, cleanRound: 0 };
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
      if (d.kind === 'deer') { s.deer++; save.missions.forEach(m => m.type === 'deer' && m.p++); }
      run.streak = Math.max(run.streak, d.streak || 0); s.bestStreak = Math.max(s.bestStreak, d.streak || 0);
      run.score = d.score || run.score;
    } else if (type === 'shot') { s.shots++; }
    else if (type === 'multi') { s.multi++; save.missions.forEach(m => m.type === 'multi' && m.p++); run.score = d.score || run.score; }
    else if (type === 'decoy') { run.clean = false; }
    else if (type === 'roundStart') { run.round = d.round; if (run.clean) run.cleanRound = d.round; s.bestRound = Math.max(s.bestRound, d.round); }
    else if (type === 'roundClear') { if (d.perfect) { s.perfect++; save.missions.forEach(m => m.type === 'perfect' && m.p++); } run.score = d.score || run.score; }
    check();
  }
  function endRun(o) { save.stats.runs++; save.stats.earned += Math.max(0, o.earned || 0); check(); persist(); }
  function takeNotices() { const n = notices; notices = []; if (n.length) persist(); return n; }

  // ---------- daily login calendar ----------
  function dailyStatus() {
    const today = dayStr();
    if (save.daily.last === today) return { available: false, day: save.daily.day };
    const y = new Date(); y.setDate(y.getDate() - 1);
    const day = save.daily.last === dayStr(y) ? (save.daily.day + 1) % 7 : 0;
    return { available: true, day };
  }
  const dailyAmount = day => Math.max(100, E.nice(cheapestNext().c * E.DAILY_PCT[day]));
  function claimDaily(mult = 1) {
    const st = dailyStatus(); if (!st.available) return 0;
    const amt = dailyAmount(st.day) * mult;
    save.bank += amt; save.daily = { last: dayStr(), day: st.day }; persist();
    return amt;
  }

  // ---------- rewarded "double earnings" cap ----------
  function doublesLeft() { if (save.ads.date !== dayStr()) { save.ads = { date: dayStr(), doubles: 0 }; } return E.DOUBLE_ADS_PER_DAY - save.ads.doubles; }
  function useDouble(amount) { if (doublesLeft() <= 0) return false; save.ads.doubles++; save.bank += amount; persist(); return true; }

  return {
    get save() { return save; }, persist, track, val, maxed, costOf, totalBought, cheapestNext, anyAffordable, buy,
    MT, ACH, missionText, missionReward, progressOf, startRun, event, endRun, takeNotices,
    dailyStatus, dailyAmount, claimDaily, doublesLeft, useDouble,
    reset() { save = def(); while (save.missions.length < 3) save.missions.push(newMission()); persist(); },
  };
})();
