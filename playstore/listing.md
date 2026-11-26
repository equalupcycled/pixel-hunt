# Pixel Hunt: Google Play store listing (v1.1.2)

| Field | Value |
|---|---|
| App name (≤30) | **Pixel Hunt** |
| Package | `com.cachebrands.pixelhunt` |
| App or game | Game |
| Category | **Arcade** (Play's game categories; "Action" is the alternative) |
| Tags (pick up to 5 in Console) | Arcade, Shooter, Pixel art, Retro, Casual / Offline |
| Free or paid | Free |
| Contains ads | **No** for 1.1.2 (store build ships without an ad SDK). Change to *Yes* when AdMob is added. |
| In-app purchases | **No** for 1.1.2. Change when Play Billing "Remove Ads" is wired. |
| Contact email | `hello@cachebrands.com` (Cache Brands company contact; shown publicly on the store listing) |
| Website | https://pixel-hunt-o4vw.onrender.com/home.html |
| Privacy policy URL | https://pixel-hunt-o4vw.onrender.com/privacy.html |
| Developer / org | Cache Brands LLC, P.O. Box 425, Ullin, IL 62992 |

## Short description (80 max: this is 72)

```
Retro pixel hunting: 5 maps, 15 bosses, 6 weapons, turrets and Infinity.
```

## Full description (4000 max: this is 1,755)

```
Pixel Hunt is a fast, retro arcade shooter in crisp pixel art. Tap to shoot, reload by hand, and don't let three targets get away!

HUNT ACROSS FIVE MAPS
Start in the Meadow, then push through the Lake, Snowy Forest, Desert and the Night Hunt in one continuous campaign. Your score and cash carry over from map to map. Every new map introduces its animals one at a time, and each newcomer is announced in the round header so you always know what's coming.

15 BOSS FIGHTS
Every 10th round brings a boss: the Giant Eagle, Goose King, Yeti Owl, Frost Wolf, Thunderbird, Pharaoh Jackal, Sun Roc, Bat King, Blood Moon and more. Beat a map's round 30 boss to clear it and unlock its Infinity mode.

SIX WEAPONS, REAL UPGRADES
Shotgun, handgun, rifle, bow, machine gun and laser, each with its own feel. Spend the cash you earn on barrels, faster reloads, tighter chokes, sharper eyes and bigger bounties. Upgrades are permanent, so every run makes you stronger.

TURRETS AND GADGETS
Mount auto-turrets to cover your flanks. Throw flak, use bird calls and duck decoys, and trigger slow-motion FOCUS when the sky gets crowded.

INFINITY MODE
Cleared a map? Take it into Infinity: endless rounds, a separate economy and high score for every map, and harder waves the longer you last.

MORE TO DO
• Missions with cash rewards
• Daily login rewards
• Perfect-round streaks and checkpoints every 5 rounds
• A local Top 10 leaderboard per mode
• Hunter outfits and style unlocks
• Sound effects and a chiptune soundtrack (toggle anytime)

PLAY ANYWHERE
Works offline, built for one-handed portrait play on phones and tablets. No account and no sign-in. Your progress is saved on your device.

No ads and no in-app purchases in this version.

Made by Cache Brands LLC.
```

## Graphics in this folder

| Asset | File | Spec |
|---|---|---|
| App icon | `icon-512.png` | 512×512, 32-bit PNG |
| Feature graphic | `feature-graphic-1024x500.png` | 1024×500 PNG, no alpha |
| Phone screenshots (9) | `screenshots/phone/*.png` | 1080×1920 (9:16) |
| 7-inch tablet (9) | `screenshots/tablet-7in/*.png` | 1200×1920 |
| 10-inch tablet (9) | `screenshots/tablet-10in/*.png` | 1600×2560 |

Suggested phone order: 2-meadow-action, 4-boss, 3-new-animal, 5-desert, 6-night, 7-map-cleared, 9-upgrades, 8-all-maps-cleared, 1-title.
Regenerate with `python3 tools/make_store_shots.py http://127.0.0.1:8800/ OUTDIR W H DSF PREFIX`, serving `www/` from `STORE=1 tools/prepare-native.sh`.
