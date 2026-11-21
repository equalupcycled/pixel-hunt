// Pixel Hunt - original retro pixel hunting game. All art drawn in code.
'use strict';
(() => {
const $ = id => document.getElementById(id);
const cvs = $('game'); let ctx = cvs.getContext('2d');
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
  '%':'101001010100101',"'":'010010000000000',' ':'000000000000000','>':'100010001010100','<':'001010100010001','\u2192':'100010001010100',
  '\u00b7':'000000010000000','&':'010101010101011','(':'010100100100010',')':'010001001001010','#':'101111101111101','=':'000111000111000',
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
  decoy: { K: '#4a0528', B: '#ff5ec4', W: '#ffd0ee', G: '#ff3aa8', E: '#fff', Y: '#ffe066', O: '#ff8fc8', X: '#fff' },
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

// ---------------- more sprites: animals, weapons, turrets, hunter ----------------
const OWL_A = [
  '....KK....KK....', '....KOK..KOK....', '....KOOKKOOK....', '...KOWWOOWWOK...', '...KOWKOOKWOK...',
  'KK.KOOOYYOOOK.KK', 'KOKKOOOOOOOOKKOK', '.KOOOOLLLLOOOOK.', '..KKOOLLLLOOKK..', '....KOOLLOOK....',
  '.....KKOOKK.....', '......Y..Y......'];
const OWL_B = OWL_A.slice(0, 5).concat([
  '...KOOOYYOOOK...', '..KOOOOOOOOOOK..', '.KOKOOLLLLOOKOK.', 'KOK.KOLLLLOK.KOK', 'KK..KOOLLOOK..KK',
  '.....KKOOKK.....', '......Y..Y......']);
const BAT_A = ['K..............K', 'KK....K..K....KK', 'KMK...KKKK...KMK', 'KMMK.KMMMMK.KMMK', '.KMMKMRMMRMKMMK.', '..KMMMMMMMMMMK..', '...KK.KMMK.KK...', '........KK......'];
const BAT_B = ['................', '......K..K......', '......KKKK......', '..KKKKMMMMKKKK..', '.KMMMMRMMRMMMMK.', 'KMMKKMMMMMMKKMMK', 'KMK..KMMMMK..KMK', 'K.....KKKK.....K'];
const RAB_A = ['..........KK..', '.........KWK..', '........KWWK..', '..KKKKKKKWWKK.', '.KWWWWWWWWWEWK', 'KWWWWWWWWWWWWN', 'KWWWWWWWWWWWK.', '.KWWKKKKKWWK..', '.KWK.....KWK..', '..KK......KK..'];
const RAB_B = ['..........KK..', '.........KWK..', '........KWWK..', '..KKKKKKKWWKK.', 'KWWWWWWWWWWEWK', 'KWWWWWWWWWWWWN', '.KWWWWWWWWWWK.', 'KWKKKKKKKKWWK.', 'KK........KWK.', '...........KK.'];
const RR_A = ['..........KKK...', '.........KBBBK..', '........KBBEBKYY', '..K.....KBBBBK..', '.KBK...KBBBK....', 'KBBBKKKBWBBK....', '.KBBBBBBWWBK....', '..KKBBBBWWK.....', '....KKBBBK......', '.....K..K.......', '....K....K......', '...KK....KK.....'];
const RR_B = RR_A.slice(0, 9).concat(['.....K.K........', '.....K.K........', '.....KKKK.......']);
const WOLF_A = ['...............K.K..'].concat(DEER_A.slice(3));
const WOLF_B = ['...............K.K..'].concat(DEER_B.slice(3));
const APAL = {
  goose: { K: '#111', B: '#7a7a72', W: '#d8d4c8', G: '#151515', E: '#fff', Y: '#333', O: '#333', X: '#fff' },
  vulture: { K: '#140c08', B: '#3a2a22', W: '#6a5040', G: '#d87a7a', E: '#fff', Y: '#e0d0a0', O: '#e0d0a0', X: '#fff' },
  eagle: { K: '#1a0c00', B: '#5a3416', W: '#7a4a20', G: '#ffffff', E: '#000', Y: '#ffcc00', O: '#ffcc00', X: '#fff' },
  thunder: { K: '#0a0a20', B: '#2a3a8a', W: '#ffd23f', G: '#5ae0ff', E: '#fff', Y: '#ffd23f', O: '#ffd23f', X: '#fff' },
  owl: { K: '#2a1a0a', O: '#8a5a2a', W: '#fff', Y: '#ffb000', L: '#d9b98a' },
  snowowl: { K: '#4a5a6a', O: '#f4f4f4', W: '#ffe066', Y: '#ffb000', L: '#d0d8e0' },
  bat: { K: '#000', M: '#4a3a5a', R: '#ff3030' }, batking: { K: '#000', M: '#7a2a9a', R: '#ffe066' },
  rabbit: { K: '#6a7a8a', W: '#f0f4f8', E: '#000', N: '#ff9ab0' },
  roadrunner: { K: '#1a1a1a', B: '#6a5a3a', W: '#e8dcc0', E: '#fff', Y: '#7a7a7a' },
  wolf: { K: '#1e1e24', D: '#7a7f8a', L: '#c8ccd4', E: '#ff0', N: '#000', T: '#7a7f8a' },
  coyote: { K: '#3a2410', D: '#b88a4a', L: '#ecd2a0', E: '#111', N: '#000', T: '#b88a4a' },
  buck: { K: '#1a0a02', D: '#6a3a14', L: '#d0a870', E: '#111', N: '#111', T: '#fff' },
  stag: { K: '#140800', D: '#8a4a18', L: '#f0d09a', E: '#111', N: '#111', T: '#ffe066' },
  swan: { K: '#1a1a22', B: '#f4f4f8', W: '#ffffff', G: '#ffd23f', E: '#111', Y: '#ff9ab0', O: '#d8d8e8', X: '#fff' },
  heron: { K: '#0a1420', B: '#3a5a7a', W: '#c8dcec', G: '#7ad0ff', E: '#fff', Y: '#ffd23f', O: '#2a3a4a', X: '#fff' },
  frostwolf: { K: '#0e1a28', D: '#c8d8e8', L: '#f4f8ff', E: '#7ad0ff', N: '#111', T: '#e8f0ff' },
  elk: { K: '#1a1008', D: '#5a3a22', L: '#d8c8b0', E: '#111', N: '#111', T: '#e8dcc0' },
  jackal: { K: '#2a1808', D: '#c49a3a', L: '#ffe08a', E: '#111', N: '#111', T: '#ffe066' },
  sunroc: { K: '#2a1000', B: '#e06020', W: '#ffd23f', G: '#ff9a3d', E: '#fff', Y: '#fff4a0', O: '#ff5a2a', X: '#fff' },
  shadowowl: { K: '#0a0614', O: '#2a1a4a', W: '#7a6aa0', Y: '#c9a7ff', L: '#1a1028' },
  bloodmoon: { K: '#1a0008', O: '#8a1020', W: '#ff5a5a', Y: '#ffd23f', L: '#4a0810' },
};
for (const k of ['goose', 'vulture', 'eagle', 'thunder']) SPR[k] = [makeSprite(BIRD_UP, APAL[k]), makeSprite(BIRD_DN, APAL[k]), makeSprite(BIRD_HIT, APAL[k])];
SPR.owl = [makeSprite(OWL_A, APAL.owl), makeSprite(OWL_B, APAL.owl)];
SPR.snowowl = [makeSprite(OWL_A, APAL.snowowl), makeSprite(OWL_B, APAL.snowowl)];
SPR.bat = [makeSprite(BAT_A, APAL.bat), makeSprite(BAT_B, APAL.bat)];
SPR.batking = [makeSprite(BAT_A, APAL.batking), makeSprite(BAT_B, APAL.batking)];
SPR.rabbit = [makeSprite(RAB_A, APAL.rabbit), makeSprite(RAB_B, APAL.rabbit)];
SPR.roadrunner = [makeSprite(RR_A, APAL.roadrunner), makeSprite(RR_B, APAL.roadrunner)];
SPR.wolf = [makeSprite(WOLF_A, APAL.wolf), makeSprite(WOLF_B, APAL.wolf)];
SPR.coyote = [makeSprite(WOLF_A, APAL.coyote), makeSprite(WOLF_B, APAL.coyote)];
SPR.buck = [makeSprite(DEER_A, APAL.buck), makeSprite(DEER_B, APAL.buck)];
const STAG_A = [
  '....K.K.....K.K.',
  '...KK.KK...KK.K.',
  '...K.KKKK.KKKKK.',
  '....K.K.....K...',
  '.....KKKKKKDK...',
  '.....KDDDDDDK...',
  '.....KDWWEDDK...',
  '.KK..KDLLLLDK...',
  'KTKKKKDDDDDDKKK.',
  '.KDDDDDWWDDDDK..',
  '..KDDDDDDDDDDK..',
  '..KDLLLLLLLDDK..',
  '..KDDKKKKKKDDK..',
  '.KDK........KDK.',
  'KDK..........KDK',
  'KK............KK'];
const STAG_B = STAG_A.slice(0, 12).concat([
  '...KDDKKKKKDDK..',
  '...KDK.....KDK..',
  '...KDK.....KDK..',
  '...KK.......KK..']);
const HERON_UP = [
  '......KK........',
  '.....KWWK.......',
  '....KWWWK.......',
  '....KWWEK.......',
  '.....KWWK.......',
  '......KWK.......',
  '.....KBBK.......',
  '....KBBBBKKKK...',
  '...KBBBBBBGGEK..',
  '..KBBBBBBBKGKY..',
  '.KK..KBBBBK.....',
  '......KBBK......',
  '......O..O......',
  '.....O....O.....'];
const HERON_DN = [
  '................',
  '................',
  '......KK........',
  '.....KWWK.......',
  '....KWWEK.......',
  '.....KWWK.......',
  'KKK..KBBK.......',
  'KGGKKBBBBK......',
  '.KGKBBBBBBK.....',
  '..KKBBBBBBK.....',
  '....KBBBBK......',
  '.....KBBK.......',
  '......O.O.......',
  '................'];
const HERON_HIT = [
  '....K......K....',
  '...KWK....KWK...',
  '....KWWKKWWK....',
  '.....KWWEK......',
  '......KWK.......',
  '.....KBBK.KKK...',
  '....KBBBBBGGGK..',
  '...KBBBBBBKGKY..',
  '....KBBBBBK.....',
  '.....KKBBK......',
  '......O..O......',
  '................'];
const BAG_A = [
  '....KKKK....',
  '...KTTTTK...',
  '..KKKKKKKK..',
  '..KYYYYYYK..',
  '..KYCCCCYK..',
  '..KYCWWCYK..',
  '..KYCCCCYK..',
  '..KYYYYYYK..',
  '...KKKKKK...',
  '............'];
const BAG_B = [
  '.....KKKK...',
  '....KTTTTK..',
  '...KKKKKKKK.',
  '...KYYYYYYK.',
  '...KYCCCCYK.',
  '...KYCWWCYK.',
  '...KYCCCCYK.',
  '...KYYYYYYK.',
  '....KKKKKK..',
  '............'];
SPR.stag = [makeSprite(STAG_A, APAL.stag), makeSprite(STAG_B, APAL.stag)];
SPR.elk = [makeSprite(STAG_A, APAL.elk), makeSprite(STAG_B, APAL.elk)];
SPR.swan = [makeSprite(BIRD_UP, APAL.swan), makeSprite(BIRD_DN, APAL.swan), makeSprite(BIRD_HIT, APAL.swan)];
SPR.heron = [makeSprite(HERON_UP, APAL.heron), makeSprite(HERON_DN, APAL.heron), makeSprite(HERON_HIT, APAL.heron)];
SPR.frostwolf = [makeSprite(WOLF_A, APAL.frostwolf), makeSprite(WOLF_B, APAL.frostwolf)];
SPR.jackal = [makeSprite(WOLF_A, APAL.jackal), makeSprite(WOLF_B, APAL.jackal)];
SPR.sunroc = [makeSprite(BIRD_UP, APAL.sunroc), makeSprite(BIRD_DN, APAL.sunroc), makeSprite(BIRD_HIT, APAL.sunroc)];
SPR.shadowowl = [makeSprite(OWL_A, APAL.shadowowl), makeSprite(OWL_B, APAL.shadowowl)];
SPR.bloodmoon = [makeSprite(OWL_A, APAL.bloodmoon), makeSprite(OWL_B, APAL.bloodmoon)];
SPR.bag = [makeSprite(BAG_A, { K: '#4a2a08', T: '#c8a060', Y: '#e0a020', C: '#ffe066', W: '#fff4b0' }), makeSprite(BAG_B, { K: '#4a2a08', T: '#c8a060', Y: '#e0a020', C: '#ffe066', W: '#fff4b0' })];
const EGG_PAL = { K: '#3a2a14', W: '#f4e6b8', L: '#ffe9a0', Y: '#e0c070', C: '#d8a24a' };
SPR.egg = [makeSprite([
  '..KKKK..',
  '.KWWWLK.',
  'KWWLLYLK',
  'KWLYYYYK',
  'KWLYYYCK',
  '.KWYYCK.',
  '..KCCK..',
  '...KK...'
], EGG_PAL)];



// ---- unique per-map animals (kept in addition to the shared roster) ----
const CARD_UP = [
  '......KK........',
  '.....KRRKK......',
  '....KRRRRK......',
  '....KRREK..KKK..',
  '.....KRRKKKRRRK.',
  'KKK..KRRRRRKRYY.',
  'KRRKKRRRRRRRKRY.',
  '.KRRRRRWWWRRK...',
  '..KRRRRWWWRK....',
  '...KKRRRRRK.....',
  '.....KKKKK......',
  '......O..O......'];
const CARD_DN = [
  '................',
  '................',
  '......KK........',
  '.....KRRK.......',
  '....KRREK..KKK..',
  'KKK..KRRKKKRRRK.',
  'KRRKKRRRRRRKRYY.',
  '.KRRRRRWWWRRKRY.',
  '..KRRRRWWWRK....',
  '...KKRRRRK......',
  '......O.O.......',
  '................'];
const CARD_HIT = [
  '....K......K....',
  '...KRK....KRK...',
  '....KRRKKRRK....',
  '.....KRREK......',
  '......KRRK.KKK..',
  '.....KRRRRKRRRK.',
  '....KRRRRRRKRYY.',
  '...KRRRWWWRRKRY.',
  '....KRRWWWRK....',
  '.....KKRRRK.....',
  '......O..O......',
  '................'];
const SQ_A = [
  'K...........KKK.',
  'KK.........KWWK.',
  'KWK.......KWWWK.',
  '.KWK.KKKKKWWWWN',
  '.KWWKKWWWWWWEWK',
  '..KWWWWWWWWWWK.',
  '..KWWWKKKWWWK..',
  '..KWWK...KWWK..',
  '..KWK....KWK...',
  '..KK.....KK....'];
const SQ_B = [
  '...........KKK..',
  'K.........KWWK..',
  'KK.......KWWWK..',
  'KWK.KKKKKWWWWN..',
  '.KWWKWWWWWWWEWK.',
  '.KWWWWWWWWWWWK..',
  'KWWWKKKKKWWWK...',
  'KWWK.....KWWK...',
  'KKK......KWK....',
  '..........KK....'];
const PH_A = [
  '...............K',
  '..............KTK',
  '.............KTTK',
  '..........KKKTTK.',
  '.........KBBBTKYY',
  '..K.....KBBBBK...',
  '.KBKKKKKBBWBK....',
  'KBBBBBBBBWWBK....',
  '.KKBBBBBBWWK.....',
  '...KKBBBBK.......',
  '....K..K.........',
  '...K....K........'];
const PH_B = [
  '...............K',
  '..............KTK',
  '.............KTTK',
  '..........KKKTTK.',
  '.........KBBBTKYY',
  '..K.....KBBBBK...',
  'KBBKKKKKBBWBK....',
  '.KBBBBBBBWWBK....',
  'KKKBBBBBBWWK.....',
  '...KKBBBBK.......',
  '....K.K..........',
  '....K.K..........'];
const KF_UP = [
  '..........KK....',
  '.........KWWK...',
  '........KWWWKYYY',
  '........KWWEK...',
  '.......KCCCK....',
  'KKK...KCCCCK....',
  'KCCKKKCCCCCK....',
  '.KCCCCCCCCK.....',
  '..KCCCOOCCK.....',
  '...KKCCCCK......',
  '.....KKKK.......',
  '......O..O......'];
const KF_DN = [
  '................',
  '................',
  '..........KK....',
  '.........KWWKYYY',
  '........KWWEK...',
  'KKK....KCCCK....',
  'KCCKKKKCCCCK....',
  '.KCCCCCCCCK.....',
  '..KCCCOOCCK.....',
  '...KKCCCCK......',
  '......O.O.......',
  '................'];
const KF_HIT = [
  '....K......K....',
  '...KWK....KWK...',
  '....KWWKKWWKYYY.',
  '.....KWWEK......',
  '......KCCK.KKK..',
  '.....KCCCCKCCK..',
  '....KCCCCCCCK...',
  '...KCCCOOCCK....',
  '....KCCCCK......',
  '.....KKKK.......',
  '......O..O......',
  '................'];
const FROG_A = [
  '................',
  '....KKKKKK......',
  '..KKGGGGGGKK....',
  '.KGGWEGGGGGK....',
  'KGGGGGGGGGGK....',
  'KGGKKKKGGGGKKK..',
  '.KK....KKKKGGK..',
  '........KK..KK..'];
const FROG_B = [
  '................',
  '....KKKKKK......',
  '..KKGGGGGGKK....',
  '.KGGWEGGGGGK....',
  'KGGGGGGGGGGK....',
  '.KGGKKKKGGGK....',
  'KGGK....KKKKKK..',
  'KKK.............'];
const BEV_A = [
  '...........KK...',
  '.........KKBBK..',
  '..KKKKKKKBBBBEK.',
  '.KBBBBBBBBBBBN..',
  'KBBBBBBBBBBBK...',
  '.KKKKKKKBBBK....',
  '.......KTTTTK...',
  '......KTTTTTK...'];
const BEV_B = [
  '...........KK...',
  '.........KKBBK..',
  '.KKKKKKKKBBBBEK.',
  'KBBBBBBBBBBBN...',
  '.KBBBBBBBBBBK...',
  '..KKKKKKBBBK....',
  '........KTTTK...',
  '.......KTTTTK...'];
const FOX_A = [
  '..............K.K',
  '.............KK.K',
  '..............KKK',
  '.............KDDK',
  '.............KDEDK',
  '.KKK........KDDDDN',
  'KTDDKKKKKKKKDDDKK.',
  '.KDDDDDDDDDDDDKTTK',
  '..KDDDDDDDDDDDKTTK',
  '..KDLLLLLLLLDDK.KK',
  '..KDDKKKKKKKDK....',
  '.KDK.......KDK....',
  'KDK.........KDK...',
  'KK...........KK...'];
const FOX_B = FOX_A.slice(0, 10).concat([
  '...KDDKKKKKDDK....',
  '...KDK.....KDK....',
  '...KDK.....KDK....',
  '...KK.......KK....']);
const PTA_UP = [
  '......KKKK......',
  '.....KWWWWK.....',
  '....KWWWEWWK....',
  '...KWWWWWWWWK...',
  '..KWWWWWWWWWWK..',
  'KKKWWWWYWWWWWK..',
  'KWWKWWWWWWWWK...',
  '.KWWWWWWWWWK....',
  '..KKWWWWWWK.....',
  '....KKKKKK......',
  '.....O..O.......',
  '................'];
const PTA_DN = [
  '................',
  '......KKKK......',
  '.....KWWWWK.....',
  '....KWWWEWWK....',
  'KKKKWWWWWWWWK...',
  'KWWKWWWWYWWWWK..',
  '.KWWWWWWWWWWK...',
  '..KWWWWWWWWK....',
  '...KKWWWWK......',
  '.....KKKK.......',
  '......O.O.......',
  '................'];
const WEAS_A = [
  '...............KK',
  '..............KDK',
  '.............KDED',
  'KKKKKKKKKKKKKDDDN',
  'KDDDDDDDDDDDDDDK.',
  '.KKKKKKKKKKKDDK..',
  '...........KDK...',
  '...........KK....'];
const WEAS_B = [
  '...............KK',
  '..............KDK',
  '.............KDED',
  '.KKKKKKKKKKKKDDDN',
  'KDDDDDDDDDDDDDDK.',
  'KDKKKKKKKKKKDDK..',
  'KK.........KDK...',
  '............KK...'];
const HAWK_UP = [
  'K...............K',
  'KK.....KK......KK',
  'KBK...KBBK....KBK',
  '.KBK.KBBBKKKKKBK.',
  '..KBKBBBBBWWEBK..',
  '...KBBBBBBBBBK...',
  '....KKBBBBBBK....',
  '......KBBBK......',
  '.......KYK.......',
  '......KYYK.......',
  '.......KK........',
  '......O..O.......'];
const HAWK_DN = [
  '.................',
  '.......KK........',
  '......KBBK.......',
  '.....KBBBKKKK....',
  'KKKKKBBBBBWWEBKKK',
  'KBBBKBBBBBBBBBKBK',
  '.KBBKKBBBBBBKKBK.',
  '..KK..KBBBK..KK..',
  '.......KYK.......',
  '......KYYK.......',
  '......O..O.......',
  '.................'];
const HAWK_HIT = [
  '....K.......K....',
  '...KBK.....KBK...',
  '....KBBKKKBBK....',
  '.....KBBBWWEBK...',
  '......KBBBBBBK...',
  '.....KBBBBBBK....',
  '......KBBBK......',
  '.......KYK.......',
  '......KYYK.......',
  '......O..O.......',
  '.................',
  '.................'];
const SCOR_A = [
  'K...........K..K.',
  'KK.........KSK.K.',
  'KSK..KKKK..KSKK..',
  '.KSKKSSSSKKSSSK..',
  '..KSSSSSSSSSSK...',
  '...KKSSSSSSKK....',
  '.....KSSSSK......',
  '......KSSK.......',
  '.......KSK.......',
  '........KK.......'];
const SCOR_B = [
  '..K.........K..K.',
  '.KK........KSK.K.',
  'KSKK.KKKK..KSKK..',
  '.KSSKSSSSKKSSSK..',
  '..KSSSSSSSSSSK...',
  '...KKSSSSSSKK....',
  '....KSSSSSK......',
  '.....KSSSK.......',
  '......KSK........',
  '.......KK........'];
const JACK_A = [
  '...........K...K.',
  '..........KWK.KWK',
  '..........KWK.KWK',
  '.........KWWKKWWK',
  '..KKKKKKKWWWWEWK.',
  '.KWWWWWWWWWWWWN.',
  'KWWWWWWWWWWWWK..',
  '.KWWKKKKKWWWK...',
  '.KWK.....KWK....',
  '..KK......KK....'];
const JACK_B = [
  '...........K...K.',
  '..........KWK.KWK',
  '..........KWK.KWK',
  '.........KWWKKWWK',
  'KKKKKKKKKWWWWEWK.',
  'KWWWWWWWWWWWWWN.',
  '.KWWWWWWWWWWWK..',
  'KWKKKKKKKKWWK...',
  'KK.......KWK....',
  '..........KK....'];
const COON_A = [
  '.............KK..',
  '............KWBWK',
  '............KWWEK',
  '..KK.......KWWWK.',
  '.KTWKKKKKKKWWWWN',
  'KTTWWWWWWWWWWWK.',
  '.KTWWWWWWWWWWK..',
  '..KWWKKKKKWWK...',
  '..KWK.....KWK...',
  '..KK.......KK...'];
const COON_B = [
  '.............KK..',
  '............KWBWK',
  '............KWWEK',
  '.KK........KWWWK.',
  'KTWKKKKKKKKWWWWN',
  'KTTWWWWWWWWWWWK.',
  '.KTWWWWWWWWWWK..',
  'KWWKKKKKKKWWK...',
  'KKK......KWK....',
  '..........KK....'];
const MOTH_A = [
  'K..............K',
  'KGK..........KGK',
  'KGGK.KKKKKK.KGGK',
  '.KGGKGGGGGGKGGK.',
  '..KGGGGWWGGGK...',
  '...KKGGWWGGKK...',
  '.....KGGGGK.....',
  '......KKKK......'];
const MOTH_B = [
  '................',
  '..K..........K..',
  '.KGKK......KKGK.',
  'KGGGGKKKKKKGGGGK',
  '.KGGGGGWWGGGGGK.',
  '..KKGGGWWGGGKK..',
  '....KKGGGGKK....',
  '......KKKK......'];
const SKUNK_A = [
  '..............KK.',
  '..........KKKWBK.',
  '.........KWWWBBK.',
  '..KK....KWWWWBK..',
  '.KWBKKKKKWWWBK...',
  'KWWBBBBBBBWWBK...',
  '.KWBBBBBBBBBK....',
  '..KWKKKKKWWK.....',
  '..KWK...KWK......',
  '..KK.....KK......'];
const SKUNK_B = [
  '..............KK.',
  '..........KKKWBK.',
  '.........KWWWBBK.',
  '.KK.....KWWWWBK..',
  'KWBKKKKKWWWWBK...',
  '.KWBBBBBBBWWBK...',
  'KWWBBBBBBBBBK....',
  '.KWKKKKKKWWK.....',
  'KKK.....KWK......',
  '.........KK......'];
APAL.cardinal = { K: '#2a0008', R: '#e01828', W: '#fff0f0', E: '#fff', Y: '#ffd23f', O: '#ff8a00' };
APAL.squirrel = { K: '#2a1408', W: '#e07820', E: '#fff', N: '#ffb090' };
APAL.pheasant = { K: '#1a0c00', B: '#8a4a18', W: '#e8c878', T: '#c05020', Y: '#ffe066' };
APAL.kingfisher = { K: '#041018', C: '#1a7aaa', W: '#f0a040', E: '#fff', Y: '#ffd23f', O: '#e07020' };
APAL.frog = { K: '#042004', G: '#4ce030', W: '#fff', E: '#111' };
APAL.beaver = { K: '#1a0c04', B: '#6a3a18', E: '#fff', N: '#ffb090', T: '#4a2a10' };
APAL.fox = { K: '#2a0c00', D: '#e07020', L: '#ffe0b0', E: '#111', N: '#fff', T: '#fff8f0' };
APAL.ptarmigan = { K: '#4a5a6a', W: '#f8f8f8', E: '#111', Y: '#ffb000', O: '#d0d0d0' };
APAL.weasel = { K: '#2a1808', D: '#c89858', E: '#111', N: '#ffd0a0' };
APAL.hawk = { K: '#1a1008', B: '#7a5a38', W: '#e8d8b8', E: '#fff', Y: '#ffb000', O: '#ff8a00' };
APAL.scorpion = { K: '#100400', S: '#6a1808' };
APAL.jackrabbit = { K: '#4a3018', W: '#e8d0a8', E: '#111', N: '#ffb090' };
APAL.raccoon = { K: '#141414', W: '#8a8a8a', B: '#111', E: '#fff', T: '#d8d8d8', N: '#fff' };
APAL.moth = { K: '#1a2a10', G: '#b8f08a', W: '#f4ffe0' };
APAL.skunk = { K: '#111', W: '#f4f4f4', B: '#2a2a2a' };
SPR.cardinal = [makeSprite(CARD_UP, APAL.cardinal), makeSprite(CARD_DN, APAL.cardinal), makeSprite(CARD_HIT, APAL.cardinal)];
SPR.squirrel = [makeSprite(SQ_A, APAL.squirrel), makeSprite(SQ_B, APAL.squirrel)];
SPR.pheasant = [makeSprite(PH_A, APAL.pheasant), makeSprite(PH_B, APAL.pheasant)];
SPR.kingfisher = [makeSprite(KF_UP, APAL.kingfisher), makeSprite(KF_DN, APAL.kingfisher), makeSprite(KF_HIT, APAL.kingfisher)];
SPR.frog = [makeSprite(FROG_A, APAL.frog), makeSprite(FROG_B, APAL.frog)];
SPR.beaver = [makeSprite(BEV_A, APAL.beaver), makeSprite(BEV_B, APAL.beaver)];
SPR.fox = [makeSprite(FOX_A, APAL.fox), makeSprite(FOX_B, APAL.fox)];
SPR.ptarmigan = [makeSprite(PTA_UP, APAL.ptarmigan), makeSprite(PTA_DN, APAL.ptarmigan)];
SPR.weasel = [makeSprite(WEAS_A, APAL.weasel), makeSprite(WEAS_B, APAL.weasel)];
SPR.hawk = [makeSprite(HAWK_UP, APAL.hawk), makeSprite(HAWK_DN, APAL.hawk), makeSprite(HAWK_HIT, APAL.hawk)];
SPR.scorpion = [makeSprite(SCOR_A, APAL.scorpion), makeSprite(SCOR_B, APAL.scorpion)];
SPR.jackrabbit = [makeSprite(JACK_A, APAL.jackrabbit), makeSprite(JACK_B, APAL.jackrabbit)];
SPR.raccoon = [makeSprite(COON_A, APAL.raccoon), makeSprite(COON_B, APAL.raccoon)];
SPR.moth = [makeSprite(MOTH_A, APAL.moth), makeSprite(MOTH_B, APAL.moth)];
SPR.skunk = [makeSprite(SKUNK_A, APAL.skunk), makeSprite(SKUNK_B, APAL.skunk)];

const ICONS = {
  shotgun: ['................', '................', '...KKKKKKKKKKKK.', 'KKKSSSSSSSSSSSSK', 'KWWWWWWKKKKKKKK.', 'KWWKWWK.........', 'KWK.KK..........', 'KK..............'],
  gun: ['................', '................', '...KKKKKKKKKKKK.', 'KKKSSSSSSSSSSSSK', 'KWWWWWWKKKKKKKK.', 'KWWKWWK.........', 'KWK.KK..........', 'KK..............'],
  handgun: ['................', '.....KKKKKKKKK..', '....KSSSSSSSSSK.', '....KSSSSSSSSSK.', '.....KKWWWKKKK..', '......KWWK......', '......KWWK......', '......KKKK......'],
  rifle: ['................', '..............KK', 'KKKKKKKKKKKKKKSK', 'KWWWWWSSSSSSSSSK', '.KWWWKKKKKKKKKK.', '.KWWK...........', 'KWWK............', 'KKK.............'],
  bow: ['....KK..........', '...KWK..........', '..KWKS..........', '.KWK..S.........', '.KWK...SKKKKKKKY', '.KWK..S.........', '..KWKS..........', '...KWK..........', '....KK..........'],
  mg: ['................', '...KK...........', 'KKKKKKKKKKKKKKKK', 'KSSSSSSSSSSSSSSK', 'KKKKSSSKKKKKKKKK', '..KYYK.KWWK.....', '..KYYK.KWWK.....', '...KK..KKKK.....'],
  laser: ['................', '...KKKKKKKK.....', '..KCCCCCCCCKKKKK', '.KCMMMMMMMCCCCRR', '.KCCCCCCCCCKKKKK', '..KKKKCCKK......', '......KCCK......', '......KKKK......'],
  turret: ['......KK........', '.....KSSKKKKKK..', '....KSSSSSSSSK..', '.....KSSKKKKKK..', '....KKKKKK......', '...KSSSSSSK.....', '..KSSSSSSSSK....', '.KKKKKKKKKKKK...'],
  flak: ['.....KK.........', '....KSSK........', '...KKKKKK.......', '..KGGGGGGK......', '.KGGKGGKGGK.....', '.KGGGGGGGGK.....', '.KGGKGGKGGK.....', '..KGGGGGGK......', '...KKKKKK.......'],
  call: ['................', '..........KK....', '.......KKKWWK...', 'KKKKKKKWWWWWK...', 'KWWWWWWWWWWWK...', 'KKKKKKKWWWWWK...', '.......KKKWWK...', '..........KK....'],
  decoy: ['.........KK.....', '........KGGK....', '........KGGKY...', '..KKKKKKKGGK....', '.KWWWWWWWWWK....', 'KWWWWWWWWWWK....', '.KKKKKKKKKK.....', '..BBBBBBBB......'],
  map: ['KKKKKKKKKKKKKKKK', 'KCCCCCCCCCCCCCCK', 'KCCCCCCGGCCCCCCK', 'KCCCCCGGGGCCCCCK', 'KCCGGGGGGGGGCCCK', 'KGGGGGGGGGGGGGGK', 'KYYYYYYYYYYYYYYK', 'KKKKKKKKKKKKKKKK'],
  hand: ['....KK.KK.......', '...KYYKYYK......', '...KYYKYYKKK....', '.KKKYYKYYKYYK...', 'KYYKYYYYYKYYK...', 'KYYYYYYYYYYYK...', '.KYYYYYYYYYK....', '..KKYYYYYYK.....', '....KKKKKK......'],
  choke: ['......KKKK......', '....KK....KK....', '...K..K..K..K...', '..K....KK....K..', '..K...KRRK...K..', '..K....KK....K..', '...K..K..K..K...', '....KK....KK....', '......KKKK......'],
  scope: ['.....KKKKKK.....', '...KKCCCCCCKK...', '..KCCCCKCCCCCK..', '..KCCCCKCCCCCK..', '..KKKKKKKKKKKK..', '..KCCCCKCCCCCK..', '...KKCCKCCCKK...', '.....KKKKKK.....'],
  feather: ['...........KK...', '.........KKWWK..', '.......KKWWWWK..', '.....KKWWWWWK...', '....KWWWWWKK....', '...KWWWWKK......', '..KWWKKK........', '.KKK............', 'K...............'],
  eye: ['................', '....KKKKKKKK....', '..KKWWWWWWWWKK..', '.KWWWWKKKKWWWWK.', 'KWWWWKCCCCKWWWWK', '.KWWWWKKKKWWWWK.', '..KKWWWWWWWWKK..', '....KKKKKKKK....'],
  coin: ['.....KKKKK......', '...KKYYYYYKK....', '..KYYYKKKYYYK...', '..KYYKYYYYYYK...', '..KYYYKKKYYYK...', '..KYYYYYYKYYK...', '..KYYYKKKYYYK...', '...KKYYYYYKK....', '.....KKKKK......'],
  auto: ['................', '....KKKKKK......', '...KYYYYYYK.....', '..KYKKKKKKYK....', '..KYK....KYK....', '..KYKKKKKKYK....', '...KYYYYYYK.....', '....KKKKKK......', '......KYYK......'],
  loader: ['......KK........', '.....KYYK.......', '....KYYYYK......', '...KYYYYYYK.....', '..KKKKYYKKKK....', '.....KYYK.......', '.....KYYK.......', '......KK........'],
  reserve: ['..KKKKKKKKKK....', '.KYYYYYYYYYK....', '.KYKKKKKKKYK....', '.KYKYYYYYYK.....', '.KYKYYYYYYK.....', '.KYKYYYYYYK.....', '.KYKKKKKKKYK....', '.KYYYYYYYYYK....', '..KKKKKKKKKK....'],
  combo: ['................', '.KK....KK.......', 'KYYK..KYYK......', 'KYYYKKYYYK......', '.KYYYYYYK.......', '..KYYYYK........', '...KYYK.........', '....KK..........'],
  crit: ['.KK.............','KYYK....KKKK....','KYYK...KYYYYK...','.KK...KYYKKYYK..','.....KYYK..KYYK.','......KK....KK..','...KKYYKK.......','..KYYYYYYK......','.KKKKKKKKKK.....'],
  eggsnipe: ['......KKKK......','.....KYYYYK.....','....KYYYYYYK....','....KYYYYYYK....','.....KYYYYK.....','......KKKK......','.....KK.........', '....KRRK........','...KKKK.........'],
  magnet: ['................','..KK.......KK...','..KYYK...KYYK...','...KYYK.KYYK....','....KYYYYYK.....','.....KYYYK......','......KYK.......','.......K........'],
  second: ['.....KKKKK......','...KKWWWWWKK....','..KWWKKKKKWWK...','..KWWKYYYKWWK...','..KWWKYYYKWWK...','..KWWKKKKKWWK...','...KKWWWWWKK....','.....KKKKK......'],
  deer: ['............KK..','...........KWWK.','..KKKKKKKKKWWWK.','KKWWWWWWWWWWWKK.','KWWWWWWWWWWWKK..','.KKKKKKKKKWWK...','........KWWK....','........KKKK....'],
  bullet: ['................','KKKKKKKKKKKKKK..','KYYYYYYYYYYYYK..','KKKKKKKKKKYYYYK.','.........KYYYYK.','..........KYYK..','...........KK...'],
};
const ICON_PAL = { K: '#000', S: '#8d97a8', W: '#8a4b1c', E: '#fff', Y: '#ffd23f', R: '#ff3b3b', C: '#8fd3ff', M: '#6a3fb5', G: '#4a7a2a', B: '#5a3a1a' };
const WSPR = {}; for (const k in ICONS) WSPR[k] = makeSprite(ICONS[k], ICON_PAL);
const TURRET_SPR = {
  pellet: makeSprite(['....KKKK....', '...KSSSSK...', '..KSSKKSSK..', '..KSKRRKSK..', '..KSSKKSSK..', '...KSSSSK...', '....KKKK....', '...KSSSSK...', '..KSSSSSSK..', '.KKKKKKKKKK.', 'KSSSSSSSSSSK', 'KKKKKKKKKKKK'], { K: '#111', S: '#8d97a8', R: '#ff3b3b' }),
  tesla: makeSprite(['....KCCK....', '...KCWWCK...', '....KCCK....', '.....KK.....', '...KOOOOK...', '....KKKK....', '...KOOOOK...', '....KKKK....', '...KOOOOK...', '.KKKKKKKKKK.', 'KSSSSSSSSSSK', 'KKKKKKKKKKKK'], { K: '#111', C: '#5ae0ff', W: '#fff', O: '#c87533', S: '#8d97a8' }),
  missile: makeSprite(['.KR.KR.KR...', '.KW.KW.KW...', 'KKKKKKKKKK..', 'KGGGGGGGGK..', 'KGKKGKKGGK..', 'KGGGGGGGGK..', 'KKKKKKKKKK..', '...KK.......', '..KSSK......', '.KKKKKKKKKK.', 'KSSSSSSSSSSK', 'KKKKKKKKKKKK'], { K: '#111', R: '#ff3b3b', W: '#eee', G: '#4a6a2a', S: '#8d97a8' }),
};
const HUNTER = ['...HHHH...', '..HHHHHH..', '.CCCCCCCC.', '...SSSS...', '..JJJJJJ..', '.JJJJJJJJ.', 'JJJCJJCJJJ', 'JJJJJJJJJJ', 'SJJJJJJJJS', '.JJJJJJJJ.', '..PPPPPP..', '..PP..PP..', '..PP..PP..', '.KKK..KKK.'];
const hunterSpr = {};
function hunterSprite(skinId) {
  if (!hunterSpr[skinId]) { const sk = ECON.SKINS.find(s => s.id === skinId) || ECON.SKINS[0]; hunterSpr[skinId] = makeSprite(HUNTER, Object.assign({ K: '#111' }, sk.pal)); }
  return hunterSpr[skinId];
}
const DECOY_SPR = makeSprite(ICONS.decoy, ICON_PAL);
const CROWN = makeSprite(['Y.Y.Y', 'YYYYY', 'YRYRY'], { Y: '#ffd23f', R: '#ff3b3b' });
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

// ---------------- backgrounds (one per map, generated) ----------------
let bg, fg, clouds = [], snow = [];
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const SKIES = {
  meadow: ['#2b6fd6', '#3a82e6', '#4b95f0', '#62a9f6', '#7fc0fb', '#a2d6ff'],
  lake: ['#4a86e0', '#5893e4', '#68a0e8', '#7aaeec', '#8fbcef', '#a6caf2'],
  snow: ['#8fa8c8', '#a0b8d4', '#b4c8e0', '#c8d8ec', '#dce6f4', '#eef3fa'],
  desert: ['#e8743a', '#f08a3a', '#f5a04a', '#f8b860', '#fbcd7a', '#fde09a'],
  night: ['#060a1a', '#0a1024', '#0e1630', '#121c3a', '#162244', '#1a284e'],
};
function buildBgFor(mapId, w, h, ground) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const r = seeded(7);
  const px = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, ww, hh); };
  const GR = ground;
  const bands = SKIES[mapId] || SKIES.meadow;
  const bot = GR - 10, bh = bot / bands.length;
  bands.forEach((col, i) => px(0, i * bh, w, bh + 1, col));
  for (let i = 1; i < bands.length; i++) {
    const y0 = Math.round(i * bh); g.fillStyle = bands[i];
    for (let x = 0; x < w; x += 2) g.fillRect(x + (y0 % 2), y0 - 2, 1, 1);
    for (let x = 0; x < w; x += 2) g.fillRect(x, y0 - 1, 1, 1);
  }
  const disc = (cx, cy, rad, inner, outer) => { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad) px(cx + x, cy + y, 1, 1, (x * x + y * y > (rad - 1) ** 2) ? outer : inner); };
  const canopy = (cx, cy, rad, dark, mid, light) => {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      const d = x * x + y * y; if (d > rad * rad) continue;
      let col = mid;
      if (d > (rad - 1.5) ** 2 || (x + y > rad * 0.6 && r() < 0.7)) col = dark;
      else if (x + y < -rad * 0.4 && r() < 0.65) col = light;
      else if (r() < 0.08) col = dark;
      px(cx + x, cy + y, 1, 1, col);
    }
  };
  const roundTree = (x, s, pal = ['#145c2a', '#22803a', '#4cb04a'], trunk = '#5a3415') => {
    const th = 10 + s * 0.6, base = GR + 2;
    px(x - 2, base - th, 4, th, trunk); px(x - 2, base - th, 1, th, '#3d220c');
    canopy(x, base - th - s * 0.6, s, ...pal); canopy(x - s * 0.6, base - th - s * 0.2, s * 0.7, ...pal); canopy(x + s * 0.6, base - th - s * 0.25, s * 0.7, ...pal);
  };
  const pine = (x, s, cols = ['#2f8a4a', '#17623a', '#0f4a26'], snowy = false, base = GR + 2) => {
    px(x - 1, base - 8, 3, 8, '#4a2a10');
    for (let i = 0; i < 4; i++) {
      const ty = base - 6 - i * s * 0.55, ww0 = s * (1 - i * 0.2);
      for (let y = 0; y < s * 0.8; y++) {
        const ww = Math.round(ww0 * (y / (s * 0.8)));
        for (let xx = -ww; xx <= ww; xx++) {
          let col = xx < -ww * 0.3 ? cols[0] : xx > ww * 0.6 ? cols[2] : cols[1];
          if (snowy && (y < 2 || (y < 4 && r() < 0.5) || (r() < 0.12))) col = y < 2 ? '#ffffff' : '#e4eef8';
          px(x + xx, ty - s * 0.8 + y, 1, 1, col);
        }
      }
    }
  };
  const hills = (c1, c2, a = 26, b = 16) => { for (let x = 0; x < w; x++) {
    const h1 = a + Math.sin(x * 0.045) * 8 + Math.sin(x * 0.13) * 3; px(x, GR - h1, 1, h1, c1);
    const h2 = b + Math.sin(x * 0.07 + 2) * 6; px(x, GR - h2, 1, h2, c2); } };
  const groundFill = (c1, c2) => { px(0, GR + 3, w, h - GR, c1); for (let y = GR + 3; y < h; y += 3) for (let x = (y % 6); x < w; x += 6) px(x, y, 1, 1, c2); };

  // foreground layer (drawn over targets on the ground)
  const fgc = document.createElement('canvas'); fgc.width = w; fgc.height = h;
  const f = fgc.getContext('2d'); const fp = (x, y, ww, hh, col) => { f.fillStyle = col; f.fillRect(x | 0, y | 0, ww, hh); };
  const gy = GR + 10, rr = seeded(3);
  const grassFg = (base, dark, tip, light, dots) => {
    fp(0, gy, w, h - gy, base);
    for (let y = gy + 4; y < h; y += 4) for (let x = (y % 8); x < w; x += 8) { fp(x, y, 2, 1, dark); fp(x + 4, y + 2, 1, 1, light); }
    for (let x = 0; x < w; x += 2) { const hh = 3 + Math.floor(rr() * 6); fp(x, gy - hh, 1, hh, rr() < 0.5 ? base : dark); if (rr() < 0.3) fp(x, gy - hh, 1, 1, tip); }
    if (dots) for (let i = 0; i < 14; i++) { const x = rr() * w, y = gy + 4 + rr() * 22; fp(x, y, 1, 1, dots[i % dots.length]); }
  };

  if (mapId === 'lake') {
    disc(150, 52, 6, '#fff6cf', '#ffe9a0');
    hills('#7ab0c8', '#5f98b4', 30, 20);
    for (let x = 4; x < w; x += 11) pine(x, 6 + (x % 3), ['#3a7a5a', '#2a6248', '#1a4a36'], false, GR - 18);
    // the lake
    const top = GR - 20;
    for (let y = top; y < GR + 10; y++) { const k = (y - top) / 30; px(0, y, w, 1, k < 0.3 ? '#3a78c8' : k < 0.6 ? '#3270bc' : '#2a66ae'); }
    for (let i = 0; i < 60; i++) { const x = r() * w, y = top + 2 + r() * 26; px(x, y, 3 + r() * 6, 1, r() < 0.5 ? '#6aa8e8' : '#9ccaf4'); }
    for (let x = 0; x < w; x += 1) px(x, top, 1, 1, '#a8d4f8');
    groundFill('#3f9a2e', '#358525');
    grassFg('#4caf34', '#3d9a2a', '#8ee06a', '#69c84a');
    // reeds & cattails
    for (let i = 0; i < 26; i++) { const x = rr() * w, hh = 8 + rr() * 14; fp(x, gy - hh, 1, hh, rr() < 0.5 ? '#4a8a2a' : '#5aa034'); if (rr() < 0.45) fp(x - 0.5, gy - hh, 2, 4, '#6a3a1a'); }
  } else if (mapId === 'snow') {
    // pale sun, white mountains
    disc(146, 50, 6, '#ffffff', '#eef3fa');
    for (let x = 0; x < w; x++) {
      const m = 52 + Math.abs(((x * 1.3) % 70) - 35) * -0.9 + Math.sin(x * 0.05) * 6;
      for (let y = 0; y < m; y++) px(x, GR - m + y, 1, 1, y < 8 ? '#ffffff' : y < 14 ? '#dfe8f2' : '#a8b8cc');
    }
    hills('#c8d6e6', '#b4c4d8', 20, 12);
    [10, 34, 58, 80, 104, 128, 150, 172].forEach((x, i) => pine(x, 9 + (i % 3) * 2, ['#2a6a4a', '#1a5038', '#0e3a28'], true));
    groundFill('#eef3fa', '#d2deec');
    fp(0, gy, w, h - gy, '#f4f8fc');
    for (let y = gy + 4; y < h; y += 4) for (let x = (y % 8); x < w; x += 8) { fp(x, y, 2, 1, '#dce6f2'); fp(x + 4, y + 2, 1, 1, '#ffffff'); }
    for (let x = 0; x < w; x++) { const hh = 2 + Math.round(Math.sin(x * 0.09) * 2 + 2 + rr() * 1.2); fp(x, gy - hh, 1, hh, '#f4f8fc'); if (rr() < 0.2) fp(x, gy - hh, 1, 1, '#ffffff'); }
    for (let i = 0; i < 8; i++) { const x = rr() * w, y = gy + 6 + rr() * 20; fp(x, y, 2, 1, '#c0cede'); }
  } else if (mapId === 'desert') {
    disc(140, 58, 12, '#fff2c0', '#ffd27a');
    // mesas
    const mesa = (x0, x1, hh, col, top) => { for (let x = x0; x < x1; x++) { const e = Math.min(x - x0, x1 - x) < 4 ? Math.min(x - x0, x1 - x) * 2 : 8; px(x, GR - hh + 8 - e, 1, hh - 8 + e, col); px(x, GR - hh + 8 - e, 1, 2, top); } };
    mesa(-10, 60, 50, '#b45a3a', '#d4784a'); mesa(110, 170, 40, '#a85234', '#c86a42'); mesa(60, 100, 28, '#c46a44', '#dc8a5a');
    hills('#d8a060', '#c89050', 18, 10);
    const cactus = (x, hh) => { const base = GR + 4; px(x - 2, base - hh, 4, hh, '#3a7a3a'); px(x - 2, base - hh, 1, hh, '#2a5a2a'); px(x - 7, base - hh * 0.6, 3, hh * 0.3, '#3a7a3a'); px(x - 7, base - hh * 0.6 + hh * 0.3 - 2, 6, 2, '#3a7a3a'); px(x + 4, base - hh * 0.75, 3, hh * 0.35, '#3a7a3a'); px(x + 2, base - hh * 0.75 + hh * 0.35 - 2, 5, 2, '#3a7a3a'); };
    cactus(20, 26); cactus(74, 18); cactus(128, 30); cactus(166, 16);
    groundFill('#e8c07a', '#d8ac62');
    grassFg('#dcb06a', '#c89a52', '#f4d696', '#f0d090', ['#8a5a2a', '#a87a4a']);
    for (let i = 0; i < 5; i++) { const x = rr() * w, y = gy - 2 + rr() * 4; f.strokeStyle = '#8a6a3a'; f.lineWidth = 1; f.beginPath(); f.arc(x, y, 3, 0, 6.3); f.stroke(); }
  } else if (mapId === 'night') {
    for (let i = 0; i < 70; i++) px(r() * w, r() * (GR - 40), 1, 1, r() < 0.2 ? '#ffffff' : '#8a9ac8');
    disc(146, 54, 9, '#f4f0d8', '#c8c4a8'); disc(150, 51, 7, '#0a1024', '#0a1024'); // crescent moon
    hills('#121e3a', '#0e1830', 26, 16);
    [14, 70, 124].forEach((x, i) => pine(x, 10 + i * 1.5, ['#0c1a14', '#08140e', '#050e0a']));
    [40, 100, 158].forEach((x, i) => roundTree(x, 11 + i * 2, ['#06100a', '#0a1a10', '#10241a'], '#120a06'));
    for (let x = -4; x < w + 8; x += 9) canopy(x, GR + 1, 5 + ((x * 7) % 3), '#06100a', '#0c1c12', '#122818');
    groundFill('#0f2410', '#0a1c0c');
    grassFg('#163218', '#0e2410', '#2a5a2a', '#1e4220');
  } else { // meadow
    disc(150, 52, 6, '#fff6cf', '#ffe9a0');
    hills('#7bbf9a', '#5fa87e');
    pine(14, 12); roundTree(40, 13); pine(70, 10); roundTree(100, 10); pine(124, 13); roundTree(158, 15);
    for (let x = -4; x < w + 8; x += 9) canopy(x, GR + 1, 5 + ((x * 7) % 3), '#145c2a', '#2c8f3c', '#58c050');
    groundFill('#3f9a2e', '#358525');
    grassFg('#4caf34', '#3a9428', '#8ee06a', '#69c84a', ['#fff', '#ffd23f']);
  }
  return { bg: c, fg: fgc };
}
let curMap = null, titleBrowseMap = null;
function mapDef(id) { return ECON.MAPS.find(m => m.id === (id || Meta.save.equip.map)) || ECON.MAPS[0]; }
function buildBg(id) {
  curMap = mapDef(id || titleBrowseMap || Meta.save.equip.map);
  const o = buildBgFor(curMap.id, W, H, GROUND); bg = o.bg; fg = o.fg;
  clouds = [];
  const nc = curMap.id === 'night' ? 0 : curMap.id === 'desert' ? 2 : 4;
  for (let i = 0; i < nc; i++) {
    const img = makeCloud(28 + i * 7, 9 + (i % 2) * 3);
    clouds.push({ img, x: rand(0, W), y: Math.round(40 + i * 32 + rand(-6, 6)), v: rand(2, 5), a: curMap.id === 'snow' ? 0.75 : 1 });
  }
  snow = [];
  if (curMap.id === 'snow') for (let i = 0; i < 45; i++) snow.push({ x: rand(0, W), y: rand(0, H), v: rand(8, 20), s: Math.random() < 0.3 ? 2 : 1, p: rand(0, 6) });
}
const thumbCache = {};
function mapThumb(id) {
  if (!thumbCache[id]) { const o = buildBgFor(id, W, 120, 92); const c = document.createElement('canvas'); c.width = W; c.height = 120; const g = c.getContext('2d'); g.drawImage(o.bg, 0, 0); g.drawImage(o.fg, 0, 0); thumbCache[id] = c; }
  return thumbCache[id];
}
// ---------------- sizing ----------------
function resize() {
  const vw = window.innerWidth || document.documentElement.clientWidth, vh = window.innerHeight || document.documentElement.clientHeight;
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
  const r = wrap.getBoundingClientRect(), cs = getComputedStyle(document.documentElement);
  const sat = parseFloat(cs.getPropertyValue('--sat')) || 0, sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
  wrap.style.setProperty('--safe-top', Math.max(0, sat - r.top) + 'px');
  wrap.style.setProperty('--safe-right', Math.max(0, sar - ((window.innerWidth || 0) - r.right)) + 'px');
  GROUND = H - 72; BAR = 30; SKY_TOP = 34; SKY_BOT = GROUND - 26;
  darkC.width = W; darkC.height = H;
  buildBg();
}
const darkC = document.createElement('canvas'), darkX = darkC.getContext('2d');
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (window.visualViewport) visualViewport.addEventListener('resize', () => { // iOS toolbar show/hide; ignore the on-screen keyboard
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  clearTimeout(resize.t); resize.t = setTimeout(resize, 120); });

