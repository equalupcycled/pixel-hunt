// Pixel Hunt native shell helpers (Capacitor Android test APK). Safe no-op in the browser.
'use strict';
window.PH_handleBack = function PH_handleBack() {
  const vis = id => { const e = document.getElementById(id); return !!(e && !e.classList.contains('hidden')); };
  const tap = id => { const e = document.getElementById(id); if (e) { e.click(); return true; } return false; };
  const page = (location.pathname || '').split('/').pop() || '';
  if (page && page !== 'index.html' && !page.endsWith('/')) {
    if (history.length > 1) { history.back(); return true; }
  }
  if (vis('ov-ad')) {
    const btn = document.querySelector('#ov-ad .ad-close');
    if (btn && !btn.disabled) { btn.click(); return true; }
    return true; // don't leave mid-ad
  }
  if (vis('shop-detail')) return tap('btn-shop-detail-close');
  if (vis('ov-how')) return tap('btn-how-close');
  if (vis('ov-about')) return tap('btn-about-close');
  if (vis('ov-daily')) return tap('btn-daily-close');
  if (vis('ov-missions')) return tap('btn-missions-close');
  if (vis('ov-board')) return tap('btn-board-close');
  if (vis('ov-shop')) return tap('btn-next');
  if (vis('ov-name')) return true; // don't drop a high-score name
  if (vis('ov-continue')) return tap('btn-norevive');
  if (vis('ov-pause')) return tap('btn-quit');
  if (vis('ov-over')) return tap('btn-menu');
  if (vis('ov-title')) {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.exitApp) App.exitApp();
    return true;
  }
  if (window.PH && !window.PH.paused && (PH.state === 'play' || PH.state === 'intro' || PH.state === 'clear')) {
    PH.togglePause();
    return true;
  }
  return false;
};

(function hookNativeBack() {
  const boot = () => {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App || !App.addListener) return;
    App.addListener('backButton', () => { window.PH_handleBack(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', boot);
})();
