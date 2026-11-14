// Pixel Hunt - original retro pixel hunting game. All art drawn in code.
'use strict';
(() => {
const $ = id => document.getElementById(id);
const cvs = $('game'), ctx = cvs.getContext('2d');
const wrap = $('wrap');
const W = 180;                 // logical width in game pixels
let H = 390, S = 2, U = 2;     // logical height, device px per game px, css px per game px
let GROUND = 320, SKY_TOP = 34, SKY_BOT = 290, BAR = 30;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.round(n).toLocaleString('en-US');
const store = {
  get(k, d) { try { const v = localStorage.getItem('pixelhunt.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pixelhunt.' + k, JSON.stringify(v)); } catch (e) {} },
};

// ---------------- pixel font (3x5) ----------------
const G = {
  A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',
  F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',
  K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',
  P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',
  U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',
  Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110',
  '4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111',
  '9':'111101111001110','+':'000010111010000','-':'000000111000000','!':'010010010000010','$':'011110010011110',
  ':':'000010000010000','.':'000000000000010',',':'000000000010100','/':'001001010100100','?':'110001010000010',
  '%':'101001010100101',"'":'010010000000000',' ':'000000000000000','>':'100010001010100','<':'001010100010001',
};
function drawStr(s, x, y, sz) {
  for (let i = 0; i < s.length; i++) {
    const g = G[s[i]] || G['?'];
    for (let r = 0; r < 5; r++) {
      let run = -1;
      for (let c = 0; c <= 3; c++) {
        const on = c < 3 && g[r * 3 + c] === '1';
        if (on && run < 0) run = c;
        if (!on && run >= 0) { ctx.fillRect(x + i * 4 * sz + run * sz, y + r * sz, (c - run) * sz, sz); run = -1; }
      }
    }
  }
}
function text(str, x, y, sz = 1, color = '#fff', align = 'left', shadow = '#000') {
  const s = String(str).toUpperCase();
  const w = s.length * 4 * sz - sz;
  const sx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  if (shadow) { ctx.fillStyle = shadow; drawStr(s, sx + Math.max(0.5, sz * 0.5), y + Math.max(0.5, sz * 0.5), sz); }
  ctx.fillStyle = color; drawStr(s, sx, y, sz);
  return w;
}

// ---------------- sprites ----------------
function makeSprite(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const k = r[x]; if (pal[k]) { g.fillStyle = pal[k]; g.fillRect(x, y, 1, 1); } } });
  return c;
}
const BIRD_UP = [
  '.....KK.........',
  '....KWWK........',
  '....KWWWK.......',
  '.....KWWWK..KKK.',
  '......KWWKKKGGGK',
  'KKK..KBBBBBKGEGY',
  'KBBKKBBBBBBBKGKY',
  '.KBBBBBBWWWBBK..',
  '..KBBBBWWWWBK...',
  '...KKBBBBBBK....',
  '.....KKKKKK.....',
  '......O..O......'];
const BIRD_DN = [
  '................',
  '................',
  '............KKK.',
  '...........KGGGK',
  'KKK..KKKKKKKGEGY',
  'KBBKKBBBBBBBKGKY',
  '.KBBBBBBBBBBBK..',
  '..KBBBKWWWWBK...',
  '...KKKWWWWK.....',
  '.....KWWWK......',
  '....KWWK........',
  '.....KK.........'];
const BIRD_HIT = [
  '....K......K....',
  '...KWK....KWK...',
  '...KWWK..KWWK...',
  '....KWWKKWWK....',
  '.....KBBBBK.KKK.',
  '....KBBBBBBKGGGK',
  '...KBBBBBBBKGXGY',
  '...KBBWWWBBBKGKY',
  '....KBBWWBBK....',
  '.....KKBBKK.....',
  '.......KK.......',
  '......O..O......'];
const PAL = {
  bird:  { K: '#111', B: '#9a5a26', W: '#e9d6a8', G: '#1f8a45', E: '#fff', Y: '#ffb000', O: '#ff8a00', X: '#fff' },
  gold:  { K: '#3a2400', B: '#f2b705', W: '#fff4b0', G: '#ffe066', E: '#fff', Y: '#ff7a00', O: '#ff7a00', X: '#fff' },
  decoy: { K: '#5a1838', B: '#ff8fc8', W: '#ffe0f0', G: '#ff5aa8', E: '#fff', Y: '#ffd23f', O: '#ffd23f', X: '#fff' },
  blue:  { K: '#111', B: '#2c5fbf', W: '#bfe3ff', G: '#e0303a', E: '#fff', Y: '#ffb000', O: '#ff8a00', X: '#fff' },
};
const DEER_A = [
  '...............K..K.',
  '...............KK.K.',
  '................KKK.',
  '...............KDDK.',
  '...............KDEDK',
  '.KK...........KDDDDN',
  'KTDKKKKKKKKKKKDDDKK.',
  '.KDDDDDDDDDDDDDDK...',
  '..KDDDDDDDDDDDDDK...',
  '..KDLLLLLLLLLLDDK...',
  '..KDDKKKKKKKKKDK....',
  '.KDK..........KDK...',
  'KDK............KDK..',
  'KK..............KK..'];
const DEER_B = DEER_A.slice(0, 10).concat([
  '...KDDKKKKKKKDDK....',
  '...KDK......KDK.....',
  '...KDK......KDK.....',
  '...KK.......KK......']);
const DEER_PAL = { K: '#2a1405', D: '#b06a2c', L: '#f0d2a0', E: '#111', N: '#111', T: '#fff' };
const SPR = {};
for (const k of Object.keys(PAL)) SPR[k] = [makeSprite(BIRD_UP, PAL[k]), makeSprite(BIRD_DN, PAL[k]), makeSprite(BIRD_HIT, PAL[k])];
SPR.deer = [makeSprite(DEER_A, DEER_PAL), makeSprite(DEER_B, DEER_PAL)];
const SHELL = makeSprite(['.RR.', 'RRRR', 'RRRR', 'RRRR', 'RHRR', 'RRRR', 'KKKK', 'YYYY', 'YYYY'], { R: '#d8342a', H: '#ff8a7a', K: '#222', Y: '#e8b923' });
const SHELL_E = makeSprite(['.KK.', 'K..K', 'K..K', 'K..K', 'K..K', 'K..K', 'KKKK', 'KKKK', 'KKKK'], { K: '#55606e' });
const ICON = (c) => makeSprite(['.KK.....', 'KCCK.KK.', '.KCCKCCK', '..KCCCK.', '...KKK..'], { K: '#000', C: c });
const ICON_P = ICON('#fff'), ICON_H = ICON('#ff4040'), ICON_E = ICON('#4a4a4a');