// ---------------- content tables ----------------
const MAP_ANIMALS = {
  // Meadow is the original roster only (ducks, bluebirds, deer; gold birds and pink decoys come from the round mix).
  meadow: {
    sig: 'bird', hint: 'DEER IN THE WOODS!',
    fly: [{ k: 'bird', w: 1 }, { k: 'blue', w: 0.45 }],
    ground: [{ k: 'deer', w: 1 }]
  },
  // Later maps: their original animals arrive as before (flyer at round 1, ground animals from round 4),
  // then ONE new animal at a time at rounds 6, 14 and 22 (never a boss round).
  lake: {
    sig: 'goose', sigName: 'GEESE', hint: 'GEESE ON THE WATER!',
    fly: [{ k: 'goose', w: 1 }, { k: 'kingfisher', w: 0.8, intro: 6, name: 'KINGFISHER' }],
    ground: [{ k: 'swimgoose', w: 1 }, { k: 'frog', w: 0.8, intro: 14, name: 'FROG' }, { k: 'beaver', w: 0.75, intro: 22, name: 'BEAVER' }]
  },
  snow: {
    sig: 'owl', sigName: 'SNOW OWLS', hint: 'RABBITS & WOLVES!',
    fly: [{ k: 'owl', w: 1 }, { k: 'ptarmigan', w: 0.8, intro: 6, name: 'PTARMIGAN' }],
    ground: [{ k: 'rabbit', w: 1 }, { k: 'wolf', w: 0.9 }, { k: 'fox', w: 0.8, intro: 14, name: 'FOX' }, { k: 'weasel', w: 0.7, intro: 22, name: 'WEASEL' }]
  },
  desert: {
    sig: 'vulture', sigName: 'VULTURES', hint: 'ROADRUNNERS & COYOTES!',
    fly: [{ k: 'vulture', w: 1 }, { k: 'hawk', w: 0.8, intro: 6, name: 'HAWK' }],
    ground: [{ k: 'roadrunner', w: 1 }, { k: 'coyote', w: 0.85 }, { k: 'scorpion', w: 0.8, intro: 14, name: 'SCORPION' }, { k: 'jackrabbit', w: 0.75, intro: 22, name: 'JACKRABBIT' }]
  },
  night: {
    sig: 'bat', sigName: 'BATS', hint: 'EYES IN THE BUSHES!',
    fly: [{ k: 'bat', w: 1 }, { k: 'owl', w: 0.55 }, { k: 'moth', w: 0.8, intro: 6, name: 'MOTH' }],
    ground: [{ k: 'eyes', w: 1 }, { k: 'raccoon', w: 0.8, intro: 14, name: 'RACCOON' }, { k: 'skunk', w: 0.7, intro: 22, name: 'SKUNK' }]
  }
};
function mapRec(id) { return MAP_ANIMALS[id] || MAP_ANIMALS.meadow; }
function sigFly(id) { return mapRec(id).sig || 'bird'; }
function debutFor(mapId, r) {
  const rec = mapRec(mapId);
  return (rec.fly || []).concat(rec.ground || []).find(e => e.intro === r) || null;
}
// Header line for a round that brings something new to this map (null when nothing new arrives).
function newsFor(mapId, r) {
  const d = debutFor(mapId, r);
  if (d) return { kind: d.k, text: 'NEW: ' + d.name + '!' };
  const rec = mapRec(mapId);
  if (mapId === 'meadow' || !rec.sigName) return null;
  if (r === 1) return { kind: rec.sig, text: 'NEW: ' + rec.sigName + '!' };
  if (r === 4) return { kind: (rec.ground[0] || {}).k, text: 'NEW: ' + rec.hint.replace(/!$/, '') + '!' };
  return null;
}
function rosterFor(mapId, r) {
  const idx = Math.max(0, ECON.mapIndex(mapId));
  const flyW = {}, groundW = {};
  for (let i = 0; i <= idx; i++) {
    const mid = ECON.MAPS[i].id, rec = mapRec(mid);
    const inherit = Math.pow(0.48, idx - i);
    const bump = (e) => (i === idx && e.intro ? 1.1 : 1);
    const locked = e => i === idx && (e.intro || 1) > r; // earlier maps were finished: their full roster is in
    (rec.fly || []).forEach(e => {
      if (locked(e)) return;
      flyW[e.k] = (flyW[e.k] || 0) + e.w * inherit * bump(e);
    });
    (rec.ground || []).forEach(e => {
      if (locked(e)) return;
      groundW[e.k] = (groundW[e.k] || 0) + e.w * inherit * bump(e);
    });
  }
  const norm = (w) => {
    const items = Object.keys(w).map(k => [k, w[k]]);
    const sum = items.reduce((a, x) => a + x[1], 0) || 1;
    return items.map(([k, v]) => [k, v / sum]);
  };
  return { fly: norm(flyW), ground: norm(groundW) };
}
// Kept as a snapshot of each map's own animals (plus hints) for older hooks / attract mode.
const MAP_SET = {
  meadow: { fly: [['bird', 0.7], ['blue', 0.3]], ground: ['deer'], hint: 'DEER IN THE WOODS!' },
  lake: { fly: [['goose', 0.45], ['bird', 0.35], ['blue', 0.20]], ground: ['swimgoose', 'swimgoose', 'deer'], hint: 'GEESE ON THE WATER!' },
  snow: { fly: [['owl', 0.55], ['bird', 0.25], ['goose', 0.20]], ground: ['rabbit', 'wolf', 'rabbit', 'deer'], hint: 'RABBITS & WOLVES!' },
  desert: { fly: [['vulture', 0.50], ['bird', 0.22], ['goose', 0.16], ['owl', 0.12]], ground: ['roadrunner', 'coyote', 'roadrunner', 'rabbit'], hint: 'ROADRUNNERS & COYOTES!' },
  night: { fly: [['bat', 0.42], ['owl', 0.24], ['vulture', 0.14], ['bird', 0.12], ['goose', 0.08]], ground: ['eyes', 'eyes', 'wolf', 'coyote'], hint: 'EYES IN THE BUSHES!' },
};
const KIND = {
  bird: { set: 'bird', m: 'fly', hp: 2, name: 'DUCK' }, blue: { set: 'blue', m: 'fly', hp: 2, name: 'BLUEBIRD' }, gold: { set: 'gold', m: 'fly', spd: 1.35, size: 0.85, life: 0.8, hp: 2, name: 'GOLDEN BIRD' }, decoy: { set: 'decoy', m: 'fly', hp: 1, name: 'PINK DECOY' },
  goose: { set: 'goose', m: 'skim', hp: 4, size: 1.12, spd: 0.85, name: 'GOOSE' },
  owl: { set: 'owl', m: 'glide', spd: 0.95, hp: 3, name: 'OWL' }, bat: { set: 'bat', m: 'flutter', size: 0.85, spd: 1.1, hp: 2, name: 'BAT' },
  vulture: { set: 'vulture', m: 'circle', size: 1.1, spd: 0.9, hp: 4, name: 'VULTURE' },
  deer: { set: 'deer', m: 'run', g: 1, size: 1.6, hp: 4, name: 'DEER' }, fawn: { set: 'deer', m: 'run', g: 1, size: 0.95, hp: 2, spd: 0.78, name: 'FAWN' }, pup: { set: 'wolf', m: 'run', g: 1, size: 0.9, hp: 2, spd: 0.85, name: 'PUP' }, bag: { set: 'bag', m: 'fly', g: 0, size: 1, hp: 1, spd: 1, name: 'BAG' }, swimgoose: { set: 'goose', m: 'swim', g: 1, size: 1.2, hp: 4, spd: 0.45, name: 'SWIMMING GOOSE' },
  rabbit: { set: 'rabbit', m: 'hop', g: 1, size: 1.25, spd: 0.9, hp: 3, name: 'RABBIT' }, wolf: { set: 'wolf', m: 'run', g: 1, size: 1.5, spd: 1.2, hp: 5, name: 'WOLF' },
  roadrunner: { set: 'roadrunner', m: 'run', g: 1, size: 1.25, spd: 1.55, hp: 3, name: 'ROADRUNNER' }, coyote: { set: 'coyote', m: 'run', g: 1, size: 1.5, spd: 1.05, hp: 5, name: 'COYOTE' },
  eyes: { set: null, m: 'peek', g: 1, size: 1, hp: 3, name: 'EYES' },
  cardinal: { set: 'cardinal', m: 'dart', hp: 2, spd: 1.15, size: 0.9, name: 'CARDINAL' },
  squirrel: { set: 'squirrel', m: 'hop', g: 1, size: 1.05, spd: 1.05, hp: 2, hopH: 11, hopCyc: 0.55, name: 'SQUIRREL' },
  pheasant: { set: 'pheasant', m: 'flush', g: 1, size: 1.3, spd: 1.05, hp: 3, name: 'PHEASANT' },
  kingfisher: { set: 'kingfisher', m: 'dive', hp: 3, spd: 1.05, size: 0.95, name: 'KINGFISHER' },
  frog: { set: 'frog', m: 'hop', g: 1, size: 1.05, spd: 0.7, hp: 2, hopH: 16, hopCyc: 0.9, name: 'FROG' },
  beaver: { set: 'beaver', m: 'swim', g: 1, size: 1.25, spd: 0.4, hp: 4, name: 'BEAVER' },
  fox: { set: 'fox', m: 'dash', g: 1, size: 1.45, spd: 1.15, hp: 4, name: 'FOX' },
  ptarmigan: { set: 'ptarmigan', m: 'glide', spd: 0.9, hp: 3, size: 1.05, name: 'PTARMIGAN' },
  weasel: { set: 'weasel', m: 'run', g: 1, size: 1.05, spd: 1.45, hp: 2, name: 'WEASEL' },
  hawk: { set: 'hawk', m: 'stoop', size: 1.15, spd: 1.05, hp: 4, name: 'HAWK' },
  scorpion: { set: 'scorpion', m: 'crawl', g: 1, size: 1.1, spd: 0.55, hp: 3, name: 'SCORPION' },
  jackrabbit: { set: 'jackrabbit', m: 'hop', g: 1, size: 1.3, spd: 1.25, hp: 3, hopH: 13, hopCyc: 0.55, name: 'JACKRABBIT' },
  raccoon: { set: 'raccoon', m: 'amble', g: 1, size: 1.35, spd: 0.75, hp: 4, name: 'RACCOON' },
  moth: { set: 'moth', m: 'flutter', size: 0.9, spd: 1.05, hp: 2, name: 'MOTH' },
  skunk: { set: 'skunk', m: 'amble', g: 1, size: 1.2, spd: 0.65, hp: 3, name: 'SKUNK' },
};
Object.keys(KIND).forEach(k => { KIND[k].hp = ECON.kindHp(k); });
const BOSSES = {
  eagle: { name: 'GIANT EAGLE', set: 'eagle', sc: 3, m: 'bfly' },
  buck: { name: 'BIG BUCK', set: 'buck', sc: 2.4, m: 'brun', minion: { kind: 'fawn', set: 'deer' } },
  stag: { name: 'GREAT STAG', set: 'stag', sc: 2.55, m: 'brun', minion: { kind: 'fawn', set: 'deer' } },
  goose: { name: 'GOOSE KING', set: 'goose', sc: 3, m: 'bfly', crown: 1 },
  swan: { name: 'SWAN QUEEN', set: 'swan', sc: 3.05, m: 'bfly', crown: 1 },
  heron: { name: 'STORM HERON', set: 'heron', sc: 3.15, m: 'bfly' },
  yeti: { name: 'YETI OWL', set: 'snowowl', sc: 3, m: 'bfly' },
  frostwolf: { name: 'FROST WOLF', set: 'frostwolf', sc: 2.5, m: 'brun', minion: { kind: 'pup', set: 'frostwolf' } },
  elk: { name: 'DIRE ELK', set: 'elk', sc: 2.6, m: 'brun', minion: { kind: 'fawn', set: 'elk' } },
  vulture: { name: 'THUNDERBIRD', set: 'thunder', sc: 3, m: 'bfly' },
  jackal: { name: 'PHARAOH JACKAL', set: 'jackal', sc: 2.45, m: 'brun', minion: { kind: 'pup', set: 'jackal' } },
  sunroc: { name: 'SUN ROC', set: 'sunroc', sc: 3.2, m: 'bfly' },
  batking: { name: 'BAT KING', set: 'batking', sc: 3, m: 'bfly', crown: 1 },
  shadowowl: { name: 'SHADOW OWL', set: 'shadowowl', sc: 3.1, m: 'bfly' },
  bloodmoon: { name: 'BLOOD MOON', set: 'bloodmoon', sc: 3.25, m: 'bfly' },
};
const payKind = k => k === 'swimgoose' ? 'goose' : k;
const WDEF = id => ECON.WEAPONS.find(w => w.id === id);
const hpOf = k => k === 'boss' ? ECON.bossHp(round) : ECON.kindHp(k);
function shotDmg(w, info = {}) {
  if (!w) return 1;
  let d = w.dmg || 1;
  if (info.charge != null && w.id === 'bow') {
    const c = info.charge;
    d = c >= 0.95 ? d : Math.max(1, Math.round(d * (0.45 + 0.55 * c)));
  }
  if (info.crit) d *= 2;
  return Math.max(1, Math.round(d));
}
function dmgLine(id) {
  const tr = Meta.track(id + '.dmg'); if (!tr) return '';
  const now = Meta.val(tr.id), nxt = Meta.maxed(tr) ? null : ECON.infVal(tr, Meta.levelOf(tr.id) + 1);
  return nxt == null ? ('DMG ' + now) : ('DMG ' + now + ' \u2192 ' + nxt);
}

