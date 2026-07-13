# JuanPMT — System Architecture

Guide for developers working on **JuanPMT** (Juan Project Management Tool): a shared team dashboard for projects, tasks, budget, finance, leads, and partners.

**Firebase project:** `juanpmt`  
**Live site:** Firebase Hosting (deployed from `public/`)  
**Repo:** vanilla ES modules — no bundler, no npm app build

---

## 1. High-level overview

```text
┌─────────────┐     HTTPS      ┌──────────────────────────┐
│  Browser    │ ─────────────► │  Firebase Hosting        │
│  (SPA UI)   │                │  serves public/          │
└──────┬──────┘                └──────────────────────────┘
       │
       │ Firebase JS SDK (CDN ESM)
       ▼
┌──────────────────────────────────────────────────────────┐
│  Firebase Auth          │  Cloud Firestore               │
│  Email / password       │  pmt/main  (app data blob)     │
│  users/{uid} profiles   │  users/{uid} (allowlist/roles) │
└──────────────────────────────────────────────────────────┘
       ▲
       │ on push to main
┌──────┴──────┐
│ GitHub      │  FirebaseExtended/action-hosting-deploy
│ Actions CI  │  secret: FIREBASE_SERVICE_ACCOUNT_JUANPMT
└─────────────┘
```

**Mental model:** one HTML shell + modular JS. All domain data lives in a single in-memory `data` object, mirrored to `localStorage` and to Firestore document `pmt/main`. Auth gates the UI; Firestore rules gate the data.

---

## 2. Tech stack

| Layer | Choice | Notes |
|--------|--------|--------|
| UI | Static HTML + CSS | `public/index.html`, `public/css/styles.css` |
| Logic | Vanilla ES modules | No React/Vue; browser-native `import` |
| Charts | Chart.js 4.x (CDN) | Loaded in `index.html` |
| Auth | Firebase Auth | Email/password only |
| Database | Cloud Firestore | Single doc for app state + `users` collection |
| Hosting | Firebase Hosting | `public/` is the site root |
| CI/CD | GitHub Actions | Deploy on merge to `main`; preview on PRs |

There is **no** Node build step for the app. Firebase CLI is only needed for local deploy / rules.

Legacy file `juanpmt.html` at the repo root is an older single-file prototype — **do not develop against it**. The live app is under `public/`.

---

## 3. Repository layout

```text
.
├── .github/
│   ├── FIREBASE_DEPLOY.md          # One-time CI secret setup
│   └── workflows/
│       ├── firebase-hosting-merge.yml      # Deploy live on push to main
│       └── firebase-hosting-pull-request.yml
├── public/                         # ← hosted site
│   ├── index.html                  # Shell: login + tabs + modals
│   ├── css/styles.css
│   └── js/
│       ├── app.js                  # Boot, auth gate, tab wiring
│       ├── auth.js                 # Login, roles, user CRUD helpers
│       ├── firebase-config.js      # Firebase init + Auth/Firestore exports
│       ├── data.js                 # In-memory store, save, Firestore watch
│       ├── helpers.js              # Formatting, name lookups
│       ├── charts.js               # Chart instance registry
│       └── modules/                # One module per tab/feature
│           ├── overview.js
│           ├── projects.js
│           ├── tasks.js
│           ├── timeline.js
│           ├── team.js
│           ├── budget.js
│           ├── finance.js
│           ├── leads.js
│           ├── partners.js
│           └── settings.js         # Categories + Users (superadmin)
├── firebase.json
├── .firebaserc                     # default project: juanpmt
├── firestore.rules
├── NOTES.md                        # Historical notes (may be stale)
└── ARCHITECTURE.md                 # ← this document
```

---

## 4. Runtime / module architecture

### Boot sequence (`public/js/app.js`)

1. Import feature modules and `watchAuth`.
2. Show **login screen** until Firebase Auth reports a signed-in, authorized user.
3. On success: reveal `#app`, bind tab clicks / filters / modals, call `watchFirestore(renderAll)`, then `renderAll()`.
4. On logout / unauthorized: hide app, show login, unsubscribe Firestore.

### Feature modules

Each tab module exports roughly:

- `init(renderAll, closeModal?)` — wire callbacks once  
- `render()` — redraw that tab’s DOM  
- Modal helpers when needed: `openModal`, `saveModal`, `deleteModal`

`window.*` handlers in `app.js` bridge `onclick="..."` attributes in HTML to module functions (no framework event system).

