# Pixel Hunt

Retro pixel bird-hunting high-score game. Mobile-first HTML5 canvas, no build step, no external assets
(all art is drawn in code, all sound is synthesized with WebAudio).

## Run locally
```
python3 -m http.server 8080   # then open http://localhost:8080
```
Any static host works (Render static site, GitHub Pages, Netlify, Cloudflare Pages). Publish dir = repo root, no build command.

## Files
- `index.html` - layout + overlays (title, how-to, shop, pause, continue, game over, ad layer)
- `css/style.css` - pixel UI styling
- `js/game.js` - game loop, sprites, pixel font, difficulty, shop, input
- `js/audio.js` - WebAudio synth sound effects (mute persisted in localStorage)
- `js/ads.js` - ad abstraction (web placeholder / AdMob on native)
- `manifest.webmanifest`, `sw.js`, `icons/` - PWA (installable, works offline)

## Rules
- Tap to shoot. Gun starts with 1 shell; tap RELOAD (or swipe down, or R/Space on desktop). You can't shoot while reloading.
- Lose: 3 targets escape **in a row** (birds flying away or deer running off-screen). Any hit resets the counter.
- Pink lovebirds are protected: shooting one costs cash + points and breaks your streak; letting them go is free.
- Earn $ per hit; spend it in the shop between rounds. High score saved in localStorage (`pixelhunt.best`).

## Ads / AdMob
`js/ads.js` exposes `Ads.showInterstitial()` (shown on every death before Game Over) and `Ads.showRewarded()`
("Watch ad to continue", once per run). On the web it shows placeholder ads (5 s countdown, "AD" label, skip/close).
When running inside Capacitor with `@capacitor-community/admob` installed, it uses AdMob automatically.

To go live:
1. `npm i @capacitor/core @capacitor/cli @capacitor-community/admob && npx cap init "Pixel Hunt" com.yourname.pixelhunt --web-dir .`
   (or copy the web files into a `www/` folder and use `--web-dir www`), then `npx cap add ios` / `npx cap add android`, `npx cap sync`.
2. **Ad unit IDs**: edit `AD_CONFIG.admob.android` / `AD_CONFIG.admob.ios` at the top of `js/ads.js`
   (currently Google's public TEST units) and set `AD_CONFIG.testing = false` for release.
3. **App IDs** (not in JS): Android `android/app/src/main/AndroidManifest.xml` ->
   `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-XXXX~YYYY"/>`;
   iOS `ios/App/App/Info.plist` -> `GADApplicationIdentifier` = `ca-app-pub-XXXX~YYYY` (+ SKAdNetworkItems per AdMob docs).
4. Test on a device; for iOS also add the App Tracking Transparency prompt if you use personalized ads.

## Debug hooks
`window.PH` (state, targets, score, `jumpRound(n)`, `forceClear()`, `forceDie()`, `setMoney(n)`) for headless tests.
