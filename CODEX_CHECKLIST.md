# CODEX_CHECKLIST.md

## Before coding

* Read `AGENTS.md`.
* Read `DESIGN.md`.
* Read `UX_FLOWS.md`.
* Identify whether the task touches UI, domain logic, data persistence, or Firebase rules.
* Avoid touching domain/data/rules unless required.

## During coding

* Keep changes small and focused.
* Prefer helpers for trend semantics.
* Do not hardcode green/red based only on plus/minus.
* Preserve Slovak copy meaning.
* Keep mobile-first layout.
* Keep inputs accessible.
* Keep buttons at least 44px tall.

## Before final response

* Run `pnpm verify` (covers lint + test + build).
* Run `pnpm test:e2e` if a user-facing flow changed.
* Run `pnpm test:rules` if Firebase/data/rules changed.
* Report commands exactly as run.
* Report changed files.
* Report risks.
* Say whether it is safe to commit/deploy.
