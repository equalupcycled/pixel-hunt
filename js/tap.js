// Pixel Hunt - reliable touch taps for HTML buttons on iOS Safari / Android Chrome / in-app browsers.
// Phones synthesize 'click' from a touch only after their own gesture heuristics (double-tap zoom,
// hover emulation, touch-action, scroll detection), and some WebViews drop it. Here a touch/pen tap on a
// <button> (or [data-tap] element) fires its click immediately on pointerup (touchend as fallback), and the browser's own
// late click for that same tap is swallowed, so every handler runs exactly once.
// Buttons that already act on pointerdown (data-press) are left alone.
// Also shows any uncaught error on screen so a real-phone problem can be read off the device.
'use strict';
(() => {
  const SLOP = 14, SWALLOW_MS = 700;
  let down = null, synth = false, lastFast = { btn: null, t: 0 };
  const SEL = 'button, [data-tap]';
  const tgt = el => (el && el.closest ? el.closest(SEL) : null);
  const btnAt = (x, y) => tgt(document.elementFromPoint(x, y));
  const eligible = b => b && !b.disabled && !b.dataset.press && !b.closest('.hidden');
  function fire(b) {
    lastFast = { btn: b, t: performance.now() };
    synth = true; try { b.click(); } finally { synth = false; }
  }
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') { down = null; return; }
    const b = tgt(e.target);
    down = eligible(b) ? { id: e.pointerId, b, x: e.clientX, y: e.clientY } : null;
  }, { capture: true, passive: true });
  document.addEventListener('pointercancel', () => { down = null; }, { capture: true, passive: true }); // became a scroll
  document.addEventListener('pointerup', e => {
    const d = down; down = null;
    if (!d || e.pointerId !== d.id) return;
    if (Math.abs(e.clientX - d.x) > SLOP || Math.abs(e.clientY - d.y) > SLOP) return;
    const b = btnAt(e.clientX, e.clientY);
    if (b === d.b && eligible(b)) fire(b);
  }, { capture: true });
  // Fallback for browsers without pointer events on touch (very old WebViews).
  if (!window.PointerEvent) {
    let td = null;
    document.addEventListener('touchstart', e => { const t = e.changedTouches[0], b = tgt(e.target); td = eligible(b) ? { b, x: t.clientX, y: t.clientY } : null; }, { capture: true, passive: true });
    document.addEventListener('touchend', e => { const t = e.changedTouches[0], d = td; td = null; if (!d) return;
      if (Math.abs(t.clientX - d.x) > SLOP || Math.abs(t.clientY - d.y) > SLOP) return;
      if (btnAt(t.clientX, t.clientY) === d.b && eligible(d.b)) fire(d.b); }, { capture: true, passive: true });
  }
  // Swallow the browser's own (late) click for a tap we already handled.
  document.addEventListener('click', e => {
    if (synth) return;
    // Any native click right after a fast tap is that tap's echo - possibly landing on whatever
    // was under the finger once the tapped overlay closed (ghost click) - so drop it.
    if (lastFast.btn && performance.now() - lastFast.t < SWALLOW_MS) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  // No long-press menu / text selection popping over the game.
  document.addEventListener('contextmenu', e => { if (!(e.target && e.target.tagName === 'INPUT')) e.preventDefault(); });

  // ---- on-screen error report (tap to dismiss) ----
  let box = null;
  window.PH_ERR = err => {
    try {
      const msg = String((err && (err.message || err.reason && err.reason.message || err.reason)) || err).slice(0, 160);
      if (!box) { box = document.createElement('div'); box.id = 'err-box'; box.addEventListener('pointerdown', () => box.remove()); }
      box.textContent = 'ERROR: ' + msg + ' (tap to hide)';
      if (!box.isConnected) document.body.appendChild(box);
    } catch (e) {}
  };
  window.addEventListener('error', e => window.PH_ERR(e.error || e.message));
  window.addEventListener('unhandledrejection', e => window.PH_ERR(e.reason || 'promise rejected'));
})();
