# Lean Bulk Tracker

Compact personal PWA for daily lean-bulk tracking, top sets, progress, and conservative 14-day calorie recommendations.

## Run locally

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

Copy `.env.example` to `.env`. Its default `VITE_USE_FIREBASE_EMULATORS=true` enables **Lokálny demo režim**, which runs immediately from one `localStorage` record and does not require Firebase emulators or network access.

## Cloud mode

1. Create a Firebase project and enable Google Authentication and Firestore.
2. Copy the Firebase web app values into `.env`.
3. Set `VITE_USE_FIREBASE_EMULATORS=false`.
4. Deploy:

```bash
pnpm exec firebase deploy --only firestore:rules
pnpm build
pnpm exec firebase deploy --only hosting
```

All cloud data is stored below `users/{uid}` and Firestore persistence queues offline writes.

Safety rule: missing, weak, malformed, or inconsistent data never produces an actionable calorie change. Recommendations are never applied automatically.
