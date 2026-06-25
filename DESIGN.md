# DESIGN.md

Visual system reference for Lean Bulk Tracker. This document describes *how
things should look*; `UX_FLOWS.md` describes *how screens should behave*.

## Typography scale

Use one consistent scale across stat cards, KPI cards, chart labels, workout
cards, and form values — do not introduce ad-hoc font sizes per component.

| Token | Use for |
|---|---|
| `metric-value` | the primary number on a card (weight, calories, e1RM...). Largest, boldest, highest-contrast text on the screen. |
| `metric-label` | the name of the metric above/below the value (e.g. "Telesná hmotnosť"). Smaller, medium contrast. |
| `metric-detail` | secondary supporting text (date, unit, sample size, "n=12 dní"). Smallest, but still readable — never low-contrast grey-on-grey. |

## Trend & status colors

Colors are semantic, not sign-based. Always derive them through a trend
classification helper (`src/domain/trends.ts`), never by checking
`value > 0` directly in a component.

* `trend-positive` — change is good in context (e.g. strength up, adherence improved).
* `trend-negative` — change is bad/risky in context (e.g. waist up too fast, weight dropping during a bulk).
* `trend-neutral` — no clear meaning yet, or insufficient data.
* `status-good` / `status-warning` / `status-danger` — same semantics, used for
  static states (badges, save confirmations) rather than directional trends.

Rules:

* Never rely on color alone — pair color with an icon, label, or text (e.g.
  "zlepšenie" badge, not just a green dot).
* All trend/status colors must have sufficient contrast in both light and
  dark mode. Use existing CSS variables; do not introduce new hardcoded hex
  values.

## Badges / pills

Use a single shared badge component for short status labels:

* "zlepšenie" → `status-good`
* "pokles" → `status-danger`
* "bez zmeny" → `status-neutral`
* "málo dát" → `trend-neutral`

Badges should be visually distinct from buttons (no border/shape ambiguity)
and never be the only signal for an important state — pair with the metric
value and a short text explanation where space allows.

## NumberStepper component

Reusable input for fast numeric entry. Used at minimum for: body weight,
waist, calories, sleep/readiness/training quality scores, exercise weight,
reps, RIR.

Core props:

* `name: string` — keeps the input compatible with native `FormData`.
* `label: string`
* `step: number`
* `min?: number`
* `max?: number`
* `precision?: number` — decimal places to round/display to
* `suffix?: string` — unit shown next to the value (e.g. "kg", "cm", "kcal")
* `value?: string | number` / `defaultValue?: string | number`
* `onRawChange?: (value: string) => void` for controlled forms that must allow
  blank/manual typing.
* `onValueChange?: (value: number) => void` when a parsed numeric value is useful.

Suggested steps:

| Field | Step |
|---|---|
| body weight | 0.1 kg |
| waist | 0.1 cm |
| calories | 25 or 50 kcal |
| sleep / readiness / training quality | 1 |
| exercise weight | 2.5 kg |
| reps | 1 |
| RIR | 0.5 or 1 (match current validation) |

Requirements:

* Increment/decrement buttons at least 44px tall (touch target).
* Manual typing and keyboard input (arrow keys) must keep working.
* Must not interfere with native form submission (Enter key, form `onSubmit`).
* Supports both integer and decimal values via `precision`.

## Charts

* Labels on axes/legends must be readable at mobile width — no overlapping
  or truncated text.
* Selected data point must show its exact value, not just be highlighted.
* Empty/insufficient-data states must explain *what* is missing (e.g. "Potrebujeme aspoň 3 záznamy"), not just show a blank chart.

## General constraints

* Mobile-first; do not design for desktop first and adapt down.
* Do not add a UI framework or new dependencies for styling — use existing
  CSS variables and utility classes.
* Preserve light/dark mode parity for every new class introduced here.
