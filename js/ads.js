// Pixel Hunt - ad abstraction.
// Web: shows placeholder ads (interstitial with 5s countdown, rewarded "continue").
// Native (Capacitor + @capacitor-community/admob): uses real AdMob ads automatically.
// >>> Put your real AdMob IDs in AD_CONFIG below (see README "Ads / AdMob"). <<<
'use strict';
window.AD_CONFIG = {
  // true = Google's official TEST ad units. Set false only with your real IDs, for release builds.
  testing: true,
  interstitialSeconds: 5,      // web placeholder countdown before "close" appears
  rewardedSeconds: 5,          // web placeholder rewarded length
  admob: {
    // App IDs go in native config (AndroidManifest.xml / Info.plist), not here. See README.
    android: {
      interstitial: 'ca-app-pub-3940256099942544/1033173712', // TEST - replace
      rewarded:     'ca-app-pub-3940256099942544/5224354917', // TEST - replace
    },
    ios: {
      interstitial: 'ca-app-pub-3940256099942544/4411468910', // TEST - replace
      rewarded:     'ca-app-pub-3940256099942544/1712485313', // TEST - replace
    },
  },
};

window.Ads = (() => {
  const cfg = window.AD_CONFIG;
  const cap = window.Capacitor;
  const AdMob = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.AdMob;
  const platform = cap && cap.getPlatform ? cap.getPlatform() : 'web';
  const ids = () => cfg.admob[platform === 'ios' ? 'ios' : 'android'];
  let ready = false;

  async function init() {
    if (!AdMob || ready) return;
    try {
      await AdMob.initialize({ initializeForTesting: cfg.testing });
      ready = true;
    } catch (e) { console.warn('AdMob init failed', e); }
  }

  // ---------- native (AdMob) ----------
  async function nativeInterstitial() {
    try {
      await init();
      await AdMob.prepareInterstitial({ adId: ids().interstitial, isTesting: cfg.testing });
      await AdMob.showInterstitial();
    } catch (e) { console.warn('interstitial failed', e); }
  }
  async function nativeRewarded() {
    try {
      await init();
      await AdMob.prepareRewardVideoAd({ adId: ids().rewarded, isTesting: cfg.testing });
      const reward = await AdMob.showRewardVideoAd();
      return !!reward; // plugin resolves with the reward item when the user earned it
    } catch (e) { console.warn('rewarded failed', e); return false; }
  }

  // ---------- web placeholder ----------
  const layer = () => document.getElementById('ov-ad');
  function artCanvas() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.className = 'ad-art';
    const g = c.getContext('2d');
    const px = ['....KKKK........', '...KYYYYK.......', '..KYYKYYYK......', '..KYYYYYYKOO....', '...KYYYYK.......',
      '..KKYYYYYKK.....', '.KYYYYYYYYYK....', 'KYYWWWYYYYYK....', 'KYYWWWWYYYK.....', '.KYYWWYYYK......',
      '..KKYYYKK.......', '....KKK.........'];
    const pal = { K: '#000', Y: '#ffd23f', W: '#fff6c0', O: '#ff8a00' };
    px.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y + 2, 1, 1); } }));
    return c;
  }
  function webAd({ seconds, rewarded }) {
    return new Promise(resolve => {
      const el = layer();
      el.innerHTML = '';
      const box = document.createElement('div'); box.className = 'ad-box';
      box.innerHTML = `<div class="ad-label">AD</div>
        <button class="pbtn ad-close" disabled>${rewarded ? 'REWARD IN ' : 'SKIP IN '}${seconds}</button>
        <div class="ad-title">${rewarded ? 'REWARDED AD' : 'ADVERTISEMENT'}</div>
        <div class="ad-body">${rewarded ? 'Watch to the end to keep your run going!' : 'Your ad could be here.<br>(Placeholder &mdash; real AdMob ads show in the mobile app.)'}</div>
        <div class="ad-bar"><i></i></div>`;
      box.insertBefore(artCanvas(), box.querySelector('.ad-title'));
      el.appendChild(box);
      el.classList.remove('hidden');
      const btn = box.querySelector('.ad-close'), bar = box.querySelector('.ad-bar i');
      const t0 = performance.now(); let done = false, earned = false;
      const finish = () => { if (done) return; done = true; clearInterval(iv); el.classList.add('hidden'); el.innerHTML = ''; resolve(rewarded ? earned : true); };
      const iv = setInterval(() => {
        const el2 = (performance.now() - t0) / 1000, left = Math.max(0, Math.ceil(seconds - el2));
        bar.style.width = Math.min(100, el2 / seconds * 100) + '%';
        if (left > 0) {
          btn.textContent = (rewarded ? 'REWARD IN ' : 'SKIP IN ') + left;
          if (rewarded) btn.disabled = false; // rewarded can be closed early (no reward)
        } else {
          earned = true; btn.disabled = false;
          btn.textContent = rewarded ? 'CLAIM \u2713' : 'CLOSE \u2715';
        }
      }, 100);
      btn.addEventListener('click', finish);
    });
  }

  return {
    isNative: !!AdMob,
    init,
    rewardedAvailable: () => true,
    /** Interstitial between death and game over. Resolves when closed. */
    showInterstitial() {
      return AdMob ? nativeInterstitial() : webAd({ seconds: cfg.interstitialSeconds, rewarded: false });
    },
    /** Rewarded ad. Resolves true if the user earned the reward. */
    showRewarded() {
      return AdMob ? nativeRewarded() : webAd({ seconds: cfg.rewardedSeconds, rewarded: true });
    },
  };
})();
