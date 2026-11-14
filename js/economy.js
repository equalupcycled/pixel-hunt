// Pixel Hunt - economy & difficulty config (shared by the game and tools/econ-sim.js).
'use strict';
(function (root) {
  const TRACKS = [
    { id: 'gun', name: 'Shotgun', icon: 'gun', w: 1.0,
      names: ['Single Shot', 'Double Barrel', 'Pump Action', 'Lever Action', 'Semi-Auto', 'Combat 12', 'Drum Mag'],
      val: [1, 2, 3, 4, 5, 6, 8], desc: v => `${v} shell${v > 1 ? 's' : ''} per load` },
    { id: 'reload', name: 'Quick Hands', icon: 'hand', w: 1.0,
      val: [1.4, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.62, 0.55, 0.48, 0.42, 0.36], desc: v => `Reload in ${v}s` },
    { id: 'choke', name: 'Wide Choke', icon: 'choke', w: 1.0,
      val: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], desc: v => `Shot spread ${v}px` },
    { id: 'eye', name: "Hunter's Eye", icon: 'eye', w: 1.0,
      val: [1, 1.06, 1.12, 1.18, 1.24, 1.3, 1.36, 1.43, 1.5], desc: v => v > 1 ? `Targets linger +${Math.round((v - 1) * 100)}%` : 'Targets linger longer' },
    { id: 'focus', name: 'Focus Scope', icon: 'scope', w: 1.2,
      val: [0, 1, 1, 2, 2, 3, 3], dur: [0, 2.5, 3.5, 3.5, 4.5, 4.5, 5.5],
      desc: (v, l) => v ? `${v} slow-mo/round, ${TRACKS[4].dur[l]}s` : 'Slow-mo ability (F)' },
    { id: 'luck', name: 'Lucky Feather', icon: 'feather', w: 2.5,
      val: [3, 4, 5], desc: v => `${v} misses in a row allowed` },
    { id: 'bounty', name: 'Bounty Hunter', icon: 'coin', w: 1.1,
      val: [1, 1.2, 1.4, 1.6, 1.8, 2, 2.25, 2.5, 2.75, 3], desc: v => `x${v} money` },
  ];
  const TOTAL_LEVELS = TRACKS.reduce((a, t) => a + t.val.length - 1, 0);

  // Price of the next level. Grows with the track's own level AND with every upgrade you own
  // (Vampire-Survivors-style global fee) so purchase order doesn't break the curve.
  const BASE = 3100, GROW = 1.05, PER_LEVEL = 0.03, EARLY = 1.6; // fitted to tools/econ-sim.js
  function nice(n) {
    const m = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
    return Math.round(n / m) * m;
  }
  function cost(track, level, totalBought) {
    const g = totalBought === 0 ? 1 : EARLY * Math.pow(GROW, totalBought); // first upgrade is a 'taste', then the real curve
    return nice(BASE * track.w * g * (1 + PER_LEVEL * level));
  }

  // Difficulty: climbs every round, keeps climbing after the early caps so runs always end.
  function difficulty(r) {
    const late = Math.max(0, r - 15);
    return {
      count: Math.min(3 + r, 22),
      speed: Math.min(26 + (r - 1) * 5.5, 103) + late * 3,
      conc: r < 3 ? 1 : r < 6 ? 2 : r < 10 ? 3 : r < 16 ? 4 : 5,
      life: Math.max(1.5, Math.max(2.4, 6.5 - (r - 1) * 0.3) - late * 0.06),
      erratic: Math.min(0.75, Math.max(0, (r - 2) * 0.09)),
      scale: Math.max(0.85, 1.5 - (r - 1) * 0.05),
      gold: Math.min(0.05 + r * 0.01, 0.16),
      decoy: r >= 3 ? Math.min(0.05 + (r - 3) * 0.02, 0.2) : 0,
      deer: r >= 4 ? Math.min(0.14 + (r - 4) * 0.025, 0.32) : 0,
      deerSpeed: Math.min(48 + (r - 4) * 8, 150) + late * 3,
      interval: Math.max(0.55, 1.5 - r * 0.07),
    };
  }
  const KILL = { bird: { pts: 500, cash: 5 }, blue: { pts: 750, cash: 7 }, gold: { pts: 2500, cash: 25 }, deer: { pts: 1500, cash: 15 } };
  const killCash = (kind, round, moneyMult, mult) => Math.round(KILL[kind].cash * (1 + 0.08 * (round - 1)) * moneyMult * (1 + 0.1 * (mult - 1)));
  const killPts = (kind, round, mult) => Math.round(KILL[kind].pts * (1 + (round - 1) * 0.25) * mult / 10) * 10;
  const roundBonus = (r, perfect) => Math.round((10 + r * 5 + (perfect ? 10 + r * 3 : 0)));
  const decoyPenalty = r => 15 + r * 5;

  // Side income, scaled to the cheapest next upgrade so it stays meaningful (CrazyGames guidance).
  const MISSION_PCT = 0.10;                                   // per completed mission
  const DAILY_PCT = [0.08, 0.10, 0.12, 0.14, 0.16, 0.20, 0.35]; // 7-day login calendar
  const DOUBLE_ADS_PER_DAY = 3;                                // "watch ad to 2x run earnings" cap

  const ECON = { TRACKS, TOTAL_LEVELS, cost, nice, difficulty, KILL, killCash, killPts, roundBonus, decoyPenalty,
    MISSION_PCT, DAILY_PCT, DOUBLE_ADS_PER_DAY, BASE, GROW, PER_LEVEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = ECON; else root.ECON = ECON;
})(typeof window !== 'undefined' ? window : globalThis);
