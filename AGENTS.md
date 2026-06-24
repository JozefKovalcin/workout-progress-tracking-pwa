# AGENTS.md

## Project

Lean Bulk Tracker is a compact personal PWA for daily lean-bulk tracking, top sets, progress, and conservative 14-day calorie recommendations.

## Stack

* Vite
* React
* TypeScript
* Firebase Auth / Firestore / Hosting
* Vitest
* Playwright
* Firestore rules tests
* pnpm

## Important commands

Use pnpm.

* Install: `pnpm install`
* Dev server: `pnpm dev`
* Lint: `pnpm lint`
* Unit tests: `pnpm test`
* Build: `pnpm build`
* Firestore rules tests: `pnpm test:rules`
* E2E tests: `pnpm test:e2e`
* Full verification: `pnpm verify`

## Architecture

* `src/domain` contains core business and safety logic. Treat it as high-risk.
* `src/data` contains demo/local and Firebase persistence logic.
* `src/app` contains UI, screens, and interaction flows.
* `firestore.rules` and `tests/rules` protect cloud data access.

## Safety rules

* Never weaken validation.
* Never make calorie recommendations auto-apply.
* Missing, weak, malformed, or inconsistent data must never produce an actionable calorie change.
* Do not change Firestore document paths or security rules unless explicitly required and covered by tests.
* Preserve demo/local mode.
* Preserve Slovak UI copy unless the task asks for copy changes.

## UI rules

* Mobile-first.
* Keep inputs and buttons at least 44px tall.
* Preserve light/dark mode.
* Prefer existing CSS variables.
* Do not add a new UI framework.
* Use existing dependencies before adding new ones.
* Ask before adding production dependencies.
* Keep fitness-dashboard style clean, readable, and fast.

## Testing expectations

For UI-only changes, run at minimum:

* `pnpm lint`
* `pnpm test`
* `pnpm build`

For persistence, auth, Firestore, or rules changes, also run:

* `pnpm test:rules`

For user-flow changes, also run:

* `pnpm test:e2e`

If a command cannot run in the current environment, explain why and still run the closest relevant checks.

## Done definition

A task is done only when:

* TypeScript passes.
* Relevant tests pass or failures are clearly explained.
* The app behavior is preserved unless intentionally changed.
* The final response lists changed files, validation commands, and follow-up risks.