const TDEF = id => ECON.TURRETS.find(t => t.id === id);

// ---------------- game state ----------------
let state = 'title', paused = false;
let best = store.get('best', 0);
let M = ECON.MAPS[0];
let score = 0, runCash = 0, round = 0, shots = 0, hits = 0, streak = 0, bestStreak = 0, missRun = 0, maxMiss = 3, moneyMult = 1, eyeMult = 1;
let runRanked = true, perfectRun = false, bonusCashEarned = 0, bonusT = 0, bonusIntroT = 0, wantBonus = false, deferredRun = false, afterFinalize = null;
let secondLeft = 0, roundCash0 = 0, perkAuto = -1, perkLoader = 1, perkReserve = 0, perkCombo = 99, perkComboPay = 1, perkCrit = 0, perkEgg = 1, perkMagnet = 0, perkDeer = 1, perkDeerMercy = 0, perkDeerCash = 1, perkBullet = 1, saveSlowT = 0, deerMercyLeft = 0;
let focusCharges = 0, focusMax = 0, focusDur = 3, focusT = 0, reviveUsed = false;
// missRun = X's used this run (TOTAL, not in a row). fromCkpt = checkpoint round this run started at (0 = fresh, ranked run).
let fromCkpt = 0, ckptFlash = 0, ckptRound = 0;
const CKPT_EVERY = 5;
let infinity = false, bossKilled = false, mapJustCleared = false, failedClear = false;
let roundHits = 0, roundEsc = 0, roundTotal = 0, queue = [], spawnT = 0, diff = null, bossT = null, bossRound = false;
let introT = 0, clearT = 0, dieT = 0, banner = '', banner2 = '', holdRound = false, news = null;
let pendingNext = null, shiftT = 0, runMaps = [], cashSettled = 0;
let targets = [], parts = [], floats = [], flashes = [], projs = [], zaps = [], tracers = [];
let shake = 0, hitStop = 0, skyFlash = 0, whiteFlash = 0, cursor = null, lastTouch = 0, contTimer = null;
let weapons = [], wi = 0, wpn = null, turrets = [], gadgets = { flak: 0, call: 0, decoy: 0 }, armed = false, decoyObj = null;
let holding = false, drawing = null, aim = { x: W / 2, y: 150 }, lightPos = null, shotKills = 0, laserSnd = 0, mgSnd = 0;
const HUNTER_X = W / 2;
// The gun pivots at the hunter's right shoulder; shots leave from the barrel tip along the (clamped) aim.
const PIVOT_Y = () => H - BAR - 13;
function aimAngle() {
  let a = Math.atan2(aim.y - PIVOT_Y(), aim.x - HUNTER_X);
  if (a > -0.12 && a <= Math.PI / 2) a = -0.12; else if (a > Math.PI / 2 || a < -Math.PI + 0.12) a = -Math.PI + 0.12; // never into the ground
  return a;
}
// shoulder slides smoothly toward the side you aim at (right shoulder when aiming right, left when aiming left)
const gunPivot = () => ({ x: HUNTER_X + clamp(Math.cos(aimAngle()) * 8, -4, 4), y: PIVOT_Y() });
const muzzle = () => { const p = gunPivot(), a = aimAngle(); return { x: p.x + Math.cos(a) * 10, y: p.y + Math.sin(a) * 10 }; };
const TURRET_X = [62, 118, 40];

function makeWeapon(id) {
  const def = WDEF(id), g = k => Meta.val(id + '.' + k);
  const extra = perkReserve || 0;
  const cap = g('cap') + (id === 'laser' ? extra * 0.35 : extra);
  const w = { id, def, cap, reload: g('reload') * (perkLoader || 1), ammo: 0, reloading: false, reloadT: 0, cool: 0, heat: 0, overheated: false, swapT: 0, radius: 5, autoT: 0 };
  w.dmg = g('dmg') || 1;
  if (id === 'shotgun') w.radius = g('choke');
  if (id === 'handgun') { w.radius = g('sights'); w.crit = g('crit'); }
  if (id === 'rifle') { w.radius = g('caliber'); w.pierce = g('pierce'); }
  if (id === 'bow') { w.radius = g('tip'); w.draw = g('draw'); w.pierce = g('pierce'); }
  if (id === 'mg') { w.radius = 3; w.spread = g('spread'); w.rate = g('rate'); }
  if (id === 'laser') { w.radius = g('width'); w.power = g('power'); }
  w.ammo = id === 'laser' ? 0 : w.cap;
  return w;
}
function makeTurret(id, i) {
  const g = k => Meta.val(id + '.' + k);
  const t = { id, x: TURRET_X[i] || 40 + i * 30, y: H - BAR - 9, ammo0: g('ammo'), ammo: 0, cool: rand(0.6, 1.4), ang: -Math.PI / 2, flash: 0, lock: null };
  t.dmg = g('dmg') || 2;
  if (id === 'pellet') { t.rate = g('rate'); t.err = g('aim'); }
  if (id === 'tesla') { t.rate = 3; t.chain = g('chain'); t.range = g('range'); }
  if (id === 'missile') { t.rate = g('rate'); t.blast = g('blast'); }
  t.ammo = t.ammo0; return t;
}
function autoReloadDelay() {
  if (Meta.levelOf('perk.auto') > 0) return Meta.val('perk.auto');
  if (Meta.autoBoostActive()) {
    const tr = Meta.track('perk.auto');
    return (tr && tr.val && tr.val[1] != null) ? tr.val[1] : 0.20;
  }
  return -1;
}
function applyGear() {
  const v = Meta.val;
  focusMax = v('focus'); maxMiss = v('luck'); moneyMult = v('bounty'); eyeMult = v('eye');
  focusDur = ECON.extendVal(Meta.track('focus').dur, Meta.levelOf('focus')) || 3;
  perkAuto = autoReloadDelay(); // -1 = off (player must reload by hand)
  perkLoader = v('perk.loader') || 1;
  perkReserve = v('perk.reserve') || 0;
  perkCombo = Meta.levelOf('perk.combo') > 0 ? v('perk.combo') : 99;
  const comboT = Meta.track('perk.combo');
  perkComboPay = (comboT && comboT.pay && Meta.levelOf('perk.combo') > 0) ? (ECON.extendVal(comboT.pay, Meta.levelOf('perk.combo')) || 1) : 1;
  perkCrit = v('perk.crit') || 0;
  perkEgg = v('perk.eggsnipe') || 1;
  perkMagnet = v('perk.magnet') || 0;
  perkDeer = v('perk.deer') || 1;
  const deerT = Meta.track('perk.deer');
  perkDeerMercy = (deerT && deerT.mercy && Meta.levelOf('perk.deer') > 0) ? (deerT.mercy[Math.min(Meta.levelOf('perk.deer'), deerT.mercy.length - 1)] || 0) : 0;
  perkDeerCash = (deerT && deerT.cash && Meta.levelOf('perk.deer') > 0) ? (deerT.cash[Math.min(Meta.levelOf('perk.deer'), deerT.cash.length - 1)] || 1) : 1;
  perkBullet = Meta.levelOf('perk.bullet') > 0 ? v('perk.bullet') : 1;
  secondLeft = v('perk.second') || 0;
  deerMercyLeft = perkDeerMercy;
  saveSlowT = 0;
}
function worldSlow() {
  let s = 1;
  if (perkBullet < 1 && (bossRound || missRun >= maxMiss - 1)) s = Math.min(s, perkBullet);
  if (saveSlowT > 0) s = Math.min(s, 0.5);
  return s;
}
function breakStreak() {
  if (perkCombo >= 99) streak = 0;
  else streak = Math.max(0, streak - perkCombo);
}
function resetRun() {
  if (!curMap || curMap.id !== Meta.save.equip.map) buildBg();
  M = curMap;
  score = 0; runCash = 0; round = 0; shots = 0; hits = 0; streak = 0; bestStreak = 0; missRun = 0; reviveUsed = false; fromCkpt = 0; ckptFlash = 0;
  bossKilled = false; mapJustCleared = false; failedClear = false;
  wantBonus = false; bonusCashEarned = 0; bonusT = 0; bonusIntroT = 0;
  pendingNext = null; shiftT = 0; runMaps = []; cashSettled = 0;
  applyGear();
  const eq = Meta.activeEquip();
  weapons = [makeWeapon(Meta.owns(eq.primary) ? eq.primary : 'shotgun')];
  if (Meta.val('loadout') && eq.secondary && eq.secondary !== weapons[0].id && Meta.owns(eq.secondary)) weapons.push(makeWeapon(eq.secondary));
  wi = 0; wpn = weapons[0];
  const slots = Meta.val('turret.slots');
  turrets = eq.turrets.filter(id => Meta.hasTurret(id)).slice(0, slots).map(makeTurret);
  gadgets = { flak: Meta.val('gadget.flak'), call: Meta.val('gadget.call'), decoy: Meta.val('gadget.decoy') };
  armed = false; decoyObj = null; holding = false; drawing = null; bossT = null;
  targets = []; parts = []; floats = []; projs = []; zaps = []; tracers = [];
  holdRound = false;
}
function addCash(n) { n = Math.round(n); Meta.addBank(n); runCash += n; }
function float(text, x, y, color = '#fff', sz = 1, life = 1) { floats.push({ text, x, y, t: 0, life, color, sz }); }

function weightedPick(items, fallback) {
  if (!items || !items.length) return fallback;
  let x = Math.random(), acc = 0;
  for (const [k, p] of items) { acc += p; if (x < acc) return k; }
  return items[0][0];
}
function pickFly() {
  const ros = rosterFor(M.id, round);
  return weightedPick(ros.fly, sigFly(M.id));
}
function pickGround() {
  const ros = rosterFor(M.id, Math.max(4, round));
  return weightedPick(ros.ground, 'deer');
}
function bossIdFor(r) { return ECON.bossIdFor(M.id, r); }
function isGroundBoss(t) { return !!(t && t.m === 'brun'); }

function startRound(opts) {
  if (!(opts && opts.restart)) round++;
  diff = Object.assign({}, ECON.difficulty(round, M, { infinity }));
  diff.speed *= M.speed; diff.deerSpeed *= M.speed; diff.life *= M.life; diff.scale *= M.size;
  bossRound = round % ECON.BOSS_EVERY === 0;
  queue = [];
  if (bossRound) {
    queue.push('boss'); // eggs (and the hatchlings they become) spawn during the fight
  } else {
    for (let i = 0; i < diff.count; i++) {
      const x = Math.random(); let k;
      if (round === 1) k = sigFly(M.id);
      else if (x < diff.deer) k = pickGround();
      else if (x < diff.deer + diff.decoy) k = 'decoy';
      else if (x < diff.deer + diff.decoy + diff.gold) k = 'gold';
      else k = pickFly();
      queue.push(k);
    }
    if (round >= 4 && !queue.some(k => KIND[k] && KIND[k].g)) queue[Math.floor(rand(1, queue.length))] = pickGround();
    if (round >= 4 && Meta.levelOf('perk.deer') > 0) { queue.push(pickGround()); queue.push(pickGround()); }
    const debut = debutFor(M.id, round);
    if (debut && !queue.includes(debut.k)) queue[Math.floor(rand(0, Math.max(1, queue.length)))] = debut.k;
  }
  roundCash0 = runCash;
  roundTotal = queue.filter(k => k !== 'decoy').length;
  roundHits = 0; roundEsc = 0; spawnT = 0.6; bossT = null; bossKilled = false;
  weapons.forEach(w => { w.ammo = w.id === 'laser' ? 0 : w.cap; w.heat = 0; w.overheated = false; w.reloading = false; });
  turrets.forEach(t => { t.ammo = t.ammo0; t.cool = rand(0.6, 1.4); t.lock = null; }); resetTurretStats();
  focusCharges = focusMax; focusT = 0; armed = false;
  state = 'intro'; introT = bossRound ? 2.2 : 1.6;
  const inp = wpn.def.input;
  news = null;
  if (bossRound) { const b = BOSSES[bossIdFor(round)]; banner = (infinity ? 'INF ' : '') + 'BOSS ROUND!'; banner2 = b.name + ' APPROACHES'; Sfx.boss(); }
  else {
    banner = (infinity ? 'INFINITY ' : '') + 'ROUND ' + round;
    news = newsFor(M.id, round);
    banner2 = news ? news.text
      : round === 1 ? (inp === 'hold' ? 'HOLD TO SPRAY' : inp === 'draw' ? 'HOLD TO DRAW, RELEASE' : inp === 'beam' ? 'HOLD TO FIRE BEAM' : 'TAP TO SHOOT')
      : round === 3 ? "DON'T SHOOT PINK DECOYS (-$)" : round === 4 ? mapRec(M.id).hint : round === ECON.BOSS_EVERY - 1 ? 'BOSS NEXT ROUND!' : '';
    if (news) introT = 2.6; // give the new-animal header time to read
    Sfx.roundStart();
  }
  if (round % CKPT_EVERY === 0) reachCheckpoint({ silent: !!(opts && opts.revive) });
  showGameButtons(true);
  Meta.event('roundStart', { round }); notify();
}
// Checkpoint = the START of round 5, 10, 15... (per map, persistent). Boss rounds are 10, 20...: their checkpoint is
// saved as the boss round begins, so continuing puts you right in front of that boss with clean X's.
function reachCheckpoint(opts) {
  const bag = infinity ? 'ckptInf' : 'ckpt';
  const c = Meta.save[bag] || (Meta.save[bag] = {});
  const isNew = round > (c[M.id] || 0);
  if (isNew) {
    c[M.id] = round;
    if (!infinity) {
      Meta.save.ckptRun = Meta.save.ckptRun || {};
      Meta.save.ckptRun[M.id] = { score, runCash, hits, shots, bestStreak, round, maps: runMaps.slice() };
    }
    Meta.persist();
  }
  if (!(opts && opts.silent) && round !== fromCkpt) { ckptFlash = 2.6; ckptRound = round; Sfx.buy(); if (bossRound) introT = Math.max(introT, 2.8); }
}
function checkpointFor(mapId, inf) { const c = (inf ? Meta.save.ckptInf : Meta.save.ckpt) || {}; return c[mapId] || 0; }

function tImg(t) { return t.kind === 'egg' ? SPR.egg[0] : t.kind === 'eyes' ? { width: 12, height: 6 } : SPR[t.set][0]; }
function groundY(set, sc) { return GROUND + 12 - SPR[set][0].height * sc / 2; }
function spawn(kind) {
  if (kind === 'boss') {
    const id = bossIdFor(round), b = BOSSES[id], hp = ECON.bossHp(round, M.id), tm = ECON.bossTime(round) * eyeMult;
    const t = { kind: 'boss', boss: id, name: b.name, set: b.set, sc: b.sc, m: b.m, crown: b.crown, minion: b.minion, hp, hp0: hp, timer: tm, timer0: tm, state: 'fly', anim: 0, ph: rand(0, 6), risen: false, hurt: 0, life: 99 };
    // Patrol the upper sky, left <-> right, until the escape timer runs out (Hunter's Eye stretches the timer and slows the patrol).
    t.x0 = 18; t.x1 = W - 18; t.x = t.x0;
    let cross = Math.max(3.4, 5.5 - Math.floor(round / ECON.BOSS_EVERY) * 0.35) * eyeMult;
    if (ECON.isFinaleRound(round)) cross = Math.max(3.0, cross * 0.9);
    t.vx = (t.x1 - t.x0) / cross; t.risen = true; t.leaving = false;
    if (isGroundBoss(t)) {
      // Patrol the ground band, just above the grass/hunter — not in the sky and not in the HUD.
      t.y = Math.min(groundY(b.set, b.sc), GROUND - 6);
    } else {
      t.y = SKY_TOP + 52;
    }
    t.y0 = t.y; t.hop = 0; t.dropT = 1.6 * eyeMult;
    targets.push(t); bossT = t; shake = 5; Sfx.deer();
    return;
  }
  const K = KIND[kind];
  const set = kind === 'owl' && M.id === 'snow' ? 'snowowl' : K.set;
  const base = { kind, set, m: K.m, hp: K.hp || 1, hp0: K.hp || 1, state: 'fly', anim: rand(0, 1), hurt: 0, g: K.g || 0 };
  if (K.m === 'peek') {
    const pt = clamp(diff.life * 0.42, 0.55, 1.6) * eyeMult;
    targets.push(Object.assign(base, { x: rand(20, W - 20), y: GROUND + rand(-3, 4), sc: 1, vis: true, pt, pt0: pt, peeks: 3, vx: 0, life: 99 }));
    return;
  }
  if (K.g) {
    const dir = 1, sc = K.size * (kind === 'swimgoose' ? 1 : Math.max(0.85, diff.scale));
    const sp = diff.deerSpeed * (K.spd || 1) * (perkDeer || 1) * rand(0.9, 1.15) / Math.sqrt(eyeMult);
    const y = K.m === 'swim' ? GROUND - 6 : groundY(set, sc);
    targets.push(Object.assign(base, { x: dir > 0 ? -20 : W + 20, y, y0: y, vx: dir * sp, vy: 0, sc, life: 99, hop: 0, hopT: 0, hopH: K.hopH, hopCyc: K.hopCyc, flushT: 0, dashT: 0 }));
    if (kind !== 'eyes') Sfx.rustle();
    return;
  }
  targets.push(makeFlyer(kind, K, set, base));
}
// Flyers always enter on the LEFT edge and leave on the RIGHT edge (that exit is the only way to escape).
// Crossing time = linger time (+0.7s, the old fly-away window) x Hunter's Eye -> Eye slows horizontal speed.
function crossTime(K) { return (diff.life * (K.life || 1) + 0.7) * eyeMult / Math.sqrt(K.spd || 1); }
function makeFlyer(kind, K, set, base) {
  const sc = diff.scale * (K.size || 1), T = crossTime(K) * rand(0.9, 1.1);
  const x0 = -10, vx = (W + 22) / T;                 // from just off-left to just off-right
  const lowBand = K.m === 'skim', diveBand = K.m === 'dive';
  const yTop = lowBand ? SKY_BOT - 70 : SKY_TOP + 14;
  const yBot = lowBand ? SKY_BOT - 6 : (diveBand ? SKY_BOT - 4 : SKY_BOT - 10);
  const y = rand(yTop + 6, Math.max(yTop + 8, (diveBand ? (yTop + yBot) / 2 : yBot) - 6));
  const vsp = diff.speed * rand(0.85, 1.15) * (K.spd || 1); // vertical zig speed
  const t = Object.assign(base, { x: x0, y, y0: y, vx, vx0: vx, vy: (Math.random() < 0.5 ? -1 : 1) * vsp * 0.5, sp: vsp, sc, yTop, yBot,
    erratic: Math.random() < diff.erratic || K.m === 'flutter' || K.m === 'dart', turnT: rand(0.4, 1), risen: true, ph: rand(0, 6), life: T, diveT: rand(0.5, 1.1) });
  if (K.m === 'circle' || K.m === 'stoop') { t.R = rand(10, 16); t.w = 2.2 * (Math.random() < 0.5 ? 1 : -1); t.ang = 0; }
  return t;
}
const live = t => t.state === 'fly' || t.state === 'flee';
const hittable = t => live(t) && (t.kind !== 'eyes' || t.vis);
function alive() { return targets.filter(live).length; }
function boxDist(t, x, y) {
  const img = tImg(t), hw = img.width * t.sc / 2 - 1, hh = img.height * t.sc / 2 - 1;
  const dx = Math.max(Math.abs(x - t.x) - hw, 0), dy = Math.max(Math.abs(y - t.y) - hh, 0);
  return Math.sqrt(dx * dx + dy * dy);
}
function segDist(t, x0, y0, x1, y1) { // distance from target box to a segment; returns {d, s(0..1)}
  const vx = x1 - x0, vy = y1 - y0, L2 = vx * vx + vy * vy || 1;
  const s = clamp(((t.x - x0) * vx + (t.y - y0) * vy) / L2, 0, 1);
  return { d: boxDist(t, x0 + vx * s, y0 + vy * s), s };
}

function dropEgg(boss) {
  const mid = Math.random() < 0.45;
  const hatchY = mid ? boss.y + rand(36, 100) : GROUND - rand(22, 50);
  targets.push({ kind: 'egg', set: 'egg', state: 'fly', x: boss.x + rand(-3, 3), y: boss.y + 8,
    vx: 0, vy: 16, sc: 1.2, hp: ECON.kindHp('egg'), hp0: ECON.kindHp('egg'), hatchY: clamp(hatchY, boss.y + 24, GROUND - 14),
    risen: true, anim: 0, hurt: 0, life: 99, g: 0 });
}
function smashEgg(t, src) {
  const mul = perkEgg || 1;
  const pts = Math.round(ECON.eggPts(round) * M.pts * mul / 10) * 10;
  const cash = Math.max(1, Math.round(ECON.eggCash(round) * moneyMult * M.cash * mul * (src === 'turret' ? ECON.TURRET_CASH : 1)));
  score += pts; addCash(cash);
  if (src !== 'turret') { hits++; }
  float('+' + fmt(pts), t.x, t.y - 12, '#ffe066', 1.1, 0.9);
  Sfx.eggCrack();
  t.state = 'gone';
  for (let k = 0; k < 10; k++) parts.push({ x: t.x, y: t.y, vx: rand(-40, 40), vy: rand(-55, 8), c: k % 2 ? '#f4e6b8' : '#d8a24a', t: 0, life: rand(0.25, 0.7), g: 180, s: 1 });
}
function hatchEgg(egg) {
  const kind = pickFly();
  const K = KIND[kind];
  const set = kind === 'owl' && M.id === 'snow' ? 'snowowl' : K.set;
  const base = { kind, set, m: K.m, hp: K.hp || 1, hp0: K.hp || 1, state: 'fly', anim: rand(0, 1), hurt: 0, g: 0, hatched: true };
  const bird = makeFlyer(kind, K, set, base);
  bird.x = clamp(egg.x, 8, W - 8);
  bird.y = clamp(egg.y, SKY_TOP + 16, SKY_BOT - 16);
  bird.y0 = bird.y;
  bird.vx = Math.abs(bird.vx0 || bird.vx || 40);
  bird.vx0 = bird.vx;
  bird.life = (W + 22 - bird.x) / bird.vx;
  bird.risen = true;
  targets.push(bird);
  roundTotal++;
  egg.state = 'gone';
  Sfx.hatch();
  for (let k = 0; k < 8; k++) parts.push({ x: egg.x, y: egg.y, vx: rand(-35, 35), vy: rand(-40, 10), c: k % 2 ? '#f4e6b8' : '#ffe066', t: 0, life: rand(0.25, 0.6), g: 140, s: 1 });
}
function maybeDropEgg(t, dt) {
  if (state !== 'play' || t.leaving) return;
  const tier = Math.max(1, Math.floor(round / ECON.BOSS_EVERY));
  const cap = 2 + tier;
  const mk = (t.minion && t.minion.kind) || 'fawn';
  const liveAdds = isGroundBoss(t)
    ? targets.filter(o => o !== t && live(o) && (o.kind === mk || o.kind === 'fawn' || o.kind === 'pup')).length
    : targets.filter(o => o !== t && live(o) && (o.kind === 'egg' || o.hatched)).length;
  if (liveAdds >= cap) { t.dropT = Math.max(t.dropT, 0.35); return; }
  t.dropT -= dt;
  if (t.dropT > 0) return;
  if (t.x < 24 || t.x > W - 24) return;
  t.dropT = ECON.eggInterval(round, M) * rand(0.82, 1.18);
  if (isGroundBoss(t)) dropFawn(t);
  else dropEgg(t);
}

function dropMinion(boss, spec) {
  const spec0 = spec || (boss && boss.minion) || { kind: 'fawn', set: 'deer' };
  const kind = spec0.kind || 'fawn';
  const K = KIND[kind] || KIND.fawn;
  const set = spec0.set || K.set;
  const sc = K.size;
  const sp = diff.deerSpeed * (K.spd || 1) * (perkDeer || 1) * rand(0.9, 1.15) / Math.sqrt(eyeMult);
  const y = groundY(set, sc);
  // Spawn just ahead of the boss so the minion is visible and not hidden inside the sprite.
  const x = clamp((boss && boss.x || 40) + 22 + rand(0, 6), 14, W - 70);
  targets.push({
    kind, set, m: K.m, hp: ECON.kindHp(kind), hp0: ECON.kindHp(kind),
    state: 'fly', anim: rand(0, 1), hurt: 0, g: 1,
    x, y, y0: y, vx: Math.abs(sp), vy: 0, sc, life: 99, hop: 0, hopT: 0, risen: true
  });
  roundTotal++;
  Sfx.rustle();
}
function dropFawn(boss) { dropMinion(boss || bossT, { kind: 'fawn', set: 'deer' }); }

