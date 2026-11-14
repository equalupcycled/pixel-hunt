// Pixel Hunt - sharing. No Facebook SDK / app ID needed.
//  1. Web Share API (navigator.share): on phones this opens the native share sheet (Facebook, Messenger, WhatsApp...).
//     When the browser supports sharing files, a 1200x628 score-card PNG is attached.
//  2. Fallback: open the Facebook sharer (https://www.facebook.com/sharer/sharer.php?u=GAME_URL) and copy the score
//     text to the clipboard (Facebook ignores pre-filled text, so the player can paste it).
//  Native (Capacitor) later: swap in @capacitor/share -> Share.share({ title, text, url, files }) (detected below).
'use strict';
window.SHARE_CONFIG = {
  // >>> Set this to the public game URL once Pixel Hunt is hosted (also update og:url / og:image in index.html). <<<
  GAME_URL: 'https://pixel-hunt-o4vw.onrender.com/',
  FALLBACK_URL: 'https://pixelhunt.example.com/', // used only when GAME_URL is empty and the page isn't on http(s)
};
window.Share = (() => {
  const cfg = window.SHARE_CONFIG;
  function gameUrl() {
    if (cfg.GAME_URL) return cfg.GAME_URL;
    if (/^https?:/.test(location.protocol)) return location.origin + location.pathname.replace(/index\.html$/, '');
    return cfg.FALLBACK_URL;
  }
  const facebookUrl = url => 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
  const toBlob = c => new Promise(res => { try { c.toBlob(b => res(b), 'image/png'); } catch (e) { res(null); } });
  async function share({ title = 'Pixel Hunt', text = '', canvas = null } = {}) {
    const url = gameUrl();
    const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
    try {
      if (cap) { await cap.share({ title, text, url, dialogTitle: 'Share your score' }); return 'shared'; }
      if (navigator.share) {
        const data = { title, text, url };
        if (canvas && navigator.canShare) {
          const blob = await toBlob(canvas);
          if (blob) { const file = new File([blob], 'pixel-hunt-score.png', { type: 'image/png' }); if (navigator.canShare({ files: [file] })) data.files = [file]; }
        }
        await navigator.share(data); return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // fall through to Facebook on other errors (e.g. files not allowed)
    }
    try { if (navigator.clipboard) await navigator.clipboard.writeText(text + ' ' + url); } catch (e) {}
    window.open(facebookUrl(url), '_blank', 'noopener,width=640,height=560');
    return 'facebook';
  }
  return { share, gameUrl, facebookUrl, config: cfg };
})();