function spr(img, cx, cy, sc = 1, flip = false, flipV = false, alpha = 1) {
  const w = img.width * sc, h = img.height * sc;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.scale(flip ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
}

// ---------------- background ----------------
let bg = null, fg = null, clouds = [];
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function buildBg() {
  bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const g = bg.getContext('2d'); const r = seeded(7);
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); };
  // sky bands with dithered seams
  const bands = ['#2b6fd6', '#3a82e6', '#4b95f0', '#62a9f6', '#7fc0fb', '#a2d6ff'];
  const top = 0, bot = GROUND - 10, bh = (bot - top) / bands.length;
  bands.forEach((c, i) => px(0, top + i * bh, W, bh + 1, c));
  for (let i = 1; i < bands.length; i++) {
    const y0 = Math.round(top + i * bh);
    g.fillStyle = bands[i];
    for (let x = 0; x < W; x += 2) g.fillRect(x + ((y0 / 1) % 2), y0 - 2, 1, 1);
    for (let x = 0; x < W; x += 2) g.fillRect(x, y0 - 1, 1, 1);
  }
  // sun
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 36) px(150 + x, 52 + y, 1, 1, (x * x + y * y > 25) ? '#ffe9a0' : '#fff6cf');
  // distant hills
  for (let x = 0; x < W; x++) {
    const h1 = 26 + Math.sin(x * 0.045) * 8 + Math.sin(x * 0.13) * 3;
    px(x, GROUND - h1, 1, h1, '#7bbf9a');
    const h2 = 16 + Math.sin(x * 0.07 + 2) * 6;
    px(x, GROUND - h2, 1, h2, '#5fa87e');
  }
  // trees
  const canopy = (cx, cy, rad, dark, mid, light) => {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      const d = x * x + y * y; if (d > rad * rad) continue;
      let c = mid;
      if (d > (rad - 1.5) ** 2 || (x + y > rad * 0.6 && r() < 0.7)) c = dark;
      else if (x + y < -rad * 0.4 && r() < 0.65) c = light;
      else if (r() < 0.08) c = dark;
      px(cx + x, cy + y, 1, 1, c);
    }
  };
  const roundTree = (x, s) => {
    const th = 10 + s * 0.6, base = GROUND + 2;
    px(x - 2, base - th, 4, th, '#5a3415'); px(x - 2, base - th, 1, th, '#3d220c');
    canopy(x, base - th - s * 0.6, s, '#145c2a', '#22803a', '#4cb04a');
    canopy(x - s * 0.6, base - th - s * 0.2, s * 0.7, '#145c2a', '#22803a', '#4cb04a');
    canopy(x + s * 0.6, base - th - s * 0.25, s * 0.7, '#145c2a', '#1d7535', '#3fa043');
  };
  const pine = (x, s) => {
    const base = GROUND + 2;
    px(x - 1, base - 8, 3, 8, '#4a2a10');
    for (let i = 0; i < 4; i++) {
      const ty = base - 6 - i * s * 0.55, w = s * (1 - i * 0.2);
      for (let y = 0; y < s * 0.8; y++) {
        const ww = Math.round(w * (y / (s * 0.8)));
        for (let xx = -ww; xx <= ww; xx++) px(x + xx, ty - s * 0.8 + y, 1, 1, xx < -ww * 0.3 ? '#2f8a4a' : xx > ww * 0.6 ? '#0f4a26' : '#17623a');
      }
    }
  };
  pine(14, 12); roundTree(40, 13); pine(70, 10); roundTree(100, 10); pine(124, 13); roundTree(158, 15);
  // bushes along tree line
  for (let x = -4; x < W + 8; x += 9) canopy(x, GROUND + 1, 5 + ((x * 7) % 3), '#145c2a', '#2c8f3c', '#58c050');
  // ground
  px(0, GROUND + 3, W, H - GROUND, '#3f9a2e');
  for (let y = GROUND + 3; y < H; y += 3) for (let x = (y % 6); x < W; x += 6) px(x, y, 1, 1, '#358525');

  // foreground tall grass (drawn over birds rising & deer legs)
  fg = document.createElement('canvas'); fg.width = W; fg.height = H;
  const f = fg.getContext('2d');
  const fp = (x, y, w, h, c) => { f.fillStyle = c; f.fillRect(x | 0, y | 0, w, h); };
  const gy = GROUND + 10;
  fp(0, gy, W, H - gy, '#4caf34');
  for (let y = gy + 4; y < H; y += 4) for (let x = (y % 8); x < W; x += 8) { fp(x, y, 2, 1, '#3d9a2a'); fp(x + 4, y + 2, 1, 1, '#69c84a'); }
  const rr = seeded(3);
  for (let x = 0; x < W; x += 2) {
    const h = 3 + Math.floor(rr() * 6);
    fp(x, gy - h, 1, h, rr() < 0.5 ? '#4caf34' : '#3a9428');
    if (rr() < 0.3) fp(x, gy - h, 1, 1, '#8ee06a');
  }
  // little flowers
  for (let i = 0; i < 14; i++) { const x = rr() * W, y = gy + 4 + rr() * 22; fp(x, y, 1, 1, rr() < 0.5 ? '#fff' : '#ffd23f'); }

  // clouds
  clouds = [];
  for (let i = 0; i < 4; i++) clouds.push({ img: makeCloud(28 + i * 7, 9 + (i % 2) * 3), x: rand(0, W), y: Math.round(40 + i * 32 + rand(-6, 6)), v: rand(2, 5) });
}
function makeCloud(w, h) {
  const c = document.createElement('canvas'); c.width = w + 4; c.height = h + 6; const g = c.getContext('2d');
  const blob = (cx, cy, r, col) => { g.fillStyle = col; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) g.fillRect(cx + x, cy + y, 1, 1); };
  const n = Math.max(3, Math.round(w / 8));
  for (let i = 0; i < n; i++) blob(4 + i * (w - 6) / (n - 1), h * 0.7 + 1, Math.round(h * 0.35) + 1, '#cfe6ff');
  for (let i = 0; i < n; i++) blob(4 + i * (w - 6) / (n - 1), h * 0.6, Math.round(h * 0.35) + (i % 2), '#ffffff');
  blob(w * 0.45, h * 0.4, Math.round(h * 0.4), '#ffffff');
  g.fillStyle = '#cfe6ff'; g.fillRect(2, Math.round(h * 0.95), w, 1);
  return c;
}

// ---------------- sizing ----------------
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  let cw = Math.min(vw, vh * 0.62);
  H = Math.round(clamp(W * vh / cw, 300, 420));
  let ch = cw * H / W;
  if (ch > vh) { ch = vh; cw = ch * W / H; }
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  S = cw * dpr / W; U = cw / W;
  cvs.width = Math.round(W * S); cvs.height = Math.round(H * S);
  cvs.style.width = cw + 'px'; cvs.style.height = ch + 'px';
  wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
  wrap.style.setProperty('--u', U + 'px');
  GROUND = H - 72; BAR = 30; SKY_TOP = 34; SKY_BOT = GROUND - 26;
  buildBg();
}
window.addEventListener('resize', resize);

