# Tracker progress, mobile login and widescreen design

## Goal

Improve the existing personal lean-bulk PWA without replacing its architecture:

- make daily scores reliably writable,
- record two working sets per main exercise,
- add useful progress charts,
- fix Google sign-in on mobile,
- use widescreen desktop space better.

## Daily entry

The daily form continues to save weight, waist, calories, sleep, readiness and training quality as one `DailyEntry`.

Scores remain integer values from 1 to 10. The app handles validation itself and displays the exact invalid field. Saving displays `Ukladám…`, then either `Deň uložený.` or a visible error. Firestore writes omit optional `undefined` fields.

## Two-set exercise logging

Each main exercise workout contains two working sets. Every set stores:

- weight in kilograms,
- repetitions,
- RIR,
- calculated Epley e1RM.

The workout performance value is the arithmetic mean of both set e1RMs. Progress compares this mean with the mean from the previous workout of the same exercise.

Backward compatibility is required. Existing one-set records remain readable and use their single e1RM as the workout value. New records store a `sets` array while retaining the existing first-set fields so existing data readers do not break abruptly.

The training form displays two clearly labelled set rows and one shared optional note. It shows saving, saved and error states.

## Progress analytics

The Progress screen has a period selector:

- 7 days,
- 30 days,
- 90 days,
- all data.

It displays:

- body-weight chart,
- waist chart,
- recorded-calories chart,
- strength chart for a selected main exercise.

Strength chart points use the average e1RM of the two recorded sets. The current percentage summary and exercise list use the same workout-level performance value so charts and summaries cannot disagree.

Charts are lightweight SVG components implemented inside the application. They show dates and values, tolerate missing days and display a clear empty state when fewer than two measurements exist.

## Authentication

Google authentication uses `signInWithPopup` on mobile and desktop. This avoids the redirect loop caused by cross-origin redirect storage on the `web.app` domain.

The login button is disabled while authentication is running and reads `Prihlasujem…`. Popup-blocked, cancelled and other Firebase errors are converted into concise Slovak messages.

The existing auth-state subscription remains the source of truth for the signed-in user.

## Responsive layout

Mobile remains a single-column interface with fixed bottom navigation.

Desktop retains the 230 px sidebar. The content area uses the available viewport width with an upper bound around 1800 px instead of the current 1130 px restriction. Cards and charts expand into responsive multi-column grids:

- ordinary desktop: 2 columns where appropriate,
- wide desktop: 3–4 columns for dashboard metrics and charts,
- mobile: 1 column.

Forms keep sensible field widths and do not stretch each input across an excessive distance.

## Data and migration safety

No destructive migration runs against Firestore. Readers normalize both legacy one-set documents and new two-set documents. Writers strip `undefined` recursively enough for all optional top-level and set fields written by the app.

Existing daily entries, targets, exercises, training schedules and recommendations remain unchanged.

## Testing and verification

Automated tests cover:

- all daily score fields saving successfully,
- clear validation for invalid scores,
- serialization without `undefined`,
- two-set validation and average e1RM,
- backward-compatible one-set performance,
- 7/30/90/all analytics ranges,
- strength series by selected exercise,
- popup-only Google sign-in and readable errors,
- login loading state,
- training save loading/success/error states.

Final verification includes:

- full Vitest suite,
- ESLint,
- TypeScript check,
- production PWA build,
- local Chrome smoke test at mobile size,
- local Chrome smoke test at widescreen size,
- deployed Firebase Hosting smoke test.