// ---------------- damage, kills, misses ----------------
function damage(t, dmg, src, info = {}) {
  if (!hittable(t)) return false;
  dmg = Math.max(1, Math.round(dmg || 1));
  if (t.kind === 'decoy') { if (src !== 'turret') hitDecoy(t); return true; }
  // Purchased turrets should finish regular animals (eggs, fawns, hatchlings included). Bosses take normal turret damage only.
  if (src === 'turret' && t.kind !== 'boss') dmg = Math.max(dmg, Math.ceil(t.hp || 1));
  t.hp -= dmg; t.hurt = 0.16;
  const xo = (info.fx || 0);
  float((info.crit ? 'CRIT ' : '') + dmg, t.x + xo, t.y - 14, info.crit ? '#ff5a5a' : '#ffe066', info.crit ? 1.3 : 1.15, 0.7);
  if (t.hp > 0.001) {
    if (t.kind === 'boss') { Sfx.bossHit(t.boss); if (Math.random() < 0.4) feathers(t.x + rand(-8, 8), t.y + rand(-6, 6), APAL[t.set] || PAL.bird, 4); }
    else if (t.kind === 'egg') Sfx.hitSoft();
    else { Sfx.hitSoft(); }
    if (src === 'player' || src === 'flak') hits += 0; // accuracy counts kills only
    return true;
  }
  if (t.kind === 'egg') { smashEgg(t, src); return true; }
  kill(t, src, info);
  return true;
}
function kill(t, src, info = {}) {
  const byYou = src !== 'turret';
  if (byYou) { streak++; bestStreak = Math.max(bestStreak, streak); }
  hits += byYou ? 1 : 0; roundHits++; shotKills++;
  const mult = byYou ? Math.min(Math.max(streak, 1), 5) : 1, wd = wpn.def;
  let pts, cash;
  if (t.kind === 'boss') {
    pts = Math.round(20000 * (round / ECON.BOSS_EVERY) * M.pts / 10) * 10;
    cash = ECON.bossCash(round) * moneyMult * M.cash;
    if (perkEgg > 1) {
      const el = Meta.levelOf('perk.eggsnipe');
      cash *= 1 + 0.10 + 0.05 * Math.max(0, el - 1);
    }
    if (byYou && perkComboPay > 1) { cash *= perkComboPay; pts *= perkComboPay; }
    bossKilled = true; Meta.event('boss'); Sfx.bossRoar(); Sfx.bossDown(); shake = 8; whiteFlash = 0.15; bossT = null;
    float('BOSS DOWN!', W / 2, H * 0.32, '#ffd23f', 2.2, 2);
    for (let k = 0; k < 40; k++) parts.push({ x: t.x, y: t.y, vx: rand(-90, 90), vy: rand(-110, 20), c: ['#ffd23f', '#fff', '#ff9a3d'][k % 3], t: 0, life: rand(0.6, 1.4), g: 120, s: 2 });
  } else {
    const pk = payKind(t.kind);
    if (t.kind === 'bag') {
      const cashB = ECON.bagCash(t.bagSize || 'small', M);
      pts = t.bagSize === 'big' ? 5000 : t.bagSize === 'mid' ? 2000 : 800;
      cash = cashB;
      bonusCashEarned += cashB;
    } else if (t.kind === 'fawn' || t.kind === 'pup') {
      pts = Math.round(ECON.fawnPts(round) * M.pts * (byYou ? wd.pts : ECON.TURRET_PTS) / 10) * 10;
      cash = ECON.fawnCash(round) * moneyMult * M.cash * (byYou ? wd.cash : ECON.TURRET_CASH);
    } else {
      pts = ECON.killPts(pk, round, mult) * M.pts * (byYou ? wd.pts : ECON.TURRET_PTS);
      cash = ECON.killCash(pk, round, moneyMult, mult) * M.cash * (byYou ? wd.cash : ECON.TURRET_CASH);
    }
    if (byYou && wd.deerBonus && t.g) cash *= wd.deerBonus;
    if (byYou && wd.goldBonus && t.kind === 'gold') cash *= wd.goldBonus;
    if (byYou && t.g && perkDeerCash > 1) cash *= perkDeerCash;
    if (!info.crit && byYou && perkCrit > 0 && Math.random() < perkCrit) info.crit = true;
    if (info.crit) { cash *= 2; pts *= 2; float('CRIT!', t.x, t.y - 30, '#ff5a5a', 1.3, 0.9); }
    if (byYou && perkComboPay > 1) { cash *= perkComboPay; pts *= perkComboPay; }
    pts = Math.round(pts / 10) * 10;
  }
  cash = Math.max(1, Math.round(cash));
  score += pts; addCash(cash);
  if (!byYou) Meta.event('turretKill');
  Meta.event('kill', { kind: t.kind, ground: !!t.g, streak, score }); setTimeout(notify, 400);
  t.state = 'hit'; t.hitT = t.g ? 0.2 : 0.35; if (t.kind === 'boss') t.hitT = 0.6;
  const yo = (shotKills - 1) * 10;
  float('+' + fmt(pts), t.x, t.y - 16 - yo, t.kind === 'gold' ? '#ffd23f' : '#ffe066', 1.3, 1.1);
  float('+$' + fmt(cash) + (byYou ? '' : ' AUTO'), t.x, t.y - 8 - yo, '#7dff7a', 1, 1.1);
  if (t.kind === 'gold') { float('GOLDEN!', t.x, t.y - 24 - yo, '#fff2a0', 1.5, 1.2); Sfx.gold(); }
  if (t.kind === 'bag') { float('JACKPOT!', t.x, t.y - 24 - yo, '#fff2a0', 1.4, 1.1); Sfx.ching(); for (let k = 0; k < 16; k++) parts.push({ x: t.x, y: t.y, vx: rand(-70, 70), vy: rand(-90, 10), c: ['#ffe066', '#fff4b0', '#ffd23f', '#fff'][k % 4], t: 0, life: rand(0.4, 0.9), g: 160, s: rand(1, 2) }); }
  if (byYou && streak >= 2) { float('STREAK X' + mult, W / 2, SKY_TOP + 14, '#ff9a3d', 1.6, 1); Sfx.streak(mult); }
  if (t.kind === 'eyes') { for (let k = 0; k < 10; k++) parts.push({ x: t.x, y: t.y, vx: rand(-40, 40), vy: rand(-60, -10), c: '#ffe066', t: 0, life: rand(0.3, 0.7), g: 200, s: 1 }); Sfx.hit(); Sfx.cry('eyes'); }
  else if (t.g && t.kind !== 'swimgoose') { Sfx.hit(); Sfx.cry(t.kind); const pal = APAL[t.set] || DEER_PAL; for (let k = 0; k < 14; k++) parts.push({ x: t.x, y: t.y, vx: rand(-40, 40), vy: rand(-70, -10), c: Math.random() < 0.5 ? (pal.D || pal.W || '#b06a2c') : (pal.L || '#f0d2a0'), t: 0, life: rand(0.4, 0.8), g: 220, s: 1.5 }); }
  else if (t.kind !== 'boss' && t.kind !== 'bag') { feathers(t.x, t.y, APAL[t.set] || PAL[t.set] || PAL.bird, 16); Sfx.hit(); Sfx.cry(t.kind); }
}
function feathers(x, y, pal, n) {
  const cols = [pal.B || pal.O || pal.M || pal.W, pal.W || pal.L || pal.K, pal.G || pal.K, pal.B || pal.O || pal.M];
  for (let k = 0; k < n; k++) parts.push({ x, y, vx: rand(-55, 55), vy: rand(-60, 20), c: cols[k % cols.length] || '#fff', t: 0, life: rand(0.7, 1.4), g: 60, s: rand(1, 2), sway: rand(0, 6) });
}
function hitDecoy(t) {
  t.state = 'hit'; t.hitT = 0.3; t.vy = 0;
  const pen = Math.min(Meta.bank(), ECON.decoyPenalty(round));
  addCash(-pen); breakStreak(); Meta.event('decoy');
  score -= Math.min(score, 1000 * round);
  float('DECOY! -$' + pen, t.x, t.y - 14, '#ff5ec4', 1.2, 1.4);
  feathers(t.x, t.y, PAL.decoy, 14); Sfx.bad();
}
function beginShot() { shotKills = 0; }
function endShot() {
  if (shotKills > 1) {
    const b = 1000 * shotKills * round; score += b;
    float((shotKills === 2 ? 'DOUBLE!' : 'MULTI X' + shotKills) + ' +' + fmt(b), W / 2, H / 2 - 60, '#7dff7a', 1.5, 1.3);
    Meta.event('multi', { n: shotKills, score });
  }
  shotKills = 0;
}
function escaped(t) {
  t.state = 'gone';
  if (t === bossT) bossT = null;
  if (state !== 'play' && state !== 'intro' && state !== 'bonus') return;
  if (t.kind === 'bag' || t.noMiss) return;
  if (t.kind === 'decoy') { float('SAFE', clamp(t.x, 20, W - 20), SKY_TOP + 6, '#ff8fc8', 1, 0.9); return; }
  if (t.g && deerMercyLeft > 0) {
    deerMercyLeft--;
    skyFlash = 0.2;
    float(deerMercyLeft >= 99 ? 'MERCY!' : ('MERCY! ' + (deerMercyLeft >= 99 ? '' : deerMercyLeft + ' LEFT')), clamp(t.x, 30, W - 30), GROUND - 20, '#7dff7a', 1.5, 1.2);
    try { Sfx.focus(); } catch (e) {}
    return;
  }
  if (secondLeft > 0) {
    secondLeft--;
    saveSlowT = Math.max(saveSlowT, 4);
    skyFlash = 0.28;
    float('SAVED! ' + secondLeft + ' LEFT', clamp(t.x, 30, W - 30), t.g ? GROUND - 20 : SKY_TOP + 8, '#7dff7a', 1.5, 1.2);
    try { Sfx.focus(); } catch (e) {}
    return;
  }
  missRun++; perfectRun = false; roundEsc++; breakStreak(); skyFlash = 0.5;
  float(t.kind === 'boss' ? 'BOSS ESCAPED!' : 'GOT AWAY', clamp(t.x, 30, W - 30), t.g ? GROUND - 20 : SKY_TOP + 8, '#ff5a5a', 1.5, 1.2);
  Sfx.escape();
  if (missRun >= maxMiss) die();
}
function die() {
  state = 'dying'; dieT = 1.6; banner = 'GAME OVER'; banner2 = missRun + ' GOT AWAY';
  shake = 6; holding = false; drawing = null; Sfx.gameOver(); Sfx.setMusic('menu'); showGameButtons(false);
}

// ---------------- weapons ----------------
const canAct = () => !paused && (state === 'play' || state === 'intro' || state === 'bonus');
function emptyMsg(x, y) {
  Sfx.empty();
  if (wpn.reloading) float(wpn.id === 'laser' ? 'VENTING' : 'RELOADING', x, y - 8, '#ccc', 1, 0.5);
  else float(wpn.def.reloadName + '!', x, y - 8, '#ff9a3d', 1.2, 0.6);
}
function needsReload(w) {
  if (!w || w.reloading) return false;
  if (w.id === 'laser') return !!w.overheated;
  return w.ammo <= 0;
}
function tickAutoReload(w, dt) {
  if (perkAuto < 0 || !w || !canAct()) { if (w) w.autoT = 0; return; }
  if (w.reloading || !needsReload(w)) { w.autoT = 0; return; }
  w.autoT = (w.autoT || 0) + dt;
  if (w.autoT >= perkAuto) { w.autoT = 0; startReload(w); }
}
function startReload(which) {
  if (!canAct()) return;
  const w = which || wpn; if (!w || w.reloading) return;
  if (w.id === 'laser' ? w.heat <= 0.01 : w.ammo >= w.cap) return;
  w.reloading = true; w.reloadT = w.reload; w.autoT = 0;
  if (w === wpn) holding = holding && w.id !== 'laser';
  if (w.id === 'laser') Sfx.vent();
  else if (w.id === 'shotgun') Sfx.shellInsert();
  else if (w.id === 'bow') Sfx.nock();
  else Sfx.magOut();
  if (w === wpn) drawing = null;
}
function finishReload(w) {
  w.reloading = false;
  if (w.id === 'laser') { w.heat = 0; w.overheated = false; } else w.ammo = w.cap;
  if (w.id === 'shotgun') Sfx.pump();
  else if (w.id === 'rifle') Sfx.bolt();
  else if (w.id === 'bow') Sfx.nockDone();
  else Sfx.magIn();
}
function useFocus() {
  if (paused || (state !== 'play' && state !== 'bonus') || focusCharges <= 0 || focusT > 0) return;
  focusCharges--; focusT = focusDur; Sfx.focus();
  float('FOCUS!', W / 2, H / 2 - 40, '#c9a7ff', 2, 1);
}
function swapWeapon() {
  if (!canAct() || weapons.length < 2) return;
  wi = 1 - wi; wpn = weapons[wi]; wpn.swapT = 0.3; holding = false; drawing = null; Sfx.swap();
  float(wpn.def.name.toUpperCase(), W / 2, H - BAR - 34, '#9fc4ff', 1.2, 0.8);
}
function areaHits(x, y, r) { return targets.filter(t => hittable(t) && boxDist(t, x, y) <= r); }
function fireTap(x, y) {
  const w = wpn;
  if (w.swapT > 0 || w.cool > 0) return;
  if (w.reloading || w.ammo <= 0) return emptyMsg(x, y);
  w.ammo--; w.cool = w.def.delay || 0.2; shots++; Meta.event('shot');
  beginShot();
  let any = false;
  if (w.id === 'shotgun') {
    Sfx.shot(); shake = Math.max(shake, 3); whiteFlash = 0.06; flashes.push({ x, y, t: 0, r: w.radius });
    const list = areaHits(x, y, w.radius);
    if (list.some(t => t.kind !== 'decoy')) hitStop = 0.05;
    list.forEach(t => { any = true; damage(t, shotDmg(w), 'player'); });
  } else if (w.id === 'handgun') {
    Sfx.pistol(); shake = Math.max(shake, 1.5); flashes.push({ x, y, t: 0, r: w.radius * 0.7 });
    const list = areaHits(x, y, w.radius).sort((a, b) => boxDist(a, x, y) - boxDist(b, x, y));
    if (list[0]) { any = true; const crit = Math.random() < w.crit; damage(list[0], shotDmg(w, { crit }), 'player', { crit }); hitStop = 0.03; }
  } else if (w.id === 'rifle') {
    Sfx.rifle(); shake = Math.max(shake, 4); whiteFlash = 0.05;
    const m = muzzle(), dx = x - m.x, dy = y - m.y, L = Math.hypot(dx, dy) || 1, ex = m.x + dx / L * 600, ey = m.y + dy / L * 600;
    tracers.push({ x0: m.x, y0: m.y, x1: ex, y1: ey, t: 0, life: 0.18, c: '#fff6a0', w: 1.4 });
    const list = targets.filter(hittable).map(t => ({ t, h: segDist(t, m.x, m.y, ex, ey) })).filter(o => o.h.d <= w.radius).sort((a, b) => a.h.s - b.h.s).slice(0, w.pierce);
    list.forEach(o => { any = true; damage(o.t, shotDmg(w), 'player'); });
    if (list.length) hitStop = 0.05;
    if (list.length >= 2) float('PIERCE X' + list.length, x, y - 20, '#9fe0ff', 1.3, 1);
  }
  endShot();
  if (!any) { breakStreak(); float('MISS', x, y - 6, '#fff', 1.5, 0.7); }
}
function fireMG(dt) {
  const w = wpn;
  w.cool -= 0; // cool decremented in update
  let n = 0;
  while (w.cool <= 0 && n < 4) {
    if (w.ammo <= 0) { if (n === 0 && mgSnd <= 0) { emptyMsg(aim.x, aim.y); mgSnd = 0.6; } holding = false; break; }
    n++; w.ammo--; w.cool += w.rate; shots++;
    const sx = aim.x + (Math.random() + Math.random() - 1) * w.spread, sy = aim.y + (Math.random() + Math.random() - 1) * w.spread;
    const m = muzzle(); tracers.push({ x0: m.x, y0: m.y, x1: sx, y1: sy, t: 0, life: 0.05, c: '#ffe066', w: 0.8 });
    flashes.push({ x: sx, y: sy, t: 0.06, r: 2 });
    const list = areaHits(sx, sy, w.radius).sort((a, b) => boxDist(a, sx, sy) - boxDist(b, sx, sy));
    beginShot();
    if (list[0]) damage(list[0], shotDmg(w), 'player');
    endShot();
    shake = Math.max(shake, 1.2);
  }
  if (n && mgSnd <= 0) { Sfx.mg(); mgSnd = 0.06; }
  if (w.ammo <= 0 && n) float(w.def.reloadName + '!', W - 32, H - BAR - 12, '#ff9a3d', 1.2, 0.8);
}
function fireLaser(dt) {
  const w = wpn;
  if (w.overheated || w.reloading) return;
  w.heat += dt;
  if (w.heat >= w.cap) { w.heat = w.cap; w.overheated = true; holding = false; Sfx.overheat(); float('OVERHEAT! VENT', W / 2, H - BAR - 30, '#ff5a2a', 1.3, 1); return; }
  const m = muzzle(), dx = aim.x - m.x, dy = aim.y - m.y, L = Math.hypot(dx, dy) || 1;
  const ex = m.x + dx / L * 600, ey = m.y + dy / L * 600;
  w.beam = { x0: m.x, y0: m.y, x1: ex, y1: ey };
  for (const t of targets) {
    if (!hittable(t)) continue;
    if (segDist(t, m.x, m.y, ex, ey).d <= w.radius) {
      t.burn = (t.burn || 0) + dt;
      const need = t.kind === 'boss' ? w.power * 2.2 : w.power;
      if (t.burn >= need) { t.burn = 0; beginShot(); damage(t, shotDmg(w), 'player'); endShot(); }
      if (Math.random() < 0.5) parts.push({ x: t.x + rand(-3, 3), y: t.y + rand(-3, 3), vx: rand(-20, 20), vy: rand(-30, 0), c: '#ff9a3d', t: 0, life: 0.3, g: 0, s: 1 });
    }
  }
  laserSnd -= dt; if (laserSnd <= 0) { Sfx.laser(); laserSnd = 0.08; }
}
function releaseArrow() {
  const w = wpn, d = drawing; drawing = null;
  if (!d || w.id !== 'bow' || !canAct()) return;
  if (w.reloading || w.ammo <= 0) return emptyMsg(aim.x, aim.y);
  const charge = clamp(d.t / w.draw, 0.15, 1);
  w.ammo--; shots++; Meta.event('shot');
  const m = muzzle(), g = 120, v = 140 + 230 * charge;
  const dx = aim.x - m.x, dy = aim.y - m.y, T = Math.max(0.12, Math.hypot(dx, dy) / v);
  projs.push({ type: 'arrow', x: m.x, y: m.y, vx: dx / T, vy: dy / T - 0.5 * g * T, g, r: w.radius, pierce: w.pierce, hitSet: new Set(), dmg: shotDmg(w, { charge }), full: charge >= 0.95, any: false, life: 4 });
  Sfx.bowShot();
  if (w.ammo <= 0) setTimeout(() => { if (wpn === w && w.ammo <= 0 && !w.reloading && state === 'play') float('NOCK!', W - 32, H - BAR - 12, '#ff9a3d', 1.2, 0.8); }, 250);
}

// ---------------- turrets ----------------
// Telemetry for tests: a "shot" is one fire event; a "hit" means that event damaged its mark.
const turretStats = { shots: 0, hits: 0, kills: 0, misses: 0 };
function resetTurretStats() { turretStats.shots = 0; turretStats.hits = 0; turretStats.kills = 0; turretStats.misses = 0; }
function timeToLeave(t) {
  if (!t || !hittable(t)) return 0;
  if (t.kind === 'eyes') return Math.max(0, t.pt || 0);
  if (t.kind === 'egg') {
    const vy = Math.max(20, t.vy || 20);
    if (t.hatchY != null) return Math.max(0, (t.hatchY - t.y) / vy);
    return 0.4;
  }
  if (t.kind === 'boss') {
    if (!t.leaving) return Math.max(0.2, t.timer || 1);
    const edge = (t.vx || 0) >= 0 ? (W + 16 * (t.sc || 1) - t.x) : (t.x + 16 * (t.sc || 1));
    return Math.max(0, edge / Math.max(24, Math.abs(t.vx || 0)));
  }
  const vx = t.g ? (t.vx || 0) : Math.max((t.vx0 || 0) * 0.55, t.vx || 0);
  if (vx > 0) return Math.max(0, (W + 12 - t.x) / vx);
  if (vx < 0) return Math.max(0, (t.x + 24) / Math.abs(vx));
  return 1;
}
function turretLeadTime(tu, t) {
  if (!tu || !t) return 0;
  if (tu.id === 'missile') return Math.hypot(t.x - tu.x, t.y - (tu.y - 8)) / 480;
  return 0; // pellet + tesla are hitscan
}
function turretValid(t, tu, leadT) {
  if (!t || !hittable(t) || (t.hp || 0) <= 0.001) return false;
  if (t.kind === 'decoy' || t.kind === 'bag') return false; // decoys penalize; bags are bonus, don't spend ammo
  if (t.x < -10 || t.x > W + 10 || t.y < -24 || t.y > H + 16) return false;
  if (tu && tu.id === 'tesla' && Math.hypot(t.x - tu.x, t.y - (tu.y - 6)) > tu.range) return false;
  // Cleanup, not wave-clear: wait until a regular is well onto the screen, but not so late the shot cannot connect.
  const earlyOk = t.kind === 'egg' || t.kind === 'fawn' || t.kind === 'pup' || t.kind === 'eyes' || t.kind === 'boss' || t.hatched;
  if (!earlyOk && (t.x / W) < 0.32) return false;
  return timeToLeave(t) > (leadT || 0) + 0.08;
}
function turretPriority(t) {
  if (t.kind === 'boss') return 0.35;
  if (t.kind === 'gold') return 2.3;
  if (t.kind === 'egg') return 1.7;
  if (t.kind === 'fawn' || t.kind === 'pup' || t.hatched) return 1.55;
  if (t.g) return 1.45;
  return 1 + (t.x / W); // closer to the right edge is a higher priority, but only if still hittable in time
}
function turretTaken(tu) {
  const locked = new Set();
  for (const o of turrets) if (o !== tu && o.lock && o.lock.kind !== 'boss') locked.add(o.lock);
  for (const p of projs) if (p.type === 'missile' && p.target && p.target.kind !== 'boss') locked.add(p.target);
  return locked;
}
function pickTurretTarget(tu) {
  if (tu.lock && turretValid(tu.lock, tu, turretLeadTime(tu, tu.lock))) return tu.lock;
  tu.lock = null;
  const taken = turretTaken(tu);
  let best = null, bd = -1;
  for (const t of targets) {
    if (taken.has(t)) continue;
    const lead = turretLeadTime(tu, t);
    if (!turretValid(t, tu, lead)) continue;
    let d = turretPriority(t);
    if (tu.id === 'missile' && (t.kind === 'gold' || t.g)) d += 0.3;
    if (d > bd) { bd = d; best = t; }
  }
  return best;
}
function dangerOf(t) { // kept for older hooks / missile retarget fallback
  return turretValid(t, null, 0) ? turretPriority(t) : -1;
}
function noteTurretKillIfDead(t) {
  if (t && ((t.hp || 0) <= 0.001 || t.state === 'gone' || t.state === 'hit' || t.state === 'fall')) turretStats.kills++;
}
function updTurrets(dt) {
  for (const tu of turrets) {
    tu.flash = Math.max(0, tu.flash - dt);
    tu.cool -= dt;
    if (tu.lock && !turretValid(tu.lock, tu, turretLeadTime(tu, tu.lock))) tu.lock = null;
    if (tu.cool > 0 || tu.ammo <= 0 || (state !== 'play' && state !== 'bonus')) continue;
    const best = pickTurretTarget(tu);
    if (!best) continue;
    tu.lock = best;
    tu.ammo--; tu.cool = tu.rate; tu.flash = 0.18;
    const mx = tu.x, my = tu.y - 6;
    const ty = best.y - (best.hop || 0);
    tu.ang = Math.atan2(ty - my, best.x - mx);
    turretStats.shots++;
    if (tu.id === 'pellet') {
      // Hitscan + a bright tracer so the player sees the shot land. No aim error, no slow projectile to miss.
      tracers.push({ x0: mx, y0: my, x1: best.x, y1: ty, t: 0, life: 0.22, c: '#fff6a0', w: 2.2 });
      flashes.push({ x: best.x, y: ty, t: 0, r: 7 });
      beginShot();
      const ok = damage(best, tu.dmg || 2, 'turret');
      shotKills = 0;
      if (ok) { turretStats.hits++; noteTurretKillIfDead(best); } else turretStats.misses++;
      if (!hittable(best)) tu.lock = null;
      Sfx.pellet();
    } else if (tu.id === 'tesla') {
      const chain = [best]; let cur = best;
      while (chain.length < tu.chain) {
        const nx = targets.filter(t => turretValid(t, tu, 0) && !chain.includes(t) && Math.hypot(t.x - cur.x, t.y - cur.y) < 55)
          .sort((a, b) => Math.hypot(a.x - cur.x, a.y - cur.y) - Math.hypot(b.x - cur.x, b.y - cur.y))[0];
        if (!nx) break; chain.push(nx); cur = nx;
      }
      const pts = [{ x: tu.x, y: tu.y - 10 }].concat(chain.map(t => ({ x: t.x, y: t.y - (t.hop || 0) })));
      zaps.push({ pts, t: 0 });
      tracers.push({ x0: mx, y0: my, x1: best.x, y1: ty, t: 0, life: 0.2, c: '#bff4ff', w: 1.8 });
      beginShot();
      let hit = 0;
      chain.forEach(t => { if (damage(t, tu.dmg || 3, 'turret')) { hit++; noteTurretKillIfDead(t); } });
      shotKills = 0;
      if (hit) turretStats.hits++; else turretStats.misses++;
      if (!hittable(best)) tu.lock = null;
      Sfx.zap();
    } else if (tu.id === 'missile') {
      const dx = best.x - mx, dy = ty - (tu.y - 8), L = Math.hypot(dx, dy) || 1;
      projs.push({ type: 'missile', x: tu.x, y: tu.y - 8, vx: dx / L * 220, vy: dy / L * 220, target: best, blast: tu.blast, life: 2.4, dmg: tu.dmg || 3, x0: mx, y0: my, marked: false });
      tracers.push({ x0: mx, y0: my, x1: best.x, y1: ty, t: 0, life: 0.16, c: '#ffb030', w: 1.6 });
      Sfx.missile();
    }
  }
}
function explode(x, y, r, src, dmg) {
  Sfx.boom(); shake = Math.max(shake, src === 'flak' ? 5 : 3);
  for (let k = 0; k < 26; k++) { const a = rand(0, 6.28), s = rand(10, 70); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c: ['#fff6a0', '#ffb030', '#ff5a2a', '#555'][k % 4], t: 0, life: rand(0.25, 0.6), g: 20, s: rand(1, 2.5) }); }
  flashes.push({ x, y, t: 0, r, boom: true });
  beginShot(); let any = false;
  targets.filter(t => hittable(t) && boxDist(t, x, y) <= r && (src !== 'turret' || t.kind !== 'decoy')).forEach(t => { any = true; damage(t, dmg, src); });
  if (src === 'turret') shotKills = 0; else endShot();
  return any;
}
// ---------------- gadgets ----------------
function useGadget(kind) {
  if (!canAct() || gadgets[kind] <= 0) return;
  if (kind === 'flak') { armed = !armed; Sfx.click(); if (armed) float('TAP TO THROW', W / 2, H / 2, '#ffd23f', 1.3, 1); return; }
  gadgets[kind]--;
  if (kind === 'call') {
    let n = 0;
    for (let i = 0; i < queue.length && n < 3; i++) if (queue[i] !== 'boss' && queue[i] !== 'decoy') { queue[i] = 'gold'; n++; }
    while (n < 3) { queue.push('gold'); roundTotal++; n++; }
    Sfx.lure(); float('BIRD CALL! GOLDEN x3', W / 2, H / 2 - 30, '#ffd23f', 1.3, 1.4);
  } else if (kind === 'decoy') {
    decoyObj = { x: W / 2, y: SKY_TOP + (SKY_BOT - SKY_TOP) * 0.5, t: 6 };
    Sfx.lure(); float('DECOY OUT!', W / 2, H / 2 - 30, '#9fe0ff', 1.3, 1.2);
  }
  syncGadgets();
}
function throwFlak(x, y) {
  armed = false; gadgets.flak--; syncGadgets(); shots++;
  projs.push({ type: 'flak', x: HUNTER_X, y: H - BAR - 20, tx: x, ty: y, t: 0, T: 0.35 });
}
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
  if (paused || !canAct()) return;
  if (p.y > H - BAR) return;
  lightPos = p; aim = p;
  try { cvs.setPointerCapture(e.pointerId); } catch (er) {}
  if (armed) { if (gadgets.flak > 0) throwFlak(p.x, p.y); return; }
  const inp = wpn.def.input;
  if (inp === 'tap') fireTap(p.x, p.y);
  else if (inp === 'hold' || inp === 'beam') {
    holding = true;
    if (inp === 'hold' && (wpn.reloading || wpn.ammo <= 0)) { emptyMsg(p.x, p.y); holding = false; }
    if (inp === 'beam' && (wpn.reloading || wpn.overheated)) { emptyMsg(p.x, p.y); holding = false; }
    if (holding && inp === 'beam') { shots++; Meta.event('shot'); }
  } else if (inp === 'draw') {
    if (wpn.reloading || wpn.ammo <= 0) emptyMsg(p.x, p.y);
    else { drawing = { t: 0 }; Sfx.bowDraw(); }
  }
});
cvs.addEventListener('pointermove', e => {
  const p = toLogical(e);
  if (e.pointerType === 'mouse') { cursor = p; lightPos = p; }
  if (holding || drawing) { aim = p; lightPos = p; }
});
cvs.addEventListener('pointerleave', () => cursor = null);
function pointerEnd(e) {
  const p = toLogical(e);
  if (downInfo && p.y - downInfo.y > 40 && performance.now() - downInfo.t < 600 && canAct() && wpn.def.input === 'tap') startReload();
  downInfo = null;
  if (drawing) { aim = p; releaseArrow(); }
  holding = false; if (wpn) wpn.beam = null;
}
cvs.addEventListener('pointerup', pointerEnd);
cvs.addEventListener('pointercancel', pointerEnd);
window.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.code === 'KeyR' || e.code === 'Space') { e.preventDefault(); startReload(); }
  if (e.code === 'KeyF') useFocus();
  if (e.code === 'KeyQ' || e.code === 'Tab') { e.preventDefault(); swapWeapon(); }
  if (e.code === 'KeyG') useGadget('flak');
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) Meta.persist();
  if (document.hidden && !paused && canAct()) togglePause(); });

// ---------------- update ----------------
function fmtBoostClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
let boostWasOn = false, boostBtnStamp = '';
function boostOwnedForUi() {
  const titleOn = $('ov-title') && !$('ov-title').classList.contains('hidden');
  const infOn = $('ov-infinity') && !$('ov-infinity').classList.contains('hidden');
  const overOn = $('ov-over') && !$('ov-over').classList.contains('hidden');
  if (overOn) {
    const inf = !!(infinity || (lastRun && lastRun.infinity));
    return Meta.withMode(inf ? 'infinity' : 'campaign', () => Meta.ownsAutoReload());
  }
  if (infOn) return Meta.withMode('infinity', () => Meta.ownsAutoReload());
  if (titleOn) return Meta.withMode('campaign', () => Meta.ownsAutoReload());
  return Meta.ownsAutoReload();
}
function refreshBoostButtons() {
  const owned = boostOwnedForUi();
  const left = Meta.autoBoostLeft();
  const active = !owned && left > 0;
  const stamp = (owned ? 'own' : active ? 'on:' + fmtBoostClock(left) : 'offer') + (Meta.isAdFree && Meta.isAdFree() ? ':af' : '');
  if (stamp === boostBtnStamp) return;
  boostBtnStamp = stamp;
  document.querySelectorAll('.boost-btn').forEach(b => {
    b.classList.toggle('owned', !!owned);
    b.classList.toggle('on', !!active);
    b.disabled = !!(owned || active);
    if (owned) b.innerHTML = 'You own Auto Reload';
    else if (active) b.innerHTML = 'AUTO RELOAD ' + fmtBoostClock(left);
    else b.innerHTML = (Meta.isAdFree && Meta.isAdFree()) ? 'AUTO RELOAD 15 MIN' : '&#9654; AD: Auto Reload 15 min';
  });
}
function watchAutoBoost() {
  const next = autoReloadDelay();
  const ended = boostWasOn && next < 0 && Meta.levelOf('perk.auto') <= 0;
  perkAuto = next;
  if (ended) { toastQ.length = 0; toastBusy = false; toast('Auto Reload ended', '', 0); }
  boostWasOn = Meta.autoBoostActive() && Meta.levelOf('perk.auto') <= 0;
  refreshBoostButtons();
}
function startAutoBoostAd() {
  Sfx.init(); Sfx.click(); Ads.init();
  if (boostOwnedForUi() || Meta.autoBoostActive()) { refreshBoostButtons(); return; }
  Ads.showRewarded().then(ok => {
    if (!ok) return;
    Meta.grantAutoBoost();
    perkAuto = autoReloadDelay();
    boostWasOn = true;
    boostBtnStamp = '';
    toast('AUTO RELOAD ON', '15 minutes', 0);
    Sfx.gold();
    refreshBoostButtons();
  });
}

