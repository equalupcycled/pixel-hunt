# Pixel Hunt

Retro pixel hunting high-score game. Mobile-first HTML5 canvas, no build step, no external assets
(all art is drawn in code, all sound is synthesized with WebAudio).

## Run locally
```
python3 -m http.server 8080   # then open http://localhost:8080
```
Any static host works (Render static site, GitHub Pages, Netlify, Cloudflare Pages). Publish dir = repo root, no build command.
Live game: https://pixel-hunt-o4vw.onrender.com/ (Render static site, auto-deploys from `main` of https://github.com/equalupcycled/pixel-hunt).
Landing / download page (does not replace the game): https://pixel-hunt-o4vw.onrender.com/home.html.

## Files
- `index.html` - the game: layout + overlays (title + map select, how-to, upgrades, pause, continue, game over, name entry, leaderboard, credits, ad layer) + Open Graph tags. Title screen links to the landing page.
- `home.html`, `css/home.css`, `img/` - public landing / download page (Play Now, Android APK, iPhone Add to Home Screen). The game stays at `/` and `/index.html` so the installed PWA is unchanged.
- `privacy.html`, `terms.html` - Privacy Policy and Terms of Use (Cache Brands LLC)
- `css/style.css` - pixel UI styling for the game
- `js/game.js` - game loop, sprites, pixel font, maps/backgrounds, weapons, turrets, gadgets, bosses, upgrades UI, input
- `js/economy.js` - weapons, turrets, gear, maps, cosmetics, price formula, difficulty curve, payouts (shared with the simulator)
- `js/meta.js` - persistent save (schema v8: Classic bank/upgrades/equipment, plus a shared Infinity wallet + upgrade tree, missions, achievements, daily calendar, stats, per-map Classic and Infinity bests, map clears); migrates v1–v7 saves
- `js/leaderboard.js` - local top-10 per map for Classic and Infinity (`map:inf`) + stubbed online provider
- `js/share.js` - "Share to Facebook" (Web Share API -> Facebook sharer fallback); `SHARE_CONFIG.GAME_URL`
- `js/audio.js` - Web Audio synth: per-weapon shots, reloads, animal hit cries, boss roar, and quiet looping chiptune (menu and gameplay). Separate Sound and Music toggles are saved in localStorage.
- `js/ads.js` - ad abstraction (web placeholder / AdMob on native)
- `tools/econ-sim.js` - Monte Carlo economy simulator: `node tools/econ-sim.js --table`, `--fit` (refits the price CURVE), `--balance`; also prints an Infinity early-game re-upgrade pace
- `tools/test_playwright.py` - headless test + screenshots (serve the folder on :8799 first)
- `manifest.webmanifest`, `sw.js`, `icons/` - PWA (installable, works offline); `icons/share-banner.png` = 1200x628 og:image

