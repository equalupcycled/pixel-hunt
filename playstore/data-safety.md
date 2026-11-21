# Google Play Data safety form: answers for Pixel Hunt 1.1.0

Basis (audited in code, Nov 20 2026): the store build (`STORE=1`, `data-store="1"`) has **no ad SDK, no analytics, no
crash reporter, no Play Billing, and no account system**. The online leaderboard is a disabled stub
(`js/leaderboard.js`, `online.enabled: false`), and the game makes no network requests. Progress, settings, and Top 10
names are stored only in the WebView's local storage on the device. The only Android permission is `INTERNET`, used to
open external links (privacy policy, terms, web version) in the browser. Sharing a score uses the Android system share
sheet, so the user chooses the target app and Pixel Hunt itself transmits nothing.

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not applicable (nothing collected). If the form forces an answer, **Yes**: all links are HTTPS and cleartext is disabled. |
| Do you provide a way for users to request that their data is deleted? | Not applicable (no data leaves the device). Users can clear it via Settings → Apps → Pixel Hunt → Storage → Clear storage, or by uninstalling. This is documented in the privacy policy. |
| Data shared with third parties | None |
| Committed to Play Families Policy | No (not designed for children; see target-audience.md) |
| Independent security review | No |

Result on the store page: **"No data collected · No data shared with third parties."**

## Must update BEFORE shipping a version with ads or billing

When AdMob (`@capacitor-community/admob`) and/or Play Billing are added, change the answers to **Yes, collects/shares**:

- **Device or other IDs** (advertising ID): collected **and** shared (AdMob), purposes Advertising/marketing, Analytics, Fraud prevention.
- **App activity → App interactions**, **App info and performance → Crash logs / Diagnostics**: collected and shared by the Google Mobile Ads SDK, purposes Advertising, Analytics, Fraud prevention.
- **Approximate location** (derived from IP by AdMob): collected and shared, purpose Advertising.
- **Financial info → Purchase history** (Play Billing): collected, purpose App functionality. Google processes payment details; the app never sees card data.
- Encrypted in transit: Yes. Ad personalization is optional and consent-gated via Google UMP (GDPR/US states).
- Also add the `com.google.android.gms.permission.AD_ID` permission, answer "Yes" to the advertising-ID declaration in App content, flip "Contains ads" to Yes, and update `privacy.html` (its Ads/Purchases sections already describe this future state).