function update(dt) {
  for (const c of clouds) { c.x += c.v * dt; if (c.x > W + 10) c.x = -c.img.width - 10; }
  for (const f of snow) { f.y += f.v * dt; f.x += Math.sin(f.p + f.y * 0.05) * 6 * dt; if (f.y > H) { f.y = -2; f.x = rand(0, W); } }
  watchAutoBoost();
  if (paused) return;
  let gdt = dt;
  if (focusT > 0) { focusT -= dt; gdt *= 0.38; }
  if (saveSlowT > 0) saveSlowT = Math.max(0, saveSlowT - dt);
  const bt = worldSlow();
  if (bt < 1) gdt *= bt;
  if (hitStop > 0) { hitStop -= dt; gdt = 0; }
  mgSnd -= dt;
  for (const w of weapons) {
    w.cool = Math.max(w.id === 'mg' ? -0.01 : 0, w.cool - dt); w.swapT = Math.max(0, w.swapT - dt);
    if (w.reloading) { w.reloadT -= dt; if (w.reloadT <= 0) finishReload(w); }
    if (w.id === 'laser' && !(holding && w === wpn) && !w.reloading && !w.overheated) w.heat = Math.max(0, w.heat - dt * 0.12);
    tickAutoReload(w, dt);
  }
  if (canAct() && wpn) {
    if (holding && wpn.id === 'mg' && !wpn.reloading && wpn.swapT <= 0) fireMG(dt);
    if (wpn.id === 'laser') { if (holding && wpn.swapT <= 0) fireLaser(dt); else wpn.beam = null; if (!holding) wpn.beam = null; }
    if (drawing) drawing.t += dt;
  }
  ckptFlash = Math.max(0, ckptFlash - dt);
  shake = Math.max(0, shake - dt * 25); skyFlash = Math.max(0, skyFlash - dt); whiteFlash = Math.max(0, whiteFlash - dt);

  if (titleScene()) {
    if (targets.length < 3 && Math.random() < 0.02) {
      const sp = rand(25, 45), fl = sigFly(curMap.id);
      const k = Math.random() < 0.2 ? 'gold' : fl, K = KIND[k];
      targets.push({ kind: k, set: k === 'owl' && curMap.id === 'snow' ? 'snowowl' : K.set, m: 'fly', x: -10, y: rand(SKY_TOP + 60, SKY_BOT - 20), vx: sp, vx0: sp, vy: rand(-1, 1) * sp * 0.4, sp: sp * 0.6, sc: 1.2, yTop: SKY_TOP + 40, yBot: SKY_BOT - 10, state: 'fly', anim: 0, life: 1e9, risen: true, erratic: true, turnT: 1, attract: true, hp: (K.hp || ECON.kindHp(k) || 2), hp0: (K.hp || ECON.kindHp(k) || 2), hurt: 0 });
    }
  } else if (state === 'intro') {
    introT -= dt; if (introT <= 0) state = 'play';
  } else if (state === 'play') {
    spawnT -= gdt;
    const conc = bossT ? 2 : diff.conc;
    if (spawnT <= 0 && queue.length && alive() < conc) { spawn(queue.shift()); spawnT = diff.interval * rand(0.8, 1.2); }
    if (!holdRound && !queue.length && targets.length === 0 && !projs.some(p => p.type === 'flak')) roundClear();
    updTurrets(gdt);
  } else if (state === 'bonus') {
    if (bonusIntroT > 0) bonusIntroT -= dt;
    else {
      bonusT -= gdt;
      spawnT -= gdt;
      if (bonusT > 0 && spawnT <= 0 && alive() < 5) { spawnBag(); spawnT = rand(0.35, 0.7); }
      if (bonusT <= 0 && targets.length === 0 && !projs.some(p => p.type === 'flak')) endBonus();
      updTurrets(gdt);
    }
  } else if (state === 'clear') {
    clearT -= dt;
    if (clearT <= 0) {
      if (mapJustCleared) {
        mapJustCleared = false;
        if (wantBonus) startBonusRound();
        else afterMapClear();
      }
      else if (failedClear) { failedClear = false; gameOver(); }
      else startRound(); // shop is only on the title / game-over screens, never mid-run
    }
  } else if (state === 'mapshift') {
    shiftT -= dt;
    if (shiftT <= 0) afterMapClear();
  } else if (state === 'dying') {
    dieT -= dt; if (dieT <= 0) { state = 'ad'; onDeath(); }
  }
  if (decoyObj) { decoyObj.t -= gdt; if (decoyObj.t <= 0) decoyObj = null; }

  if (state !== 'ad' && state !== 'over' && state !== 'shop') for (const t of targets) updTarget(t, gdt);
  targets = targets.filter(t => t.state !== 'gone');
  updProjs(gdt);
  for (const p of parts) { p.t += gdt; p.vy += p.g * gdt; p.vx *= 1 - 1.5 * gdt; p.x += (p.vx + (p.sway ? Math.sin(p.t * 8) * p.sway * 4 : 0)) * gdt; p.y += p.vy * gdt; }
  parts = parts.filter(p => p.t < p.life);
  for (const f of floats) { f.t += dt; f.y -= 12 * dt; }
  floats = floats.filter(f => f.t < f.life);
  for (const f of flashes) f.t += dt;
  flashes = flashes.filter(f => f.t < (f.boom ? 0.25 : 0.12));
  for (const z of zaps) z.t += dt; zaps = zaps.filter(z => z.t < 0.18);
  for (const tr of tracers) tr.t += dt; tracers = tracers.filter(tr => tr.t < tr.life);
}
function updProjs(dt) {
  for (const p of projs) {
    p.life -= dt;
    if (p.type === 'arrow') {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      for (const t of targets) {
        if (p.pierce <= 0 || p.hitSet.has(t) || !hittable(t)) continue;
        if (boxDist(t, p.x, p.y) <= p.r) {
          p.hitSet.add(t); p.pierce--; p.any = true;
          beginShot(); damage(t, p.dmg, 'player'); endShot(); Sfx.arrowHit();
        }
      }
      if (p.pierce <= 0) p.dead = true;
      if (p.y > GROUND + 14 || p.x < -10 || p.x > W + 10 || p.y < -60 || p.life <= 0) { p.dead = true; if (!p.any && canAct()) float('MISS', clamp(p.x, 12, W - 12), clamp(p.y, SKY_TOP + 10, GROUND), '#9aa', 1, 0.6); }
    } else if (p.type === 'pellet') {
      p.x += p.vx * dt; p.y += p.vy * dt;
      for (const t of targets) if (hittable(t) && t.kind !== 'decoy' && boxDist(t, p.x, p.y) <= p.r) { damage(t, p.dmg || 2, 'turret'); p.dead = true; break; }
      if (p.y < -10 || p.x < -10 || p.x > W + 10 || p.life <= 0) p.dead = true;
    } else if (p.type === 'missile') {
      const mark = (hit) => { if (p.marked) return; p.marked = true; if (hit) turretStats.hits++; else turretStats.misses++; };
      const alreadyDown = t => t && (t.kind !== 'decoy') && ((t.hp || 0) <= 0.001 || t.state === 'hit' || t.state === 'fall' || t.state === 'gone');
      let t = p.target;
      if (!(t && turretValid(t, null, 0))) {
        const nxt = targets.filter(x => turretValid(x, null, 0) && x.kind !== 'boss').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] || null;
        if (nxt) { p.target = nxt; t = nxt; }
        else if (alreadyDown(t)) {
          // Original mark is already down and nothing else to chase — count a hit, not a miss.
          const tx = t.x, ty = (t.y || 0) - (t.hop || 0);
          explode(tx, ty, p.blast, 'turret', p.dmg || 3);
          tracers.push({ x0: p.x0 != null ? p.x0 : p.x, y0: p.y0 != null ? p.y0 : p.y, x1: tx, y1: ty, t: 0, life: 0.18, c: '#ffb030', w: 2 });
          mark(true);
          p.dead = true;
        } else {
          p.target = null; t = null;
        }
      }
      if (!p.dead && t && hittable(t) && t.kind !== 'decoy') {
        const tx = t.x, ty = t.y - (t.hop || 0);
        const a = Math.atan2(ty - p.y, tx - p.x);
        const sp = Math.min(520, Math.max(220, Math.hypot(p.vx, p.vy)) + 620 * dt);
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        if (Math.hypot(tx - p.x, ty - p.y) < Math.max(10, (p.blast || 8) * 0.7)) {
          const any = explode(tx, ty, p.blast, 'turret', p.dmg || 3);
          tracers.push({ x0: p.x0 != null ? p.x0 : p.x, y0: p.y0 != null ? p.y0 : p.y, x1: tx, y1: ty, t: 0, life: 0.2, c: '#ffb030', w: 2.2 });
          mark(!!any || alreadyDown(t));
          if (any) noteTurretKillIfDead(t);
          p.dead = true;
        }
      }
      if (!p.dead) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (Math.random() < 0.8) parts.push({ x: p.x, y: p.y, vx: rand(-5, 5), vy: rand(-5, 5), c: Math.random() < 0.5 ? '#ccc' : '#ff9a3d', t: 0, life: 0.35, g: 0, s: 1 });
        if (p.life <= 0 || p.y < -20 || p.x < -20 || p.x > W + 20) {
          if (t && (hittable(t) || alreadyDown(t))) {
            const any = hittable(t) ? explode(t.x, t.y - (t.hop || 0), p.blast, 'turret', p.dmg || 3) : true;
            mark(!!any || alreadyDown(t));
            if (hittable(t)) noteTurretKillIfDead(t);
          } else mark(false);
          p.dead = true;
        }
      }
    } else if (p.type === 'flak') {
      p.t += dt; const k = Math.min(1, p.t / p.T);
      p.x = HUNTER_X + (p.tx - HUNTER_X) * k; p.y = (H - BAR - 20) + (p.ty - (H - BAR - 20)) * k - Math.sin(k * Math.PI) * 30;
      if (k >= 1) { const any = explode(p.tx, p.ty, 22, 'flak', ECON.flakDmg(Meta.val('gadget.flak'))); if (!any) float('MISS', p.tx, p.ty - 6, '#fff', 1.2, 0.6); p.dead = true; }
    }
  }
  projs = projs.filter(p => !p.dead);
}

function updTarget(t, dt) {
  t.anim += dt; t.hurt = Math.max(0, (t.hurt || 0) - dt);
  const slow = decoyObj && t.state === 'fly' ? (t.kind === 'boss' ? 0.8 : t.kind === 'egg' ? 0.85 : t.g ? 0.75 : 0.6) : 1;
  if (t.kind === 'egg') {
    if (t.state === 'fly') {
      const eggSlow = slow * (perkEgg > 1 ? 1 / Math.sqrt(perkEgg) : 1);
      t.vy += 150 * dt * eggSlow;
      t.y += t.vy * dt * eggSlow;
      t.x += (t.vx || 0) * dt * eggSlow;
      if (t.y >= t.hatchY || t.y >= GROUND - 14) hatchEgg(t);
    }
    return;
  }
  if (t.kind === 'boss') return updBoss(t, dt * slow, dt);
  if (t.m === 'peek') {
    if (t.state === 'fly') {
      t.pt -= dt * slow;
      if (t.pt <= 0) {
        if (t.vis) { t.vis = false; t.peeks--; t.pt = 0.5; if (t.peeks <= 0) { escaped(t); return; } }
        else { t.vis = true; t.pt = t.pt0; t.x = rand(20, W - 20); t.y = GROUND + rand(-3, 4); }
      }
    } else if (t.state === 'hit') { t.hitT -= dt; if (t.hitT <= 0) t.state = 'gone'; }
    return;
  }
  if (t.g) {
    if (t.state === 'fly') {
      if (t.m === 'hop') {
        const per = t.hopCyc || 0.7, air = Math.min(0.55, per * 0.64), h = t.hopH || 9;
        t.hopT += dt * slow; const cyc = t.hopT % per;
        if (cyc < air) { t.x += t.vx * dt * slow * 1.5; t.hop = Math.sin(cyc / air * Math.PI) * h; } else t.hop = 0;
      } else if (t.m === 'swim') {
        t.x += t.vx * dt * slow; t.hop = Math.sin(t.anim * 3) * 0.8;
      } else if (t.m === 'dash') {
        t.dashT = (t.dashT || 0) + dt * slow; const cyc = t.dashT % 1.15;
        if (cyc < 0.4) t.hop = 0;
        else { t.x += t.vx * dt * slow * 1.85; t.hop = Math.abs(Math.sin(cyc * 16)) * 3; }
      } else if (t.m === 'amble') {
        t.dashT = (t.dashT || 0) + dt * slow; const cyc = t.dashT % 1.4;
        if (cyc < 0.35) t.hop = 0;
        else { t.x += t.vx * dt * slow; t.hop = Math.abs(Math.sin(cyc * 10)) * 2; }
      } else if (t.m === 'crawl') {
        t.x += t.vx * dt * slow; t.hop = 0; t.y = (t.y0 || t.y) + Math.sin(t.anim * 7) * 0.6;
      } else if (t.m === 'flush') {
        t.flushT = (t.flushT || 0) + dt * slow;
        t.x += t.vx * dt * slow; t.hop = Math.abs(Math.sin(t.anim * 12)) * 3;
        if (!t.flushed && t.x > 48 && t.flushT > 0.55) {
          t.flushed = true; t.g = 0; t.m = 'skim'; t.risen = true;
          t.yTop = SKY_BOT - 70; t.yBot = SKY_BOT - 6;
          t.vy = -90; t.sp = Math.max(36, Math.abs(t.vx));
          t.vx = Math.max(t.vx, 55); t.vx0 = t.vx;
          t.life = (W + 22 - t.x) / Math.max(20, t.vx);
          t.hop = 0;
        }
      } else {
        t.x += t.vx * dt * slow; t.hop = Math.abs(Math.sin(t.anim * 12)) * 3;
      }
      if (t.x > W + 24) escaped(t);
    } else if (t.state === 'hit') { t.hitT -= dt; if (t.hitT <= 0) { t.state = 'fall'; t.fallT = 0.9; } }
    else if (t.state === 'fall') { t.fallT -= dt; t.x += t.vx * 0.15 * dt; if (t.fallT <= 0) t.state = 'gone'; }
    return;
  }
  if (t.state === 'fly') {
    t.life -= dt;
    // horizontal: always rightward. Zig-zaggers vary pace (never below 55% of base); decoy only slows them.
    if (t.erratic) {
      t.turnT -= dt;
      if (t.turnT <= 0) { t.vx = t.vx0 * rand(0.7, 1.35); t.vy = (Math.random() < 0.5 ? -1 : 1) * t.sp * rand(0.5, 1); t.turnT = (t.m === 'flutter' || t.m === 'dart') ? rand(0.15, 0.4) : rand(0.35, 0.9); }
    }
    let vy = t.vy;
    if (t.m === 'glide') vy = Math.cos(t.anim * 1.6 + t.ph) * t.sp * 0.45;
    if (t.m === 'dive') {
      t.diveT = (t.diveT || 0) - dt * slow;
      if (t.diving) {
        vy = t.sp * 2.1;
        if (t.y >= (t.yBot || SKY_BOT) - 5) { t.diving = false; t.diveT = rand(0.65, 1.2); vy = -t.sp * 1.4; t.vy = vy; }
      } else {
        vy = Math.cos(t.anim * 2 + (t.ph || 0)) * t.sp * 0.35;
        if (t.diveT <= 0) t.diving = true;
      }
    }
    if (t.m === 'stoop') {
      t.diveT = (t.diveT || 0) - dt * slow;
      if (t.diving) {
        vy = t.sp * 2.0;
        if (t.y >= (t.yBot || SKY_BOT) - 8) { t.diving = false; t.diveT = rand(0.8, 1.4); vy = -t.sp; t.vy = vy; }
      } else if (t.diveT <= 0) t.diving = true;
    }
    if (decoyObj) { const dy = decoyObj.y - t.y; t.vy += (Math.sign(dy) * t.sp - t.vy) * Math.min(1, dt * 2); vy = t.vy; }
    t.x += Math.max(t.vx0 * 0.55, t.vx) * dt * slow;
    t.y += vy * dt * slow;
    if (t.m === 'circle' || (t.m === 'stoop' && !t.diving)) { t.ang += (t.w || 2) * dt * slow; t.y += Math.cos(t.ang) * (t.R || 12) * (t.w || 2) * 0.6 * dt * slow; }
    if (t.y < t.yTop) { t.y = t.yTop; t.vy = Math.abs(t.vy); if (t.m === 'dive' || t.m === 'stoop') t.diving = false; }
    if (t.y > t.yBot) { t.y = t.yBot; t.vy = -Math.abs(t.vy); }
    if (!t.erratic && t.m !== 'glide' && t.m !== 'dive' && t.m !== 'stoop' && Math.random() < dt * 0.8) t.vy = -t.vy; // gentle zig-zag
    if (t.erratic && t.m === 'dart' && t.turnT <= 0.01) t.turnT = rand(0.18, 0.4);
    if (t.x > W + 12) { if (t.attract) t.state = 'gone'; else escaped(t); }
  } else if (t.state === 'hit') {
    t.hitT -= dt;
    if (t.hitT <= 0) { t.state = 'fall'; t.vy = 20; Sfx.fall(); }
  } else if (t.state === 'fall') {
    t.vy += 320 * dt; t.y += t.vy * dt;
    if (t.y > GROUND + 14) { t.state = 'gone'; Sfx.thud(); }
  }
}
function updBoss(t, dt, rdt) {
  if (t.state === 'fly') {
    t.ph += dt;
    const surge = 1 + 0.35 * Math.sin(t.ph * 1.3);
    if (state === 'play') {
      t.timer = Math.max(0, t.timer - dt);
      t.x += t.vx * surge * dt;
      if (t.timer <= 0) t.leaving = true;
      if (t.leaving) {
        if (t.x > W + 16 * t.sc || t.x < -16 * t.sc) escaped(t);
      } else {
        if (t.x >= t.x1) { t.x = t.x1; t.vx = -Math.abs(t.vx); }
        else if (t.x <= t.x0) { t.x = t.x0; t.vx = Math.abs(t.vx); }
        maybeDropEgg(t, dt);
      }
    }
    if (t.m === 'brun') t.hop = Math.abs(Math.sin(t.anim * 9)) * 3;
    else t.y = t.y0 + Math.sin(t.ph * 1.7) * 16 + Math.sin(t.ph * 0.5) * 9;
  } else if (t.state === 'hit') { t.hitT -= rdt; if (t.hitT <= 0) { t.state = 'fall'; t.vy = 10; t.fallT = 1.2; Sfx.fall(); } }
  else if (t.state === 'fall') {
    t.vy += 200 * dt; t.y += t.vy * dt;
    const floor = isGroundBoss(t) ? GROUND + 8 : GROUND + 20;
    if (t.y > floor) { t.y = floor; t.state = 'gone'; Sfx.thud(); shake = 6; }
  }
}

