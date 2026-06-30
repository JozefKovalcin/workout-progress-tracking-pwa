# Lean Bulk Tracker PWA

[![CI](https://github.com/JozefKovalcin/workout-progress-tracking-pwa/actions/workflows/ci.yml/badge.svg)](https://github.com/JozefKovalcin/workout-progress-tracking-pwa/actions/workflows/ci.yml)

Lean Bulk Tracker is a compact personal PWA for tracking lean-bulk progress, top sets, bodyweight trends, and conservative 14-day calorie recommendations. It is intentionally a smaller portfolio project: focused, testable, and useful without requiring a paid backend or API key.

## Project Overview

The app helps a lifter record daily bodyweight, training performance, and progress notes. It can run in a local demo mode from browser storage, or in Firebase mode with Google Authentication and Firestore. Recommendation logic is conservative: missing, weak, malformed, or inconsistent data never produces an actionable calorie change, and recommendations are never applied automatically.

## Features

- Daily bodyweight and lean-bulk progress tracking.
- Top-set logging for strength progress.
- Conservative 14-day calorie recommendation flow.
- Local demo mode backed by `localStorage`.
- Optional Firebase mode with Google Authentication, Firestore, offline persistence, and hosting.
- Automated tests for core data and recommendation behavior.
- PWA-oriented frontend built for a small personal workflow.

## Tech Stack

- Frontend: React, TypeScript, Vite
- PWA: Vite PWA tooling and generated assets
- Data: local demo storage or Firebase Authentication and Firestore
- Testing: Vitest, Testing Library, Playwright, Firebase rules tests
- Tooling: pnpm, ESLint, GitHub Actions

## Local Demo Mode

Copy `.env.example` to `.env`. The default `VITE_USE_FIREBASE_EMULATORS=true` enables local demo mode, which runs immediately from one `localStorage` record and does not require Firebase emulators or network access.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Useful commands:

```bash
pnpm lint
pnpm test
pnpm build
```

The committed `.env.e2e` file contains only fake/demo Firebase values for local end-to-end tests.

## Cloud / Firebase Mode

1. Create a Firebase project.
2. Enable Google Authentication and Firestore.
3. Copy the Firebase web app values into `.env`.
4. Set `VITE_USE_FIREBASE_EMULATORS=false`.
5. Deploy Firestore rules and hosting:

```bash
pnpm exec firebase deploy --only firestore:rules
pnpm build
pnpm exec firebase deploy --only hosting
```

All cloud data is stored below `users/{uid}` and Firestore persistence queues offline writes.

## Testing

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:rules
pnpm test:e2e
```

GitHub Actions runs the lightweight portfolio CI path: install, lint, unit tests, and build. Firebase rules and Playwright tests are available locally when the required emulators/browsers are installed.

## Screenshots

Screenshot placeholders are tracked in [docs/screenshots/](docs/screenshots/). Recommended screenshots:

- dashboard / current bulk status,
- daily entry form,
- progress charts,
- recommendation state,
- mobile PWA view.

## Security Notes and Limitations

This is a portfolio project, not a medical, nutrition, or production health platform. It should not be used as professional nutrition advice.

Do not commit real Firebase project credentials beyond public web-app config intended for client use. Keep private service account keys, production `.env` files, Firebase debug logs, database exports, and personal training data out of Git. If a real secret is ever committed, rotate it with the relevant provider because deleting it from the current tree does not remove it from Git history.

For reporting security concerns, see [SECURITY.md](SECURITY.md).

## What This Demonstrates for Employers

- Building a focused React/TypeScript PWA with clear local and cloud modes.
- Designing conservative data validation around user-facing recommendations.
- Working with Firebase Authentication, Firestore, security rules, and hosting.
- Writing automated tests around business logic and persistence behavior.
- Keeping a small project documented, reproducible, and safe to scan.