// ---------------- upgrades ----------------
const UPG = ECON.TRACKS;
const ICONS = {
  gun: ['................', '................', '.KKKKKKKKKKKK...', 'KSSSSSSSSSSSSKKK', '.KKKKKKKKWWWWWWK', '.........KWWKWWK', '..........KK.KWK', '..............KK'],
  hand: ['....KK.KK.......', '...KYYKYYK......', '...KYYKYYKKK....', '.KKKYYKYYKYYK...', 'KYYKYYYYYKYYK...', 'KYYYYYYYYYYYK...', '.KYYYYYYYYYK....', '..KKYYYYYYK.....', '....KKKKKK......'],
  choke: ['......KKKK......', '....KK....KK....', '...K..K..K..K...', '..K....KK....K..', '..K...KRRK...K..', '..K....KK....K..', '...K..K..K..K...', '....KK....KK....', '......KKKK......'],
  scope: ['.....KKKKKK.....', '...KKCCCCCCKK...', '..KCCCCKCCCCCK..', '..KCCCCKCCCCCK..', '..KKKKKKKKKKKK..', '..KCCCCKCCCCCK..', '...KKCCKCCCKK...', '.....KKKKKK.....'],
  feather: ['...........KK...', '.........KKWWK..', '.......KKWWWWK..', '.....KKWWWWWK...', '....KWWWWWKK....', '...KWWWWKK......', '..KWWKKK........', '.KKK............', 'K...............'],
  eye: ['................', '....KKKKKKKK....', '..KKWWWWWWWWKK..', '.KWWWWKKKKWWWWK.', 'KWWWWKCCCCKWWWWK', '.KWWWWKKKKWWWWK.', '..KKWWWWWWWWKK..', '....KKKKKKKK....'],
  coin: ['.....KKKKK......', '...KKYYYYYKK....', '..KYYYKKKYYYK...', '..KYYKYYYYYYK...', '..KYYYKKKYYYK...', '..KYYYYYYKYYK...', '..KYYYKKKYYYK...', '...KKYYYYYKK....', '.....KKKKK......'],
};
const ICON_PAL = { K: '#000', S: '#8d97a8', W: '#8a4b1c', E: '#fff', Y: '#ffd23f', R: '#ff3b3b', C: '#8fd3ff' };

// ---------------- game state ----------------
let state = 'title', paused = false;
let best = store.get('best', 0);
let score, runCash = 0, focusDur = 3, eyeMult = 1, round, shells, maxShells, reloading, reloadT, reloadTime, radius, maxMiss, moneyMult;
let focusCharges, focusMax, focusT, missRun, streak, bestStreak, reviveUsed;
let shots, hits, roundHits, roundEsc, roundTotal, queue, spawnT, spawnInt, conc, diff;
let introT = 0, clearT = 0, dieT = 0, banner = '', banner2 = '';
let targets = [], parts = [], floats = [], flashes = [];
let shake = 0, hitStop = 0, skyFlash = 0, whiteFlash = 0, cursor = null, lastTouch = 0, contTimer = null;

function resetRun() {
  score = 0; runCash = 0; round = 0; shots = 0; hits = 0; streak = 0; bestStreak = 0;
  applyUpgrades(); shells = maxShells; reloading = false; missRun = 0; reviveUsed = false;
  targets = []; parts = []; floats = [];
}
function applyUpgrades() {
  const v = Meta.val;
  maxShells = v('gun'); reloadTime = v('reload'); radius = v('choke'); focusMax = v('focus'); maxMiss = v('luck'); moneyMult = v('bounty');
  eyeMult = v('eye'); focusDur = ECON.TRACKS.find(t => t.id === 'focus').dur[Meta.save.lv.focus] || 3;
}
function addCash(n) { Meta.save.bank = Math.max(0, Meta.save.bank + n); runCash += n; }

const difficulty = ECON.difficulty;

function startRound() {
  round++;
  diff = difficulty(round);
  queue = [];
  for (let i = 0; i < diff.count; i++) {
    const x = Math.random();
    let k = 'bird';
    if (round === 1) k = 'bird';
    else if (x < diff.deer) k = 'deer';
    else if (x < diff.deer + diff.decoy) k = 'decoy';
    else if (x < diff.deer + diff.decoy + diff.gold) k = 'gold';
    else if (Math.random() < 0.3) k = 'blue';
    queue.push(k);
  }
  if (round >= 4 && !queue.includes('deer')) queue[Math.floor(rand(1, queue.length))] = 'deer';
  roundTotal = queue.filter(k => k !== 'decoy').length;
  roundHits = 0; roundEsc = 0; spawnT = 0.6;
  shells = maxShells; reloading = false; focusCharges = focusMax; focusT = 0;
  state = 'intro'; introT = 1.6; banner = 'ROUND ' + round;
  banner2 = round === 1 ? 'TAP TO SHOOT' : round === 4 ? 'DEER IN THE WOODS!' : round === 3 ? "DON'T SHOOT PINK BIRDS" : '';
  Sfx.roundStart();
  showGameButtons(true);
  Meta.event('roundStart', { round }); notify();
}

function spawn(kind) {
  if (kind === 'deer') {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const sp = diff.deerSpeed * rand(0.9, 1.15) / Math.sqrt(eyeMult);
    targets.push({ kind, x: dir > 0 ? -20 : W + 20, y: GROUND + 1, vx: dir * sp, vy: 0, sc: 1.6, state: 'fly', anim: 0, life: 99, hop: 0 });
    Sfx.deer();
    return;
  }
  const sp = diff.speed * rand(0.85, 1.15) * (kind === 'gold' ? 1.35 : 1);
  const ang = rand(-Math.PI * 0.8, -Math.PI * 0.2);
  targets.push({ kind, x: rand(24, W - 24), y: GROUND + 16, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, sp,
    sc: diff.scale * (kind === 'gold' ? 0.85 : 1), state: 'fly', anim: rand(0, 1), life: diff.life * eyeMult * (kind === 'gold' ? 0.8 : 1),
    erratic: Math.random() < diff.erratic, turnT: rand(0.4, 1), risen: false });
}

function alive() { return targets.filter(t => t.state === 'fly' || t.state === 'flee').length; }

// ---------------- input ----------------
function toLogical(e) {
  const r = cvs.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
let downInfo = null;
cvs.addEventListener('pointerdown', e => {
  e.preventDefault(); Sfx.init();
  const p = toLogical(e);
  if (e.pointerType !== 'mouse') lastTouch = performance.now();
  downInfo = { y: p.y, t: performance.now() };
  if (paused) return;
  if (state === 'play' || state === 'intro') {
    if (p.y > H - BAR) return;
    shoot(p.x, p.y);
  }
});
cvs.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') cursor = toLogical(e); });
cvs.addEventListener('pointerleave', () => cursor = null);
cvs.addEventListener('pointerup', e => {
  if (!downInfo) return;
  const p = toLogical(e);
  if (p.y - downInfo.y > 40 && performance.now() - downInfo.t < 600 && (state === 'play' || state === 'intro')) startReload();
  downInfo = null;
});
window.addEventListener('keydown', e => {
  if (e.code === 'KeyR' || e.code === 'Space') { e.preventDefault(); startReload(); }
  if (e.code === 'KeyF') useFocus();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) Meta.persist();
  if (document.hidden && !paused && (state === 'play' || state === 'intro')) togglePause(); });

