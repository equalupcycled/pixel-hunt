# Pixel Hunt

Retro pixel hunting high-score game. Mobile-first HTML5 canvas, no build step, no external assets
(all art is drawn in code, all sound is synthesized with WebAudio).

## Run locally
```
python3 -m http.server 8080   # then open http://localhost:8080
```
Any static host works (Render static site, GitHub Pages, Netlify, Cloudflare Pages). Publish dir = repo root, no build command.
Live: https://pixel-hunt-o4vw.onrender.com/ (Render static site, auto-deploys from `main` of https://github.com/equalupcycled/pixel-hunt).

## Files
- `index.html` - layout + overlays (title + map select, how-to, armory, pause, continue, game over, name entry, leaderboard, ad layer) + Open Graph tags
- `css/style.css` - pixel UI styling
- `js/game.js` - game loop, sprites, pixel font, maps/backgrounds, weapons, turrets, gadgets, bosses, armory UI, input
- `js/economy.js` - weapons, turrets, gear, maps, cosmetics, price formula, difficulty curve, payouts (shared with the simulator)
- `js/meta.js` - persistent save v2 (bank, upgrade levels, equipment, missions, achievements, daily calendar, stats, per-map bests); migrates v1 saves
- `js/leaderboard.js` - local top-10 per map + stubbed online provider
- `js/share.js` - "Share to Facebook" (Web Share API -> Facebook sharer fallback); `SHARE_CONFIG.GAME_URL`
- `js/audio.js` - WebAudio synth sound effects (each weapon has its own)
- `js/ads.js` - ad abstraction (web placeholder / AdMob on native)
- `tools/econ-sim.js` - Monte Carlo economy simulator: `node tools/econ-sim.js --table`, `--fit` (refits the price CURVE), `--balance`
- `tools/test_playwright.py` - headless test + screenshots (serve the folder on :8799 first)
- `manifest.webmanifest`, `sw.js`, `icons/` - PWA (installable, works offline); `icons/share-banner.png` = 1200x628 og:image

