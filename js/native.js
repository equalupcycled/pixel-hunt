// Pixel Hunt native shell helpers (Capacitor Android test APK). Safe no-op in the browser.
'use strict';

// Open a URL in the system browser when running in the Capacitor shell. Falls back to a new tab in the browser.
window.PH_openUrl = function PH_openUrl(url) {
  if (!url) return false;
  try {
    const cap = window.Capacitor;
    const native = !!(cap && ((cap.isNativePlatform && cap.isNativePlatform()) || cap.Plugins));
    if (native && cap.Plugins) {
      const Browser = cap.Plugins.Browser;
      if (Browser && typeof Browser.open === 'function') {
        Browser.open({ url: url });
        return true;
      }
      const App = cap.Plugins.App;
      if (App && typeof App.openUrl === 'function') {
        App.openUrl({ url: url });
        return true;
      }
    }
  } catch (e) { /* fall through */ }
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) window.location.href = url;
  return true;
};

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
  if (vis('ov-adfree')) return tap('btn-adfree-cancel');
  if (vis('ov-daily')) return tap('btn-daily-close');
  if (vis('ov-missions')) return tap('btn-missions-close');
  if (vis('ov-board')) return tap('btn-board-close');
  if (vis('ov-shop')) return tap('btn-next');
  if (vis('ov-name')) return true; // don't drop a high-score name
  if (vis('ov-continue')) return tap('btn-norevive');
  if (vis('ov-pause')) return tap('btn-resume'); // BACK closes the pause menu; quitting a run stays an explicit button
  if (vis('ov-over')) return tap('btn-over-close') || tap('btn-menu');
  if (vis('ov-infinity')) return tap('btn-inf-close');
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
  let hooked = false; // boot runs on DOMContentLoaded AND load: register once, or one BACK press fires twice (pause, then quit)
  const boot = () => {
    if (hooked) return;
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App || !App.addListener) return;
    hooked = true;
    App.addListener('backButton', () => { window.PH_handleBack(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', boot);
})();