function startReload() {
  if (paused || !(state === 'play' || state === 'intro')) return;
  if (reloading || shells >= maxShells) return;
  reloading = true; reloadT = reloadTime; Sfx.reloadStart();
}
function useFocus() {
  if (paused || state !== 'play' || focusCharges <= 0 || focusT > 0) return;
  focusCharges--; focusT = focusDur; Sfx.focus();
  floats.push({ text: 'FOCUS!', x: W / 2, y: H / 2 - 40, t: 0, life: 1, color: '#c9a7ff', sz: 2 });
}

function shoot(x, y) {
  if (reloading) { Sfx.empty(); floats.push({ text: 'RELOADING', x, y: y - 8, t: 0, life: 0.5, color: '#ccc', sz: 1 }); return; }
  if (shells <= 0) { Sfx.empty(); floats.push({ text: 'RELOAD!', x, y: y - 8, t: 0, life: 0.6, color: '#ff9a3d', sz: 1.2 }); return; }
  shells--; shots++; Meta.event('shot');
  Sfx.shot();
  shake = Math.max(shake, 3); whiteFlash = 0.06;
  flashes.push({ x, y, t: 0 });
  const hitList = [];
  for (const t of targets) {
    if (t.state !== 'fly' && t.state !== 'flee') continue;
    const img = t.kind === 'deer' ? SPR.deer[0] : SPR.bird[0];
    const hw = img.width * t.sc / 2 - 1, hh = img.height * t.sc / 2 - 1;
    const dx = Math.max(Math.abs(x - t.x) - hw, 0), dy = Math.max(Math.abs(y - t.y) - hh, 0);
    if (dx * dx + dy * dy <= radius * radius) hitList.push(t);
  }
  const good = hitList.filter(t => t.kind !== 'decoy');
  const bad = hitList.filter(t => t.kind === 'decoy');
  if (good.length) {
    hitStop = 0.05;
    good.forEach((t, i) => kill(t, i));
    if (good.length > 1) {
      const b = 1000 * good.length * round;
      score += b;
      floats.push({ text: (good.length === 2 ? 'DOUBLE!' : 'MULTI X' + good.length) + ' +' + fmt(b), x: W / 2, y: H / 2 - 60, t: 0, life: 1.3, color: '#7dff7a', sz: 1.5 });
      Meta.event('multi', { n: good.length, score });
    }
  }
  bad.forEach(t => {
    t.state = 'hit'; t.hitT = 0.3; t.vy = 0;
    const pen = Math.min(Meta.save.bank, ECON.decoyPenalty(round));
    addCash(-pen); streak = 0; Meta.event('decoy');
    const sp = Math.min(score, 1000 * round); score -= sp;
    floats.push({ text: 'LOVEBIRD! -$' + pen, x: t.x, y: t.y - 14, t: 0, life: 1.4, color: '#ff8fc8', sz: 1.2 });
    feathers(t.x, t.y, PAL.decoy, 14);
    Sfx.bad();
  });
  if (!hitList.length) {
    streak = 0;
    floats.push({ text: 'MISS', x, y: y - 6, t: 0, life: 0.7, color: '#fff', sz: 1.5 });
  }
  if (shells === 0 && !reloading) setTimeout(() => { if (shells === 0 && !reloading && state === 'play') floats.push({ text: 'RELOAD!', x: W - 32, y: H - BAR - 12, t: 0, life: 0.8, color: '#ff9a3d', sz: 1.2 }); }, 250);
}

function kill(t, i) {
  hits++; roundHits++; missRun = 0; streak++; bestStreak = Math.max(bestStreak, streak);
  const mult = Math.min(streak, 5);
  const pts = ECON.killPts(t.kind, round, mult);
  const m = ECON.killCash(t.kind, round, moneyMult, mult);
  score += pts; addCash(m);
  Meta.event('kill', { kind: t.kind, streak, score }); setTimeout(notify, 400);
  t.state = 'hit'; t.hitT = t.kind === 'deer' ? 0.2 : 0.35;
  const yo = i * 10;
  floats.push({ text: 'HIT! +' + fmt(pts), x: t.x, y: t.y - 16 - yo, t: 0, life: 1.1, color: t.kind === 'gold' ? '#ffd23f' : '#ffe066', sz: 1.3 });
  floats.push({ text: '+$' + m, x: t.x, y: t.y - 8 - yo, t: 0, life: 1.1, color: '#7dff7a', sz: 1 });
  if (t.kind === 'gold') { floats.push({ text: 'GOLDEN!', x: t.x, y: t.y - 24 - yo, t: 0, life: 1.2, color: '#fff2a0', sz: 1.5 }); Sfx.gold(); }
  if (streak >= 2) { floats.push({ text: 'STREAK X' + mult, x: W / 2, y: SKY_TOP + 14, t: 0, life: 1, color: '#ff9a3d', sz: 1.6 }); Sfx.streak(mult); }
  if (t.kind === 'deer') { Sfx.deer(); for (let k = 0; k < 14; k++) parts.push({ x: t.x, y: t.y, vx: rand(-40, 40), vy: rand(-70, -10), c: Math.random() < 0.5 ? '#b06a2c' : '#f0d2a0', t: 0, life: rand(0.4, 0.8), g: 220, s: 1.5 }); }
  else { feathers(t.x, t.y, PAL[t.kind], 16); Sfx.hit(); Sfx.squawk(); }
}
function feathers(x, y, pal, n) {
  const cols = [pal.B, pal.W, pal.G, pal.B];
  for (let k = 0; k < n; k++) parts.push({ x, y, vx: rand(-55, 55), vy: rand(-60, 20), c: cols[k % cols.length], t: 0, life: rand(0.7, 1.4), g: 60, s: rand(1, 2), sway: rand(0, 6) });
}

function escaped(t) {
  t.state = 'gone';
  if (state !== 'play' && state !== 'intro') return;
  if (t.kind === 'decoy') { floats.push({ text: 'SAFE', x: clamp(t.x, 20, W - 20), y: SKY_TOP + 6, t: 0, life: 0.9, color: '#ff8fc8', sz: 1 }); return; }
  missRun++; roundEsc++; streak = 0;
  skyFlash = 0.5;
  floats.push({ text: 'GOT AWAY', x: clamp(t.x, 26, W - 26), y: t.kind === 'deer' ? GROUND - 20 : SKY_TOP + 8, t: 0, life: 1.2, color: '#ff5a5a', sz: 1.5 });
  Sfx.escape();
  if (missRun >= maxMiss) die();
}

function die() {
  state = 'dying'; dieT = 1.6; banner = 'GAME OVER'; banner2 = missRun + ' IN A ROW GOT AWAY';
  shake = 6; Sfx.gameOver(); showGameButtons(false);
}