## Rules
- Everything flies/runs **left to right**: enters on the left edge, and if it reaches the right edge unshot it escapes = **1 miss (X)**.
- Lose: **3 targets escape in a row** (birds, ground animals, or a boss). Any hit by *you* resets the counter (turret kills don't).
- Manual reload for every weapon: RELOAD / BOLT / NOCK / VENT button, swipe down (tap weapons) or R / Space.
- Pink lovebirds are protected: shooting one costs cash + points; letting them go is free. Turrets never shoot them.
- Every 10th round is a **boss round** with a health bar; the boss makes one slow left-to-right pass (the timer is how long until it reaches the right edge).
- Money, upgrades and equipment **persist** (localStorage `pixelhunt.save.v1`, schema v2). High score overall in `pixelhunt.best`, per map in the save.

## Arsenal
| Weapon | Input | Role | Unlock |
|---|---|---|---|
| Shotgun | tap | starter; wide spread, forgiving | free |
| Handgun | tap | fast precise taps, big mag, small hit area, crits pay 2x | 2 upgrades owned |
| Rifle | tap | one round from the hunter through the tap point, pierces a line; ground game pays 1.5x | 12 |
| Bow | hold/release | silent (misses don't break streak), arcing arrows with travel time, full draw = 2 dmg to bosses; gold pays 2x | 24 |
| Machine Gun | hold | sprays a belt, long reload, hits pay 65% | 40 |
| Laser Gun | hold | beam sweep, heat instead of ammo, manual VENT, hits pay 85% | 90 |

Each has 3-5 upgrade tracks (capacity, reload, accuracy/size, special). **Gun Sling** (30 upgrades) adds a 2nd slot and a SWAP button.

Turrets (need **Turret Pads**, up to 3 slots): Pellet Turret (20), Tesla Coil (55, chain lightning), Missile Pod (75, homing splash).
They only shoot targets that are about to escape, have a few shots per round, and pay 40% / 50% points.

Gadgets (charges per run): Flak Grenade (tap FLAK, tap the sky), Bird Call (next 3 birds golden), Duck Decoy (birds gather + slow 6 s).
Gear: Hunter's Eye, Focus Scope (slow-mo), Lucky Feather (4-5 misses allowed), Bounty Hunter ($ multiplier), Flashlight (Night map).
Cosmetics: 5 hunter skins, 6 crosshair colors (fixed prices, no gameplay effect).

## Maps & bosses
| Map | Unlock | $ / pts | Animals | Boss |
|---|---|---|---|---|
| Meadow | free | 1.0 / 1.0 | ducks, bluebirds, deer | Giant Eagle / Big Buck |
| Lake | 18 upgrades | 1.3 / 1.2 | ducks, geese (2 hits) skimming low, swimming geese | Goose King |
| Snowy Forest | 45 | 1.7 / 1.5 | gliding snow owls, hopping rabbits, wolves (2 hits) | Yeti Owl |
| Desert | 80 | 2.2 / 1.8 | circling vultures, roadrunners, coyotes (2 hits) | Thunderbird |
| Night Hunt | 120 | 2.8 / 2.3 | bats, owls, glowing eyes in the bushes; dark - only the flashlight shows them | Bat King |

## Economy (tuned with tools/econ-sim.js)
- 239 purchasable levels. Price = 1000 x track weight x (1 + 3% x track level) x CURVE[upgrades owned]; CURVE is fitted by
  `node tools/econ-sim.js --fit` so the cheapest next purchase is ~4 average runs of earnings at every stage.
- Simulated average player: 3.9 games per purchase (p10 3, median 4, p90 5), ~76 h to max everything (~57 h watching 2x ads).
- Side income scales with the cheapest next upgrade: missions 10%, daily calendar 8-35%, achievements one-time.

## Leaderboard
`js/leaderboard.js`: `Leaderboard.submitScore(map, {name, score, round, weapon})`, `Leaderboard.fetchTop(map)`, `Leaderboard.qualifies(map, score)`.
Today: local top 10 per map (`pixelhunt.board.v1`), after a qualifying run the player types a name (free text, up to 12 characters; letters, digits, spaces and . - _ ' ! - cleaned by `Leaderboard.cleanName`, remembered for next time). Old initials entries still display.
Online later: set `LEADERBOARD_CONFIG.online = { enabled: true, url: 'https://<api>' }`. Expected API (e.g. a Render web service + Postgres):
`POST /scores` `{map, name, score, round, weapon, ts}` -> `{rank}`; `GET /scores?map=lake&limit=10` -> `[{name, score, round, weapon, ts}]`.
Validate scores and names server-side (length, profanity filter) (rate limit, sanity caps per round) before trusting them.

## Share to Facebook
Game over and leaderboard have **SHARE TO FACEBOOK**. `js/share.js`:
1. `navigator.share({title, text, url, files})` when available - on phones this is the system share sheet (Facebook, Messenger, WhatsApp...).
   Text: "I scored 51,550 on Pixel Hunt (Lake, round 14)! Can you beat me?" + game URL; a 1200x628 score-card PNG is attached when the browser can share files.
2. Otherwise opens `https://www.facebook.com/sharer/sharer.php?u=GAME_URL` (and copies the text to the clipboard, since Facebook ignores pre-filled text).
No Facebook SDK or app ID needed. **Once hosted**: set `SHARE_CONFIG.GAME_URL` in `js/share.js` and make `og:url` / `og:image` in `index.html` absolute URLs.
Capacitor: `npm i @capacitor/share` - `share.js` already prefers `Capacitor.Plugins.Share.share({title, text, url})` when present
(to attach the image natively, write it with `@capacitor/filesystem` and pass `files: [uri]`).

## Ads / AdMob
`js/ads.js` exposes `Ads.showInterstitial()` (shown on every death before Game Over) and `Ads.showRewarded()`
("Watch ad to continue" once per run, 2x run earnings, 2x daily). On the web it shows placeholder ads (5 s countdown, "AD" label, close).
When running inside Capacitor with `@capacitor-community/admob` installed, it uses AdMob automatically.

To go live:
1. `npm i @capacitor/core @capacitor/cli @capacitor-community/admob @capacitor/share && npx cap init "Pixel Hunt" com.yourname.pixelhunt --web-dir .`
   (or copy the web files into a `www/` folder and use `--web-dir www`), then `npx cap add ios` / `npx cap add android`, `npx cap sync`.
2. **Ad unit IDs**: edit `AD_CONFIG.admob.android` / `AD_CONFIG.admob.ios` at the top of `js/ads.js`
   (currently Google's public TEST units) and set `AD_CONFIG.testing = false` for release.
3. **App IDs** (not in JS): Android `android/app/src/main/AndroidManifest.xml` ->
   `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-XXXX~YYYY"/>`;
   iOS `ios/App/App/Info.plist` -> `GADApplicationIdentifier` = `ca-app-pub-XXXX~YYYY` (+ SKAdNetworkItems per AdMob docs).
4. Test on a device; for iOS also add the App Tracking Transparency prompt if you use personalized ads.

## Debug hooks
`window.PH` (state, targets, weapon, turrets, boss, `jumpRound(n)`, `forceClear()`, `forceDie()`, `setMoney(n)`, `grantAll()`, `makeCard(o)`) for headless tests.
