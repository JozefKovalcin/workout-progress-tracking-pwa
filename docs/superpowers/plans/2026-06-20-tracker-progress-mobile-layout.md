# Tracker Progress, Mobile Login and Widescreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make daily and training entries reliable, record two working sets per exercise, add selectable progress charts, fix mobile Google login, and improve widescreen layout.

**Architecture:** Preserve the current React/Firebase PWA and Firestore collections. Extend `TopSet` with a backward-compatible `sets` array, centralize workout performance normalization and chart-series derivation in domain modules, keep authentication behind `firebaseAuth.ts`, and update the existing screens with focused reusable components.

**Tech Stack:** React 19, TypeScript, Firebase Auth/Firestore/Hosting, Vitest, Testing Library, SVG, Vite PWA, Playwright with installed Chrome.

---

### Task 1: Daily-entry regression coverage

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/data/trackerData.test.ts`
- Modify: `src/data/trackerData.ts`

- [ ] Add an App test that fills weight, waist, calories, sleep, readiness and training quality, submits, and asserts the complete `DailyEntry` passed to `saveDailyEntry`.
- [ ] Add serialization tests for every optional daily field.
- [ ] Run the focused tests and confirm the new case fails if any score is lost or serialized as `undefined`.
- [ ] Make the minimal serialization/form fix required by the failing tests.
- [ ] Re-run focused tests and commit.

### Task 2: Two-set data model and performance calculations

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/validation.ts`
- Modify: `src/domain/validation.test.ts`
- Modify: `src/domain/performance.ts`
- Modify: `src/domain/performance.test.ts`
- Modify: `src/test/fixtures.ts`

- [ ] Add failing tests for two valid working sets, an invalid second set, average workout e1RM and legacy one-set compatibility.
- [ ] Extend `TopSet` with optional `sets: WorkingSet[]`, where `WorkingSet` contains `weightKg`, `reps`, `rir`, and `estimated1RmKg`.
- [ ] Add `workoutE1Rm(topSet)` that averages normalized sets and use it throughout performance comparison, PR and decline logic.
- [ ] Validate both sets when the array exists and retain legacy validation otherwise.
- [ ] Run domain tests and commit.

### Task 3: Two-set persistence and training UI

**Files:**
- Modify: `src/data/trackerData.ts`
- Modify: `src/data/trackerData.test.ts`
- Modify: `src/data/demoData.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/styles.css`

- [ ] Add failing Firestore mapping/serialization tests for the new `sets` array and a demo-storage round trip test.
- [ ] Add failing UI tests that require two labelled series, average e1RM and save status/error feedback.
- [ ] Update Firestore mapping to accept both legacy and two-set records.
- [ ] Replace `TopSetForm` with two series rows and one note; save first-set legacy fields plus `sets`.
- [ ] Add training save loading/success/error UI.
- [ ] Run focused tests and commit.

### Task 4: Progress-series domain layer

**Files:**
- Create: `src/domain/progress.ts`
- Create: `src/domain/progress.test.ts`

- [ ] Add failing tests for 7, 30, 90 and all-data date filtering.
- [ ] Add failing tests for weight, waist, calorie and selected-exercise strength points with missing values ignored.
- [ ] Implement pure range and series helpers using strict `LocalDate` parsing and `workoutE1Rm`.
- [ ] Run focused tests and commit.

### Task 5: Full progress charts

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/styles.css`

- [ ] Add failing UI tests for the four range options, four chart areas and exercise selector.
- [ ] Replace `MiniLine` with an accessible reusable SVG chart that renders labels, points and empty states.
- [ ] Update Progress screen with responsive weight, waist and calorie cards plus selected-exercise strength chart.
- [ ] Ensure percentage summaries use the same normalized two-set performance.
- [ ] Run focused tests and commit.

### Task 6: Mobile Google sign-in

**Files:**
- Create: `src/data/firebaseAuth.test.ts`
- Modify: `src/data/firebaseAuth.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] Add a failing test proving `signInWithGoogle` always calls `signInWithPopup` and never redirect.
- [ ] Add failing tests for popup-blocked, popup-closed and generic Slovak error messages.
- [ ] Add an App test for disabled `Prihlasujem…` state.
- [ ] Implement popup-only sign-in and error mapping.
- [ ] Run focused tests and commit.

### Task 7: Widescreen and mobile layout

**Files:**
- Modify: `src/app/styles.css`
- Modify: `src/app/App.test.tsx`

- [ ] Add stable class/structure assertions for chart grids and two-set rows.
- [ ] Increase desktop content width to use available viewport up to approximately 1800 px.
- [ ] Add wide-screen grid breakpoints and preserve one-column mobile layout.
- [ ] Keep bottom navigation and form controls usable at 390 px width.
- [ ] Run UI tests and commit.

### Task 8: Full verification and deployment

**Files:**
- Modify if needed: `README.md`

- [ ] Run `vitest run --dir src`.
- [ ] Run ESLint and TypeScript build.
- [ ] Start local Vite with production Firebase config.
- [ ] Use installed Chrome at 390×844 to verify login button behavior, daily save validation and two-set form.
- [ ] Use installed Chrome at 2560×1080 to verify content width and chart grid.
- [ ] Build and deploy Firebase Hosting.
- [ ] Verify the public site serves the new hashed assets and run a non-cloud demo smoke test against the public URL.

