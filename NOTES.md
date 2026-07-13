# JuanPMT — Project Management Tool

## Current state
`juanpmt.html` is a single-file, self-contained project management dashboard (vanilla JS, Chart.js from CDN). It currently runs entirely client-side with data persisted in `localStorage`. Tabs: Overview, Projects, Tasks, Timeline, Team, Budget, Finance (income/expenses/payroll).

Started empty (no seed/sample data) — data model:
- `data.projects`: id, name, client, start, end, status, priority, budget, spent
- `data.tasks`: id, name, project, owner, due, status, priority, hours
- `data.team`: id, name, role, capacity (weekly hours), salary (monthly, optional)
- `data.transactions`: id, type (In/Out), category, amount, date, project (optional), member (optional), note

## What's next (goal: deploy to Firebase with shared team data)
1. **Convert storage from localStorage to Firestore** so all team members see the same live projects/tasks/finance data instead of per-browser local data. This means:
   - Replace the `load()`/`save()` functions with Firestore reads/writes (or real-time `onSnapshot` listeners for live sync).
   - Add Firebase SDK (via CDN or npm + bundler — decide based on whether this becomes a build-based project or stays a single HTML file).
   - Decide on auth (even simple shared-password or Firebase Auth) since this will be a real multi-user app, not a sandboxed artifact.
2. **Set up Firebase Hosting config** (`firebase.json`, `.firebaserc`) to deploy the static site.
3. User already has the Firebase CLI installed and logged in, plus a Firebase project (or will create one) — just needs `firebase init` (Hosting + Firestore) run in this directory and `firebase deploy`.

## Why this moved to Claude Code
This next phase (Firestore integration, auth, hosting config, deploy) is a multi-step engineering task better suited to an iterative CLI workflow than the Cowork artifact sandbox (which has no real backend and can't run `firebase` commands with the user's actual credentials).