// ---------------- update ----------------
function update(dt) {
  for (const c of clouds) { c.x += c.v * dt; if (c.x > W + 10) c.x = -c.img.width - 10; }
  if (paused) return;
  let gdt = dt;
  if (focusT > 0) { focusT -= dt; gdt *= 0.38; }
  if (hitStop > 0) { hitStop -= dt; gdt = 0; }
  if (reloading) { reloadT -= dt; if (reloadT <= 0) { reloading = false; shells = maxShells; Sfx.reloadDone(); } }
  shake = Math.max(0, shake - dt * 25); skyFlash = Math.max(0, skyFlash - dt); whiteFlash = Math.max(0, whiteFlash - dt);

  if (state === 'title') {
    if (targets.length < 3 && Math.random() < 0.02) {
      const sp = rand(25, 45), a = rand(0, Math.PI * 2);
      targets.push({ kind: Math.random() < 0.2 ? 'gold' : Math.random() < 0.3 ? 'blue' : 'bird', x: rand(20, W - 20), y: rand(SKY_TOP + 60, SKY_BOT), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, sp, sc: 1.2, state: 'fly', anim: 0, life: 1e9, risen: true, erratic: true, turnT: 1, attract: true });
    }
  } else if (state === 'intro') {
    introT -= dt; if (introT <= 0) state = 'play';
  } else if (state === 'play') {
    spawnT -= gdt;
    if (spawnT <= 0 && queue.length && alive() < diff.conc) { spawn(queue.shift()); spawnT = diff.interval * rand(0.8, 1.2); }
    if (!queue.length && targets.length === 0) roundClear();
  } else if (state === 'clear') {
    clearT -= dt; if (clearT <= 0) { if (Meta.anyAffordable()) openShop(); else startRound(); }
  } else if (state === 'dying') {
    dieT -= dt; if (dieT <= 0) { state = 'ad'; onDeath(); }
  }

  if (state !== 'ad' && state !== 'over' && state !== 'shop') for (const t of targets) updTarget(t, gdt);
  targets = targets.filter(t => t.state !== 'gone');
  for (const p of parts) { p.t += gdt; p.vy += p.g * gdt; p.vx *= 1 - 1.5 * gdt; p.x += (p.vx + (p.sway ? Math.sin(p.t * 8) * p.sway * 4 : 0)) * gdt; p.y += p.vy * gdt; }
  parts = parts.filter(p => p.t < p.life);
  for (const f of floats) { f.t += dt; f.y -= 12 * dt; }
  floats = floats.filter(f => f.t < f.life);
  for (const f of flashes) f.t += dt;
  flashes = flashes.filter(f => f.t < 0.12);
}

function updTarget(t, dt) {
  t.anim += dt;
  if (t.kind === 'deer') {
    if (t.state === 'fly') {
      t.x += t.vx * dt;
      t.hop = Math.abs(Math.sin(t.anim * 12)) * 3;
      if ((t.vx > 0 && t.x > W + 24) || (t.vx < 0 && t.x < -24)) escaped(t);
    } else if (t.state === 'hit') { t.hitT -= dt; if (t.hitT <= 0) { t.state = 'fall'; t.fallT = 0.9; } }
    else if (t.state === 'fall') { t.fallT -= dt; t.x += t.vx * 0.15 * dt; if (t.fallT <= 0) t.state = 'gone'; }
    return;
  }
  if (t.state === 'fly') {
    t.life -= dt;
    if (t.erratic) {
      t.turnT -= dt;
      if (t.turnT <= 0) { const a = rand(0, Math.PI * 2); t.vx = Math.cos(a) * t.sp; t.vy = Math.sin(a) * t.sp * 0.8; t.turnT = rand(0.35, 0.9); }
    }
    t.x += t.vx * dt; t.y += t.vy * dt;
    if (t.y < SKY_BOT) t.risen = true;
    if (t.x < 10) t.vx = Math.abs(t.vx);
    if (t.x > W - 10) t.vx = -Math.abs(t.vx);
    if (t.y < SKY_TOP + 8) t.vy = Math.abs(t.vy);
    if (t.risen && t.y > SKY_BOT) t.vy = -Math.abs(t.vy);
    if (!t.risen && t.vy > -5) t.vy = -t.sp * 0.6;
    if (t.life <= 0 && !t.attract) { t.state = 'flee'; t.vy = -Math.max(60, t.sp * 1.6); t.vx *= 0.3; }
  } else if (t.state === 'flee') {
    t.x += t.vx * dt; t.y += t.vy * dt;
    if (t.y < -20) escaped(t);
  } else if (t.state === 'hit') {
    t.hitT -= dt;
    if (t.hitT <= 0) { t.state = 'fall'; t.vy = 20; Sfx.fall(); }
  } else if (t.state === 'fall') {
    t.vy += 320 * dt; t.y += t.vy * dt;
    if (t.y > GROUND + 14) { t.state = 'gone'; Sfx.thud(); }
  }
}

function roundClear() {
  state = 'clear'; clearT = 2.0;
  const perfect = roundHits === roundTotal;
  const bonusCash = ECON.roundBonus(round, perfect);
  addCash(bonusCash);
  banner = perfect ? 'PERFECT!' : 'ROUND CLEAR';
  banner2 = '+$' + bonusCash + (perfect ? '  +' + fmt(5000 * round) : '');
  if (perfect) score += 5000 * round;
  Sfx.clear(); showGameButtons(false);
  Meta.event('roundClear', { perfect, score }); Meta.persist(); notify();
}

// ---------------- overlays / UI ----------------
const ov = id => $(id);
function show(id, on) { ov(id).classList.toggle('hidden', !on); }
function showGameButtons(on) {
  show('btn-pause', on); show('btn-reload', on); show('btn-focus', on && focusMax > 0);
}
function iconCanvas(key) {
  const c = makeSprite(ICONS[key], ICON_PAL); return c;
}
let shopFrom = 'round';
function openShop(from = 'round') {
  shopFrom = from;
  if (from === 'round') state = 'shop';
  $('shop-money').textContent = fmt(Meta.save.bank);
  const nx = Meta.cheapestNext();
  $('shop-sub').textContent = from === 'round' ? `ROUND ${round} CLEARED \u00b7 NEXT: ROUND ${round + 1}` + (round + 1 === 4 ? ' (DEER!)' : '')
    : `UPGRADES ARE PERMANENT \u00b7 ${Meta.totalBought()}/${ECON.TOTAL_LEVELS} OWNED`;
  $('btn-next').innerHTML = from === 'round' ? 'NEXT ROUND &#9654;' : 'BACK';
  const list = $('shop-list'); list.innerHTML = '';
  UPG.forEach(u => {
    const l = Meta.save.lv[u.id], maxed = Meta.maxed(u), c = maxed ? 0 : Meta.costOf(u);
    const cur = u.names ? u.names[l] : u.desc(u.val[l], l);
    const next = maxed ? 'MAXED' : 'Next: ' + (u.names ? u.names[l + 1] + ' (' + u.desc(u.val[l + 1], l + 1) + ')' : u.desc(u.val[l + 1], l + 1));
    const el = document.createElement('div'); el.className = 'item' + (!maxed && Meta.save.bank >= c ? ' can' : '');
    const ic = makeSprite(ICONS[u.icon], ICON_PAL);
    const pct = maxed ? 100 : Math.min(100, Math.floor(Meta.save.bank / c * 100));
    const mid = document.createElement('div');
    mid.innerHTML = `<div class="nm">${u.name.toUpperCase()} <span class="lvl">LV ${l}/${u.val.length - 1}</span></div><div class="ds">${cur}</div><div class="ds dim">${next}</div>
      <div class="pips">${u.val.slice(1).map((_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div>
      ${maxed ? '' : `<div class="prog"><i style="width:${pct}%"></i></div>`}`;
    const b = document.createElement('button'); b.className = 'pbtn' + (maxed ? ' max' : '');
    b.textContent = maxed ? 'MAX' : '$' + fmt(c);
    b.disabled = maxed || Meta.save.bank < c;
    b.dataset.id = u.id;
    b.addEventListener('click', () => {
      if (!Meta.buy(u.id)) return;
      applyUpgrades(); shells = maxShells; Sfx.buy(); notify(); openShop(shopFrom);
      toast('UPGRADED!', u.name + ' LV ' + Meta.save.lv[u.id], 0);
    });
    el.append(ic, mid, b); list.appendChild(el);
  });
  show('ov-shop', true);
}
$('btn-next').addEventListener('click', () => { Sfx.click(); show('ov-shop', false); if (shopFrom === 'round') startRound(); else if (shopFrom === 'over') show('ov-over', true); else toTitle(); });

