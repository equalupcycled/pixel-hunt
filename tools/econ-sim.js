// Monte Carlo economy sim for Pixel Hunt. Usage: node tools/econ-sim.js [--table]
// Models an "average" player: aim accuracy falls with target speed/size/erratic paths, more shells
// and faster reloads give more attempts per target, run ends after N escapes in a row.
const E = require('../js/economy.js');
const rnd = Math.random;
function stats(lv) {
  const v = id => E.TRACKS.find(t => t.id === id).val[lv[id]];
  return { shells: v('gun'), reload: v('reload'), radius: v('choke'), eye: v('eye'), focus: v('focus'),
    focusDur: E.TRACKS[4].dur[lv.focus], maxMiss: v('luck'), mm: v('bounty') };
}
function pTarget(st, d, kind, slow) {
  const speed = (kind === 'deer' ? d.deerSpeed * 0.8 : d.speed * (kind === 'gold' ? 1.35 : 1)) * (slow ? 0.38 : 1);
  const scale = kind === 'deer' ? 1.6 : d.scale * (kind === 'gold' ? 0.85 : 1);
  const a = Math.min(0.97, Math.max(0.03, 1.05 * Math.pow(st.radius / 5, 0.4) * Math.pow(scale / 1.5, 0.6) *
    Math.pow(26 / speed, 0.55) * (kind === 'deer' ? 1 : 1 - 0.25 * d.erratic)));
  let T = (kind === 'deer' ? (180 / (d.deerSpeed)) : d.life * (kind === 'gold' ? 0.8 : 1)) * st.eye / Math.min(d.conc, 3) * (slow ? 2.2 : 1);
  const cycle = st.shells * 0.45 + st.reload;
  let n = 1 + Math.floor(Math.max(0, T - 0.45) / cycle) * st.shells + Math.min(st.shells - 1, Math.floor((Math.max(0, T - 0.45) % cycle) / 0.45));
  n = Math.min(n, 5);
  return 1 - Math.pow(1 - a, n);
}
function run(lv) {
  const st = stats(lv);
  let r = 0, cash = 0, time = 0, missRun = 0, streak = 0, alive = true, kills = 0;
  while (alive && r < 200) {
    r++; const d = E.difficulty(r);
    let hits = 0, total = 0, focusLeft = Math.round(st.focus * st.focusDur / 2.5);
    for (let i = 0; i < d.count && alive; i++) {
      const x = rnd(); let kind = 'bird';
      if (r > 1) { if (x < d.deer) kind = 'deer'; else if (x < d.deer + d.decoy) kind = 'decoy'; else if (x < d.deer + d.decoy + d.gold) kind = 'gold'; else if (rnd() < 0.3) kind = 'blue'; }
      if (kind === 'decoy') { if (rnd() < 0.08) cash -= Math.min(cash, E.decoyPenalty(r)); continue; }
      total++;
      const slow = focusLeft > 0; if (slow) focusLeft--;
      const p = pTarget(st, d, kind, slow);
      if (rnd() < p) { hits++; kills++; missRun = 0; streak++; cash += E.killCash(kind, r, st.mm, Math.min(streak, 5)); time += d.life * 0.35 / d.conc + d.interval / d.conc; }
      else { missRun++; streak = 0; time += d.life / d.conc; if (missRun >= st.maxMiss) alive = false; }
    }
    time += 3.6;
    if (alive) cash += E.roundBonus(r, hits === total);
  }
  return { cash, rounds: r, time, kills };
}
function avg(lv, n = 400) {
  let c = 0, r = 0, t = 0; const arr = [];
  for (let i = 0; i < n; i++) { const o = run(lv); c += o.cash; r += o.rounds; t += o.time; arr.push(o.cash); }
  arr.sort((a, b) => a - b);
  return { cash: c / n, median: arr[n >> 1], rounds: r / n, time: t / n };
}
// Progression: player buys the cheapest available upgrade when affordable; earns missions (~1 per 2 runs)
// and a daily login reward every ~6 runs. Rewarded 2x ad NOT counted (reported separately).
function progression({ withSide = true, ads = false } = {}) {
  const lv = {}; E.TRACKS.forEach(t => lv[t.id] = 0);
  let bank = 0, runs = 0, hours = 0, bought = 0, sinceBuy = 0, dayRun = 0, dayIdx = 0;
  const rows = [];
  const nextOpts = () => E.TRACKS.filter(t => lv[t.id] < t.val.length - 1).map(t => ({ t, c: E.cost(t, lv[t.id], bought) })).sort((a, b) => a.c - b.c);
  let est = avg(lv, 300);
  while (bought < E.TOTAL_LEVELS && runs < 5000) {
    const opts = nextOpts(); const next = opts[0];
    const o = run(lv); runs++; sinceBuy++; hours += o.time / 3600; bank += o.cash * (ads && dayRun < E.DOUBLE_ADS_PER_DAY ? 2 : 1);
    if (withSide) {
      if (runs % 2 === 0) bank += Math.round(next.c * E.MISSION_PCT);
      if (++dayRun >= 6) { dayRun = 0; bank += Math.round(next.c * E.DAILY_PCT[dayIdx++ % 7]); }
    }
    while (bought < E.TOTAL_LEVELS) {
      const nx = nextOpts()[0];
      if (bank < nx.c) break;
      bank -= nx.c;
      rows.push({ n: bought + 1, item: nx.t.name + ' ' + (lv[nx.t.id] + 1), cost: nx.c, earn: Math.round(est.cash), ratio: +(nx.c / est.cash).toFixed(1), effRuns: +(nx.c / (est.cash + (withSide ? nx.c * (E.MISSION_PCT / 2 + 0.02) : 0))).toFixed(1), runs: sinceBuy, rounds: +est.rounds.toFixed(1), runMin: +(est.time / 60).toFixed(1), hours: +hours.toFixed(1) });
      lv[nx.t.id]++; bought++; sinceBuy = 0; est = avg(lv, 300);
    }
  }
  return { rows, runs, hours };
}

const modes = [['no ads', {}], ['2x ad on 3 runs/day', { ads: true }]];
for (const [name, opt] of modes) {
  const res = progression(opt);
  const rs = res.rows.map(r => r.runs);
  console.log(`[${name}] upgrades=${E.TOTAL_LEVELS} totalRuns=${res.runs} totalHours=${res.hours.toFixed(1)} runsPerUpgrade avg=${(res.runs / res.rows.length).toFixed(2)} min=${Math.min(...rs)} max=${Math.max(...rs)}`);
  if (name === 'no ads') {
    const pick = process.argv.includes('--table') ? res.rows : res.rows.filter((r, i) => i % 4 === 0 || i === res.rows.length - 1);
    console.log('#  | upgrade bought           | cost     | avg run $ | cost/run | eff runs* | actual runs | avg rounds | run min | hours');
    pick.forEach(r => console.log(`${String(r.n).padStart(2)} | ${r.item.padEnd(24)} | ${String(r.cost).padStart(8)} | ${String(r.earn).padStart(9)} | ${String(r.ratio).padStart(8)} | ${String(r.effRuns).padStart(9)} | ${String(r.runs).padStart(11)} | ${String(r.rounds).padStart(10)} | ${String(r.runMin).padStart(7)} | ${r.hours}`));
    console.log('* eff runs = cost / (avg run earnings + mission & daily income per run)');
  }
}