| Module | Responsibility |
|--------|----------------|
| `overview` | KPI strip, task-status chart, budget chart, upcoming tasks |
| `projects` | Project CRUD + status filter |
| `tasks` | Task CRUD + filters |
| `timeline` | Gantt-style project bars |
| `team` | Members, capacity, salaries |
| `budget` | Budget vs spent by project |
| `finance` | In/Out transactions, payroll, expense charts |
| `leads` | Sales pipeline |
| `partners` | Equity / flat partners + dividend run |
| `settings` | Transaction categories; **Users** (superadmin only) |

### Shared layers

- **`data.js`** — source of truth for business entities; `save()` / `watchFirestore()`.
- **`auth.js`** — session, superadmin checks, create/list/deactivate users.
- **`helpers.js`** — `fmtMoney`, dates, `projectName` / `memberName`.
- **`firebase-config.js`** — single place for project config and SDK exports.

---

## 5. Data model

### Firestore

| Path | Purpose |
|------|---------|
| `pmt/main` | Entire app state as one JSON document |
| `users/{uid}` | Allowlisted app users (role, active, profile) |

### `pmt/main` shape (`data` object)

```js
{
  team: [],
  projects: [],
  tasks: [],
  transactions: [],
  leads: [],
  partners: [],
  outCategories: string[],   // expense categories
  inCategories: string[]     // income categories
}
```

Defaults / migration live in `data.js` (`emptyData`, `migrate`). Protected expense categories **`Salary`** and **`Dividend`** are required by payroll and partner dividends.

### Entity fields (concise)

| Entity | Key fields |
|--------|------------|
| **project** | `id`, `name`, `client`, `start`, `end`, `status`, `priority`, `budget`, `spent` |
| **task** | `id`, `name`, `project`, `owner`, `due`, `status`, `priority`, `hours` |
| **team member** | `id`, `name`, `role`, `capacity`, `salary` |
| **transaction** | `id`, `type` (`In`\|`Out`), `category`, `amount`, `date`, `project?`, `member?`, `note`, (`partnerId` for dividends) |
| **lead** | `id`, name/contact/email/phone, `status`, `source`, `value`, `assignedTo`, `notes` |
| **partner** | `id`, `name`, `teamMemberId?`, `shareType`, `shareValue`, `notes` |
| **user** (Firestore) | `email`, `name`, `role` (`superadmin`\|`user`), `active`, `createdAt`, `createdBy?` |

IDs are generated with `uid(prefix)` in `data.js` (e.g. `p_…`, `f_…`).

### Persistence flow

```text
UI mutation → mutate `data` → save()
                              ├─ localStorage[`juanpmt_data_v2`]
                              └─ setDoc(pmt/main)

Other clients ← onSnapshot(pmt/main) ← Object.assign(data) ← renderAll()
```

`watchFirestore` ignores snapshots with `hasPendingWrites` to avoid echo loops.

---

## 6. Auth & authorization

### Roles

| Role | Who | Capabilities |
|------|-----|----------------|
| **Superadmin** | Hardcoded `njcarlo@gmail.com` (+ `users/{uid}.role === 'superadmin'`) | Full app access; Settings → Users |
| **User** | Created by superadmin | Full app data access; **cannot** manage users |

### Flows

1. **First boot (superadmin):** Login screen → “Create superadmin account” with `njcarlo@gmail.com` + password. Profile is upserted into `users/{uid}`.
2. **Add teammate:** Superadmin → Settings → Users → name, email, temp password. Uses a **secondary Firebase app** so creating the Auth user does not sign the admin out (`auth.js` / `secondaryAuth`).
3. **Sign-in:** Email/password → `ensureUserProfile`. Non-allowlisted or inactive users are signed out with an error.
4. **Password reset:** “Forgot password?” → Firebase `sendPasswordResetEmail`.

### Security rules (`firestore.rules`)

- `pmt/*` — read/write if **active** signed-in user (or hardcoded superadmin email).
- `users/*` — read for self / active users; create/update/delete only **superadmin** (cannot delete self).

**Important:** Email/Password must be enabled in Firebase Console → Authentication. Rules must be deployed (`firebase deploy --only firestore:rules`) — Hosting CI does **not** deploy rules today.

---

## 7. UI structure

- `#loginScreen` — shown when logged out  
- `#app` — main shell (hidden until authorized)  
  - Header: brand, tab nav, user chip + logout  
  - Panels: `#panel-{tab}` toggled by `data-tab` buttons  
  - Settings: categories for all users; Users card only if `isSuperadmin()`  
- Modals at end of `index.html` for CRUD forms  

Styling is centralized in `styles.css` (CSS variables for colors/radius). Prefer matching existing patterns when adding UI.

---

## 8. CI/CD & environments

| Event | Workflow | Result |
|-------|----------|--------|
| Push / merge to `main` | `firebase-hosting-merge.yml` | Deploy to **live** Hosting channel |
| Pull request | `firebase-hosting-pull-request.yml` | Preview channel + PR comment |

