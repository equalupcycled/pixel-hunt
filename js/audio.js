// Pixel Hunt - all sounds synthesized in code with WebAudio (no audio files).
'use strict';
window.Sfx = (() => {
  let ac = null, master = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('pixelhunt.muted') === '1'; } catch (e) {}

  // Never let audio break input: any WebAudio failure (old iOS, in-app browsers, too many
  // contexts, autoplay policy) just leaves the game silent.
  function unlock() { // iOS only unlocks audio after a sound starts inside a touchend/click
    try { const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) {}
  }
  function init() {
    try {
      if (ac) { if (ac.state !== 'running') { const r = ac.resume && ac.resume(); if (r && r.catch) r.catch(() => {}); unlock(); } return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.45;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      unlock();
      const r = ac.resume && ac.resume(); if (r && r.catch) r.catch(() => {});
    } catch (e) { ac = null; master = null; noiseBuf = null; }
  }
  ['touchend', 'pointerup', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, init, { capture: true, passive: true }));
  const ok = () => ac && !muted;

  function tone(type, f0, f1, dur, vol = 0.25, delay = 0) {
    if (!ok()) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, f0, f1, delay = 0, type = 'lowpass') {
    if (!ok()) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const notes = (seq, type = 'square', vol = 0.15) =>
    seq.forEach(([f, d, at]) => tone(type, f, f, d, vol, at));

  const api = {
    init,
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      try { localStorage.setItem('pixelhunt.muted', m ? '1' : '0'); } catch (e) {}
      if (master) master.gain.value = m ? 0 : 0.45;
    },
    shot() { noise(0.45, 1.0, 4000, 150); tone('square', 140, 35, 0.18, 0.35); noise(0.08, 0.6, 9000, 3000, 0, 'highpass'); },
    empty() { tone('square', 1800, 1700, 0.03, 0.12); tone('square', 900, 850, 0.03, 0.1, 0.04); },
    reloadStart() { noise(0.05, 0.4, 3000, 1500); tone('square', 300, 200, 0.05, 0.12, 0.02); },
    reloadDone() { noise(0.06, 0.5, 2500, 800); tone('square', 220, 120, 0.07, 0.18); noise(0.07, 0.5, 2000, 700, 0.09); tone('square', 180, 90, 0.08, 0.18, 0.09); },
    hit() { tone('square', 600, 1200, 0.08, 0.15); },
    squawk() { tone('sawtooth', 900, 300, 0.22, 0.12, 0.03); tone('square', 700, 250, 0.2, 0.06, 0.05); },
    fall() { tone('triangle', 900, 120, 0.7, 0.12, 0.05); },
    thud() { noise(0.12, 0.5, 400, 60); },
    gold() { notes([[1047, .08, 0], [1319, .08, .07], [1568, .08, .14], [2093, .16, .21]], 'square', 0.12); },
    deer() { tone('sawtooth', 220, 110, 0.35, 0.12, 0.03); noise(0.2, 0.3, 600, 100, 0.05); },
    bad() { tone('square', 300, 150, 0.2, 0.15); tone('square', 200, 100, 0.25, 0.15, 0.15); },
    escape() { tone('triangle', 700, 200, 0.5, 0.18); tone('square', 350, 120, 0.5, 0.05, 0.05); },
    streak(n) { tone('square', 500 + n * 90, 700 + n * 120, 0.1, 0.1, 0.06); },
    roundStart() { notes([[523, .1, 0], [659, .1, .1], [784, .1, .2], [1047, .2, .3]]); },
    clear() { notes([[784, .1, 0], [659, .1, .1], [784, .1, .2], [1047, .1, .3], [1319, .3, .4]]); },
    gameOver() { notes([[392, .2, 0], [330, .2, .22], [262, .2, .44], [196, .5, .66]], 'square', 0.16); },
    buy() { notes([[988, .06, 0], [1319, .14, .06]], 'square', 0.12); },
    focus() { tone('sine', 300, 80, 0.6, 0.25); },
    pistol() { noise(0.18, 0.7, 6000, 400); tone('square', 320, 90, 0.08, 0.22); },
    rifle() { noise(0.6, 1.0, 5000, 90); tone('square', 110, 30, 0.3, 0.4); noise(0.1, 0.5, 9000, 4000, 0, 'highpass'); },
    bolt() { noise(0.05, 0.5, 3500, 1200); tone('square', 260, 180, 0.04, 0.14); noise(0.06, 0.5, 2500, 900, 0.18); tone('square', 200, 140, 0.05, 0.15, 0.2); },
    bowDraw() { tone('sawtooth', 120, 220, 0.35, 0.05); },
    bowShot() { noise(0.18, 0.5, 2500, 600, 0, 'bandpass'); tone('triangle', 420, 160, 0.12, 0.15); },
    arrowHit() { noise(0.05, 0.4, 1500, 500); tone('square', 500, 900, 0.05, 0.1); },
    mg() { noise(0.07, 0.6, 5000, 500); tone('square', 180, 70, 0.04, 0.16); },
    laser() { tone('sawtooth', 1400 + Math.random() * 200, 1200, 0.07, 0.05); tone('sine', 2200, 2000, 0.07, 0.04); },
    overheat() { tone('sawtooth', 800, 100, 0.5, 0.15); noise(0.5, 0.4, 6000, 2000, 0, 'highpass'); },
    vent() { noise(0.6, 0.5, 8000, 1500, 0, 'highpass'); },
    zap() { tone('sawtooth', 2000, 300, 0.18, 0.12); noise(0.15, 0.5, 9000, 3000, 0, 'highpass'); },
    pellet() { noise(0.06, 0.35, 5000, 800); tone('square', 420, 200, 0.04, 0.08); },
    missile() { noise(0.4, 0.4, 1500, 400, 0, 'bandpass'); tone('sawtooth', 200, 600, 0.3, 0.06); },
    boom() { noise(0.7, 1.0, 1800, 50); tone('square', 90, 25, 0.4, 0.35); },
    lure() { notes([[880, .08, 0], [660, .12, .1], [880, .08, .3], [660, .16, .4]], 'triangle', 0.14); },
    swap() { noise(0.05, 0.4, 3000, 900); tone('square', 400, 300, 0.05, 0.1, 0.05); },
    boss() { notes([[196, .18, 0], [185, .18, .2], [175, .18, .4], [165, .5, .6]], 'sawtooth', 0.14); noise(0.8, 0.5, 400, 60, 0.6); },
    bossHit() { tone('square', 300, 150, 0.08, 0.16); noise(0.08, 0.4, 2000, 400); },
    bossDown() { notes([[523, .12, 0], [659, .12, .12], [784, .12, .24], [1047, .12, .36], [1319, .12, .48], [1568, .4, .6]], 'square', 0.14); noise(0.8, 0.8, 1500, 60); },
    letter() { tone('square', 880, 880, 0.03, 0.08); },
    click() { tone('square', 660, 660, 0.03, 0.08); },
  };
  // wrap every sound so an audio exception can never abort a tap handler
  Object.keys(api).forEach(k => {
    const d = Object.getOwnPropertyDescriptor(api, k);
    if (typeof d.value === 'function') { const f = d.value; api[k] = function () { try { return f.apply(api, arguments); } catch (e) {} }; }
  });
  return api;
})();