function onDeath() {
  if (!reviveUsed && Ads.rewardedAvailable()) {
    show('ov-continue', true);
    let n = 8; $('cont-count').textContent = n;
    clearInterval(contTimer);
    contTimer = setInterval(() => { n--; $('cont-count').textContent = n; if (n <= 0) { declineContinue(); } }, 1000);
  } else {
    Ads.showInterstitial().then(gameOver);
  }
}
function declineContinue() {
  clearInterval(contTimer); show('ov-continue', false);
  Ads.showInterstitial().then(gameOver);
}
$('btn-norevive').addEventListener('click', () => { Sfx.click(); declineContinue(); });
$('btn-revive').addEventListener('click', () => {
  Sfx.click(); clearInterval(contTimer); show('ov-continue', false);
  reviveUsed = true;
  Ads.showRewarded().then(ok => { if (ok) revive(); else gameOver(); });
});
function revive() {
  missRun = 0; streak = 0;
  targets = targets.filter(t => t.state === 'fall' || t.state === 'hit');
  shells = maxShells; reloading = false;
  state = 'intro'; introT = 1.4; banner = 'SECOND CHANCE!'; banner2 = 'ROUND ' + round;
  Sfx.roundStart(); showGameButtons(true);
}
let earnedShown = 0;
function gameOver() {
  state = 'over';
  const isBest = score > best;
  if (isBest) { best = score; store.set('best', best); }
  Meta.endRun({ score, round, earned: runCash });
  $('go-score').textContent = fmt(score); $('go-best').textContent = fmt(best);
  $('go-round').textContent = round; $('go-hits').textContent = hits;
  $('go-acc').textContent = shots ? Math.round(hits / shots * 100) + '%' : '0%';
  earnedShown = Math.max(0, runCash);
  $('go-earned').textContent = '+$' + fmt(earnedShown);
  show('newbest', isBest && score > 0);
  const dbl = $('btn-double'), left = Meta.doublesLeft();
  dbl.classList.toggle('hidden', earnedShown <= 0);
  dbl.disabled = left <= 0;
  dbl.innerHTML = left > 0 ? `&#9654; WATCH AD: 2X EARNINGS<br><small>+$${fmt(earnedShown)} MORE \u00b7 ${left} LEFT TODAY</small>` : '2X USED UP TODAY<br><small>COMES BACK TOMORROW</small>';
  renderNext('go-next'); renderMissions('go-missions');
  show('ov-over', true); notify();
}
function renderNext(id) {
  const nx = Meta.cheapestNext(), el = $(id);
  if (!nx.t) { el.innerHTML = '<div class="nx-t">ALL UPGRADES MAXED!</div>'; return; }
  const pct = Math.min(100, Math.floor(Meta.save.bank / nx.c * 100));
  el.innerHTML = `<div class="nx-t${pct >= 100 ? ' ready' : ''}">${pct >= 100 ? 'READY TO BUY: ' : 'BANK $' + fmt(Meta.save.bank) + ' \u00b7 NEXT: '}${nx.t.name.toUpperCase()} $${fmt(nx.c)}</div><div class="prog big"><i style="width:${pct}%"></i><span>${pct}%</span></div>`;
}
function renderMissions(id) {
  $(id).innerHTML = Meta.save.missions.map(m => {
    const p = Math.min(m.n, Meta.MT[m.type].scope === 'run' ? m.p : m.p);
    return `<div class="ms"><div class="ms-t">${Meta.missionText(m)}</div><div class="ms-r">$${fmt(Meta.missionReward())}</div>
      <div class="prog"><i style="width:${Math.floor(p / m.n * 100)}%"></i></div><div class="ms-p">${fmt(p)}/${fmt(m.n)}${Meta.MT[m.type].scope === 'run' ? ' (one run)' : ''}</div></div>`;
  }).join('');
}
$('btn-double').addEventListener('click', () => {
  Sfx.click();
  Ads.showRewarded().then(ok => {
    if (ok && Meta.useDouble(earnedShown)) { $('go-earned').textContent = '+$' + fmt(earnedShown * 2) + ' (2X!)'; Sfx.gold(); toast('EARNINGS DOUBLED!', '+$' + fmt(earnedShown), 0); }
    $('btn-double').classList.add('hidden'); renderNext('go-next');
  });
});
$('btn-go-shop').addEventListener('click', () => { Sfx.click(); show('ov-over', false); openShop('over'); });