## Rules
- Everything flies/runs **left to right**: enters on the left edge, and if it reaches the right edge unshot it escapes = **1 miss (X)**.
- Lose: **3 escapes TOTAL per run** (birds, ground animals, a hatched boss-egg bird, or a boss that leaves = 1 X each). Hits don't clear X's. Lucky Feather raises the limit to 4, then 5.
- A **PERFECT round** (every target hit) gives one X back.
- **Watch ad to continue** (once per run): restarts the **same round you lost**, **keeps your score** and cash earned this run, and clears all X's. If the run started at round 1 it stays ranked.
- **Checkpoints** at the start of rounds 5, 10, 15... are saved per map (Infinity has its own). Game over also offers *Continue from Round N checkpoint* (X's cleared, score from 0, not ranked) or *Start from Round 1* (ranked).
  Rounds 10, 20... are boss rounds, so their checkpoint puts you right in front of the boss.
- **Clear a map** by defeating its **round 30 boss** (the 3rd boss). That unlocks **Infinity** for that map (endless rounds, a **separate Infinity high score**) and the Classic run **automatically continues** into the **next map** — score and money keep accumulating until you lose, and the end-of-run 2X applies to the full run. Maps cannot be bought; they unlock in order (Meadow → Lake → Snowy Forest → Desert → Night Hunt) only by clearing the previous one. Map select shows clear progress (N/30) or “Clear Meadow to unlock” for the next locked map, and a celebratory “New map unlocked: Lake!” banner after the clear. Players who already bought or played a map keep it (no refunds). Saves that already reached round 30 are granted the clear on load.
- **Infinity progression is shared** across every Infinity map, and is **completely separate** from Classic. Entering Infinity starts you over with the free shotgun (no upgrades) and an Infinity wallet of $0. Classic money, upgrades, and loadout are never spent or changed by Infinity play. In Infinity, upgrades have **no level cap** (except one-time unlocks, maps, and the 3 turret pads): each extra level costs more (×1.22 past the Classic cap) and gains shrink but stay nonzero. The Upgrades screen is labeled Classic or Infinity and shows the matching wallet; it is still only reachable from the title screen and game over.
- Manual reload for every weapon: RELOAD / BOLT / NOCK / VENT button, swipe down (tap weapons) or R / Space.
- Pink decoys (the pink birds with a heart) are protected: shooting one costs cash + points; letting them fly by is free. Turrets never shoot them. Round 3 reminds you: "DON'T SHOOT PINK DECOYS (-$)."
- Meadow is the original hunt: ducks, bluebirds, gold birds, pink decoys, and deer. Each later map keeps every animal from earlier maps and adds its own animals gradually — the map's signature animals first (announced on the round header), then one new animal at a time around rounds 6, 14, and 22 (Lake: kingfisher, frog, beaver; Snowy Forest: ptarmigan, fox, weasel; Desert: hawk, scorpion, jackrabbit; Night: moth, raccoon, skunk). The round intro header reads e.g. `ROUND 14` / `NEW: BEAVER!`.
- Every 10th round is a **boss round** (Classic and Infinity) with a health bar. The boss patrols the upper sky, left to right and back, and periodically drops **eggs**. Smash an egg before it hatches for a few points; a hatched bird flies left-to-right and is **1 X** if it escapes. Drop rate rises with boss tier (round 10 / 20 / 30 / Infinity) and harder maps, and each map's boss drops that map's bird types. A timer still counts down: if it hits zero the boss flies off for **1 X** (this keeps fights from lasting forever and is the same skill check as before, just no longer tied to a single pass).
- The **Upgrades** screen is only available between runs (title screen and game over). There is no shop between rounds or in the pause menu.
- Money, upgrades and equipment **persist** (localStorage `pixelhunt.save.v1`, schema v8). High score overall in `pixelhunt.best`, per-map Classic and Infinity bests in the save.

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
They lock on and fire (shots land; regular animals go down in one hit, bosses take normal turret damage), have a few shots per round, and pay 40% / 50% points. They will not waste a shot on a decoy or a target already leaving the screen.

Gadgets (charges per run): Flak Grenade (tap FLAK, tap the sky), Bird Call (next 3 birds golden), Duck Decoy (birds gather + slow 6 s).
Gear: Hunter's Eye, Focus Scope (slow-mo), Lucky Feather (4-5 misses allowed), Bounty Hunter ($ multiplier), Flashlight (Night map).
Perks (late-game, expensive, in a dedicated shop tab; Infinity levels have no cap): Auto Reload, Speed Loader, Reserve Ammo, Combo Keeper, Critical Shot, Egg Sniper, Cash Magnet, Second Chance, Deer Whisperer, Bullet Time.
Cosmetics: 5 hunter skins, 6 crosshair colors (fixed prices, no gameplay effect).

## Maps & bosses
| Map | Unlock | $ / pts | Animals | Boss |
|---|---|---|---|---|
| Meadow | always open | 1.0 / 1.0 | ducks, bluebirds, deer | Giant Eagle / Big Buck |
| Lake | clear Meadow (R30 boss) | 1.3 / 1.2 | ducks, geese (2 hits) skimming low, swimming geese | Goose King |
| Snowy Forest | clear Lake | 1.7 / 1.5 | gliding snow owls, hopping rabbits, wolves (2 hits) | Yeti Owl |
| Desert | clear Snowy Forest | 2.2 / 1.8 | circling vultures, roadrunners, coyotes (2 hits) | Thunderbird |
| Night Hunt | clear Desert | 2.8 / 2.3 | bats, owls, glowing eyes in the bushes; dark - only the flashlight shows them | Bat King |

## Economy (tuned with tools/econ-sim.js)
- 329 purchasable levels (including 50 perk levels; maps are not purchasable). Price = 1000 x track weight x (1 + 3% x track level) x CURVE[upgrades owned].
  The CURVE is the higher pre-total-miss set (kept at John's request). Campaign runs end at the round 30 boss, so late-game earnings per campaign run are a bit lower than an endless climb. Infinity uses the same early-game prices (so the first re-upgrades still take about 6 games each) and then an exponential cost past the Classic cap.
- Simulated average player: 6.71 games per purchase (p10 4, median 6, p90 11), ~154 h to max everything (~128 h watching 2x ads). Maps are no longer purchasable, so the late curve stays on Meadow income unless a map has been cleared.
  Examples: Handgun $9,000, Laser Gun $96,000.
- Side income scales with the cheapest next upgrade: missions 10%, daily calendar 8-35%, achievements one-time.

## Leaderboard
`js/leaderboard.js`: `Leaderboard.submitScore(map, {name, score, round, weapon})`, `Leaderboard.fetchTop(map)`, `Leaderboard.qualifies(map, score)`.
Today: local top 10 per map (`pixelhunt.board.v1`), plus a separate Infinity board per map under keys like `meadow:inf`. After a qualifying run the player types a name (free text, up to 12 characters; letters, digits, spaces and . - _ ' ! - cleaned by `Leaderboard.cleanName`, remembered for next time). Old initials entries still display.
Online later: set `LEADERBOARD_CONFIG.online = { enabled: true, url: 'https://<api>' }`. Expected API (e.g. a Render web service + Postgres):
`POST /scores` `{map, name, score, round, weapon, ts}` -> `{rank}`; `GET /scores?map=lake&limit=10` -> `[{name, score, round, weapon, ts}]`. Infinity uses map keys such as `lake:inf`.
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
("Watch ad to continue this run" once per run — same round, score kept, 2x run earnings, 2x daily). On the web it shows placeholder ads (5 s countdown, "AD" label, close).
When running inside Capacitor with `@capacitor-community/admob` installed, it uses AdMob automatically.

The Android test APK (`com.cachebrands.pixelhunt`) already ships the existing simulated test ads — no AdMob SDK is bundled yet. To go live with real ads:
1. Keep the existing Capacitor Android wrapper, then `npm i @capacitor-community/admob @capacitor/share && npx cap sync`.
2. **Ad unit IDs**: edit `AD_CONFIG.admob.android` / `AD_CONFIG.admob.ios` at the top of `js/ads.js`
   (currently Google's public TEST units) and set `AD_CONFIG.testing = false` for release.
3. **App IDs** (not in JS): Android `android/app/src/main/AndroidManifest.xml` ->
   `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-XXXX~YYYY"/>`;
   iOS `ios/App/App/Info.plist` -> `GADApplicationIdentifier` = `ca-app-pub-XXXX~YYYY` (+ SKAdNetworkItems per AdMob docs).
4. Test on a device; for iOS also add the App Tracking Transparency prompt if you use personalized ads.

**Remove Ads** ($2.99 label) is a simulated in-game purchase today: the title, pause, and game over screens offer a button that opens a confirm sheet ("Remove Ads — $2.99 (test purchase, no charge)" with Buy / Cancel). Buy calls `completeRemoveAdsPurchase()` (the single hook later billing can replace), marks this device ad-free in local storage (schema v9), and shows a thanks toast. Ad-free skips forced death ads and grants rewarded features instantly (continue once per run, 2X daily limits, and the 15-minute Auto Reload still apply).

## Legal
`privacy.html` and `terms.html` are linked from the title screen footer (also in Credits). Owner: **Cache Brands LLC**, P.O. Box 425, Ullin, IL 62992, dowdyboy1992-qhj8xm@mail.grokbot.com. Last updated Nov 14, 2026. A **© 2026 Cache Brands LLC** line appears on the title screen.

## Debug hooks
`window.PH` (state, targets, weapon, turrets, boss, `jumpRound(n)`, `forceClear()`, `forceDie()`, `setMoney(n)`, `grantAll()`, `makeCard(o)`) for headless tests.

## Android test APK
The game also ships as a debug-signed Android package that bundles the web files and runs offline (no Render URL). Package id `com.cachebrands.pixelhunt`, version `1.0.6` (versionCode 7), portrait, immersive fullscreen, Pixel Hunt launcher icon. The hardware back button closes menus, pauses a run, quits to title from the pause menu, and exits the app from the title screen. The service worker is not registered in the native shell so it cannot fight the bundled assets. Audio unlocks on the first tap, same as the PWA.

Prerelease builds are attached to GitHub releases (for example `v1.0.6-test`). To rebuild a sideloadable debug APK:

    export JAVA_HOME=/home/box/jdk21 ANDROID_HOME=/home/box/android-sdk
    npm install
    bash tools/build-apk.sh

The APK is copied to `dist/PixelHunt-1.0.6-test.apk`. Requires JDK 21 (Capacitor 8) and an Android SDK (platforms + build-tools). JDK 17 is also installed on the build box but is not sufficient for this wrapper. `www/`, `android/app/build/`, and `android/local.properties` are generated and not committed.

