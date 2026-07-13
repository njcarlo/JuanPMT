# JuanPMT — notes

> **For current architecture, data model, auth, CI/CD, and open tasks, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).**  
> This file is kept for historical context and may be outdated.

## History
Started as a single-file dashboard (`juanpmt.html`) with `localStorage` only. The live app now lives under `public/`, syncs via Firestore (`pmt/main`), uses Firebase Auth (email/password), and deploys with Firebase Hosting + GitHub Actions.