function roundClear() {
  state = 'clear'; clearT = 2.0; holding = false; drawing = null;
  const perfect = roundHits >= roundTotal;
  const bonusCash = Math.round(ECON.roundBonus(round, perfect) * M.cash * (perkComboPay > 1 ? perkComboPay : 1));
  addCash(bonusCash);
  const earned = Math.max(0, runCash - roundCash0);
  let magnetCash = 0;
  if (perkMagnet > 0 && earned > 0) {
    magnetCash = Math.max(1, Math.round(earned * perkMagnet));
    addCash(magnetCash);
  }
  banner = perfect ? 'PERFECT!' : 'ROUND CLEAR';
  banner2 = '+$' + bonusCash + (perfect ? '  +' + fmt(5000 * round) : '') + (magnetCash ? '  MAGNET +$' + fmt(magnetCash) : '');
  if (perfect && missRun > 0) { missRun--; banner2 += '  -1 X'; } // a perfect round gives back one X
  if (perfect) score += 5000 * round;
  // Campaign ends at the map's clear boss (round 30). Beating it unlocks Infinity; failing it ends the run.
  const campaignEnd = !infinity && round >= ECON.CLEAR_ROUND;
  mapJustCleared = campaignEnd && bossKilled;
  failedClear = campaignEnd && !bossKilled;
  // Perfect-run (R31 bonus) is per map: broken by an X or a continue on this map only.
  wantBonus = !!(mapJustCleared && perfectRun && !infinity && !reviveUsed);
  if (mapJustCleared && wantBonus) {
    banner = 'PERFECT! BONUS ROUND';
    banner2 = 'BAG THE CASH!';
    clearT = 2.4;
  } else if (mapJustCleared) {
    beginMapShiftBanner();
    if (!pendingNext) {
      const first = !Meta.isCleared(M.id);
      banner = first ? 'ALL MAPS CLEARED!' : 'MAP CLEARED!';
      banner2 = first ? 'YOU HUNTED EVERY RANGE' : (M.name.toUpperCase() + ' COMPLETE');
      if (perfect) banner2 += '  +$' + bonusCash;
      clearT = 3.2;
    }
  } else if (failedClear) {
    banner = 'SO CLOSE!'; banner2 = 'BEAT THE ROUND ' + ECON.CLEAR_ROUND + ' BOSS TO CLEAR ' + M.name.toUpperCase();
    clearT = 2.6;
  }
  Sfx.clear(); if (mapJustCleared) Sfx.gold();
  showGameButtons(false);
  Meta.event('roundClear', { perfect, score }); Meta.persist(); notify();
}
function spawnBag() {
  const roll = Math.random();
  const size = roll < 0.08 ? 'big' : roll < 0.40 ? 'mid' : 'small';
  const sc = size === 'big' ? 1.55 : size === 'mid' ? 1.2 : 0.9;
  const sp = (size === 'big' ? 42 : size === 'mid' ? 58 : 76) * rand(0.9, 1.15);
  const y = rand(SKY_TOP + 28, SKY_BOT - 30);
  targets.push({ kind: 'bag', bagSize: size, set: 'bag', m: 'fly', state: 'fly', x: -16, y, y0: y, vx: sp, vx0: sp, vy: Math.sin(rand(0, 6)) * 8, sc, hp: 1, hp0: 1, anim: 0, hurt: 0, g: 0, life: 99, risen: true, noMiss: true, sp, yTop: SKY_TOP + 24, yBot: SKY_BOT - 16 });
}
function startBonusRound() {
  wantBonus = false;
  bonusT = ECON.BONUS_TIME;
  bonusIntroT = 1.2;
  bonusCashEarned = 0;
  round = ECON.CLEAR_ROUND + 1;
  bossRound = false; bossT = null;
  queue = []; targets = []; projs = [];
  spawnT = 0.25;
  state = 'bonus';
  banner = 'PERFECT! BONUS ROUND';
  banner2 = 'BAG THE CASH!  ' + ECON.BONUS_TIME + 'S';
  showGameButtons(true);
  Sfx.gold();
}
function endBonus() {
  showGameButtons(false);
  if (!infinity && ECON.nextMap(M.id)) {
    beginMapShiftBanner(true);
    return;
  }
  banner = 'MAP CLEARED!';
  banner2 = 'BONUS +$' + fmt(bonusCashEarned);
  victory();
}
function beginMapShiftBanner(fromBonus) {
  const nxt = ECON.nextMap(M.id);
  if (!nxt || infinity) { pendingNext = null; return; }
  Meta.markCleared(M.id);
  pendingNext = nxt;
  banner = M.name.toUpperCase() + ' CLEARED!';
  banner2 = (fromBonus && bonusCashEarned ? ('BONUS +$' + fmt(bonusCashEarned) + '  ') : '') + '\u2192  ' + nxt.name.toUpperCase();
  showGameButtons(false);
  show('btn-pause', true);
  state = 'mapshift';
  shiftT = 2.6;
  Sfx.gold();
}
function afterMapClear() {
  if (infinity) { pendingNext = null; victory(); return; }
  const nxt = pendingNext || ECON.nextMap(M.id);
  pendingNext = null;
  if (!nxt) { victory(); return; }
  startNextMap(nxt);
}
function startNextMap(nxt) {
  if (!nxt) { victory(); return; }
  const keep = {
    score, runCash, hits, shots, bestStreak, runRanked,
    gadgets: { flak: gadgets.flak, call: gadgets.call, decoy: gadgets.decoy }
  };
  Meta.markCleared(M.id);
  Meta.selectMap(nxt.id);
  curMap = nxt; M = nxt;
  buildBg();
  missRun = 0; streak = 0; reviveUsed = false; fromCkpt = 0;
  // Perfect-run tracking for R31 is per map.
  perfectRun = true;
  wantBonus = false; bonusCashEarned = 0; bonusT = 0; bonusIntroT = 0;
  bossKilled = false; mapJustCleared = false; failedClear = false;
  pendingNext = null; shiftT = 0; holdRound = false;
  round = 0;
  score = keep.score; runCash = keep.runCash; hits = keep.hits; shots = keep.shots; bestStreak = keep.bestStreak;
  runRanked = keep.runRanked;
  gadgets = keep.gadgets;
  decoyObj = null; armed = false; holding = false; drawing = null; bossT = null;
  targets = []; queue = []; projs = []; parts = []; floats = []; zaps = []; tracers = []; flashes = [];
  if (runMaps.indexOf(nxt.id) < 0) runMaps.push(nxt.id);
  startRound();
}
function runIsActive() {
  return state === 'play' || state === 'intro' || state === 'clear' || state === 'bonus' || state === 'mapshift' || state === 'dying';
}
function runMapsLabel() {
  if (!runMaps.length) return M ? M.name.toUpperCase() : '';
  return runMaps.map(id => { const m = ECON.MAPS.find(x => x.id === id); return (m ? m.name : id).toUpperCase(); }).join(' + ');
}
// ---------------- overlays / UI ----------------
function show(id, on) { $(id).classList.toggle('hidden', !on); }
const titleScene = () => state === 'title' || !!( $('ov-title') && !$('ov-title').classList.contains('hidden') ) || !!( $('ov-infinity') && !$('ov-infinity').classList.contains('hidden') );
function showGameButtons(on) {
  show('btn-pause', on); show('btn-reload', on); show('btn-focus', on && focusMax > 0);
  show('btn-swap', on && weapons.length > 1);
  ['flak', 'call', 'decoy'].forEach(k => show('btn-' + k, on && Meta.val('gadget.' + k) > 0));
  if (on) syncGadgets();
}
function syncGadgets() {
  ['flak', 'call', 'decoy'].forEach(k => { const b = $('btn-' + k); b.querySelector('span').textContent = gadgets[k]; b.disabled = gadgets[k] <= 0; b.classList.toggle('active', k === 'flak' && armed); });
}
const iconEl = key => makeSprite(ICONS[key] || ICONS.gun, ICON_PAL);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let shopFrom = 'title', shopTab = 'weapons', shopSel = {}, shopInf = false, shopBoughtId = null;
function lockText(u) {
  const tb = Meta.totalBought();
  if (tb < (u.req || 0)) return `Own ${u.req} upgrades (you have ${tb})`;
  if (u.needs) { const n = Meta.track(u.needs); return 'Need ' + (n ? n.name : 'another upgrade') + ' first'; }
  return 'Locked';
}
function isGadgetTrack(t) { return t && (t.id || '').startsWith('gadget.'); }
function isGearOnly(t) { return t && t.group === 'gear' && !isGadgetTrack(t) && t.id !== 'loadout' && t.id !== 'turret.slots'; }
function trackAffordable(t) {
  return t && !Meta.maxed(t) && Meta.eligible(t) && Meta.costOf(t) <= Meta.bank();
}
function tabCanFor(tab) {
  if (tab === 'gadgets') return ECON.TRACKS.some(t => isGadgetTrack(t) && trackAffordable(t));
  if (tab === 'gear') return ECON.TRACKS.some(t => isGearOnly(t) && trackAffordable(t));
  if (tab === 'weapons') return ECON.TRACKS.some(t => (t.group === 'weapon' || t.id === 'loadout') && trackAffordable(t));
  if (tab === 'turrets') return ECON.TRACKS.some(t => (t.group === 'turret' || t.id === 'turret.slots') && trackAffordable(t));
  if (tab === 'perks') return ECON.TRACKS.some(t => t.group === 'perk' && trackAffordable(t));
  if (tab === 'style' && !shopInf) {
    const eq = Meta.activeEquip();
    return ECON.SKINS.some(s => !Meta.save.cosm.includes(s.id) && Meta.bank() >= s.cost)
      || ECON.CROSSHAIRS.some(s => !Meta.save.cosm.includes(s.id) && Meta.bank() >= s.cost);
  }
  return false;
}
function buyLabel(u, maxed, ok, c) {
  if (maxed) return u.unlock ? 'OWNED' : 'MAX';
  if (!ok) return 'LOCKED';
  return 'BUY $' + fmt(c);
}
function fillBuyButton(b, u, maxed, ok, c) {
  const can = !maxed && ok && Meta.bank() >= c;
  b.className = 'pbtn buy-btn' + (maxed ? ' max' : (ok && !can ? ' need-btn' : ''));
  b.textContent = buyLabel(u, maxed, ok, c);
  b.disabled = maxed || !ok || Meta.bank() < c;
  b.dataset.id = u.id;
}
function onBuyTrack(u) {
  if (!Meta.buy(u.id)) return false;
  shopBoughtId = u.id;
  Sfx.buy(); afterBuy();
  toast(u.unlock ? 'UNLOCKED!' : 'UPGRADED!', u.name + (u.unlock ? '' : ' LV ' + Meta.levelOf(u.id)), 0);
  if (u.group === 'weapon' && u.unlock) { Meta.equipWeapon(u.of, 'primary'); toast('EQUIPPED', WDEF(u.of).name, 0); }
  if (u.group === 'map') { Meta.selectMap(u.of); buildBg(); }
  if (u.group === 'turret' && u.unlock) Meta.mountTurret(u.of, true);
  closeShopDetail();
  openShop(shopFrom, true);
  return true;
}
function trackEffect(u, l) { return u.desc(ECON.infVal(u, l), l); }
function trackLabel(u, l) {
  const nm = u.names ? (u.names[Math.min(l, u.names.length - 1)] || u.names[u.names.length - 1]) : '';
  const fx = trackEffect(u, l);
  if (nm && fx && nm !== fx) return nm + ' · ' + fx;
  return fx || nm || u.name;
}
function trackItem(u) {
  const l = Meta.levelOf(u.id), maxed = Meta.maxed(u), ok = Meta.eligible(u), c = maxed ? 0 : Meta.costOf(u);
  const can = !maxed && ok && Meta.bank() >= c;
  const el = document.createElement('div');
  el.className = 'item shop-card' + (can ? ' can' : '') + (ok ? '' : ' locked') + (ok && !maxed && !can ? ' short' : '');
  el.dataset.id = u.id;
  const cur = trackLabel(u, l);
  const nxt = trackLabel(u, l + 1);
  const uncapped = Meta.isInf() && !ECON.cappedTrack(u);
  const lv = u.unlock ? '' : `<span class="lvl">${uncapped || Meta.isInf() ? 'LV ' + l : 'LV ' + l + '/' + (u.val.length - 1)}</span>`;
  const pips = u.unlock ? '' : (uncapped && l >= u.val.length
    ? `<div class="pips"><i class="on"></i><span class="lvl">+${l - (u.val.length - 1)}</span></div>`
    : `<div class="pips">${u.val.slice(1).map((_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div>`);
  const top = document.createElement('div'); top.className = 'item-top';
  const mid = document.createElement('div'); mid.className = 'item-mid';
  mid.innerHTML = `<div class="nm">${esc(u.name.toUpperCase())} ${lv}</div>`
    + `<div class="blurb">${esc(cur)}</div>`
    + pips;
  top.append(iconEl(u.icon), mid);
  el.appendChild(top);
  if (!ok) {
    const msg = document.createElement('div'); msg.className = 'lock-msg'; msg.textContent = 'Locked · ' + lockText(u); el.appendChild(msg);
  } else if (maxed) {
    const msg = document.createElement('div'); msg.className = 'ds dim'; msg.textContent = u.unlock ? 'Owned' : 'Maxed'; el.appendChild(msg);
  } else {
    const sl = document.createElement('div'); sl.className = 'statline';
    if ((u.k === 'dmg' || (u.id || '').endsWith('.dmg')) && !u.unlock) {
      const a = ECON.infVal(u, l), b = ECON.infVal(u, l + 1);
      sl.innerHTML = `<div class="nxt dmg-stat">DMG ${esc(a)} \u2192 ${esc(b)}</div>`;
    } else {
      sl.innerHTML = (u.unlock ? '' : `<div class="now">Now: ${esc(cur)}</div>`) + `<div class="nxt">Next: ${esc(nxt)}</div>`;
    }
    el.appendChild(sl);

    if (Meta.bank() < c) {
      const need = document.createElement('div'); need.className = 'need';
      need.textContent = 'Need $' + fmt(c - Meta.bank()) + ' more';
      el.appendChild(need);
    }
  }
  const b = document.createElement('button');
  fillBuyButton(b, u, maxed, ok, c);
  b.addEventListener('click', e => { e.stopPropagation(); onBuyTrack(u); });
  el.appendChild(b);
  el.addEventListener('click', e => { if (e.target.closest('button')) return; openTrackDetail(u); });
  return el;
}
function closeShopDetail() { const d = $('shop-detail'); if (d) d.classList.add('hidden'); }
function openTrackDetail(u) {
  const body = $('shop-detail-body'); if (!body) return;
  body.innerHTML = '';
  const l = Meta.levelOf(u.id), maxed = Meta.maxed(u), ok = Meta.eligible(u), c = maxed ? 0 : Meta.costOf(u);
  const cur = trackLabel(u, l);
  const nxt = maxed ? '' : trackLabel(u, l + 1);
  const uncapped = Meta.isInf() && !ECON.cappedTrack(u);
  const lv = u.unlock ? '' : (uncapped || Meta.isInf() ? 'LV ' + l : 'LV ' + l + '/' + (u.val.length - 1));
  const head = document.createElement('div'); head.style.display = 'flex'; head.style.gap = '10px'; head.style.alignItems = 'center';
  head.appendChild(iconEl(u.icon));
  const htxt = document.createElement('div');
  htxt.innerHTML = `<div class="nm">${esc(u.name.toUpperCase())}</div><div class="ds">${esc(lv)}</div>`;
  head.appendChild(htxt);
  body.appendChild(head);
  const p = document.createElement('p'); p.textContent = cur || u.name; body.appendChild(p);
  if (!ok) { const m = document.createElement('p'); m.className = 'lock-msg'; m.textContent = 'Locked · ' + lockText(u); body.appendChild(m); }
  else if (!maxed) {
    const sl = document.createElement('div'); sl.className = 'statline';
    if ((u.k === 'dmg' || (u.id || '').endsWith('.dmg'))) {
      sl.innerHTML = `<div class="nxt dmg-stat">DMG ${esc(ECON.infVal(u, l))} \u2192 ${esc(ECON.infVal(u, l + 1))}</div>`;
    } else {
      sl.innerHTML = `<div class="now">Now: ${esc(cur)}</div><div class="nxt">Next: ${esc(nxt)}</div>`;
    }
    body.appendChild(sl);
    if (Meta.bank() < c) { const need = document.createElement('p'); need.className = 'need'; need.textContent = 'Need $' + fmt(c - Meta.bank()) + ' more'; body.appendChild(need); }
  } else { const m = document.createElement('p'); m.textContent = u.unlock ? 'Owned' : 'Maxed'; body.appendChild(m); }
  const b = document.createElement('button');
  fillBuyButton(b, u, maxed, ok, c);
  b.addEventListener('click', e => { e.stopPropagation(); onBuyTrack(u); });
  body.appendChild(b);
  $('shop-detail').classList.remove('hidden');
}
function openWeaponDetail(w, owned, eq) {
  const body = $('shop-detail-body'); if (!body) return;
  body.innerHTML = '';
  const head = document.createElement('div'); head.style.display = 'flex'; head.style.gap = '10px'; head.style.alignItems = 'center';
  head.appendChild(iconEl(w.id));
  const htxt = document.createElement('div');
  const badge = eq.primary === w.id ? 'Equipped' : (eq.secondary === w.id && Meta.val('loadout') ? 'On the sling' : (owned ? 'Owned' : 'Locked'));
  htxt.innerHTML = `<div class="nm">${esc(w.name.toUpperCase())}</div><div class="ds">${esc(w.role)} · ${esc(badge)}</div><div class="dmg-line">${esc(dmgLine(w.id))}</div>`;
  head.appendChild(htxt);
  body.appendChild(head);
  const p = document.createElement('p'); p.textContent = owned ? 'Upgrade this gun below, or equip it as your primary or sling weapon.' : 'Buy this gun to add it to your loadout.'; body.appendChild(p);
  if (!owned) body.appendChild(trackItem(Meta.track('own.' + w.id)));
  else w.tracks.forEach(tr => body.appendChild(trackItem(Meta.track(w.id + '.' + tr.k))));
  $('shop-detail').classList.remove('hidden');
}
function afterBuy() { notify(); }
function card(iconKey, title, sub, badge, expanded, onToggle) {
  const c = document.createElement('div'); c.className = 'card' + (expanded ? ' open' : '');
  const h = document.createElement('div'); h.className = 'card-h';
  const ic = typeof iconKey === 'string' ? iconEl(iconKey) : iconKey;
  const mid = document.createElement('div'); mid.innerHTML = `<div class="nm">${esc(title)}${badge ? ` <span class="badge">${badge}</span>` : ''}</div><div class="ds">${esc(sub)}</div>`;
  h.append(ic, mid);
  h.dataset.tap = '1';
  if (onToggle) h.addEventListener('click', onToggle);
  c.appendChild(h); return c;
}
function btn(label, cls, fn, disabled) { const b = document.createElement('button'); b.className = 'pbtn ' + (cls || ''); b.innerHTML = label; b.disabled = !!disabled; b.addEventListener('click', e => { e.stopPropagation(); Sfx.click(); fn(); }); return b; }
function tabCan(group) {
  return ECON.TRACKS.some(t => t.group === group && !Meta.maxed(t) && Meta.eligible(t) && Meta.costOf(t) <= Meta.bank());
}
function ensureShopTabIcons() {
  if (ensureShopTabIcons.done) return;
  ensureShopTabIcons.done = true;
  const icons = { weapons: 'gun', gear: 'eye', turrets: 'turret', gadgets: 'flak', perks: 'auto', maps: 'map', style: 'coin' };
  document.querySelectorAll('#shop-tabs button').forEach(b => {
    const key = icons[b.dataset.tab];
    if (!key || b.querySelector('canvas')) return;
    const cv = iconEl(key);
    cv.className = 'tab-ico';
    b.insertBefore(cv, b.firstChild);
  });
}
function flashBought() {
  if (!shopBoughtId) return;
  const id = shopBoughtId; shopBoughtId = null;
  const el = document.querySelector('#shop-list [data-id="' + id + '"]');
  if (el) { el.classList.add('bought'); try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
}
function openShop(from = 'title', keep) {
  if (shopTab === 'maps') shopTab = 'weapons';
  if (from === 'infinity') { shopInf = true; shopFrom = 'infinity'; }
  else if (from === 'title') { shopInf = false; shopFrom = 'title'; }
  else if (from === 'over') { shopInf = !!(lastRun && lastRun.infinity); shopFrom = 'over'; }
  else shopFrom = from === 'round' ? 'title' : from; // upgrades are only between runs (title / game over)
  Meta.setMode(shopInf ? 'infinity' : 'campaign');
  if ($('shop-title')) $('shop-title').textContent = shopInf ? 'INFINITY UPGRADES' : 'UPGRADES';
  closeShopDetail();
  ensureShopTabIcons();
  if (!keep) $('shop-list').scrollTop = 0;
  const scroll = $('shop-list').scrollTop;
  $('shop-money').textContent = fmt(Meta.bank());
  const infMapName = (mapDef(Meta.save.equip.map) || { name: 'Meadow' }).name.toUpperCase();
  $('shop-sub').textContent = shopInf
    ? (infMapName + ' INFINITY WALLET · NO LEVEL CAP · THIS MAP ONLY · ' + Meta.totalBought() + ' BOUGHT')
    : ('CLASSIC · UPGRADES ARE PERMANENT · ' + Meta.totalBought() + '/' + ECON.TOTAL_LEVELS + ' OWNED');
  const modes = $('shop-modes');
  if (modes) { modes.classList.add('hidden'); modes.innerHTML = ''; }
  document.querySelectorAll('#shop-tabs button').forEach(b => {
    const hide = shopInf && b.dataset.tab === 'style';
    b.classList.toggle('hidden', hide);
    b.classList.toggle('on', b.dataset.tab === shopTab);
    b.classList.toggle('can', !hide && tabCanFor(b.dataset.tab));
  });
  const list = $('shop-list'); list.innerHTML = '';

  const midRun = false; // shop is never mid-run; kept so equip/mount buttons stay enabled between runs
  const eq = Meta.activeEquip();
  if (shopInf) { const nte = document.createElement('div'); nte.className = 'note'; nte.textContent = 'Infinity starts you over with the free shotgun. Money and upgrades here are only for this map, and never touch Classic or other Infinity maps.'; list.appendChild(nte); }
  if (shopTab === 'weapons') {
    const sel = shopSel.weapon || eq.primary;
    ECON.WEAPONS.forEach(w => {
      const owned = Meta.owns(w.id), open = true;
      const badge = eq.primary === w.id ? 'EQUIPPED' : eq.secondary === w.id && Meta.val('loadout') ? 'SLING' : owned ? '' : 'LOCKED';
      const badgeCls = eq.primary === w.id ? 'equip' : (eq.secondary === w.id ? 'sling' : (owned ? '' : 'dim'));
      const c = card(w.id, w.name.toUpperCase(), w.role, badge, eq.primary === w.id, () => openWeaponDetail(w, owned, eq));
      if (badge && c.querySelector('.badge') && badgeCls) c.querySelector('.badge').classList.add(badgeCls);
      const dg = document.createElement('div'); dg.className = 'dmg-line'; dg.textContent = dmgLine(w.id); c.insertBefore(dg, c.children[1] || null);
      if (owned) {
        const row = document.createElement('div'); row.className = 'row3';
        row.appendChild(btn(eq.primary === w.id ? 'EQUIPPED' : 'EQUIP', 'small' + (eq.primary === w.id ? ' on' : ''), () => { Meta.equipWeapon(w.id, 'primary'); openShop(shopFrom, true); }, midRun || eq.primary === w.id));
        if (Meta.val('loadout')) row.appendChild(btn(eq.secondary === w.id ? 'ON SLING' : 'SLING SLOT', 'small' + (eq.secondary === w.id ? ' on' : ''), () => { Meta.equipWeapon(w.id, 'secondary'); openShop(shopFrom, true); }, midRun || eq.secondary === w.id));
        c.appendChild(row);
        w.tracks.forEach(tr => c.appendChild(trackItem(Meta.track(w.id + '.' + tr.k))));
      } else c.appendChild(trackItem(Meta.track('own.' + w.id)));
      list.appendChild(c);
    });
    list.appendChild(trackItem(Meta.track('loadout')));
  } else if (shopTab === 'turrets') {
    const slots = Meta.val('turret.slots');
    list.appendChild(trackItem(Meta.track('turret.slots')));
    const n = document.createElement('div'); n.className = 'note';
    n.textContent = `Turrets lock on and shoot on their own — shots land, and a regular target goes down. They will not waste a shot on a decoy or something already leaving. Limited shots per round; kills pay ${Math.round(ECON.TURRET_CASH * 100)}% and don't reset your miss counter. Mounted: ${eq.turrets.length}/${slots}`;
    list.appendChild(n);
    ECON.TURRETS.forEach(tu => {
      const owned = Meta.hasTurret(tu.id), mounted = eq.turrets.includes(tu.id);
      const badge = mounted ? 'MOUNTED' : owned ? '' : 'LOCKED';
      const cv = document.createElement('canvas'); cv.width = 12; cv.height = 12; cv.getContext('2d').drawImage(TURRET_SPR[tu.id], 0, 0);
      const c = card(cv, tu.name.toUpperCase(), tu.role, badge, mounted, () => {});
      if (mounted && c.querySelector('.badge')) c.querySelector('.badge').classList.add('equip');
      const dg = document.createElement('div'); dg.className = 'dmg-line'; dg.textContent = dmgLine(tu.id); c.insertBefore(dg, c.children[1] || null);
      if (owned) {
        const row = document.createElement('div'); row.className = 'row3';
        const lab = mounted ? 'UNMOUNT' : (slots ? 'MOUNT' : 'NEED PAD');
        row.appendChild(btn(lab, 'small' + (mounted ? ' on' : ''), () => { Meta.mountTurret(tu.id, !mounted); openShop(shopFrom, true); }, midRun || (!slots && !mounted)));
        c.appendChild(row);
        tu.tracks.forEach(tr => c.appendChild(trackItem(Meta.track(tu.id + '.' + tr.k))));
      } else c.appendChild(trackItem(Meta.track('own.' + tu.id)));
      list.appendChild(c);
    });
  } else if (shopTab === 'gear') {
    ECON.TRACKS.filter(isGearOnly).forEach(t => list.appendChild(trackItem(t)));
  } else if (shopTab === 'gadgets') {
    const nte = document.createElement('div'); nte.className = 'note';
    nte.textContent = 'Gadgets give limited uses each run. Tap their buttons during a hunt.';
    list.appendChild(nte);
    ECON.TRACKS.filter(isGadgetTrack).forEach(t => list.appendChild(trackItem(t)));
  } else if (shopTab === 'perks') {
    const nte = document.createElement('div'); nte.className = 'note';
    nte.textContent = 'Late-game perks. Big costs, big help — they work with every gun (including laser vent and bow nock). In Infinity they keep leveling with no cap.';
    list.appendChild(nte);
    ECON.TRACKS.filter(t => t.group === 'perk').forEach(t => list.appendChild(trackItem(t)));
  } else if (shopTab === 'style') {
    const n = document.createElement('div'); n.className = 'note'; n.textContent = 'Cosmetic only: fixed prices.'; list.appendChild(n);
    const mk = (kind, it, preview) => {
      const owned = Meta.save.cosm.includes(it.id), on = (kind === 'skin' ? eq.skin : eq.cross) === it.id;
      const el = document.createElement('div'); el.className = 'item' + (on ? ' can' : ''); el.dataset.id = kind + '.' + it.id;
      const top = document.createElement('div'); top.className = 'item-top';
      const mid = document.createElement('div'); mid.innerHTML = `<div class="nm">${esc(it.name.toUpperCase())}</div><div class="blurb">${kind === 'skin' ? 'Hunter outfit' : 'Crosshair color'}</div>`;
      top.append(preview, mid); el.appendChild(top);
      if (!owned && Meta.bank() < it.cost) {
        const need = document.createElement('div'); need.className = 'need'; need.textContent = 'Need $' + fmt(it.cost - Meta.bank()) + ' more'; el.appendChild(need);
      }
      const b = btn(on ? 'ON' : owned ? 'EQUIP' : 'BUY $' + fmt(it.cost), on ? 'max' : '', () => { if (Meta.buyCosmetic(kind, it.id)) { Sfx.buy(); shopBoughtId = kind + '.' + it.id; openShop(shopFrom, true); } }, on || (!owned && Meta.bank() < it.cost));
      el.appendChild(b); list.appendChild(el);
    };
    const sec = t => { const s = document.createElement('div'); s.className = 'sec'; s.textContent = t; list.appendChild(s); };
    sec('HUNTER SKINS');
    ECON.SKINS.forEach(s => { const cv = document.createElement('canvas'); cv.width = 14; cv.height = 14; cv.getContext('2d').drawImage(hunterSprite(s.id), 2, 0); mk('skin', s, cv); });
    sec('CROSSHAIRS');
    ECON.CROSSHAIRS.forEach(cx => { const cv = document.createElement('canvas'); cv.width = 15; cv.height = 15; const g = cv.getContext('2d'); g.fillStyle = cx.c; g.fillRect(7, 1, 1, 5); g.fillRect(7, 9, 1, 5); g.fillRect(1, 7, 5, 1); g.fillRect(9, 7, 5, 1); g.fillRect(7, 7, 1, 1); mk('cross', cx, cv); });
  }
  if (keep) list.scrollTop = scroll;
  show('ov-shop', true);
  flashBought();
}


$('shop-tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  Sfx.click(); shopTab = b.dataset.tab; openShop(shopFrom);
});
$('btn-next').addEventListener('click', () => { Sfx.click(); closeShopDetail(); show('ov-shop', false); if (shopFrom === 'over') show('ov-over', true); else if (shopFrom === 'infinity') { Meta.setMode('infinity'); shopInf = true; updateInfinity(); show('ov-infinity', true); } else toTitle(); });
const shopDetail = $('shop-detail');
if (shopDetail) {
  $('btn-shop-detail-close').addEventListener('click', e => { e.stopPropagation(); Sfx.click(); closeShopDetail(); });
  shopDetail.addEventListener('click', e => { if (e.target === shopDetail) { Sfx.click(); closeShopDetail(); } });
}

// ---------------- death / revive / game over ----------------
function onDeath() {
  if (!reviveUsed && Ads.rewardedAvailable()) {
    $('cont-detail').textContent = 'Resume Round ' + round + ' and keep your score (' + fmt(score) + ').';
    $('cont-note').textContent = 'One continue per run \u00b7 X\'s cleared \u00b7 ' + (fromCkpt ? 'checkpoint run, not ranked' : 'still ranked');
    const cr = $('btn-revive');
    if (cr) cr.innerHTML = Meta.isAdFree()
      ? 'CONTINUE THIS RUN<br><small>KEEP SCORE \u00b7 NO AD</small>'
      : '\u25b6 WATCH AD<br><small>CONTINUE THIS RUN \u00b7 KEEP SCORE</small>';
    show('ov-continue', true);
    let n = 8; $('cont-count').textContent = n;
    clearInterval(contTimer);
    contTimer = setInterval(() => { n--; $('cont-count').textContent = n; if (n <= 0) declineContinue(); }, 1000);
  } else Ads.showInterstitial().then(gameOver);
}
function declineContinue() { clearInterval(contTimer); show('ov-continue', false); Ads.showInterstitial().then(gameOver); }
$('btn-norevive').addEventListener('click', () => { Sfx.click(); declineContinue(); });
$('btn-revive').addEventListener('click', () => {
  Sfx.click(); clearInterval(contTimer); show('ov-continue', false); reviveUsed = true;
  Ads.showRewarded().then(ok => { if (ok) revive(); else gameOver(); });
});
function revive() {
  // Restart the round you lost from the beginning, keeping score, cash earned, and ranked status.
  const keep = { score, runCash, hits, shots, bestStreak, fromCkpt, infinity, round };
  missRun = 0; streak = 0;
  targets = []; queue = []; projs = []; parts = []; floats = []; zaps = []; tracers = []; flashes = [];
  bossT = null; decoyObj = null; armed = false; holding = false; drawing = null; mapJustCleared = false; failedClear = false;
  score = keep.score; runCash = keep.runCash; hits = keep.hits; shots = keep.shots; bestStreak = keep.bestStreak;
  fromCkpt = keep.fromCkpt; infinity = keep.infinity;
  perfectRun = false;
  startRound({ restart: true, revive: true });
  banner = 'SECOND CHANCE!';
  banner2 = 'ROUND ' + keep.round + '  \u00b7  SCORE KEPT  ' + fmt(keep.score);
}
let earnedShown = 0, lastRun = null;
function finishRun(opts) {
  state = 'over';
  const ranked = !!runRanked; // checkpoint or carried-from-checkpoint stays unranked
  const cleared = !!(opts && opts.cleared);
  const isBest = ranked && (infinity ? score > (Meta.save.bestInfinityByMap[M.id] || 0) : score > best);
  const isAll = ranked && !infinity && score > best;
  const nxt = !infinity && cleared ? ECON.nextMap(M.id) : null;
  const allCleared = !!(cleared && !infinity && !nxt);
  const unlockedMap = (nxt && !Meta.isCleared(M.id) && !Meta.hasMap(nxt.id)) ? nxt : null;
  const defer = !!(cleared && !infinity && !allCleared && !(opts && opts.finalize));
  if (isAll && !defer) { best = score; store.set('best', best); }
  if (defer) {
    Meta.endRun({ score: 0, round, earned: 0, ranked: false, infinity, cleared, deferScore: true, map: M.id });
    deferredRun = true;
    lastRun = { score, round, map: M.id, mapName: M.name, weapon: wpn.id, isBest: false, isAll: false, fromCkpt, infinity, cleared, unlockedMap: unlockedMap && unlockedMap.name, nextMap: nxt && nxt.name, nextMapId: nxt && nxt.id, allCleared: false, bonusCash: bonusCashEarned, defer: true, runRanked: ranked, maps: runMapsLabel() ? runMapsLabel().split(' + ') : [] };
    showOver(null);
    return;
  }
  if (opts && opts.finalize && deferredRun) deferredRun = false;
  Meta.endRun({ score: ranked ? score : 0, round, earned: runCash, ranked, infinity, cleared, skipCleared: !!(opts && opts.finalize), skipStats: !!(opts && opts.skipStats), map: M.id });
  deferredRun = false;
  lastRun = { score, round, map: M.id, mapName: M.name, weapon: wpn.id, isBest: isBest && score > 0, isAll: isAll && score > 0, fromCkpt, infinity, cleared, unlockedMap: unlockedMap && unlockedMap.name, nextMap: allCleared ? null : (nxt && nxt.name), nextMapId: allCleared ? null : (nxt && nxt.id), allCleared, bonusCash: bonusCashEarned, defer: false, runRanked: ranked, maps: runMapsLabel() ? runMapsLabel().split(' + ') : [] };
  if (ranked && window.Leaderboard && Leaderboard.qualifies(M.id, score, infinity)) openNameEntry();
  else showOver(null);
}
function gameOver() { const wasDeferred = deferredRun; deferredRun = false; finishRun({ cleared: false, finalize: wasDeferred }); }
function victory() { finishRun({ cleared: true }); }
function finalizeDeferredRun(then) {
  if (!deferredRun) { if (then) then(); return; }
  deferredRun = false;
  const ranked = !!(lastRun && lastRun.runRanked);
  if (ranked && !infinity && score > best) { best = score; store.set('best', best); }
  Meta.endRun({ score: ranked ? score : 0, round, earned: runCash, ranked, infinity: false, cleared: true, skipCleared: true, map: lastRun ? lastRun.map : M.id });
  if (lastRun) {
    lastRun.score = score;
    lastRun.round = round;
    lastRun.defer = false;
    lastRun.nextMap = null;
    lastRun.nextMapId = null;
    lastRun.isBest = ranked && score > 0;
    lastRun.isAll = ranked && score > 0;
  }
  if (ranked && window.Leaderboard && Leaderboard.qualifies((lastRun && lastRun.map) || M.id, score, false)) {
    afterFinalize = then || null;
    openNameEntry();
    return;
  }
  if (then) then();
}

function showTitleBehindOver() {
  ['ov-pause', 'ov-shop', 'ov-continue', 'ov-board', 'ov-how', 'ov-about', 'ov-missions', 'ov-daily', 'ov-adfree'].forEach(id => show(id, false));
  paused = false;
  showGameButtons(false);
  titleBrowseMap = null;
  const infOver = !!(lastRun && lastRun.infinity);
  Meta.setMode(infOver ? 'infinity' : 'campaign'); shopInf = infOver;
  if (!curMap || curMap.id !== Meta.save.equip.map) buildBg();
  targets = []; projs = []; parts = []; floats = []; holding = false; drawing = null;
  Sfx.setMusic('menu');
  if (infOver) {
    show('ov-title', false);
    updateInfinity();
    show('ov-infinity', true);
  } else {
    show('ov-infinity', false);
    updateTitle();
    show('ov-title', true);
  }
  refreshAdFreeUI();
}

