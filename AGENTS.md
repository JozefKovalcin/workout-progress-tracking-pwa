# AGENTS.md

## Project

Lean Bulk Tracker is a mobile-first React/TypeScript/Firebase PWA for lean-bulk tracking.

It tracks:

* daily body data,
* calories/macros,
* training top sets,
* strength progress,
* 14-day conservative calorie recommendations.

See `DESIGN.md` for the visual system and `UX_FLOWS.md` for interaction flows.
Before coding or finishing a task, follow `CODEX_CHECKLIST.md`.

## Stack

* Vite
* React
* TypeScript
* Firebase Auth
* Firestore
* pnpm
* Vitest
* Playwright

## Commands

Use pnpm.

* `pnpm lint`
* `pnpm test`
* `pnpm build`
* `pnpm test:e2e`
* `pnpm test:rules`
* `pnpm verify` — runs lint + test + build in one step. Run this as the default
  validation command. Run `pnpm test:e2e` additionally only if a user-facing
  flow changed, and `pnpm test:rules` additionally only if Firestore
  rules/paths or data shape changed.

## High-risk areas

Do not casually modify:

* `src/domain`
* recommendation logic,
* validation logic,
* Firestore rules,
* Firestore paths,
* import/export schema,
* demo/cloud data behavior.

Changes to these areas require tests and explanation.

## UI rules

* Mobile-first.
* Keep touch targets at least 44px tall.
* Important numbers must be large and readable.
* Trend colors must be semantic.
* Do not rely on color alone.
* Preserve light/dark mode.
* Do not add a UI framework.
* Do not add dependencies unless necessary.

## Trend semantics

Green means good in context.
Red means bad/risky in context.
Amber means warning.
Neutral means no clear meaning or insufficient data.

Never classify a trend only by plus/minus. Always go through a helper
function (see `DESIGN.md`) rather than hardcoding a color from a sign.

Examples:

* strength increase = good,
* waist increase = warning/bad,
* weight increase during lean bulk can be good only if moderate,
* weight gain too fast = warning/bad,
* missing data = neutral.

Numeric thresholds (e.g. what counts as "moderate" vs "too fast" weekly
weight gain) live in `src/domain` as named constants. This document
intentionally does not duplicate the numbers — read the source so the docs
can't drift out of sync with the code.

## Final answer requirements

Every Codex final answer should include:

* summary,
* changed files,
* tests run,
* pass/fail status,
* risks,
* whether it is safe to commit,
* whether it is safe to deploy.