**Required GitHub secret:** `FIREBASE_SERVICE_ACCOUNT_JUANPMT`  
Setup steps: `.github/FIREBASE_DEPLOY.md` (or `firebase init hosting:github`).

Hosting config: `firebase.json` → `public` directory, SPA rewrite to `/index.html`.

---

## 9. Local development

```bash
# Option A — Firebase emulator / hosting serve (needs Firebase CLI)
firebase serve --only hosting

# Option B — any static server from public/
npx serve public
# or: python -m http.server -d public 8080
```

Open the URL, sign in (or create superadmin once). Pointing at the real `juanpmt` Firebase project uses production Auth/Firestore — be careful with shared data.

There is no test suite yet; verify manually: login, CRUD on a tab, Settings categories/users, multi-tab sync.

---

## 10. Conventions for contributors

1. **Keep modules thin** — UI + CRUD in `modules/*`; shared state in `data.js`; auth in `auth.js`.
2. **Always call `save()`** after mutating `data`, then `_renderAll()` / `renderAll()`.
3. **Register new `window.*` handlers** in `app.js` if you add `onclick` in HTML.
4. **Categories:** use `getOutCategories()` / `getInCategories()`, not deprecated constants.
5. **Do not remove** `Salary` / `Dividend` without updating payroll & partners.
6. **New Firestore collections** need matching `firestore.rules` entries.
7. Prefer small PRs; `main` auto-deploys Hosting when CI secrets are configured.

---

## 11. Open tasks / backlog

### Must-do / ops (blockers for a healthy prod)

| Priority | Task | Detail |
|----------|------|--------|
| P0 | Enable Email/Password in Firebase Auth | Console → Authentication → Sign-in method |
| P0 | Deploy Firestore rules | `firebase deploy --only firestore:rules` (not in Hosting CI yet) |
| P0 | Create superadmin account in the app | Login → Create superadmin account → `njcarlo@gmail.com` |
| P0 | Add `FIREBASE_SERVICE_ACCOUNT_JUANPMT` secret | Otherwise Actions deploys fail — see `.github/FIREBASE_DEPLOY.md` |
| P1 | Confirm live Hosting URL & Auth authorized domains | Include custom domain if any |

### Product / engineering (known gaps)

| Priority | Task | Detail |
|----------|------|--------|
| P1 | **Link Budget KPIs to Finance transactions** | Implemented on branch `cursor/transaction-types-settings-1309` (`1195ae2`) but **not merged to `main`**. Today Overview/Budget still use manual `project.spent`. Should derive spent from `Out` txns tagged to a project (and show Received from `In`). |
| P1 | Deploy Firestore rules from CI | Extend GitHub Action to `firebase deploy --only firestore:rules` (or hosting+rules) so rules don’t drift |
| P2 | Split `pmt/main` monolith | Large single doc will hit size/contention limits; migrate to collections per entity with transactions/batches |
| P2 | Remove or archive `juanpmt.html` | Avoid confusion with `public/` |
| P2 | Role permissions beyond superadmin/user | e.g. read-only finance, hide Partners, etc. |
| P2 | Fully delete Auth users when removed in Settings | Today only Firestore profile is deleted; Auth account remains but cannot pass allowlist |
| P3 | Automated tests | Smoke tests for auth gate, `migrate()`, finance totals |
| P3 | Update / retire `NOTES.md` | Historical; prefer this architecture doc |
| P3 | Password / invite UX | Force password change on first login; invite links instead of temp passwords in clear UI |
| P3 | Offline / conflict strategy | localStorage + Firestore can diverge; document or add last-write metadata |

### Suggested next implementation order

1. Finish ops checklist (Auth provider, rules deploy, CI secret, first superadmin).  
2. Cherry-pick / re-land **Finance-linked budget KPIs** onto `main`.  
3. Add **rules deploy** to CI.  
4. Plan Firestore collection split before data grows large.

---

## 12. Quick reference — important constants

| Constant | Location | Value / meaning |
|----------|----------|-----------------|
| `SUPERADMIN_EMAIL` | `auth.js` / `firebase-config.js` | `njcarlo@gmail.com` |
| `STORAGE_KEY` | `data.js` | `juanpmt_data_v2` |
| `DATA_DOC` | `firebase-config.js` | `doc(db, 'pmt', 'main')` |
| `PROTECTED_OUT_CATEGORIES` | `data.js` | `Salary`, `Dividend` |
| Firebase `projectId` | `firebase-config.js` / `.firebaserc` | `juanpmt` |

---

*Last updated: 2026-07-13 — reflects `main` after auth + Hosting CI merges; notes unmerged KPI work on `cursor/transaction-types-settings-1309`.*