function showOver(rank) {
  const r = lastRun;
  $('go-title').textContent = r.cleared ? (r.allCleared ? 'ALL MAPS CLEARED!' : 'MAP CLEARED!') : 'GAME OVER';
  $('go-title').classList.toggle('red', !r.cleared);
  $('go-title').classList.toggle('gold', !!r.cleared);
  const bestNow = r.infinity ? (Meta.save.bestInfinityByMap[r.map] || 0) : best;
  $('go-score').textContent = fmt(r.score); $('go-best').textContent = fmt(bestNow);
  $('go-bestl').textContent = r.infinity ? ('INF BEST (' + r.mapName.toUpperCase() + ')') : 'BEST';
  $('go-round').textContent = r.round; $('go-hits').textContent = hits;
  $('go-acc').textContent = shots ? Math.min(100, Math.round(hits / shots * 100)) + '%' : '0%';
  const boardName = r.infinity ? (r.mapName.toUpperCase() + ' INFINITY') : 'CLASSIC';
  $('go-rank').textContent = rank ? `#${rank} ON THE ${boardName} LEADERBOARD!` : '';
  show('go-rank', !!rank);
  earnedShown = Math.max(0, runCash - (cashSettled || 0));
  $('go-earned').textContent = '+$' + fmt(earnedShown);
  $('newbest').textContent = r.infinity ? 'NEW ' + r.mapName.toUpperCase() + ' INFINITY BEST!' : 'NEW HIGH SCORE!';
  show('newbest', r.isBest);
  const dbl = $('btn-double'), left = Meta.doublesLeft();
  dbl.classList.toggle('hidden', earnedShown <= 0);
  dbl.disabled = left <= 0;
  const adFree = Meta.isAdFree();
  dbl.innerHTML = left > 0
    ? ((adFree ? '2X EARNINGS' : '&#9654; WATCH AD: 2X EARNINGS') + `<br><small>+$${fmt(earnedShown)} MORE \u00b7 ${left} LEFT TODAY</small>`)
    : '2X USED UP TODAY<br><small>COMES BACK TOMORROW</small>';
  renderNext('go-next'); renderMissions('go-missions');
  let note = '';
  if (r.cleared) {
    note = r.allCleared
      ? 'ALL FIVE MAPS CLEARED!'
      : r.unlockedMap
        ? ('NEW MAP UNLOCKED: ' + r.unlockedMap.toUpperCase() + '! \u00b7 INFINITY UNLOCKED')
        : 'MAP CLEARED \u00b7 INFINITY UNLOCKED';
    if (!r.runRanked) note += ' \u00b7 CHECKPOINT RUN, NOT RANKED';
  }
  else if (!r.runRanked) note = (r.infinity ? 'INFINITY ' : '') + `CHECKPOINT RUN (FROM ROUND ${r.fromCkpt || 0}) \u00b7 NOT RANKED`;
  else if (r.infinity) note = 'INFINITY RUN \u00b7 RANKED ON THIS MAP\'S INFINITY BOARD';
  if (r.maps && r.maps.length > 1) note = (note ? note + ' \u00b7 ' : '') + 'FULL RUN: ' + r.maps.join(' + ');
  $('go-unranked').textContent = note;
  show('go-unranked', !!note);
  if ($('go-bonus')) {
    const bc = r.bonusCash || 0;
    $('go-bonus').textContent = bc > 0 ? ('PERFECT BONUS +$' + fmt(bc)) : '';
    show('go-bonus', bc > 0);
  }
  if ($('btn-next-map')) show('btn-next-map', false);
  const ck = checkpointFor(r.map, r.infinity);
  const snap = (!r.infinity && Meta.save.ckptRun) ? Meta.save.ckptRun[r.map] : null;
  const ckScore = (snap && snap.round === ck) ? snap.score : 0;
  $('btn-ckpt').innerHTML = ckScore
    ? (`CONTINUE FROM ROUND ${ck}<br><small>CHECKPOINT \u00b7 SCORE ${fmt(ckScore)} KEPT \u00b7 X'S CLEARED \u00b7 NOT RANKED</small>`)
    : (`CONTINUE FROM ROUND ${ck}<br><small>CHECKPOINT \u00b7 SCORE 0 \u00b7 X'S CLEARED \u00b7 NOT RANKED</small>`);
  show('btn-ckpt', ck > 0 && !r.cleared);
  const againMode = r.infinity ? 'INFINITY' : 'RANKED RUN';
  $('btn-again').innerHTML = ck > 0 ? `START FROM ROUND 1<br><small>${againMode}</small>` : (r.infinity ? 'PLAY INFINITY AGAIN' : 'PLAY AGAIN');
  $('btn-again').classList.toggle('green', false);
  const showInf = Meta.isCleared(r.map) && !r.infinity;
  $('btn-go-infinity').innerHTML = 'PLAY INFINITY<br><small>ENDLESS \u00b7 SEPARATE HIGH SCORE</small>';
  show('btn-go-infinity', showInf);
  showTitleBehindOver(); show('ov-over', true); notify(); boostBtnStamp = ''; refreshBoostButtons();
}
function renderNext(id) {
  const nx = Meta.cheapestNext(), el = $(id);
  if (!nx.t) { el.innerHTML = '<div class="nx-t">ALL UPGRADES MAXED!</div>'; return; }
  const pct = Math.min(100, Math.floor(Meta.bank() / nx.c * 100));
  const label = Meta.isInf() ? 'INFINITY $' : 'BANK $';
  el.innerHTML = `<div class="nx-t${pct >= 100 ? ' ready' : ''}">${pct >= 100 ? 'READY TO BUY: ' : label + fmt(Meta.bank()) + ' · NEXT: '}${esc(nx.t.name.toUpperCase())} $${fmt(nx.c)}</div><div class="prog big"><i style="width:${pct}%"></i><span>${pct}%</span></div>`;
}
function renderMissions(id) {
  $(id).innerHTML = Meta.save.missions.map(m => {
    const p = Math.min(m.n, m.p);
    return `<div class="ms"><div class="ms-t">${esc(Meta.missionText(m))}</div><div class="ms-r">$${fmt(Meta.missionReward())}</div>
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
$('btn-go-shop').addEventListener('click', () => { Sfx.click(); finalizeDeferredRun(() => { shopInf = !!(infinity || (lastRun && lastRun.infinity)); show('ov-over', false); openShop('over'); }); });

// ---------------- leaderboard name entry (free text, max 12 chars) ----------------
let lastEntryTs = 0;
function openNameEntry() {
  const inp = $('name-input');
  inp.value = store.get('playerName', '');
  $('name-score').textContent = fmt(lastRun.score);
  $('name-map').textContent = (lastRun.infinity ? lastRun.mapName.toUpperCase() + ' INFINITY' : 'CLASSIC') + ' \u00b7 ROUND ' + lastRun.round;
  syncNameCount(); show('ov-name', true); Sfx.gold();
  setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) {} }, 50);
}
function syncNameCount() { $('name-count').textContent = Array.from($('name-input').value).length + '/' + Leaderboard.NAME_MAX; }
$('name-input').addEventListener('input', syncNameCount);
$('name-input').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') submitName(); });
function submitName() {
  if ($('ov-name').classList.contains('hidden')) return;
  const name = Leaderboard.cleanName($('name-input').value);
  store.set('playerName', name); show('ov-name', false); $('name-input').blur(); Sfx.buy();
  const ts = Date.now(); lastEntryTs = ts;
  Leaderboard.submitScore(lastRun.map, { name, score: lastRun.score, round: lastRun.round, weapon: lastRun.weapon, ts, infinity: !!lastRun.infinity }).then(r => {
    const next = afterFinalize; afterFinalize = null;
    showOver(r.rank);
    if (next) next();
  });
}
$('btn-name-ok').addEventListener('click', () => { Sfx.click(); submitName(); });

// ---------------- leaderboard ----------------
let boardMap = 'meadow', boardFrom = 'title', boardInf = false;
function openBoard(map, from, inf) {
  boardFrom = from || boardFrom;
  if (inf != null) boardInf = !!inf;
  else if (from === 'infinity') boardInf = true;
  else if (from === 'over' && lastRun) boardInf = !!lastRun.infinity;
  else boardInf = false;
  boardMap = boardInf ? (map || boardMap || Meta.save.equip.map) : 'classic';
  $('board-tabs').innerHTML = '';
  $('board-modes').innerHTML = '';
  if (boardInf) {
    const maps = ECON.MAPS.filter(m => Meta.isCleared(m.id));
    maps.forEach(m => $('board-tabs').appendChild(btn(m.name.toUpperCase(), 'small' + (m.id === boardMap ? ' on' : ''), () => openBoard(m.id, boardFrom, true))));
  }
  $('board-list').innerHTML = '<div class="note">LOADING...</div>';
  show('ov-board', true);
  Leaderboard.fetchTop(boardInf ? boardMap : 'meadow', undefined, boardInf).then(({ list, source }) => {
    const src = source === 'online' ? 'ONLINE TOP 10' : 'TOP 10 ON THIS DEVICE';
    const mapNm = boardInf ? ((mapDef(boardMap) || { name: boardMap }).name.toUpperCase() + ' INFINITY · ') : 'CLASSIC · ';
    $('board-src').textContent = mapNm + src;
    const rows = [];
    for (let i = 0; i < 10; i++) {
      const e = list[i];
      rows.push(e ? `<div class="brow${e.ts === lastEntryTs ? ' me' : ''}"><span class="rk">${i + 1}</span><b>${esc(Leaderboard.nameOf(e))}<small>${esc(((WDEF(e.weapon) || {}).name || '').toUpperCase())}</small></b><span class="sc">${fmt(e.score)}</span><span class="rd">R${e.round || 0}</span></div>`
        : `<div class="brow empty"><span class="rk">${i + 1}</span><b>---</b><span class="sc">0</span><span class="rd"></span></div>`);
    }
    $('board-list').innerHTML = rows.join('');
    $('btn-board-share').disabled = !list.length;
  });
}
$('btn-board').addEventListener('click', () => { Sfx.init(); Sfx.click(); openBoard(null, 'title', false); });
$('btn-go-board').addEventListener('click', () => { Sfx.click(); finalizeDeferredRun(() => openBoard(lastRun ? lastRun.map : Meta.save.equip.map, 'over', !!(lastRun && lastRun.infinity))); });
$('btn-board-close').addEventListener('click', () => { Sfx.click(); show('ov-board', false); });

// ---------------- share (Web Share API -> Facebook sharer fallback) ----------------
function makeCard(o) { // 300x157 pixel card, upscaled x4 -> 1200x628 PNG (Open Graph size)
  const w = 300, h = 157, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const mapId = o.map || 'meadow', th = mapThumb(mapId);
  g.drawImage(th, 0, 0, W, 120, 0, 0, w, 200);
  g.fillStyle = 'rgba(8,16,32,0.45)'; g.fillRect(0, 0, w, h);
  const old = ctx; ctx = g; ctx.setTransform(1, 0, 0, 1, 0, 0);
  try {
    text('PIXEL', 150, 10, 4, '#ffe066', 'center', '#7a2a00');
    text('HUNT', 150, 36, 4, '#ff5a2a', 'center', '#3a0a00');
    spr(SPR.bird[0], 228, 22, 1.6); spr(SPR.gold[1], 66, 30, 1.4, true);
    if (o.score != null) {
      text('I SCORED', 150, 70, 1.5, '#9fc4ff', 'center');
      text(fmt(o.score), 150, 82, 3.2, '#ffffff', 'center');
      text((o.mapName || '').toUpperCase() + (o.infinity ? ' INF' : '') + ' \u00b7 ROUND ' + o.round, 150, 108, 1.5, '#7dff7a', 'center');
      text('CAN YOU BEAT ME?', 150, 126, 1.5, '#ffd23f', 'center');
    } else {
      text('RETRO PIXEL HUNTING', 150, 72, 2, '#ffffff', 'center');
      text('6 WEAPONS \u00b7 TURRETS \u00b7 5 MAPS \u00b7 BOSSES', 150, 94, 1.2, '#7dff7a', 'center');
      text('HOW HIGH CAN YOU SCORE?', 150, 116, 1.5, '#ffd23f', 'center');
    }
    const hs = hunterSprite(Meta.save.equip.skin); g.drawImage(hs, 14, 118, 20, 28);
  } finally { ctx = old; }
  const big = document.createElement('canvas'); big.width = w * 4; big.height = h * 4;
  const bg2 = big.getContext('2d'); bg2.imageSmoothingEnabled = false; bg2.drawImage(c, 0, 0, w * 4, h * 4);
  return big;
}
function shareScore(o) {
  if (!o) return;
  const txt = `I scored ${fmt(o.score)} on Pixel Hunt (${o.mapName}${o.infinity ? ' Infinity' : ''}, round ${o.round})! Can you beat me?`;
  Share.share({ title: 'Pixel Hunt', text: txt, canvas: makeCard(o) }).then(res => {
    if (res === 'facebook') toast('OPENING FACEBOOK', 'Score text copied - paste it into your post', 0);
    else if (res === 'shared') toast('THANKS FOR SHARING!', '', 0);
  });
}
$('btn-share').addEventListener('click', () => { Sfx.click(); shareScore(lastRun); });
$('btn-board-share').addEventListener('click', () => {
  Sfx.click();
  Leaderboard.fetchTop(boardMap, undefined, boardInf).then(({ list }) => {
    const mine = list.find(e => e.ts === lastEntryTs) || list[0]; if (!mine) return;
    shareScore({ score: mine.score, round: mine.round, map: boardMap, mapName: mapDef(boardMap).name, infinity: boardInf });
  });
});

// ---------- toasts / notices ----------
const toastQ = []; let toastBusy = false;
function toast(title, sub, reward) { toastQ.push({ title, sub, reward }); if (!toastBusy) nextToast(); }
function nextToast() {
  const t = toastQ.shift(); const el = $('toast');
  if (!t) { toastBusy = false; el.classList.add('hidden'); return; }
  toastBusy = true;
  el.innerHTML = `<b>${esc(t.title)}</b><div>${esc(t.sub || '')}</div>${t.reward ? `<i>+$${fmt(t.reward)}</i>` : ''}`;
  el.classList.remove('hidden'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  setTimeout(nextToast, 2200);
}
function notify() { Meta.takeNotices().forEach(n => { toast(n.text, n.sub, n.reward); Sfx.gold(); }); }

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
  const d2 = $('btn-daily-2x');
  if (d2) d2.innerHTML = Meta.isAdFree() ? 'CLAIM 2X' : '&#9654; WATCH AD: CLAIM 2X';
  show('ov-daily', true);
  return true;
}
function claimDaily(mult) {
  const amt = Meta.claimDaily(mult);
  show('ov-daily', false); $('btn-daily').classList.add('hidden');
  if (amt) { Sfx.buy(); toast('DAILY REWARD', mult > 1 ? (Meta.isAdFree() ? 'DOUBLED!' : 'DOUBLED WITH AD!') : 'COME BACK TOMORROW', amt); }
  updateTitle();
}
$('btn-daily-claim').addEventListener('click', () => { Sfx.init(); claimDaily(1); });
$('btn-daily-2x').addEventListener('click', () => { Sfx.init(); Ads.showRewarded().then(ok => claimDaily(ok ? 2 : 1)); });
$('btn-daily').addEventListener('click', () => { Sfx.init(); Sfx.click(); maybeDaily(); });
$('btn-daily-close').addEventListener('click', () => { Sfx.click(); show('ov-daily', false); });

// ---------- missions / achievements / stats ----------
function openMissions() {
  renderMissions('ms-list');
  const s = Meta.save.stats;
  $('ach-list').innerHTML = Meta.ACH.map(a => `<div class="ach ${Meta.save.ach[a.id] ? 'done' : ''}"><b>${esc(a.name)}</b><span>${esc(a.txt)}</span><i>${Meta.save.ach[a.id] ? '\u2713' : a.r ? '$' + fmt(a.r) : 'BADGE'}</i></div>`).join('');
  $('ach-count').textContent = Object.keys(Meta.save.ach).length + '/' + Meta.ACH.length;
  const bm = ECON.MAPS.filter(m => Meta.hasMap(m.id)).flatMap(m => {
    const rows = [['BEST: ' + m.name.toUpperCase(), Meta.save.bestByMap[m.id] || 0]];
    if (Meta.isCleared(m.id)) rows.push(['INF BEST: ' + m.name.toUpperCase(), Meta.save.bestInfinityByMap[m.id] || 0]);
    return rows;
  });
  $('stats-list').innerHTML = [['RUNS', s.runs], ['TARGETS HIT', s.kills], ['GOLDEN BIRDS', s.gold], ['GROUND GAME', s.deer], ['BOSSES', s.bosses || 0], ['TURRET KILLS', s.turretKills || 0], ['BEST ROUND', s.bestRound], ['BEST STREAK', s.bestStreak],
    ['ACCURACY', s.shots ? Math.min(100, Math.round(s.hits / s.shots * 100)) + '%' : '-'], ['TOTAL EARNED', '$' + fmt(s.earned)], ['UPGRADES', Meta.totalBought() + '/' + ECON.TOTAL_LEVELS], ['MISSIONS DONE', Meta.save.mDone]].concat(bm)
    .map(([k, v]) => `<div><span>${k}</span><b>${typeof v === 'number' ? fmt(v) : v}</b></div>`).join('');
  show('ov-missions', true);
}
$('btn-missions').addEventListener('click', () => { Sfx.init(); Sfx.click(); openMissions(); });
$('btn-missions-close').addEventListener('click', () => { Sfx.click(); show('ov-missions', false); });
$('btn-armory').addEventListener('click', () => { Sfx.init(); Sfx.click(); shopInf = false; Meta.setMode('campaign'); show('ov-title', false); openShop('title'); });

// ---------- title ----------
function shownMap() { return mapDef(titleBrowseMap || Meta.save.equip.map); }
function cycleMap(d) {
  const maps = ECON.MAPS;
  const cur = shownMap();
  const i = Math.max(0, maps.findIndex(m => m.id === cur.id));
  const nxt = maps[(i + d + maps.length) % maps.length];
  if (Meta.hasMap(nxt.id)) { titleBrowseMap = null; Meta.selectMap(nxt.id); }
  else titleBrowseMap = nxt.id;
  buildBg(nxt.id); targets = []; updateTitle();
}
$('btn-map-prev').addEventListener('click', () => { Sfx.init(); Sfx.click(); cycleMap(-1); });
$('btn-map-next').addEventListener('click', () => { Sfx.init(); Sfx.click(); cycleMap(1); });
function updateTitle() {
  const m = shownMap();
  const unlocked = Meta.hasMap(m.id);
  $('title-best').textContent = fmt(best);
  const anyClear = ECON.MAPS.some(m => Meta.isCleared(m.id));
  $('title-bank').textContent = '$' + fmt(Meta.save.bank);
  $('title-map').textContent = m.name.toUpperCase() + (unlocked && Meta.isCleared(m.id) ? '  \u2605' : unlocked ? '' : '  LOCKED');
  $('title-map').classList.toggle('is-locked', !unlocked);
  const bestLine = unlocked
    ? ('MAP BEST ' + fmt(Meta.save.bestByMap[m.id] || 0) + ' \u00b7 $ x' + m.cash)
    : (ECON.unlockHint(m.id) || 'Locked');
  $('title-mapbest').textContent = (unlocked && Meta.isCleared(m.id))
    ? bestLine + ' \u00b7 INF BEST ' + fmt(Meta.save.bestInfinityByMap[m.id] || 0)
    : bestLine;
  const eq = Meta.save.equip;
  $('title-loadout').textContent = WDEF(eq.primary).name.toUpperCase() + (Meta.val('loadout') && eq.secondary ? ' + ' + WDEF(eq.secondary).name.toUpperCase() : '') + (eq.turrets.length ? ' \u00b7 ' + eq.turrets.length + ' TURRET' + (eq.turrets.length > 1 ? 'S' : '') : '');
  $('btn-armory').classList.toggle('gold-btn', Meta.anyAffordable());
  const cleared = unlocked && Meta.isCleared(m.id), prog = Meta.clearProgress(m.id);
  show('btn-infinity', cleared);
  const el = $('title-clear');
  el.classList.toggle('is-locked', !unlocked);
  if (!unlocked) {
    el.innerHTML = '<div class="nx-t">' + (ECON.unlockHint(m.id) || 'Locked') + '</div>';
  } else if (cleared) {
    el.innerHTML = '<div class="nx-t ready">MAP CLEARED \u00b7 INFINITY UNLOCKED</div>';
  } else {
    const pct = Math.floor(prog.cur / prog.need * 100);
    el.innerHTML = `<div class="nx-t">CLEAR ${prog.cur}/${prog.need} \u00b7 BEAT THE ROUND ${prog.need} BOSS</div><div class="prog"><i style="width:${pct}%"></i><span>${pct}%</span></div>`;
  }
  const play = $('btn-play');
  if (play) { play.disabled = !unlocked; play.setAttribute('aria-disabled', unlocked ? 'false' : 'true'); }
  renderNext('title-next');
  boostBtnStamp = ''; refreshBoostButtons();
}
function clearedMaps() { return ECON.MAPS.filter(m => Meta.isCleared(m.id)); }
function updateInfinity() {
  const maps = clearedMaps();
  let id = Meta.save.equip.map;
  if (!Meta.isCleared(id) && maps[0]) { Meta.selectMap(maps[0].id); id = maps[0].id; }
  const m = mapDef(id);
  const slot = Meta.infOf(id);
  $('inf-best').textContent = fmt(Meta.save.bestInfinityByMap[id] || 0);
  $('inf-bank').textContent = '$' + fmt(slot.bank);
  $('inf-map').textContent = m.name.toUpperCase() + '  \u2605';
  $('inf-mapbest').textContent = 'INF BEST ' + fmt(Meta.save.bestInfinityByMap[id] || 0) + ' \u00b7 THIS MAP ONLY';
  const eq = slot.equip || { primary: 'shotgun', secondary: null, turrets: [] };
  const pn = (WDEF(eq.primary) || WDEF('shotgun')).name.toUpperCase();
  const sn = eq.secondary && WDEF(eq.secondary) ? ' + ' + WDEF(eq.secondary).name.toUpperCase() : '';
  const tn = (eq.turrets && eq.turrets.length) ? ' \u00b7 ' + eq.turrets.length + ' TURRET' + (eq.turrets.length > 1 ? 'S' : '') : '';
  $('inf-loadout').textContent = pn + sn + tn;
  Meta.setMode('infinity');
  renderNext('inf-next');
  const shopBtn = $('btn-inf-shop');
  if (shopBtn) shopBtn.classList.toggle('gold-btn', Meta.anyAffordable());
  if (!curMap || curMap.id !== id) buildBg(id);
}
function cycleInfMap(d) {
  const maps = clearedMaps();
  if (!maps.length) return;
  const i = Math.max(0, maps.findIndex(m => m.id === Meta.save.equip.map));
  const nxt = maps[(i + d + maps.length) % maps.length];
  Meta.selectMap(nxt.id);
  targets = [];
  updateInfinity();
}
function openInfinityLobby() {
  ['ov-over', 'ov-pause', 'ov-shop', 'ov-continue', 'ov-board', 'ov-name', 'ov-how', 'ov-about', 'ov-missions', 'ov-daily', 'ov-adfree', 'ov-title'].forEach(id => show(id, false));
  paused = false; state = 'title'; targets = []; projs = []; holding = false; drawing = null; showGameButtons(false);
  titleBrowseMap = null;
  Meta.setMode('infinity'); shopInf = true;
  if (!curMap || curMap.id !== Meta.save.equip.map) buildBg();
  Sfx.setMusic('menu');
  updateInfinity(); refreshAdFreeUI();
  show('ov-infinity', true);
}

function toTitle() {
  finalizeDeferredRun();

  ['ov-over', 'ov-pause', 'ov-shop', 'ov-continue', 'ov-board', 'ov-name', 'ov-how', 'ov-about', 'ov-missions', 'ov-daily', 'ov-adfree', 'ov-infinity'].forEach(id => show(id, false));
  paused = false; state = 'title'; targets = []; projs = []; holding = false; drawing = null; showGameButtons(false); Meta.persist();
  titleBrowseMap = null;
  Meta.setMode('campaign'); shopInf = false;
  if (!curMap || curMap.id !== Meta.save.equip.map) buildBg();
  Sfx.setMusic('menu');
  updateTitle(); refreshAdFreeUI(); show('ov-title', true); maybeDaily();
}
function leaveOverToTitle() {
  if (lastRun && lastRun.infinity) { finalizeDeferredRun(); openInfinityLobby(); return; }
  toTitle();
}
function newGame(fromRound, opts) {
  titleBrowseMap = null;
  if (!Meta.hasMap(Meta.save.equip.map)) { const owned = ECON.MAPS.filter(m => Meta.hasMap(m.id)); Meta.selectMap((owned[owned.length - 1] || ECON.MAPS[0]).id); }

  const carry = !!(opts && opts.carry);
  const resume = opts && opts.resume;
  const keep = (carry || resume) ? { score, runCash, hits, shots, bestStreak, runRanked, deferredRun, gadgets: { flak: gadgets.flak, call: gadgets.call, decoy: gadgets.decoy }, maps: runMaps.slice() } : null;
  if (!carry && !resume) finalizeDeferredRun();

  Sfx.init(); Sfx.click(); Ads.init();
  ['ov-title', 'ov-over', 'ov-pause', 'ov-shop', 'ov-daily', 'ov-board', 'ov-how', 'ov-about', 'ov-missions', 'ov-infinity'].forEach(id => show(id, false));
  infinity = !!(opts && opts.infinity);
  Meta.setMode(infinity ? 'infinity' : 'campaign');
  shopInf = !!infinity;
  Sfx.setMusic('game');
  targets = []; resetRun();
  const ck = fromRound > 1 ? fromRound : 0;
  if (carry) {
    score = keep.score; runCash = keep.runCash; hits = keep.hits; shots = keep.shots; bestStreak = keep.bestStreak;
    runRanked = keep.runRanked; deferredRun = keep.deferredRun;
    gadgets = keep.gadgets; runMaps = keep.maps.length ? keep.maps : [M.id];
    missRun = 0; fromCkpt = 0; perfectRun = true;
  } else if (resume) {
    score = resume.score || 0; runCash = resume.runCash || 0; hits = resume.hits || 0; shots = resume.shots || 0;
    bestStreak = resume.bestStreak || 0;
    runMaps = (resume.maps && resume.maps.length) ? resume.maps.slice() : [M.id];
    cashSettled = runCash;
    runRanked = false; deferredRun = false;
    missRun = 0;
  } else {
    runRanked = !ck;
    deferredRun = false;
    runMaps = [M.id];
  }
  Meta.startRun({ base: ck ? ck - 1 : 0 });
  if (ck) { fromCkpt = ck; round = ck - 1; runRanked = false; } // checkpoint continue is not ranked
  if (carry) perfectRun = !infinity; // next map starts at R1, so its own R31 can still be earned
  else if (resume) perfectRun = false; // mid-map resume is not a from-R1 perfect
  else perfectRun = runRanked && !infinity && !ck;
  startRound();
}
function goToNextMap() {
  const id = lastRun && lastRun.nextMapId;
  if (!id || !Meta.hasMap(id) && !ECON.nextMap(M.id)) {
    const nxt = ECON.nextMap(M.id);
    if (!nxt) return;
    Meta.selectMap(nxt.id);
  } else Meta.selectMap(id);
  show('ov-over', false);
  newGame(0, { carry: true });
}
function continueCheckpoint() {
  const inf = !!(lastRun && lastRun.infinity);
  const mapId = Meta.save.equip.map;
  const ck = checkpointFor(mapId, inf);
  if (inf) { if (ck) newGame(ck, { infinity: true }); else newGame(0, { infinity: true }); return; }
  const snap = (Meta.save.ckptRun || {})[mapId];
  const resume = (snap && ck && snap.round === ck) ? snap : null;
  if (ck) newGame(ck, { infinity: false, resume }); else newGame(0, { infinity: false });
}
$('btn-play').addEventListener('click', () => {
  const m = shownMap();
  if (!Meta.hasMap(m.id)) { toast('MAP LOCKED', ECON.unlockHint(m.id) || 'Locked', 0); return; }
  if (titleBrowseMap) { Meta.selectMap(titleBrowseMap); titleBrowseMap = null; }
  newGame();
});
$('btn-infinity').addEventListener('click', () => {
  const m = shownMap();
  if (!Meta.isCleared(m.id) && !ECON.MAPS.some(x => Meta.isCleared(x.id))) { toast('INFINITY LOCKED', 'Beat the round ' + ECON.CLEAR_ROUND + ' boss to unlock', 0); return; }
  if (titleBrowseMap && Meta.isCleared(titleBrowseMap)) { Meta.selectMap(titleBrowseMap); titleBrowseMap = null; }
  else if (!Meta.isCleared(Meta.save.equip.map)) {
    const first = ECON.MAPS.find(x => Meta.isCleared(x.id));
    if (first) Meta.selectMap(first.id);
  }
  openInfinityLobby();
});
$('btn-go-infinity').addEventListener('click', () => { Sfx.click(); show('ov-over', false); openInfinityLobby(); });
$('btn-again').addEventListener('click', () => { finalizeDeferredRun(() => newGame(0, { infinity: !!(lastRun && lastRun.infinity) })); });
$('btn-ckpt').addEventListener('click', continueCheckpoint);
$('btn-menu').addEventListener('click', () => { Sfx.click(); leaveOverToTitle(); });
$('btn-over-close').addEventListener('click', () => { Sfx.click(); leaveOverToTitle(); });
if ($('btn-next-map')) $('btn-next-map').addEventListener('click', () => { Sfx.click(); goToNextMap(); });

if ($('btn-inf-close')) $('btn-inf-close').addEventListener('click', () => { Sfx.click(); toTitle(); });
if ($('btn-inf-play')) $('btn-inf-play').addEventListener('click', () => newGame(0, { infinity: true }));
if ($('btn-inf-shop')) $('btn-inf-shop').addEventListener('click', () => { Sfx.init(); Sfx.click(); shopInf = true; Meta.setMode('infinity'); show('ov-infinity', false); openShop('infinity'); });
if ($('btn-inf-board')) $('btn-inf-board').addEventListener('click', () => { Sfx.init(); Sfx.click(); openBoard(Meta.save.equip.map, 'infinity', true); });
if ($('btn-inf-map-prev')) $('btn-inf-map-prev').addEventListener('click', () => { Sfx.init(); Sfx.click(); cycleInfMap(-1); });
if ($('btn-inf-map-next')) $('btn-inf-map-next').addEventListener('click', () => { Sfx.init(); Sfx.click(); cycleInfMap(1); });
$('btn-how').addEventListener('click', () => { Sfx.init(); Sfx.click(); show('ov-how', true); });
$('btn-how-close').addEventListener('click', () => { Sfx.click(); show('ov-how', false); });
function togglePause() {
  if (!(state === 'play' || state === 'intro' || state === 'bonus')) return;
  paused = !paused; holding = false; drawing = null; show('ov-pause', paused); if (!paused) Sfx.click(); boostBtnStamp = ''; refreshBoostButtons();
}
$('btn-pause').addEventListener('click', togglePause);
$('btn-resume').addEventListener('click', togglePause);
$('btn-quit').addEventListener('click', () => { Sfx.click(); paused = false; show('ov-pause', false); if (runIsActive()) { gameOver(); return; } leaveOverToTitle(); });
['btn-auto-boost-t', 'btn-auto-boost-o', 'btn-auto-boost-p'].forEach(id => { const el = $(id); if (el) el.addEventListener('click', startAutoBoostAd); });
function syncAudio() {
  document.querySelectorAll('.sfx-btn').forEach(b => {
    const on = Sfx.sfxOn; b.classList.toggle('off', !on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  });
  document.querySelectorAll('.music-btn').forEach(b => {
    const on = Sfx.musicOn; b.classList.toggle('off', !on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? 'Music on' : 'Music off');
  });
}
document.querySelectorAll('.sfx-btn').forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.setSfxOn(!Sfx.sfxOn); syncAudio(); if (Sfx.sfxOn) Sfx.click(); }));
document.querySelectorAll('.music-btn').forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.setMusicOn(!Sfx.musicOn); syncAudio(); if (Sfx.sfxOn) Sfx.click(); }));
syncAudio();
$('btn-about').addEventListener('click', () => { Sfx.init(); Sfx.click(); show('ov-about', true); });
$('btn-about-close').addEventListener('click', () => { Sfx.click(); show('ov-about', false); });
const press = (id, fn) => { const el = $(id); el.dataset.press = '1'; el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sfx.init(); fn(); }); };
press('btn-reload', startReload); press('btn-focus', useFocus); press('btn-swap', swapWeapon);
press('btn-flak', () => useGadget('flak')); press('btn-call', () => useGadget('call')); press('btn-decoy', () => useGadget('decoy'));
// ---------------- render ----------------
const crossColor = () => (ECON.CROSSHAIRS.find(c => c.id === Meta.save.equip.cross) || ECON.CROSSHAIRS[0]).c;
function drawTarget(t) {
  if (t.kind === 'eyes') return;
  if (t.kind === 'bag') {
    const fr = SPR.bag[Math.floor(t.anim * 8) % 2];
    const flick = t.hurt > 0 && Math.floor(t.hurt * 40) % 2 === 0;
    spr(fr, t.x, t.y + Math.sin(t.anim * 6) * 2, t.sc, false, false, flick ? 0.35 : 1);
    if (Math.floor(t.anim * 10) % 2) { ctx.fillStyle = '#fff6a0'; ctx.fillRect(t.x + rand(-6, 6), t.y + rand(-8, 4), 1, 1); }
    return;
  }
  if (t.kind === 'egg') {
    const wob = Math.sin(t.anim * 8) * 1.2;
    const flick = t.hurt > 0 && Math.floor(t.hurt * 40) % 2 === 0;
    spr(SPR.egg[0], t.x + wob * 0.3, t.y, t.sc, false, false, flick ? 0.35 : 1);
    if (live(t) && t.hp0 > 1 && (t.hp < t.hp0 || t.hp0 > 2)) {
      const bw = 14, by = t.y - SPR.egg[0].height * t.sc / 2 - 5;
      ctx.fillStyle = '#000'; ctx.fillRect(t.x - bw / 2 - 0.5, by - 0.5, bw + 1, 4);
      ctx.fillStyle = '#3b1820'; ctx.fillRect(t.x - bw / 2, by, bw, 3);
      ctx.fillStyle = t.hurt > 0 ? '#fff' : '#ff5a5a';
      ctx.fillRect(t.x - bw / 2, by, bw * Math.max(0, t.hp / t.hp0), 3);
    }
    return;
  }
  const set = SPR[t.set]; if (!set) return;
  const flick = t.hurt > 0 && Math.floor(t.hurt * 40) % 2 === 0;
  const a = flick ? 0.35 : 1;
  if (t.kind === 'boss' && isGroundBoss(t)) {
    const fr = set[Math.floor(t.anim * 10) % 2];
    if (t.state === 'hit') spr(set[0], t.x, t.y - (t.hop || 0), t.sc, t.vx < 0, false, a);
    else if (t.state === 'fall') spr(fr, t.x, t.y + 4, t.sc, t.vx < 0, true, Math.min(1, (t.fallT || 0) * 2));
    else spr(fr, t.x, t.y - (t.hop || 0), t.sc, t.vx < 0, false, a);
    if (t.crown && live(t)) { const img = set[0]; ctx.drawImage(CROWN, t.x - 5, t.y - (t.hop || 0) - img.height * t.sc / 2 - 5, 10, 6); }
    return;
  }
  if (t.g) {
    const fr = t.m === 'swim' ? set[1] : set[Math.floor(t.anim * 10) % 2];
    if (t.state === 'fall') spr(fr, t.x, t.y + 4, t.sc, t.vx < 0, true, Math.min(1, (t.fallT || 0) * 2));
    else {
      spr(fr, t.x, t.y - (t.hop || 0), t.sc, t.vx < 0, false, a);
      if (t.m === 'swim') { ctx.fillStyle = 'rgba(200,230,255,0.7)'; ctx.fillRect(t.x - 10, t.y + 6, 20, 1); ctx.fillRect(t.x - 14 - (t.vx > 0 ? 4 : -4), t.y + 7, 6, 1); }
    }
  } else {
    const flip = t.vx < 0;
    if (t.state === 'hit') spr(set[2] || set[0], t.x, t.y, t.sc, flip);
    else if (t.state === 'fall') spr(set[1], t.x, t.y, t.sc, Math.floor(t.anim * 12) % 2 === 0, true);
    else {
      spr(set[Math.abs(Math.floor(t.anim * (t.state === "flee" ? 14 : 9))) % 2], t.x, t.y, t.sc, flip, false, a);
      if (t.kind === 'decoy') heart(t.x, t.y - 11 * t.sc);
      if (t.kind === 'gold' && Math.floor(t.anim * 8) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(t.x + rand(-8, 8), t.y + rand(-6, 6), 1, 1); }
      if (t.kind === 'moth' && live(t)) {
        const g = 0.28 + 0.28 * Math.abs(Math.sin(t.anim * 8));
        ctx.fillStyle = 'rgba(200,255,140,' + g + ')';
        ctx.fillRect(t.x - 5, t.y - 4, 10, 8);
        ctx.fillStyle = 'rgba(255,255,210,' + (g + 0.15) + ')';
        ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
      }
    }
  }
  if (t.crown && live(t)) { const img = set[0]; ctx.drawImage(CROWN, t.x - 5, t.y - img.height * t.sc / 2 - 5, 10, 6); }
  if (t.kind !== 'boss' && live(t) && t.hp0 > 1 && (t.hp < t.hp0 || t.hp0 > 2)) {
    const img = (t.kind === 'egg' ? SPR.egg[0] : set[0]);
    const bw = Math.max(14, Math.min(22, 10 + t.hp0));
    const bh = 3, by = t.y - (img ? img.height * t.sc / 2 : 10) - 5;
    ctx.fillStyle = '#000'; ctx.fillRect(t.x - bw / 2 - 0.5, by - 0.5, bw + 1, bh + 1);
    ctx.fillStyle = '#3b1820'; ctx.fillRect(t.x - bw / 2, by, bw, bh);
    ctx.fillStyle = t.hurt > 0 ? '#fff' : '#ff5a5a';
    ctx.fillRect(t.x - bw / 2, by, bw * Math.max(0, t.hp / t.hp0), bh);
  }
}
function drawHunter() {
  const hx = HUNTER_X, feet = H - BAR - 1;
  ctx.drawImage(hunterSprite(Meta.save.equip.skin), hx - 7.5, feet - 21, 15, 21);
  if (!wpn) return;
  const m = gunPivot(), img = WSPR[wpn.id] || WSPR.gun, a = aimAngle();
  // Sprites point RIGHT with the stock/grip at the left end and their underside (+y) down. Rotate to the aim and
  // mirror vertically when aiming left, so the stock stays at the shoulder and the grip underneath - never upside down.
  ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(a); if (Math.cos(a) < 0) ctx.scale(1, -1);
  const pull = drawing ? Math.min(1, drawing.t / wpn.draw) : 0;
  ctx.drawImage(img, -3, -img.height * 0.4, img.width * 0.8, img.height * 0.8);
  if (wpn.id === 'bow' && drawing) { ctx.fillStyle = '#eee'; ctx.fillRect(-1 - pull * 4, -0.5, 12, 1); }
  ctx.restore();
}
function drawTurrets() {
  for (const tu of turrets) {
    const img = TURRET_SPR[tu.id];
    if (tu.id === 'pellet') { ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tu.x, tu.y - 7); ctx.lineTo(tu.x + Math.cos(tu.ang) * 7, tu.y - 7 + Math.sin(tu.ang) * 7); ctx.stroke(); }
    ctx.drawImage(img, tu.x - 6, tu.y - 9, 12, 12);
    if (tu.flash > 0) { ctx.fillStyle = tu.id === 'tesla' ? '#bff4ff' : '#fff6a0'; ctx.globalAlpha = tu.flash / 0.15; ctx.fillRect(tu.x - 3, tu.y - 13, 6, 4); ctx.globalAlpha = 1; }
    for (let i = 0; i < tu.ammo0; i++) { ctx.fillStyle = i < tu.ammo ? '#7dff7a' : '#333'; ctx.fillRect(tu.x - tu.ammo0 * 1.5 + i * 3, tu.y + 4, 2, 2); }
  }
}
function drawProjs() {
  for (const p of projs) {
    if (p.type === 'arrow') {
      const L = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / L, uy = p.vy / L;
      ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x - ux * 8, p.y - uy * 8); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = p.full ? '#ffd23f' : '#ccc'; ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(p.x - ux * 8 - 1, p.y - uy * 8 - 1, 2, 2);
    } else if (p.type === 'pellet') { ctx.fillStyle = '#ffe066'; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
    else if (p.type === 'missile') { ctx.fillStyle = '#ddd'; ctx.fillRect(p.x - 2, p.y - 1, 4, 2); ctx.fillStyle = '#ff3b3b'; ctx.fillRect(p.x + Math.sign(p.vx || 1) * 2, p.y - 1, 1, 2); }
    else if (p.type === 'flak') { ctx.fillStyle = '#2a4a1a'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); ctx.fillStyle = '#ffd23f'; ctx.fillRect(p.x - 0.5, p.y - 3, 1, 1); }
  }
  for (const tr of tracers) { ctx.strokeStyle = tr.c; ctx.globalAlpha = 1 - tr.t / tr.life; ctx.lineWidth = tr.w; ctx.beginPath(); ctx.moveTo(tr.x0, tr.y0); ctx.lineTo(tr.x1, tr.y1); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const z of zaps) {
    ctx.strokeStyle = Math.random() < 0.5 ? '#bff4ff' : '#5ae0ff'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < z.pts.length - 1; i++) {
      const a = z.pts[i], b = z.pts[i + 1]; ctx.moveTo(a.x, a.y);
      for (let k = 1; k <= 5; k++) { const f = k / 5; ctx.lineTo(a.x + (b.x - a.x) * f + (k < 5 ? rand(-4, 4) : 0), a.y + (b.y - a.y) * f + (k < 5 ? rand(-4, 4) : 0)); }
    }
    ctx.stroke();
  }
  if (wpn && wpn.beam && holding) {
    const b = wpn.beam, wd = wpn.radius;
    ctx.globalAlpha = 0.5 + Math.random() * 0.3; ctx.strokeStyle = '#ff2d7a'; ctx.lineWidth = wd * 1.6; ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(0.8, wd * 0.4); ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
  }
}
function drawDark() {
  const d = darkX;
  d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H);
  d.fillStyle = 'rgba(2,4,16,0.92)'; d.fillRect(0, 0, W, H);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, k = 1) => { const g = d.createRadialGradient(x, y, r * 0.35, x, y, r); g.addColorStop(0, `rgba(0,0,0,${k})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, Math.PI * 2); d.fill(); };
  const lp = lightPos || { x: W / 2, y: SKY_TOP + (SKY_BOT - SKY_TOP) * 0.45 };
  hole(lp.x, lp.y, Meta.val('flashlight'));
  hole(HUNTER_X, H - BAR - 12, 26, 0.8);
  hole(146, 54, 18, 0.5);
  // Boss and falling eggs stay visible on Night Hunt so the fight is fair in the dark.
  for (const t of targets) {
    if (!live(t)) continue;
    if (t.kind === 'boss') hole(t.x, t.y, 34, 0.95);
    else if (t.kind === 'egg' || t.kind === 'bag') hole(t.x, t.y, 16, 0.9);
  }
  for (const f of flashes) hole(f.x, f.y, f.boom ? 44 : 24, 1 - f.t / 0.25);
  if (wpn && wpn.beam && holding) { const b = wpn.beam; for (let k = 0; k < 1; k += 0.08) hole(b.x0 + (b.x1 - b.x0) * k * 0.4, b.y0 + (b.y1 - b.y0) * k * 0.4, 10, 0.7); }
  for (const tu of turrets) if (tu.flash > 0) hole(tu.x, tu.y - 8, 16, 0.8);
  ctx.drawImage(darkC, 0, 0, W, H);
}
function drawGlowEyes() {
  for (const t of targets) {
    if (!live(t) && t.kind !== 'eyes') continue;
    if (t.kind === 'eyes') {
      if (t.state === 'fly' && t.vis && (t.anim % 1.7) > 0.12) { ctx.fillStyle = '#ffe066'; ctx.fillRect(t.x - 4, t.y, 2, 1.5); ctx.fillRect(t.x + 2, t.y, 2, 1.5); ctx.fillStyle = 'rgba(255,224,102,0.25)'; ctx.fillRect(t.x - 6, t.y - 1, 12, 3.5); }
    } else if ((t.kind === 'bat' || (t.kind === 'boss' && t.boss === 'batking')) && live(t)) { ctx.fillStyle = t.kind === 'boss' ? '#ffe066' : '#ff3030'; const s = t.sc; ctx.fillRect(t.x - 2.5 * s, t.y - 0.5 * s, s, s); ctx.fillRect(t.x + 1.5 * s, t.y - 0.5 * s, s, s); }
    else if (t.kind === 'owl' && live(t)) { ctx.fillStyle = '#ffe066'; const s = t.sc; ctx.fillRect(t.x - 2 * s, t.y - 2.5 * s, s, s); ctx.fillRect(t.x + 1 * s, t.y - 2.5 * s, s, s); }
  }
}
function render() {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const sx = shake ? rand(-shake, shake) : 0, sy = shake ? rand(-shake, shake) : 0;
  ctx.save(); ctx.translate(sx, sy);
  ctx.drawImage(bg, 0, 0, W, H);
  if (skyFlash > 0) { ctx.fillStyle = `rgba(255,120,150,${skyFlash * 0.5})`; ctx.fillRect(0, 0, W, GROUND); }
  for (const c of clouds) { ctx.globalAlpha = c.a || 1; ctx.drawImage(c.img, Math.round(c.x), c.y); } ctx.globalAlpha = 1;
  if (curMap && curMap.id === 'desert') { ctx.fillStyle = 'rgba(255,240,200,0.08)'; const k = performance.now() / 300; for (let y = GROUND - 30; y < GROUND; y += 3) ctx.fillRect(Math.sin(k + y) * 2, y, W, 1); }
  if (decoyObj) { const bob = Math.sin(performance.now() / 200) * 1.5; ctx.drawImage(DECOY_SPR, decoyObj.x - 8, decoyObj.y - 4 + bob, 16, 8); ctx.strokeStyle = 'rgba(159,224,255,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(decoyObj.x, decoyObj.y, 14 + Math.sin(performance.now() / 150) * 3, 0, 6.3); ctx.stroke(); }
  for (const t of targets) drawTarget(t);
  ctx.drawImage(fg, 0, 0, W, H);
  if (!titleScene()) { drawTurrets(); drawHunter(); }
  drawProjs();
  for (const p of parts) { ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, (p.life - p.t) * 3); ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;
  for (const f of flashes) {
    if (f.boom) { const k = f.t / 0.25; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffb030'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + k * 0.6), 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff6a0'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.4 * (1 - k), 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; continue; }
    const k = f.t / 0.12, r = 3 + k * (f.r || 5) * 1.4;
    ctx.fillStyle = '#fff6a0'; ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.fillRect(f.x - r, f.y - 0.75, r * 2, 1.5); ctx.fillRect(f.x - 0.75, f.y - r, 1.5, r * 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(f.x - 2, f.y - 2, 4, 4);
    if (f.r > 3) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + k), 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  for (const f of snow) { ctx.fillStyle = '#fff'; ctx.fillRect(f.x, f.y, f.s, f.s); }
  if (curMap && curMap.dark) { drawDark(); drawGlowEyes(); }
  ctx.restore();

  if (focusT > 0) { ctx.fillStyle = 'rgba(80,40,160,0.18)'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6); }
  if (whiteFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${whiteFlash * 3})`; ctx.fillRect(0, 0, W, H); }
  for (const f of floats) {
    const a = f.t < 0.08 ? 1.4 : 1;
    ctx.globalAlpha = Math.min(1, (f.life - f.t) * 3);
    text(f.text, clamp(f.x, 6 + f.text.length * 2 * f.sz, W - 6 - f.text.length * 2 * f.sz), f.y, f.sz * a, f.color, 'center');
  }
  ctx.globalAlpha = 1;
  if (state === 'play' || state === 'intro' || state === 'bonus') drawCrosshair();
  if (titleScene()) return drawTitle();
  drawHud();
  if ((state === 'intro' || state === 'clear' || state === 'mapshift' || state === 'dying' || (state === 'bonus' && bonusIntroT > 0)) && banner) {
    const y = H * 0.4;
    const isNews = state === 'intro' && news && banner2 === news.text;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, y - 6, W, isNews ? 46 : banner2 ? 30 : 22);
    text(banner, W / 2, y, 2, state === 'dying' || (bossRound && state === 'intro') ? '#ff5a5a' : '#ffe066', 'center');
    if (isNews) {
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, y - 6, W, 1); ctx.fillRect(0, y + 39, W, 1);
      const blink = Math.floor(performance.now() / 180) % 2;
      text(banner2, W / 2, y + 15, 1.5, blink ? '#7dff7a' : '#ffffff', 'center');
      const k = KIND[news.kind], set = k && SPR[news.kind === 'owl' && M.id === 'snow' ? 'snowowl' : k.set];
      if (set) { const img = set[Math.floor(performance.now() / 160) % 2] || set[0]; spr(img, W / 2, y + 31, Math.min(1, 12 / img.height)); }
    } else if (banner2) text(banner2, W / 2, y + 14, 1, '#fff', 'center');
  }
  if (ckptFlash > 0 && (state === 'intro' || state === 'play')) { // CHECKPOINT! ribbon above the round banner
    const y = H * 0.4 - 40, a = Math.min(1, ckptFlash * 2);
    ctx.globalAlpha = a; ctx.fillStyle = '#1b6b2a'; ctx.fillRect(0, y - 7, W, 31); ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, y - 7, W, 2); ctx.fillRect(0, y + 22, W, 2);
    text('CHECKPOINT!', W / 2, y, 2, Math.floor(ckptFlash * 6) % 2 ? '#ffe066' : '#fff', 'center');
    text('ROUND ' + ckptRound + ' SAVED' + (bossRound ? ' - BOSS NEXT' : ''), W / 2, y + 14, 1, '#cfe0ff', 'center');
    ctx.globalAlpha = 1;
  }
}
function drawCrosshair() {
  const mouse = cursor && performance.now() - lastTouch > 800;
  const p = (holding || drawing) ? aim : mouse ? cursor : null;
  if (!p || !wpn) return;
  const col = crossColor(), r = wpn.id === 'mg' ? wpn.spread : armed ? 22 : wpn.radius;
  ctx.strokeStyle = armed ? '#ffb030' : col; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = col; ctx.fillRect(p.x - 0.5, p.y - r - 2, 1, 4); ctx.fillRect(p.x - 0.5, p.y + r - 2, 1, 4); ctx.fillRect(p.x - r - 2, p.y - 0.5, 4, 1); ctx.fillRect(p.x + r - 2, p.y - 0.5, 4, 1);
  if (drawing && wpn.id === 'bow') {
    const charge = clamp(drawing.t / wpn.draw, 0.15, 1), m = muzzle(), g = 120, v = 140 + 230 * charge;
    const dx = p.x - m.x, dy = p.y - m.y, T = Math.max(0.12, Math.hypot(dx, dy) / v), vx = dx / T, vy = dy / T - 0.5 * g * T;
    ctx.fillStyle = charge >= 0.95 ? '#ffd23f' : 'rgba(255,255,255,0.7)';
    for (let k = 1; k < 10; k++) { const tt = T * k / 10; ctx.fillRect(m.x + vx * tt - 0.5, m.y + vy * tt + 0.5 * g * tt * tt - 0.5, 1, 1); }
    ctx.strokeStyle = charge >= 0.95 ? '#ffd23f' : '#9fc4ff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2); ctx.stroke();
  }
}
function heart(x, y) {
  ctx.fillStyle = '#ff1a7a';
  ctx.fillRect(x - 3, y, 2, 1.5); ctx.fillRect(x + 1, y, 2, 1.5);
  ctx.fillRect(x - 3.5, y + 1.5, 7, 2); ctx.fillRect(x - 2, y + 3.5, 4, 1.5); ctx.fillRect(x - 0.7, y + 5, 1.4, 1.2);
}
function drawTitle() {
  const y = H * 0.12;
  const bob = Math.sin(performance.now() / 400) * 1.5;
  const infLobby = $('ov-infinity') && !$('ov-infinity').classList.contains('hidden');
  if (infLobby) {
    text('INFINITY', W / 2, y + 18 + bob, 5, '#ffd23f', 'center', '#7a2a00');
    spr(SPR.gold[Math.floor(performance.now() / 120) % 2], W / 2 + 70, y + 8 + bob, 1.2);
    return;
  }
  text('PIXEL', W / 2, y + bob, 6, '#ffe066', 'center', '#7a2a00');
  text('HUNT', W / 2, y + 36 + bob, 6, '#ff5a2a', 'center', '#3a0a00');
  spr(SPR.bird[Math.floor(performance.now() / 120) % 2], W / 2 + 54, y + 4 + bob, 1);
}
function drawAmmo(x, y) {
  const w = wpn, id = w.id;
  if (id === 'shotgun') { for (let i = 0; i < w.cap; i++) ctx.drawImage(i < w.ammo && !w.reloading ? SHELL : SHELL_E, x + i * 6, y - 1, 4, 9); return w.cap * 6; }
  if (id === 'handgun' || id === 'rifle') {
    const st = id === 'rifle' ? 5 : 3.2;
    for (let i = 0; i < w.cap; i++) { const on = i < w.ammo && !w.reloading; ctx.fillStyle = on ? '#e8b923' : '#3b4458'; ctx.fillRect(x + i * st, y + (id === 'rifle' ? 0 : 2), id === 'rifle' ? 3 : 2, id === 'rifle' ? 8 : 6); if (on) { ctx.fillStyle = '#b87333'; ctx.fillRect(x + i * st, y + (id === 'rifle' ? 0 : 2), id === 'rifle' ? 3 : 2, 2); } }
    return w.cap * st;
  }
  if (id === 'bow') { for (let i = 0; i < w.cap; i++) { const on = i < w.ammo && !w.reloading; ctx.fillStyle = on ? '#8a5a2a' : '#3b4458'; ctx.fillRect(x + i * 4 + 1, y + 1, 1, 7); ctx.fillStyle = on ? '#ddd' : '#3b4458'; ctx.fillRect(x + i * 4, y, 3, 2); } return w.cap * 4; }
  const bw = 56;
  ctx.fillStyle = '#000'; ctx.fillRect(x, y + 1, bw, 6);
  if (id === 'mg') { ctx.fillStyle = '#e8b923'; ctx.fillRect(x + 1, y + 2, (bw - 2) * (w.reloading ? 0 : w.ammo / w.cap), 4); text(w.reloading ? '' : w.ammo, x + bw + 3, y + 1, 1, '#fff', 'left', null); }
  else { const k = w.heat / w.cap; ctx.fillStyle = k > 0.75 ? '#ff3b3b' : k > 0.45 ? '#ff9a3d' : '#7dff7a'; ctx.fillRect(x + 1, y + 2, (bw - 2) * k, 4); if (w.overheated && Math.floor(performance.now() / 200) % 2) text('HOT!', x + bw + 3, y + 1, 1, '#ff5a2a', 'left', null); }
  return bw;
}
function drawHud() {
  ctx.fillStyle = 'rgba(10,20,40,0.78)'; ctx.fillRect(0, 0, W, 28);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 28, W, 1);
  text('SCORE', 4, 3, 1, '#9fc4ff', 'left', null);
  text(fmt(score), 4, 10, 1.5, '#fff');
  const savedBest = infinity ? (Meta.save.bestInfinityByMap[M.id] || 0) : best;
  const mb = Math.max(savedBest, score);
  text((infinity ? 'INF ' : '') + M.name.toUpperCase() + ' BEST', W / 2 + 6, 3, 1, '#9fc4ff', 'center', null);
  text(fmt(mb), W / 2 + 6, 10, 1.5, '#ffe066', 'center');
  const bonusHud = state === 'bonus';
  text(infinity ? 'INF ROUND' : (bonusHud ? 'BONUS' : 'ROUND'), W - 4, 3, 1, infinity || bonusHud ? '#ffd23f' : '#9fc4ff', 'right', null);
  const rlabel = infinity ? String(round) : bonusHud ? String(Math.max(0, Math.ceil(bonusT))) + 'S' : (round + '/' + ECON.CLEAR_ROUND);
  text(rlabel, W - 4, 10, 1.5, bossRound ? '#ff5a5a' : '#fff', 'right');
  text('$' + fmt(Meta.bank()), 4, 20, 1, '#7dff7a');
  if (perfectRun && !infinity && !bonusHud) text('PERFECT', 48, 20, 1, '#ffd23f', 'left', null);
  const mx = W - 4 - maxMiss * 8;
  text('MISS', mx - 3, 20, 1, '#ff9a9a', 'right', null);
  for (let i = 0; i < maxMiss; i++) {
    const x = mx + i * 8, on = i < missRun;
    ctx.fillStyle = '#000'; ctx.fillRect(x, 18.5, 7, 8);
    ctx.fillStyle = on ? '#ff3030' : '#3b4458';
    for (let k = 0; k < 5; k++) { ctx.fillRect(x + 1 + k, 19.5 + k * 1.2, 1, 1.2); ctx.fillRect(x + 5 - k, 19.5 + k * 1.2, 1, 1.2); }
  }
  if (streak >= 2) text('STREAK X' + Math.min(streak, 5), W / 2 + 6, 20, 1, '#ff9a3d', 'center', null);
  const perkTags = [];
  if (Meta.autoBoostActive() && Meta.levelOf('perk.auto') <= 0 && (state === 'play' || state === 'intro' || state === 'clear' || state === 'bonus')) {
    perkTags.push('AUTO ' + fmtBoostClock(Meta.autoBoostLeft()));
  } else if (wpn && wpn.reloading && perkAuto >= 0) perkTags.push('AUTO');
  if (worldSlow() < 1 && (state === 'play' || state === 'intro' || state === 'bonus')) perkTags.push('BULLET TIME');
  if ((Meta.val('perk.second') || 0) > 0 && (state === 'play' || state === 'intro' || state === 'clear' || state === 'bonus')) perkTags.push('SAVES ' + secondLeft);
  if (perkTags.length) {
    const py = (bossT && live(bossT)) ? 50 : 31;
    const label = perkTags.join('  ·  ');
    const boostChip = perkTags[0] && perkTags[0].indexOf('AUTO ') === 0;
    if (boostChip) {
      const tw = label.length * 4 + 8;
      const tx = W / 2 - tw / 2;
      ctx.fillStyle = 'rgba(8,28,12,0.85)';
      ctx.fillRect(tx, py - 1, tw, 9);
      ctx.fillStyle = '#7dff7a';
      ctx.fillRect(tx, py - 1, tw, 1);
      text(label, W / 2, py, 1, '#7dff7a', 'center', null);
    } else {
      text(label, W / 2, py, 1, '#cfe0ff', 'center', null);
    }
  }
  // boss bar
  if (bossT && live(bossT)) {
    const bx = 4, bw = W - 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, 31, bw, 16);
    text(bossT.name, bx + 2, 32, 1, '#ffd23f', 'left', null);
    text('ESCAPES ' + Math.max(0, Math.ceil(bossT.timer)) + 'S', bx + bw - 2, 32, 1, bossT.timer < 4 ? '#ff5a5a' : '#fff', 'right', null);
    ctx.fillStyle = '#300'; ctx.fillRect(bx + 2, 39, bw - 4, 4);
    ctx.fillStyle = bossT.hurt > 0 ? '#fff' : '#ff3b3b'; ctx.fillRect(bx + 2, 39, (bw - 4) * Math.max(0, bossT.hp / bossT.hp0), 4);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(bx + 2, 44, (bw - 4) * Math.max(0, bossT.timer / bossT.timer0), 1.5);
  }
  // bottom bar
  const by = H - BAR;
  ctx.fillStyle = '#1a1208'; ctx.fillRect(0, by, W, BAR);
  ctx.fillStyle = '#000'; ctx.fillRect(0, by, W, 1);
  ctx.fillStyle = '#3a2a14'; ctx.fillRect(0, by + 1, W, 1);
  const lab = wpn.def.ammoName;
  text(lab, 4, by + 4, 1, '#9fc4ff', 'left', null);
  const ax = 8 + lab.length * 4, aw = drawAmmo(ax, by + 3);
  if (wpn.reloading) {
    const p = 1 - wpn.reloadT / wpn.reload;
    ctx.fillStyle = '#000'; ctx.fillRect(ax, by + 13, aw - 2, 2);
    ctx.fillStyle = '#7dff7a'; ctx.fillRect(ax, by + 13, (aw - 2) * p, 2);
  } else if (wpn.id !== 'laser' && wpn.ammo === 0 && Math.floor(performance.now() / 250) % 2 && ax + aw + 22 < W - 60) text('EMPTY', ax + aw + 2, by + 5, 1, '#ff9a3d', 'left', null);
  text('HIT', 4, by + 19, 1, '#9fc4ff', 'left', null);
  const n = roundTotal || 0, maxW = 112 - 18, step = Math.min(9, maxW / Math.max(1, n));
  for (let i = 0; i < n; i++) {
    const img = i < roundHits ? ICON_H : i < roundHits + roundEsc ? ICON_E : ICON_P;
    ctx.drawImage(img, 18 + i * step, by + 19, 8, 5);
  }
  if (focusT > 0) text('SLOW-MO', W / 2, SKY_TOP + 16, 1, '#c9a7ff', 'center');
  if (decoyObj) text('DECOY ' + Math.ceil(decoyObj.t) + 'S', W / 2, SKY_TOP + (bossT ? 16 : 2), 1, '#9fe0ff', 'center');
  const rb = $('btn-reload');
  const empty = wpn.id === 'laser' ? wpn.overheated : wpn.ammo === 0;
  const full = wpn.id === 'laser' ? wpn.heat <= 0.01 : wpn.ammo >= wpn.cap;
  rb.classList.toggle('need', empty && !wpn.reloading);
  rb.classList.toggle('full', full && !wpn.reloading);
  rb.style.setProperty('--p', wpn.reloading ? (1 - wpn.reloadT / wpn.reload).toFixed(3) : 0);
  const lbl = rb.querySelector('.lbl'); if (lbl.textContent !== wpn.def.reloadName) lbl.textContent = wpn.def.reloadName;
  const fb = $('btn-focus');
  $('focus-n').textContent = focusCharges;
  fb.classList.toggle('active', focusT > 0);
  fb.disabled = focusCharges <= 0 && focusT <= 0;
  if (weapons.length > 1) { const o = weapons[1 - wi]; const sw = $('swap-n'); const s = o.def.name.toUpperCase(); if (sw.textContent !== s) sw.textContent = s; }
}

// ---------------- loop ----------------
let last = performance.now();
let frameErrs = 0;
function frame(now) {
  requestAnimationFrame(frame); // schedule first: one bad frame must never freeze the game
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
  try { update(dt); render(); frameErrs = 0; }
  catch (e) { if (++frameErrs === 1 || frameErrs % 300 === 0) { console.error(e); window.PH_ERR && PH_ERR(e); } }
}

// ---------------- Remove Ads (per-device). Simulated purchase today; swap completeRemoveAdsPurchase later for real billing.
function adFreePriceLabel() {
  const cfg = window.ADFREE_CONFIG || {};
  return cfg.priceLabel || '$2.99';
}
function refreshAdFreeUI() {
  const on = !!(Meta.isAdFree && Meta.isAdFree());
  document.querySelectorAll('.adfree-buy').forEach(b => {
    b.classList.toggle('hidden', on);
    b.textContent = 'REMOVE ADS ' + adFreePriceLabel();
  });
  document.querySelectorAll('.adfree-owned').forEach(n => n.classList.toggle('hidden', !on));
  const sheet = $('ov-adfree');
  if (sheet && on) show('ov-adfree', false);
  refreshBoostButtons();
}
function showRemoveAdsConfirm(on) {
  show('ov-adfree', !!on);
}
// Single entry point used by every REMOVE ADS button. Later this can open a real checkout instead of the confirm sheet.
function purchaseRemoveAds() {
  Sfx.init(); Sfx.click();
  if (Meta.isAdFree()) { refreshAdFreeUI(); return; }
  showRemoveAdsConfirm(true);
}
// Called after the player confirms (or, later, after a real payment succeeds).
function completeRemoveAdsPurchase() {
  Sfx.init(); Sfx.click();
  if (!Meta.grantAdFree('simulated')) return false;
  showRemoveAdsConfirm(false);
  refreshAdFreeUI();
  toast('THANKS! ADS REMOVED', 'This purchase stays on this device.', 0);
  Sfx.gold();
  return true;
}
function cancelRemoveAdsPurchase() {
  Sfx.click();
  showRemoveAdsConfirm(false);
}

refreshAdFreeUI();
resize(); resetRun(); syncAudio(); toTitle();

requestAnimationFrame(frame);


['btn-adfree-t', 'btn-adfree-p', 'btn-adfree-o'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('click', purchaseRemoveAds);
});
if ($('btn-adfree-buy')) $('btn-adfree-buy').addEventListener('click', completeRemoveAdsPurchase);
if ($('btn-adfree-cancel')) $('btn-adfree-cancel').addEventListener('click', cancelRemoveAdsPurchase);

// debug/test hooks (used by tools/test_playwright.py)
window.PH = {
  get state() { return state; }, get targets() { return targets; }, get score() { return score; }, get weapon() { return wpn; }, get turrets() { return turrets; },
  turretStats: () => turretStats, resetTurretStats, dropEgg(boss) { dropEgg(boss || bossT || { x: W / 2, y: SKY_TOP + 70 }); },
  holdRound(on) { holdRound = !!on; }, get holdRoundOn() { return holdRound; },
  pickTurretTarget, turretValid, timeToLeave,
  get money() { return Meta.bank(); }, Meta, get missRun() { return missRun; }, get round() { return round; }, get shells() { return wpn ? wpn.ammo : 0; },
  get boss() { return bossT; }, get projs() { return projs; },
  setMoney(m) { Meta.setBank(m); Meta.persist(); }, setScore(n) { score = n; }, setCash(n) { runCash = n; }, toLogical: (x, y) => ({ x: x / W, y: y / H }), dims: () => ({ W, H, GROUND, SKY_TOP, SKY_BOT, BAR, S, U }),
  forceClear() { queue = []; targets = []; }, forceDie() { missRun = maxMiss; die(); }, get fromCkpt() { return fromCkpt; }, get infinity() { return infinity; }, get reviveUsed() { return reviveUsed; },
  setMiss(n) { missRun = n; }, perfectClear() { queue = []; targets = []; roundHits = roundTotal; }, get maxMiss() { return maxMiss; },
  checkpoint: (m, inf) => checkpointFor(m || Meta.save.equip.map, inf != null ? inf : infinity), continueCkpt() { continueCheckpoint(); },
  jumpRound(r) { round = r - 1; targets = []; queue = []; startRound(); },
  skipIntro() { if (state === 'intro') { state = 'play'; introT = 0; } },
  hideBanners() { ckptFlash = 0; banner = ''; banner2 = ''; },
  dropFawn(boss) { dropFawn(boss || bossT); },
  isGroundBoss: (t) => isGroundBoss(t),
  reviveNow() { reviveUsed = true; revive(); },
  forceMapClear() { infinity = false; bossKilled = true; round = ECON.CLEAR_ROUND; bossRound = true; queue = []; targets = []; projs = []; mapJustCleared = false; failedClear = false; perfectRun = false; wantBonus = false; if (state !== 'play') state = 'play'; },
  advanceMapFlow() { if (state === 'bonus') endBonus(); if (state === 'clear') clearT = 0; if (state === 'mapshift') shiftT = 0; },
  startNextMap(id) { const nxt = (id && ECON.MAPS.find(m => m.id === id)) || pendingNext || ECON.nextMap(M.id); if (nxt) startNextMap(nxt); },
  get runCash() { return runCash; }, get runMaps() { return runMaps.slice(); }, get cashSettled() { return cashSettled; }, get pendingNext() { return pendingNext && pendingNext.id; },
  forcePerfectClear() { infinity = false; bossKilled = true; round = ECON.CLEAR_ROUND; bossRound = true; queue = []; targets = []; projs = []; mapJustCleared = false; failedClear = false; perfectRun = true; runRanked = true; reviveUsed = false; fromCkpt = 0; wantBonus = false; if (state !== 'play') state = 'play'; },
  startInfinity() { newGame(0, { infinity: true }); },
  openInfinity() { openInfinityLobby(); },
  goToNextMap() { goToNextMap(); },
  startBonus() { startBonusRound(); },
  get perfectRun() { return perfectRun; }, setPerfect(on) { perfectRun = !!on; },
  get runRanked() { return runRanked; }, get bonusCash() { return bonusCashEarned; }, get deferredRun() { return deferredRun; },
  get lastRun() { return lastRun; },

  newGame(from, opts) { newGame(from || 0, opts); },
  togglePause() { togglePause(); },
  get paused() { return paused; },

  autoBoostLeft: () => Meta.autoBoostLeft(), autoBoostActive: () => Meta.autoBoostActive(),
  grantAutoBoost() { Meta.grantAutoBoost(); perkAuto = autoReloadDelay(); boostWasOn = Meta.autoBoostActive(); boostBtnStamp = ''; refreshBoostButtons(); },
  setAutoBoostMs(ms) { return Meta.setAutoBoostMs(ms); },
  setNow(fnOrMs) { Meta.setNow(fnOrMs); boostBtnStamp = ''; watchAutoBoost(); },
  autoReloadDelay: () => autoReloadDelay(), get perkAuto() { return perkAuto; },

  spawn(k) { spawn(k); }, setAim(x, y) { aim = { x, y }; lightPos = { x, y }; }, hold(on) { holding = on; },
  kindHp: k => ECON.kindHp(k), bossHp: r => ECON.bossHp(r), dmgOf: (id, lv) => ECON.dmgOf(id, lv),
  shotDmg, damage, makeWeapon, makeTurret, hitsNeeded: (hp, d) => ECON.hitsNeeded(hp, d),
  flakDmg: l => ECON.flakDmg(l), dmgLine, fireTap,
  grantAll() { Meta.withMode('campaign', () => { ECON.TRACKS.forEach(t => { Meta.save.lv[t.id] = t.val.length - 1; }); }); Meta.persist(); },
  makeCard: o => makeCard(o || {}).toDataURL('image/png'),
  rebuild() { buildBg(); }, toTitle() { toTitle(); }, showOver(rank) { showOver(rank); }, openShop(tab) { shopTab = tab || shopTab; openShop('title'); }, openInfShop() { shopInf = true; Meta.setMode('infinity'); openShop('infinity'); }, openBoard(m, from, inf) { openBoard(m, from || 'title', inf); },
  get banner() { return banner; }, get banner2() { return banner2; },
  KIND, MAP_ANIMALS, rosterFor, debutFor, newsFor, sigFly, pickFly, pickGround, get news() { return news; },
  animalName: k => (KIND[k] && KIND[k].name) || (k || '').toUpperCase(),

  get browseMap() { return titleBrowseMap || Meta.save.equip.map; },
  hasMap: id => Meta.hasMap(id),
  isAdFree: () => Meta.isAdFree(),
  grantAdFree(src) { const ok = Meta.grantAdFree(src || 'simulated'); refreshAdFreeUI(); return ok; },
  clearAdFree() { Meta.clearAdFree(); refreshAdFreeUI(); },
  purchaseRemoveAds, completeRemoveAdsPurchase, cancelRemoveAdsPurchase, refreshAdFreeUI,
};
})();