// ---------- toasts / notices ----------
const toastQ = []; let toastBusy = false;
function toast(title, sub, reward) {
  toastQ.push({ title, sub, reward }); if (!toastBusy) nextToast();
}
function nextToast() {
  const t = toastQ.shift(); const el = $('toast');
  if (!t) { toastBusy = false; el.classList.add('hidden'); return; }
  toastBusy = true;
  el.innerHTML = `<b>${t.title}</b><div>${t.sub || ''}</div>${t.reward ? `<i>+$${fmt(t.reward)}</i>` : ''}`;
  el.classList.remove('hidden'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  setTimeout(nextToast, 2200);
}
function notify() {
  Meta.takeNotices().forEach(n => { toast(n.text, n.sub, n.reward); Sfx.gold(); });
}

// ---------- daily reward ----------
function maybeDaily() {
  const st = Meta.dailyStatus();
  $('btn-daily').classList.toggle('hidden', !st.available);
  if (!st.available) return false;
  const cal = $('daily-cal'); cal.innerHTML = '';
  ECON.DAILY_PCT.forEach((_, d) => {
    const c = document.createElement('div');
    c.className = 'dc' + (d < st.day ? ' got' : d === st.day ? ' now' : '') + (d === 6 ? ' big' : '');
    c.innerHTML = `<span>DAY ${d + 1}</span><b>$${fmt(Meta.dailyAmount(d))}</b>`;
    cal.appendChild(c);
  });
  $('daily-amt').textContent = '$' + fmt(Meta.dailyAmount(st.day));
  show('ov-daily', true);
  return true;
}
function claimDaily(mult) {
  const amt = Meta.claimDaily(mult);
  show('ov-daily', false); $('btn-daily').classList.add('hidden');
  if (amt) { Sfx.buy(); toast('DAILY REWARD', mult > 1 ? 'DOUBLED WITH AD!' : 'COME BACK TOMORROW', amt); }
  updateTitle();
}
$('btn-daily-claim').addEventListener('click', () => { Sfx.init(); claimDaily(1); });
$('btn-daily-2x').addEventListener('click', () => { Sfx.init(); Ads.showRewarded().then(ok => claimDaily(ok ? 2 : 1)); });
$('btn-daily').addEventListener('click', () => { Sfx.init(); Sfx.click(); maybeDaily(); });

// ---------- missions / achievements / stats panel ----------
function openMissions() {
  renderMissions('ms-list');
  const s = Meta.save.stats;
  $('ach-list').innerHTML = Meta.ACH.map(a => `<div class="ach ${Meta.save.ach[a.id] ? 'done' : ''}"><b>${a.name}</b><span>${a.txt}</span><i>${Meta.save.ach[a.id] ? '\u2713' : a.r ? '$' + fmt(a.r) : 'BADGE'}</i></div>`).join('');
  $('ach-count').textContent = Object.keys(Meta.save.ach).length + '/' + Meta.ACH.length;
  $('stats-list').innerHTML = [['RUNS', s.runs], ['TARGETS HIT', s.kills], ['GOLDEN BIRDS', s.gold], ['DEER', s.deer], ['BEST ROUND', s.bestRound], ['BEST STREAK', s.bestStreak],
    ['ACCURACY', s.shots ? Math.round(s.hits / s.shots * 100) + '%' : '-'], ['TOTAL EARNED', '$' + fmt(s.earned)], ['UPGRADES', Meta.totalBought() + '/' + ECON.TOTAL_LEVELS], ['MISSIONS DONE', Meta.save.mDone]]
    .map(([k, v]) => `<div><span>${k}</span><b>${typeof v === 'number' ? fmt(v) : v}</b></div>`).join('');
  show('ov-missions', true);
}
$('btn-missions').addEventListener('click', () => { Sfx.init(); Sfx.click(); openMissions(); });
$('btn-missions-close').addEventListener('click', () => { Sfx.click(); show('ov-missions', false); });
$('btn-armory').addEventListener('click', () => { Sfx.init(); Sfx.click(); show('ov-title', false); openShop('title'); });
function updateTitle() {
  $('title-best').textContent = fmt(best);
  $('title-bank').textContent = '$' + fmt(Meta.save.bank);
  renderNext('title-next');
}
function toTitle() {
  ['ov-over', 'ov-pause', 'ov-shop', 'ov-continue'].forEach(id => show(id, false));
  paused = false; state = 'title'; targets = []; showGameButtons(false); Meta.persist();
  updateTitle(); show('ov-title', true); maybeDaily();
}
function newGame() {
  Sfx.init(); Sfx.click(); Ads.init();
  ['ov-title', 'ov-over', 'ov-pause', 'ov-shop', 'ov-daily'].forEach(id => show(id, false));
  targets = []; resetRun(); Meta.startRun(); startRound();
}
$('btn-play').addEventListener('click', newGame);
$('btn-again').addEventListener('click', newGame);
$('btn-menu').addEventListener('click', () => { Sfx.click(); toTitle(); });
$('btn-how').addEventListener('click', () => { Sfx.init(); Sfx.click(); show('ov-how', true); });
$('btn-how-close').addEventListener('click', () => { Sfx.click(); show('ov-how', false); });
function togglePause() {
  if (!(state === 'play' || state === 'intro')) return;
  paused = !paused; show('ov-pause', paused); if (!paused) Sfx.click();
}
$('btn-pause').addEventListener('click', togglePause);
$('btn-resume').addEventListener('click', togglePause);
$('btn-quit').addEventListener('click', () => { Sfx.click(); toTitle(); });
function syncMute() { document.querySelectorAll('.mute-btn').forEach(b => b.textContent = 'SOUND: ' + (Sfx.muted ? 'OFF' : 'ON')); }
document.querySelectorAll('.mute-btn').forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.setMuted(!Sfx.muted); syncMute(); Sfx.click(); }));
$('btn-reload').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sfx.init(); startReload(); });
$('btn-focus').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); useFocus(); });

