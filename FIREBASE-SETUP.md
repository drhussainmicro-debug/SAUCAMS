# Firebase setup — SAUC AMS

Same architecture as the Kuwait Hospital app, plus live requests.

- **Live content** — Firestore *overrides* the content baked into `index.html`.
  If Firestore is empty, unreachable, or the phone is offline, the app runs on
  its built-in content. Firebase is never required for the app to work.
- **Live requests** — restricted-approval and consult submissions go into
  Firestore, and signed-in team members get an in-app inbox with a badge and a
  toast when something arrives.

---

## ⚠️ Read this first

**Do not reuse the Kuwait Hospital config.** Those keys point at the `khams-4cfec`
project; using them would write SAUC's data — including patient details — into
another hospital's database. Create a separate SAUC project.

**Approval requests contain patient data** (age, sex, ward, bed, specimen,
organism). The only thing preventing the public from reading them is
`firestore.rules`. Deploy the rules **before** telling anyone the app is live.

---

## 1. Create the project

1. <https://console.firebase.google.com> → **Add project** → name it e.g. `sauc-ams`.
2. **Build → Firestore Database → Create database → Production mode**, region
   `europe-west` or `me-central`.
3. **Build → Authentication → Get started → Email/Password → Enable.**
   Leave sign-up disabled; you add accounts by hand (step 4).
4. **Project settings (gear) → Your apps → Web (`</>`)** → register → copy the
   `firebaseConfig` block.

## 2. Paste the config in two places

The same block goes into both files:

- `index.html` — near the bottom, in the `<script type="module">` marked
  `PASTE YOUR OWN SAUC PROJECT CONFIG HERE`
- `admin.html` — same placeholder

Until you do, the app runs on built-in content and the admin page shows a
"Firebase is not configured" banner. Nothing breaks.

## 3. Deploy the security rules

**Firestore Database → Rules** → paste all of `firestore.rules` → **Publish**.

Then verify, in a browser tab where you are *not* signed in (DevTools console on
the live site):

```js
// must FAIL with "Missing or insufficient permissions"
await firebase.firestore().collection('requests').get()
```

If that succeeds, stop and re-check the rules — patient data is exposed.

## 4. Create team accounts

**Authentication → Users → Add user.** One per stewardship member. These accounts
are used for both the admin console and the in-app **AMS Requests** inbox.

## 5. Seed content (optional)

Open `admin.html`, sign in, and use the tabs. Anything you leave empty keeps the
app's built-in content, so you can migrate one section at a time.

---

## Data model

| Path | Purpose | Read | Write |
|---|---|---|---|
| `updates/{id}` | Alerts & Updates | public | team |
| `config/contacts` | AMS team contacts | public | team |
| `config/tiles` | Home tile labels | public | team |
| `config/restricted` | Restricted drug picker | public | team |
| `config/screening` | MDRO criteria | public | team |
| `guidelines/data` | `conditions[]` → `DB.CONDITIONS` | public | team |
| `monographs/data` | `data[]` → `DRUGS` | public | team |
| `antibiogram/data` | `gramPos[]`, `gramNeg[]`, `sites[]` | public | team |
| **`requests/{id}`** | **Submissions incl. patient data** | **team only** | create: anyone |
| `refs/{ref}` | Public status stub — no patient data | public | create: anyone, update: team |

### Why two collections for requests

A requester needs to check "has AMS answered AMS-1234 yet?" without the app
being able to read everyone else's requests. So each submission writes:

- `requests/{id}` — the full record, patient data, **team-only read**
- `refs/AMS-1234` — `{status, type, drug, createdAt}`, publicly readable

Keep `refs` free of patient identifiers. Anything written there is world-readable.

---

## How requests flow

1. A clinician fills in **Restricted Approval** and taps *Send to AMS*.
2. The app writes to `requests` and `refs`, and shows them the reference.
3. Every signed-in team member's app updates within a second: a badge appears on
   the **AMS Requests** tile and a toast slides up.
4. Any team member opens the request and marks it *Seen* → *Answered* → *Closed*.
   The status change is mirrored to `refs`, so the requester's lookup reflects it.

If Firebase is unreachable, the approval form falls back to its previous
behaviour — composing an email — so a request is never silently lost.

---

## Things worth doing next

- **App Check** (Console → App Check → reCAPTCHA v3). Right now anyone who finds
  the project ID can create `requests` documents. App Check stops automated
  abuse without requiring users to sign in.
- **Retention.** Patient data should not accumulate forever. Decide a period
  (say 90 days) and either delete closed requests from the admin page or add a
  scheduled Cloud Function.
- **Backups.** Firestore → Backups, or periodic exports.
- **Push notifications.** The current inbox is live only while the app is open.
  Notifying a phone with the app closed needs Firebase Cloud Messaging plus a
  service-worker handler — a separate piece of work.
