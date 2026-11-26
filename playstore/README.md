# Pixel Hunt: Google Play release kit (v1.1.2, versionCode 11)

Everything that can be done without the developer's Google accounts is done: a signed release AAB/APK, store listing
text and graphics, privacy policy, and Data safety / IARC / audience answers. The checklist below is what **John** must do.

## What's built

| Item | Where |
|---|---|
| Signed **AAB** (upload this to Play) | GitHub release **v1.1.2** → `PixelHunt-1.1.2.aab` (local: `dist/PixelHunt-1.1.2.aab`) |
| Signed **APK** (sideload / testing) | GitHub release v1.1.2 → `PixelHunt-1.1.2.apk` and the web landing page download |
| Version | `versionName 1.1.2`, `versionCode 11` |
| SDK levels | `minSdk 24`, `targetSdk 36`, `compileSdk 36` (meets Play's API 36 target requirement for new apps/updates since Aug 31 2026) |
| Hardening | `debuggable=false`, WebView remote debugging off, no cleartext / mixed content, R8 minify + resource shrinking |
| Permissions | `INTERNET` only (plus AndroidX's non-dangerous internal `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`) |
| App | Name "Pixel Hunt", adaptive + round icons, splash, portrait-locked, edge-to-edge |
| Ads / billing in this build | **Off.** The store build (`STORE=1`) shows no ads (rewards such as continue/2X are granted free) and hides the simulated "Remove Ads" purchase, because no ad SDK or Play Billing is wired yet. Placeholder ads and fake purchases would violate Play policy. |
| Privacy policy | https://pixel-hunt-o4vw.onrender.com/privacy.html |
| Listing / graphics | `listing.md`, `icon-512.png`, `feature-graphic-1024x500.png`, `screenshots/{phone,tablet-7in,tablet-10in}/` |
| Policy forms | `data-safety.md`, `content-rating-iarc.md`, `target-audience.md` |

### Upload key (Play App Signing "upload key")

- Keystore: `/home/box/secrets/pixelhunt-upload.jks` on the Grok Bot box (PKCS12, alias `pixelhunt-upload`, RSA 4096, valid to 2054).
  Passwords are in `/home/box/secrets/pixelhunt-upload-password.txt` and `pixelhunt-upload.properties` (chmod 600). **Not in git.**
- Certificate: `CN=Cache Brands LLC, O=Cache Brands LLC, C=US`
- SHA-256: `d9:b9:8d:2b:64:66:41:9a:46:fc:e8:e0:d9:af:8e:ee:bd:2d:f3:d3:3d:15:b9:4e:e8:7e:69:8d:2b:33:38:79`
- SHA-1: `5a:2b:c3:17:e0:5e:34:d2:2f:cd:23:bf:85:3a:ba:62:8f:38:1b:ed`
- With Play App Signing (default for new apps), Google holds the real app-signing key. If this upload key is ever lost,
  Play support can reset it, but **back it up anyway** (see checklist).

### Rebuild

```bash
export JAVA_HOME=/home/box/jdk21 ANDROID_HOME=/home/box/android-sdk
bash tools/build-release.sh          # STORE=1 web build → cap sync → signed AAB + APK in dist/, then apksigner verify
```
Bump `versionCode` (+1 every upload) and `versionName` in `android/app/build.gradle` and `package.json` first.

## John's checklist (in order)

1. **Create a Google Play Console developer account**: https://play.google.com/console/signup, **$25 one-time** fee.
   - *Personal* account: government photo ID verification plus a verified phone number.
   - *Organization* account (publishing as **Cache Brands LLC**): needs a **D-U-N-S number** (free from Dun & Bradstreet, can take days), the org's website and phone, and verification. Organization accounts skip the 12-tester rule below.
2. **Verify identity / contact details** when prompted. The developer name and address may be shown publicly.
3. **Create the app** in Play Console: name *Pixel Hunt*, Game, Free, default language English (US). Accept the declarations.
4. **App content** section: fill it from `target-audience.md`, `data-safety.md`, `content-rating-iarc.md`, plus the privacy policy URL. Ads: No. App access: no login needed.
5. **Store listing**: paste the texts from `listing.md` and upload `icon-512.png`, `feature-graphic-1024x500.png`, 4–8 phone screenshots, and the 7" and 10" tablet screenshots. Set category **Arcade**, contact email hello@cachebrands.com, and website.
6. **Play App Signing**: keep the default (Google-managed key). The first AAB upload registers the upload key above.
7. **Upload `PixelHunt-1.1.2.aab`** (from the v1.1.2 GitHub release) to a testing track.
8. **New *personal* accounts (created after Nov 13 2023): run a closed test with at least 12 testers opted in for 14 continuous days** before you can apply for Production access. Tips: collect 12+ Gmail addresses (friends/family) into an email list, share the opt-in link, and ask them to keep it installed and open it a few times. Then answer the "apply for production" questionnaire.
9. **Countries / pricing**: Free, choose countries (all or US first). Then **send for review → roll out to Production**.
10. **Back up the upload keystore and passwords** off the box (password manager plus an offline copy).

### Later (only with John's OK: not wired today)

- **Ads (AdMob):** create an AdMob account, add the Android app, and send:
  the **AdMob App ID** (`ca-app-pub-XXXX~YYYY`), an **Interstitial unit ID**, and a **Rewarded unit ID**.
  Then dev work: `npm i @capacitor-community/admob`, add the App ID meta-data to `AndroidManifest.xml`, put the unit IDs in
  `js/ads.js` (`AD_CONFIG.admob.android`, `testing:false`), add the Google **UMP consent** form (GDPR/US), add the `AD_ID`
  permission, publish `app-ads.txt` on the website, and update Data safety ("Contains ads: Yes"). In a native build with
  the plugin present, ads switch on automatically (`ADS_OFF` is only true when the AdMob plugin is missing).
- **Remove Ads ($2.99) via Google Play Billing:** create a one-time in-app product, e.g. id **`remove_ads`**, at $2.99
  (needs a **payments profile/merchant account** in Play Console). Dev work: add a Play Billing plugin, replace the simulated
  `purchaseRemoveAds()` in `js/game.js`, and handle restore/acknowledge. Update the listing ("In-app purchases"), IARC
  ("digital purchases: yes"), and Data safety (purchase history).
- **Online leaderboard:** currently a disabled stub (local Top 10 only). It would need a backend and a privacy/Data safety update.

## Notes

- Each new upload needs a higher `versionCode`. Never re-sign with a different upload key without a Play upload-key reset.
- The `screenshots/` sets come from the real store build (no ad UI) with an automated player. Regenerate with `tools/make_store_shots.py`.
