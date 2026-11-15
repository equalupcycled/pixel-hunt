// Pixel Hunt - all sounds and music synthesized with the Web Audio API (no audio files, no licenses).
'use strict';
window.Sfx = (() => {
  let ac = null, sfxGain = null, musicGain = null, noiseBuf = null;
  let sfxOn = true, musicOn = true;
  try { sfxOn = localStorage.getItem('pixelhunt.muted') !== '1'; } catch (e) {}
  try { const v = localStorage.getItem('pixelhunt.music'); if (v === '0' || v === 'off') musicOn = false; if (v === '1' || v === 'on') musicOn = true; } catch (e) {}

  let musicMode = 'menu', musicTimer = null, musicUntil = 0, musicNodes = [];

  function unlock() {
    try { const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) {}
  }
  function init() {
    try {
      if (ac) { if (ac.state !== 'running') { const r = ac.resume && ac.resume(); if (r && r.catch) r.catch(() => {}); unlock(); } pumpMusic(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      sfxGain = ac.createGain();
      musicGain = ac.createGain();
      sfxGain.gain.value = sfxOn ? 0.42 : 0;
      musicGain.gain.value = musicOn ? 0.07 : 0;
      sfxGain.connect(ac.destination);
      musicGain.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      unlock();
      const r = ac.resume && ac.resume(); if (r && r.catch) r.catch(() => {});
      pumpMusic();
    } catch (e) { ac = null; sfxGain = null; musicGain = null; noiseBuf = null; }
  }
  ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, init, { capture: true, passive: true }));

  const sfxOk = () => ac && sfxOn && sfxGain;
  const saveSfx = () => { try { localStorage.setItem('pixelhunt.muted', sfxOn ? '0' : '1'); } catch (e) {} };
  const saveMusic = () => { try { localStorage.setItem('pixelhunt.music', musicOn ? '1' : '0'); } catch (e) {} };

  function tone(type, f0, f1, dur, vol = 0.2, delay = 0, dest) {
    if (!ac) return;
    const bus = dest || sfxGain;
    if (!bus || (bus === sfxGain && !sfxOn)) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  }
  function noise(dur, vol, f0, f1, delay = 0, type = 'lowpass') {
    if (!sfxOk()) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(Math.max(20, f0), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxGain);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const notes = (seq, type = 'square', vol = 0.12) =>
    seq.forEach(([f, d, at]) => tone(type, f, f, d, vol, at));

  // --- looping chiptune: short, quiet, separate menu / game patterns ---
  const MENU_LOOP = 3.2;
  const GAME_LOOP = 2.4;
  const MENU_SONG = [
    [523, 0.11, 0.00], [659, 0.11, 0.20], [784, 0.14, 0.40], [659, 0.11, 0.60],
    [587, 0.11, 0.80], [698, 0.11, 1.00], [880, 0.14, 1.20], [698, 0.11, 1.40],
    [523, 0.11, 1.60], [659, 0.11, 1.80], [784, 0.11, 2.00], [1047, 0.22, 2.20],
    [784, 0.14, 2.50], [659, 0.18, 2.80],
  ];
  const GAME_BASS = [
    [146, 0.18, 0.00], [146, 0.12, 0.30], [196, 0.18, 0.60], [174, 0.18, 0.90],
    [146, 0.18, 1.20], [130, 0.18, 1.50], [196, 0.18, 1.80], [220, 0.22, 2.10],
  ];
  const GAME_LEAD = [
    [294, 0.08, 0.15], [330, 0.08, 0.45], [392, 0.10, 0.75], [330, 0.08, 1.05],
    [294, 0.08, 1.35], [246, 0.10, 1.65], [392, 0.10, 1.95],
  ];
  function stopMusicNodes() {
    musicNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    musicNodes = [];
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  }
  function scheduleSong(seq, type, vol, when) {
    seq.forEach(([f, d, at]) => {
      const o = tone(type, f, f, d, vol, Math.max(0, when + at - ac.currentTime), musicGain);
      if (o) musicNodes.push(o);
    });
  }
  function pumpMusic() {
    try {
      if (!ac || !musicOn || !musicGain) { stopMusicNodes(); return; }
      if (ac.state !== 'running') return;
      const now = ac.currentTime;
      if (musicUntil > now + 0.12) {
        if (!musicTimer) musicTimer = setTimeout(() => { musicTimer = null; pumpMusic(); }, Math.max(80, (musicUntil - now - 0.08) * 1000));
        return;
      }
      const start = Math.max(now, musicUntil);
      if (musicMode === 'game') {
        scheduleSong(GAME_BASS, 'triangle', 0.55, start);
        scheduleSong(GAME_LEAD, 'square', 0.28, start);
        musicUntil = start + GAME_LOOP;
      } else {
        scheduleSong(MENU_SONG, 'square', 0.42, start);
        musicUntil = start + MENU_LOOP;
      }
      if (musicTimer) clearTimeout(musicTimer);
      musicTimer = setTimeout(() => { musicTimer = null; pumpMusic(); }, Math.max(80, (musicUntil - ac.currentTime - 0.08) * 1000));
    } catch (e) { stopMusicNodes(); }
  }
  function setMusicMode(mode) {
    const next = mode === 'game' ? 'game' : 'menu';
    if (musicMode !== next) { musicMode = next; musicUntil = 0; stopMusicNodes(); }
    pumpMusic();
  }

  function cryBird(hi) {
    const f = hi || 800;
    tone('sawtooth', f, f * 0.35, 0.16, 0.09);
    tone('square', f * 0.8, f * 0.28, 0.14, 0.05, 0.03);
  }

  const api = {
    init,
    get muted() { return !sfxOn; },
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
    setMuted(m) { // backward compatible: this is the Sound (SFX) mute
      sfxOn = !m;
      saveSfx();
      if (sfxGain) sfxGain.gain.value = sfxOn ? 0.42 : 0;
    },
    setSfxOn(on) { api.setMuted(!on); },
    setMusicOn(on) {
      musicOn = !!on;
      saveMusic();
      if (musicGain) musicGain.gain.value = musicOn ? 0.07 : 0;
      if (musicOn) { musicUntil = 0; pumpMusic(); } else stopMusicNodes();
    },
    setMusic(mode) { setMusicMode(mode); },

    // --- weapons ---
    shot() { noise(0.28, 0.7, 3500, 180); tone('square', 150, 40, 0.12, 0.22); noise(0.06, 0.4, 8000, 2500, 0, 'highpass'); },
    pistol() { noise(0.10, 0.5, 6500, 500); tone('square', 380, 110, 0.05, 0.16); noise(0.04, 0.25, 9000, 4000, 0, 'highpass'); },
    rifle() { noise(0.32, 0.7, 4500, 80); tone('square', 120, 32, 0.16, 0.28); noise(0.07, 0.35, 9000, 3500, 0, 'highpass'); },
    bowDraw() { tone('sawtooth', 110, 240, 0.28, 0.04); },
    bowShot() { noise(0.12, 0.32, 2400, 500, 0, 'bandpass'); tone('triangle', 520, 180, 0.10, 0.12); tone('square', 880, 400, 0.06, 0.04); },
    arrowHit() { noise(0.04, 0.28, 1600, 500); tone('square', 520, 900, 0.04, 0.08); },
    mg() { noise(0.05, 0.42, 5200, 600); tone('square', 200, 80, 0.03, 0.12); },
    laser() { tone('sawtooth', 1500 + Math.random() * 180, 1100, 0.05, 0.04); tone('sine', 2400, 1800, 0.05, 0.03); },
    overheat() { tone('sawtooth', 700, 120, 0.35, 0.10); noise(0.35, 0.25, 5000, 1600, 0, 'highpass'); },
    vent() { noise(0.4, 0.32, 7000, 1200, 0, 'highpass'); },
    pellet() { noise(0.05, 0.28, 4800, 800); tone('square', 400, 180, 0.03, 0.07); },
    zap() { tone('sawtooth', 1800, 280, 0.12, 0.09); noise(0.10, 0.28, 8000, 2500, 0, 'highpass'); },
    missile() { noise(0.28, 0.28, 1400, 350, 0, 'bandpass'); tone('sawtooth', 180, 520, 0.2, 0.05); },
    boom() { noise(0.45, 0.7, 1600, 50); tone('square', 80, 28, 0.28, 0.22); },

    // --- reload / empty ---
    empty() { tone('square', 1900, 1700, 0.03, 0.10); tone('square', 950, 850, 0.03, 0.08, 0.035); },
    shellInsert() { noise(0.04, 0.28, 2800, 900); tone('square', 280, 200, 0.04, 0.10, 0.02); },
    pump() { noise(0.05, 0.35, 2200, 700); tone('square', 200, 110, 0.06, 0.14); noise(0.05, 0.3, 1800, 500, 0.08); tone('square', 160, 90, 0.07, 0.12, 0.08); },
    magOut() { noise(0.04, 0.28, 2400, 800); tone('square', 320, 240, 0.04, 0.09); },
    magIn() { tone('square', 240, 180, 0.05, 0.11); noise(0.05, 0.3, 2000, 600, 0.04); tone('square', 200, 140, 0.05, 0.10, 0.06); },
    nock() { noise(0.05, 0.2, 1800, 700, 0, 'bandpass'); tone('triangle', 360, 280, 0.07, 0.08); },
    nockDone() { tone('triangle', 280, 220, 0.06, 0.08); noise(0.04, 0.18, 1400, 500, 0, 'bandpass'); },
    reloadStart() { api.magOut(); },
    reloadDone() { api.magIn(); },
    bolt() { noise(0.04, 0.32, 3200, 1000); tone('square', 250, 170, 0.04, 0.11); noise(0.05, 0.32, 2200, 800, 0.14); tone('square', 190, 130, 0.05, 0.11, 0.16); },

    // --- hits / animals ---
    hit() { tone('square', 620, 1100, 0.06, 0.10); },
    hitSoft() { tone('triangle', 480, 220, 0.04, 0.07); noise(0.05, 0.06, 900, 200, 0.04); },
    squawk() { cryBird(880); },
    cry(kind) {
      const k = kind || 'bird';
      if (k === 'deer') {
        // "buah" bleat / grunt
        tone('sawtooth', 280, 160, 0.10, 0.11);
        tone('sawtooth', 190, 120, 0.16, 0.10, 0.08);
        tone('triangle', 140, 100, 0.18, 0.06, 0.10);
        noise(0.12, 0.12, 500, 90, 0.08);
      } else if (k === 'wolf') {
        tone('sawtooth', 420, 260, 0.18, 0.09);
        tone('triangle', 300, 180, 0.22, 0.07, 0.06);
      } else if (k === 'coyote') {
        tone('square', 640, 480, 0.07, 0.08);
        tone('square', 720, 500, 0.08, 0.07, 0.08);
        tone('sawtooth', 500, 300, 0.10, 0.05, 0.14);
      } else if (k === 'rabbit') {
        tone('square', 1400, 900, 0.06, 0.07);
        tone('triangle', 1100, 700, 0.07, 0.05, 0.04);
      } else if (k === 'goose' || k === 'swimgoose') {
        tone('sawtooth', 360, 240, 0.08, 0.10);
        tone('sawtooth', 300, 200, 0.10, 0.09, 0.07);
        tone('square', 220, 160, 0.10, 0.05, 0.09);
      } else if (k === 'owl') {
        tone('sine', 420, 380, 0.10, 0.08);
        tone('sine', 280, 260, 0.16, 0.09, 0.14);
      } else if (k === 'vulture') {
        tone('sawtooth', 500, 180, 0.20, 0.08);
        noise(0.14, 0.12, 2000, 400, 0.04, 'bandpass');
      } else if (k === 'roadrunner') {
        tone('square', 980, 980, 0.04, 0.07);
        tone('square', 1240, 1240, 0.04, 0.07, 0.06);
        tone('square', 880, 880, 0.05, 0.06, 0.12);
      } else if (k === 'bat') {
        tone('square', 2400, 1800, 0.05, 0.06);
        tone('sine', 2800, 2000, 0.06, 0.04, 0.03);
      } else if (k === 'eyes') {
        tone('sine', 760, 200, 0.22, 0.07);
        tone('triangle', 500, 140, 0.2, 0.04, 0.04);
      } else if (k === 'gold') {
        cryBird(1100);
      } else if (k === 'blue') {
        cryBird(980);
      } else if (k === 'decoy') {
        api.bad();
      } else if (k === 'boss') {
        api.bossRoar();
      } else {
        cryBird(k === 'bird' ? 860 : 800);
      }
    },
    deer() { api.cry('deer'); },
    rustle() { noise(0.12, 0.18, 900, 200); },
    fall() { tone('triangle', 800, 140, 0.45, 0.08, 0.04); },
    thud() { noise(0.10, 0.35, 350, 60); },
    gold() { notes([[1047, .07, 0], [1319, .07, .06], [1568, .07, .12], [2093, .12, .18]], 'square', 0.09); },
    bad() { tone('square', 280, 140, 0.14, 0.11); tone('square', 180, 90, 0.18, 0.11, 0.12); },
    escape() { tone('triangle', 640, 200, 0.32, 0.12); tone('square', 320, 120, 0.32, 0.04, 0.04); },
    streak(n) { tone('square', 500 + n * 80, 680 + n * 100, 0.08, 0.08, 0.04); },
    roundStart() { notes([[523, .08, 0], [659, .08, .08], [784, .08, .16], [1047, .14, .24]], 'square', 0.10); },
    clear() { notes([[784, .08, 0], [659, .08, .08], [784, .08, .16], [1047, .08, .24], [1319, .2, .32]], 'square', 0.10); },
    gameOver() { notes([[392, .16, 0], [330, .16, .18], [262, .16, .36], [196, .36, .54]], 'square', 0.12); },
    buy() { notes([[988, .06, 0], [1319, .10, .05], [1568, .16, .12]], 'square', 0.12); },
    focus() { tone('sine', 280, 80, 0.45, 0.16); },
    lure() { notes([[880, .07, 0], [660, .10, .09], [880, .07, .26], [660, .12, .35]], 'triangle', 0.10); },
    swap() { noise(0.04, 0.25, 2800, 800); tone('square', 380, 280, 0.04, 0.08, 0.04); },
    boss() { notes([[196, .14, 0], [185, .14, .16], [175, .14, .32], [165, .36, .48]], 'sawtooth', 0.11); noise(0.5, 0.28, 350, 60, 0.45); },
    bossHit() { tone('square', 280, 140, 0.07, 0.12); noise(0.07, 0.28, 1800, 350); },
    bossRoar() {
      tone('sawtooth', 180, 90, 0.35, 0.16);
      tone('square', 140, 70, 0.4, 0.10, 0.04);
      noise(0.4, 0.35, 500, 50, 0.05);
      tone('sawtooth', 220, 80, 0.28, 0.08, 0.18);
    },
    bossDown() { notes([[523, .09, 0], [659, .09, .1], [784, .09, .2], [1047, .09, .3], [1319, .09, .4], [1568, .28, .5]], 'square', 0.11); noise(0.5, 0.45, 1200, 50); },
    letter() { tone('square', 880, 880, 0.03, 0.06); },
    click() { tone('square', 700, 700, 0.025, 0.07); },
    eggCrack() { noise(0.08, 0.32, 2600, 400); tone('square', 720, 260, 0.07, 0.10); tone('triangle', 420, 180, 0.06, 0.06, 0.02); },
    hatch() { noise(0.10, 0.26, 2000, 450); tone('square', 880, 1240, 0.07, 0.08, 0.03); tone('triangle', 1480, 900, 0.09, 0.07, 0.07); },
  };
  Object.keys(api).forEach(k => {
    const d = Object.getOwnPropertyDescriptor(api, k);
    if (typeof d.value === 'function') { const f = d.value; api[k] = function () { try { return f.apply(api, arguments); } catch (e) {} }; }
  });
  return api;
})();