// ---------------- render ----------------
function render() {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const sx = shake ? rand(-shake, shake) : 0, sy = shake ? rand(-shake, shake) : 0;
  ctx.save(); ctx.translate(sx, sy);
  ctx.drawImage(bg, 0, 0, W, H);
  if (skyFlash > 0) { ctx.fillStyle = `rgba(255,120,150,${skyFlash * 0.5})`; ctx.fillRect(0, 0, W, GROUND); }
  for (const c of clouds) ctx.drawImage(c.img, Math.round(c.x), c.y);
  // targets
  for (const t of targets) {
    if (t.kind === 'deer') {
      const fr = SPR.deer[Math.floor(t.anim * 10) % 2];
      if (t.state === 'fall') spr(fr, t.x, t.y + 4, t.sc, t.vx < 0, true, Math.min(1, t.fallT * 2));
      else spr(fr, t.x, t.y - (t.hop || 0), t.sc, t.vx < 0);
      continue;
    }
    const set = SPR[t.kind];
    const flip = t.vx < 0;
    if (t.state === 'hit') spr(set[2], t.x, t.y, t.sc, flip);
    else if (t.state === 'fall') spr(set[1], t.x, t.y, t.sc, Math.floor(t.anim * 12) % 2 === 0, true);
    else {
      spr(set[Math.floor(t.anim * (t.state === 'flee' ? 14 : 9)) % 2], t.x, t.y, t.sc, flip);
      if (t.kind === 'decoy') { heart(t.x, t.y - 11 * t.sc); }
      if (t.kind === 'gold' && Math.floor(t.anim * 8) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(t.x + rand(-8, 8), t.y + rand(-6, 6), 1, 1); }
    }
  }
  ctx.drawImage(fg, 0, 0, W, H);
  for (const p of parts) { ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, (p.life - p.t) * 3); ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;
  for (const f of flashes) {
    const k = f.t / 0.12, r = 3 + k * radius * 1.4;
    ctx.fillStyle = '#fff6a0'; ctx.globalAlpha = 1 - k;
    ctx.fillRect(f.x - r, f.y - 0.75, r * 2, 1.5); ctx.fillRect(f.x - 0.75, f.y - r, 1.5, r * 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(f.x - 2, f.y - 2, 4, 4);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(f.x, f.y, radius * (0.6 + k), 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (focusT > 0) {
    ctx.fillStyle = 'rgba(80,40,160,0.18)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6);
  }
  if (whiteFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${whiteFlash * 3})`; ctx.fillRect(0, 0, W, H); }

  // floating text
  for (const f of floats) {
    const a = f.t < 0.08 ? 1.4 : 1;
    ctx.globalAlpha = Math.min(1, (f.life - f.t) * 3);
    text(f.text, clamp(f.x, 6 + f.text.length * 2 * f.sz, W - 6 - f.text.length * 2 * f.sz), f.y, f.sz * a, f.color, 'center');
  }
  ctx.globalAlpha = 1;

  // crosshair (mouse)
  if (cursor && performance.now() - lastTouch > 800 && (state === 'play' || state === 'intro')) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(cursor.x - 0.5, cursor.y - radius - 2, 1, 4); ctx.fillRect(cursor.x - 0.5, cursor.y + radius - 2, 1, 4);
    ctx.fillRect(cursor.x - radius - 2, cursor.y - 0.5, 4, 1); ctx.fillRect(cursor.x + radius - 2, cursor.y - 0.5, 4, 1);
  }

  if (state === 'title') return drawTitle();
  drawHud();
  if ((state === 'intro' || state === 'clear' || state === 'dying') && banner) {
    const y = H * 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, y - 6, W, banner2 ? 30 : 22);
    text(banner, W / 2, y, 2, state === 'dying' ? '#ff5a5a' : '#ffe066', 'center');
    if (banner2) text(banner2, W / 2, y + 14, 1, '#fff', 'center');
  }
}
function heart(x, y) {
  ctx.fillStyle = '#ff2d7a';
  ctx.fillRect(x - 2, y, 1.5, 1); ctx.fillRect(x + 0.5, y, 1.5, 1);
  ctx.fillRect(x - 2.5, y + 1, 5, 1); ctx.fillRect(x - 1.5, y + 2, 3, 1); ctx.fillRect(x - 0.5, y + 3, 1, 1);
}
function drawTitle() {
  const y = H * 0.17;
  const bob = Math.sin(performance.now() / 400) * 1.5;
  text('PIXEL', W / 2, y + bob, 6, '#ffe066', 'center', '#7a2a00');
  text('HUNT', W / 2, y + 36 + bob, 6, '#ff5a2a', 'center', '#3a0a00');
  spr(SPR.bird[Math.floor(performance.now() / 120) % 2], W / 2 + 54, y + 4 + bob, 1);
}
function drawHud() {
  // top bar
  ctx.fillStyle = 'rgba(10,20,40,0.78)'; ctx.fillRect(0, 0, W, 28);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 28, W, 1);
  text('SCORE', 4, 3, 1, '#9fc4ff', 'left', null);
  text(fmt(score), 4, 10, 1.5, '#fff');
  text('HIGH SCORE', W / 2 + 6, 3, 1, '#9fc4ff', 'center', null);
  text(fmt(Math.max(best, score)), W / 2 + 6, 10, 1.5, '#ffe066', 'center');
  text('ROUND', W - 4, 3, 1, '#9fc4ff', 'right', null);
  text(round, W - 4, 10, 1.5, '#fff', 'right');
  text('$' + fmt(Meta.save.bank), 4, 20, 1, '#7dff7a');
  // miss slots
  const mx = W - 4 - maxMiss * 8;
  text('MISS', mx - 3, 20, 1, '#ff9a9a', 'right', null);
  for (let i = 0; i < maxMiss; i++) {
    const x = mx + i * 8, on = i < missRun;
    ctx.fillStyle = '#000'; ctx.fillRect(x, 18.5, 7, 8);
    ctx.fillStyle = on ? '#ff3030' : '#3b4458';
    for (let k = 0; k < 5; k++) { ctx.fillRect(x + 1 + k, 19.5 + k * 1.2, 1, 1.2); ctx.fillRect(x + 5 - k, 19.5 + k * 1.2, 1, 1.2); }
  }
  if (streak >= 2) text('STREAK X' + Math.min(streak, 5), W / 2 + 6, 20, 1, '#ff9a3d', 'center', null);

  // bottom bar
  const by = H - BAR;
  ctx.fillStyle = '#1a1208'; ctx.fillRect(0, by, W, BAR);
  ctx.fillStyle = '#000'; ctx.fillRect(0, by, W, 1);
  ctx.fillStyle = '#3a2a14'; ctx.fillRect(0, by + 1, W, 1);
  text('SHOT', 4, by + 4, 1, '#9fc4ff', 'left', null);
  for (let i = 0; i < maxShells; i++) ctx.drawImage(i < shells && !reloading ? SHELL : SHELL_E, 22 + i * 6, by + 3, 4, 9);
  if (reloading) {
    const p = 1 - reloadT / reloadTime;
    ctx.fillStyle = '#000'; ctx.fillRect(22, by + 13, maxShells * 6 - 2, 2);
    ctx.fillStyle = '#7dff7a'; ctx.fillRect(22, by + 13, (maxShells * 6 - 2) * p, 2);
  } else if (shells === 0 && Math.floor(performance.now() / 250) % 2) text('EMPTY', 24 + maxShells * 6, by + 5, 1, '#ff9a3d', 'left', null);
  text('HIT', 4, by + 19, 1, '#9fc4ff', 'left', null);
  const n = roundTotal || 0, maxW = 112 - 18, step = Math.min(9, maxW / Math.max(1, n));
  for (let i = 0; i < n; i++) {
    const img = i < roundHits ? ICON_H : i < roundHits + roundEsc ? ICON_E : ICON_P;
    ctx.drawImage(img, 18 + i * step, by + 19, 8, 5);
  }
  if (focusT > 0) text('SLOW-MO', W / 2, SKY_TOP + 2, 1, '#c9a7ff', 'center');
  // DOM buttons state
  const rb = $('btn-reload');
  rb.classList.toggle('need', shells === 0 && !reloading);
  rb.classList.toggle('full', shells >= maxShells && !reloading);
  rb.style.setProperty('--p', reloading ? (1 - reloadT / reloadTime).toFixed(3) : 0);
  const fb = $('btn-focus');
  $('focus-n').textContent = focusCharges;
  fb.classList.toggle('active', focusT > 0);
  fb.disabled = focusCharges <= 0 && focusT <= 0;
}

// ---------------- loop ----------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); render();
  requestAnimationFrame(frame);
}
resize(); resetRun(); syncMute(); toTitle();
requestAnimationFrame(frame);

// debug/test hooks
window.PH = {
  get state() { return state; }, get targets() { return targets; }, get score() { return score; },
  get money() { return Meta.save.bank; }, Meta, get missRun() { return missRun; }, get round() { return round; }, get shells() { return shells; },
  setMoney(m) { Meta.save.bank = m; Meta.persist(); }, toLogical: (x, y) => ({ x: x / W, y: y / H }),
  forceClear() { queue = []; targets = []; }, forceDie() { missRun = maxMiss; die(); },
  jumpRound(r) { round = r - 1; targets = []; startRound(); },
};
})();
