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
- `js/economy.js` - upgrade tracks, price formula, difficulty curve, payouts (shared with the simulator)
- `js/meta.js` - persistent save (bank, upgrades, missions, achievements, daily calendar, stats, 2x-ad cap)
- `tools/econ-sim.js` - Monte Carlo economy simulator: `node tools/econ-sim.js --table`
- `tools/test_playwright.py` - headless smoke test + screenshots (serve the folder on :8799 first)
- `manifest.webmanifest`, `sw.js`, `icons/` - PWA (installable, works offline)

## Rules
- Tap to shoot. Gun starts with 1 shell; tap RELOAD (or swipe down, or R/Space on desktop). You can't shoot while reloading.
- Lose: 3 targets escape **in a row** (birds flying away or deer running off-screen). Any hit resets the counter.
- Pink lovebirds are protected: shooting one costs cash + points and breaks your streak; letting them go is free.
- Earn $ per hit. **Money and upgrades persist** across runs (localStorage `pixelhunt.save.v1`); high score in `pixelhunt.best`.
- Shop ("Armory") is available from the title, game over, and between rounds whenever you can afford something.

## Economy (tuned with tools/econ-sim.js)
- 7 upgrade tracks, 52 levels: Shotgun (Single -> Double Barrel -> Pump -> Lever -> Semi-Auto -> Combat 12 -> Drum Mag),
  Quick Hands (12), Wide Choke (9), Hunter's Eye (8), Focus Scope (6), Lucky Feather (2), Bounty Hunter (9).
- Price = 3100 x trackWeight x (1 + 0.03 x trackLevel) x 1.6 x 1.05^(upgrades owned) (first upgrade = 3100).
  Every purchase raises all prices (Vampire Survivors-style), so purchase order can't break the curve.
- Simulated average player: a run earns ~18-29% of the next upgrade; each upgrade takes ~3-5 runs
  (avg ~3.8 incl. missions + daily), ~200 runs / ~10 hours of play to max everything.
- Side income scales with the cheapest next upgrade: missions 10%, daily calendar 8-35% (day 7 big),
  achievements fixed one-time rewards. Rewarded "2x run earnings" on game over is capped at 3/day.
- Tweak `BASE`, `GROW`, `EARLY`, `PER_LEVEL`, track weights in `js/economy.js`, then re-run the sim.

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
