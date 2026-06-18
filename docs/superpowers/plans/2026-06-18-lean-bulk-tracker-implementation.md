# Lean Bulk Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vytvoriť mobile-first cloudovú PWA pre denný lean-bulk tracking, tréningové top sety, transparentné trendy a konzervatívne návrhy úprav kalórií.

**Architecture:** React SPA bude mať čistú doménovú vrstvu pre výpočty a rozhodovanie, repository rozhranie pre dáta a Firebase adaptér pre Google Auth, Firestore a offline synchronizáciu. Všetky odporúčania sa vypočítajú deterministicky na klientovi zo zdrojových záznamov; UI nikdy nezmení cieľ bez explicitného potvrdenia používateľa.

**Tech Stack:** React + TypeScript + Vite, React Router, Firebase Authentication/Firestore/Hosting, `vite-plugin-pwa`, date-fns, Lucide icons, Vitest + Testing Library, Firebase Emulator Suite, Playwright.

---

## Locked file map

- `src/domain/` — typy, predvolené dáta a čisté výpočty bez Reactu/Firebase.
- `src/data/` — repository kontrakt, Firebase inicializácia, auth, Firestore mapovanie a stav synchronizácie.
- `src/app/` — providers, routing, responzívny shell a globálna téma.
- `src/features/today/` — dnešný formulár, kalibračný stav a kompaktný dashboard.
- `src/features/training/` — dnešné cviky a zápis top setov.
- `src/features/progress/` — trendy váhy, pásu, kalórií a výkonnostný merač.
- `src/features/history/` — kalendár/zoznam a spätná editácia.
- `src/features/settings/` — profil, cviky, tréningový rozvrh, prahy a export.
- `src/features/recommendations/` — vysvetlenie návrhu, prijatie/zamietnutie a história cieľov.
- `src/components/` — malé znovupoužiteľné UI prvky a SVG grafy.
- `tests/rules/` — bezpečnostné testy Firestore pravidiel.
- `e2e/` — kritické mobilné a desktopové používateľské scenáre.

## Task 1: Bootstrap projektu a testovacieho prostredia

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `vitest.setup.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Test: `src/app/App.test.tsx`
- Create: `src/app/styles.css`
- Create: `public/logo.svg`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Inicializovať balíky**

Run:

```powershell
pnpm init
pnpm add react react-dom react-router firebase date-fns lucide-react
pnpm add -D typescript vite @vitejs/plugin-react vite-plugin-pwa @vite-pwa/assets-generator vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @types/react @types/react-dom eslint typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh @playwright/test firebase-tools @firebase/rules-unit-testing
```

Expected: `package.json` a `pnpm-lock.yaml` existujú, inštalácia skončí bez chyby.

- [ ] **Step 2: Nastaviť skripty**

Run `pnpm pkg set type=module`, then set `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:rules": "firebase emulators:exec --project demo-lean-bulk --only firestore \"vitest run tests/rules\"",
    "test:e2e": "playwright test",
    "dev:e2e": "vite --mode e2e --host 127.0.0.1",
    "lint": "eslint .",
    "icons": "pwa-assets-generator --preset minimal-2023 public/logo.svg",
    "verify": "pnpm lint && pnpm test && pnpm build && pnpm test:rules && pnpm test:e2e"
  }
}
```

- [ ] **Step 3: Vytvoriť TypeScript, HTML a ESLint konfiguráciu**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

```html
<!-- index.html -->
<!doctype html>
<html lang="sk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#121816" />
    <title>Lean Bulk Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```js
// eslint.config.js
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
    }
  }
);
```

- [ ] **Step 4: Vytvoriť Vite/Vitest konfiguráciu**

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg"],
      manifest: {
        name: "Lean Bulk Tracker",
        short_name: "Bulk Tracker",
        description: "Osobný lean-bulk dashboard a tréningový log",
        theme_color: "#121816",
        background_color: "#f4f7f5",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    css: true
  }
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Vytvoriť environment a ignore súbory**

```dotenv
# .env.example
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-lean-bulk.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-lean-bulk
VITE_FIREBASE_APP_ID=demo-app-id
VITE_USE_FIREBASE_EMULATORS=true
```

```gitignore
# .gitignore
node_modules/
dist/
.env.local
.env.production.local
.firebaserc
playwright-report/
test-results/
.firebase/
firebase-debug.log
firestore-debug.log
```

- [ ] **Step 6: Vytvoriť zdroj PWA ikony**

```svg
<!-- public/logo.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#121816"/>
  <path d="M128 352V160h64v128h128V160h64v192H128Z" fill="#55d292"/>
  <circle cx="256" cy="256" r="40" fill="#eef5f0"/>
</svg>
```

- [ ] **Step 7: Vytvoriť minimálny render test**

```tsx
// src/app/App.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the product name", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Lean Bulk Tracker" })).toBeVisible();
  });
});
```

- [ ] **Step 8: Overiť červený test**

Run: `pnpm test -- src/app/App.test.tsx`

Expected: FAIL, pretože `App` ešte neposkytuje požadovaný nadpis.

- [ ] **Step 9: Doplniť minimálnu aplikáciu**

```tsx
// src/app/App.tsx
export function App() {
  return <h1>Lean Bulk Tracker</h1>;
}
```

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./app/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 10: Overiť bootstrap**

Run: `pnpm test -- src/app/App.test.tsx && pnpm build`

Expected: test PASS a Vite build vytvorí `dist/`.

- [ ] **Step 11: Commit**

```powershell
git add package.json pnpm-lock.yaml index.html tsconfig.json vite.config.ts eslint.config.js vitest.setup.ts src public/logo.svg .gitignore .env.example
git commit -m "chore: bootstrap lean bulk tracker app"
```

## Task 2: Doménové typy, dátumy a predvolené dáta

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/date.ts`
- Create: `src/domain/defaults.ts`
- Create: `src/test/fixtures.ts`
- Test: `src/domain/defaults.test.ts`

- [ ] **Step 1: Napísať test predvoleného profilu a rozvrhu**

```ts
// src/domain/defaults.test.ts
import { describe, expect, it } from "vitest";
import { CALIBRATION_PROFILE, DEFAULT_EXERCISES, DEFAULT_TRAINING_DAYS } from "./defaults";

describe("default tracker data", () => {
  it("starts the stabilization block on 2026-06-19", () => {
    expect(CALIBRATION_PROFILE).toMatchObject({
      startDate: "2026-06-19",
      startingWeightKg: 81.4,
      trainingCalories: 2900,
      restCalories: 2700,
      proteinGrams: 180,
      fatGrams: 50
    });
  });

  it("uses five enabled training days", () => {
    expect(DEFAULT_TRAINING_DAYS.filter((day) => day.enabled).map((day) => day.weekday))
      .toEqual([1, 3, 5, 6, 7]);
  });

  it("normalizes Flat Bench Press to 6-10 reps", () => {
    expect(DEFAULT_EXERCISES.find((exercise) => exercise.id === "flat-bench-press"))
      .toMatchObject({ repMin: 6, repMax: 10, isMain: true });
  });
});
```

- [ ] **Step 2: Overiť červený test**

Run: `pnpm test -- src/domain/defaults.test.ts`

Expected: FAIL s chýbajúcimi modulmi.

- [ ] **Step 3: Definovať stabilné verejné typy**

```ts
// src/domain/types.ts
export type LocalDate = `${number}-${number}-${number}`;
export type DayType = "training" | "rest";
export type RecommendationStatus = "pending" | "accepted" | "rejected" | "insufficient" | "hold";
export type Confidence = "low" | "medium" | "high";

export interface TrackerProfile {
  startDate: LocalDate;
  startingWeightKg: number;
  trainingCalories: number;
  restCalories: number;
  proteinGrams: number;
  fatGrams: number;
  evaluationDays: 14;
  targetGainMinPct: number;
  targetGainMaxPct: number;
}

export interface DailyEntry {
  date: LocalDate;
  dayTypeOverride?: DayType;
  weightKg?: number;
  waistCm?: number;
  calories?: number;
  sleepScore?: number;
  readinessScore?: number;
  trainingQualityScore?: number;
  updatedAtMs: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  repMin: number;
  repMax: number;
  isMain: boolean;
  archivedAtMs?: number;
}

export interface TrainingDayPlan {
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  label: string;
  enabled: boolean;
  exerciseIds: string[];
}

export interface TopSet {
  id: string;
  date: LocalDate;
  exerciseId: string;
  weightKg: number;
  reps: number;
  rir: number;
  note?: string;
  estimated1RmKg: number;
  updatedAtMs: number;
}

export interface MacroTargets {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface TargetPeriod {
  id: string;
  effectiveDate: LocalDate;
  training: MacroTargets;
  rest: MacroTargets;
  reason: string;
  createdAtMs: number;
}
```

- [ ] **Step 4: Implementovať lokálne dátumy bez UTC posunu**

```ts
// src/domain/date.ts
import { format, parseISO } from "date-fns";
import type { LocalDate } from "./types";

export function toLocalDate(date: Date): LocalDate {
  return format(date, "yyyy-MM-dd") as LocalDate;
}

export function fromLocalDate(value: LocalDate): Date {
  return parseISO(value);
}

export function weekdayIso(value: LocalDate): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = fromLocalDate(value).getDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}
```

- [ ] **Step 5: Seednúť profil, cviky a upraviteľný rozvrh**

Implement `src/domain/defaults.ts` with:

```ts
import type { Exercise, TrackerProfile, TrainingDayPlan } from "./types";

export const CALIBRATION_PROFILE: TrackerProfile = {
  startDate: "2026-06-19",
  startingWeightKg: 81.4,
  trainingCalories: 2900,
  restCalories: 2700,
  proteinGrams: 180,
  fatGrams: 50,
  evaluationDays: 14,
  targetGainMinPct: 0.2,
  targetGainMaxPct: 0.35
};

const mainExerciseRows: Array<[string, string, string, number, number]> = [
  ["incline-db-press", "Incline DB press", "Hrudník", 6, 10],
  ["machine-chest-press", "Machine chest press", "Hrudník", 8, 12],
  ["flat-bench-press", "Flat Bench Press", "Hrudník", 6, 10],
  ["chest-supported-row", "Chest-supported row", "Chrbát", 8, 12],
  ["lat-pulldown", "Lat pulldown", "Chrbát", 8, 12],
  ["chin-row", "Chin row", "Ramená", 10, 15],
  ["cable-lateral-raise", "Cable lateral raise", "Ramená", 8, 15],
  ["hack-squat-leg-press", "Hack squat / leg press", "Quads", 6, 10],
  ["seated-lying-leg-curl", "Seated/lying leg curl", "Hamstringy", 8, 15],
  ["rdl", "RDL", "Hamstringy", 6, 10],
  ["hip-thrust", "Hip thrust", "Glutes", 8, 12],
  ["walking-lunge", "Walking lunge", "Glutes", 10, 15],
  ["standing-calf-raise", "Standing calf raise", "Lýtka", 8, 15],
  ["cable-crunch", "Cable crunch", "Brucho", 10, 20],
  ["dragon-flag", "Dragon Flag", "Brucho", 8, 15]
];

export const DEFAULT_EXERCISES: Exercise[] = mainExerciseRows.map(
  ([id, name, muscleGroup, repMin, repMax]) => ({
  id,
  name,
  muscleGroup,
  repMin,
  repMax,
  isMain: true
}));

export const DEFAULT_TRAINING_DAYS: TrainingDayPlan[] = [
  { weekday: 1, label: "Lower / quads", enabled: true, exerciseIds: ["hack-squat-leg-press", "seated-lying-leg-curl", "standing-calf-raise", "cable-crunch"] },
  { weekday: 2, label: "Voľno", enabled: false, exerciseIds: [] },
  { weekday: 3, label: "Hrudník priority / pull", enabled: true, exerciseIds: ["incline-db-press", "chest-supported-row"] },
  { weekday: 4, label: "Voľno", enabled: false, exerciseIds: [] },
  { weekday: 5, label: "Pump / objem", enabled: true, exerciseIds: ["machine-chest-press", "cable-lateral-raise", "chin-row"] },
  { weekday: 6, label: "Posterior / pull", enabled: true, exerciseIds: ["rdl", "hip-thrust", "walking-lunge", "lat-pulldown"] },
  { weekday: 7, label: "Hrudník weakpoint / brucho", enabled: true, exerciseIds: ["flat-bench-press", "dragon-flag"] }
];
```

- [ ] **Step 6: Pridať spoločné test fixtures**

```ts
// src/test/fixtures.ts
import type { DailyEntry, Exercise, TopSet } from "../domain/types";

export const makeDailyEntry = (overrides: Partial<DailyEntry> = {}): DailyEntry => ({
  date: "2026-06-19",
  updatedAtMs: 1,
  ...overrides
});

export const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: "rdl",
  name: "RDL",
  muscleGroup: "Hamstringy",
  repMin: 6,
  repMax: 10,
  isMain: true,
  ...overrides
});

export const makeTopSet = (overrides: Partial<TopSet> = {}): TopSet => ({
  id: "2026-06-19__rdl",
  date: "2026-06-19",
  exerciseId: "rdl",
  weightKg: 100,
  reps: 8,
  rir: 1,
  estimated1RmKg: 126.6667,
  updatedAtMs: 1,
  ...overrides
});
```

- [ ] **Step 7: Overiť a commitnúť**

Run: `pnpm test -- src/domain/defaults.test.ts`

Expected: PASS.

```powershell
git add src/domain src/test
git commit -m "feat: add tracker domain model and seed data"
```

## Task 3: Makrá, typ dňa a validácia denných vstupov

**Files:**
- Create: `src/domain/macros.ts`
- Create: `src/domain/validation.ts`
- Test: `src/domain/macros.test.ts`
- Test: `src/domain/validation.test.ts`

- [ ] **Step 1: Napísať výpočtové testy**

```ts
// src/domain/macros.test.ts
import { describe, expect, it } from "vitest";
import { calculateMacros, resolveDayType } from "./macros";
import { DEFAULT_TRAINING_DAYS } from "./defaults";

describe("macro targets", () => {
  it("calculates exact carbs from calories", () => {
    expect(calculateMacros(2900, 180, 50)).toEqual({
      calories: 2900,
      proteinGrams: 180,
      carbsGrams: 432.5,
      fatGrams: 50
    });
  });

  it("uses schedule unless the day is overridden", () => {
    expect(resolveDayType("2026-06-19", DEFAULT_TRAINING_DAYS)).toBe("training");
    expect(resolveDayType("2026-06-19", DEFAULT_TRAINING_DAYS, "rest")).toBe("rest");
  });
});
```

```ts
// src/domain/validation.test.ts
import { describe, expect, it } from "vitest";
import { validateDailyEntry } from "./validation";

describe("daily entry validation", () => {
  it("rejects impossible values and scores outside 1-10", () => {
    expect(validateDailyEntry({
      date: "2026-06-19",
      weightKg: 0,
      waistCm: 400,
      calories: -1,
      sleepScore: 11,
      updatedAtMs: 1
    })).toEqual([
      "Váha musí byť medzi 30 a 300 kg.",
      "Pás musí byť medzi 40 a 250 cm.",
      "Kalórie musia byť medzi 0 a 10 000.",
      "Spánok musí byť na škále 1–10."
    ]);
  });
});
```

- [ ] **Step 2: Overiť červené testy**

Run: `pnpm test -- src/domain/macros.test.ts src/domain/validation.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementovať čisté funkcie**

```ts
// src/domain/macros.ts
import { weekdayIso } from "./date";
import type { DayType, LocalDate, MacroTargets, TrainingDayPlan } from "./types";

export function calculateMacros(
  calories: number,
  proteinGrams: number,
  fatGrams: number
): MacroTargets {
  return {
    calories,
    proteinGrams,
    fatGrams,
    carbsGrams: (calories - proteinGrams * 4 - fatGrams * 9) / 4
  };
}

export function resolveDayType(
  date: LocalDate,
  plan: TrainingDayPlan[],
  override?: DayType
): DayType {
  if (override) return override;
  return plan.find((day) => day.weekday === weekdayIso(date))?.enabled ? "training" : "rest";
}
```

```ts
// src/domain/validation.ts
import type { DailyEntry, TopSet } from "./types";

const scoreMessage = (label: string, value?: number) =>
  value === undefined || (Number.isInteger(value) && value >= 1 && value <= 10)
    ? undefined
    : `${label} musí byť na škále 1–10.`;

export function validateDailyEntry(entry: DailyEntry): string[] {
  return [
    entry.weightKg === undefined || (entry.weightKg >= 30 && entry.weightKg <= 300)
      ? undefined : "Váha musí byť medzi 30 a 300 kg.",
    entry.waistCm === undefined || (entry.waistCm >= 40 && entry.waistCm <= 250)
      ? undefined : "Pás musí byť medzi 40 a 250 cm.",
    entry.calories === undefined || (entry.calories >= 0 && entry.calories <= 10_000)
      ? undefined : "Kalórie musia byť medzi 0 a 10 000.",
    scoreMessage("Spánok", entry.sleepScore),
    scoreMessage("Pripravenosť", entry.readinessScore),
    scoreMessage("Kvalita tréningu", entry.trainingQualityScore)
  ].filter((message): message is string => Boolean(message));
}

export function validateTopSet(set: TopSet): string[] {
  return [
    set.weightKg > 0 && set.weightKg <= 1000 ? undefined : "Váha musí byť väčšia ako 0 kg.",
    Number.isInteger(set.reps) && set.reps >= 1 && set.reps <= 100 ? undefined : "Opakovania musia byť 1–100.",
    set.rir >= 0 && set.rir <= 10 ? undefined : "RIR musí byť 0–10."
  ].filter((message): message is string => Boolean(message));
}
```

- [ ] **Step 4: Overiť a commitnúť**

Run: `pnpm test -- src/domain/macros.test.ts src/domain/validation.test.ts`

Expected: PASS.

```powershell
git add src/domain
git commit -m "feat: add macro and entry validation rules"
```

## Task 4: Výkonnostný progres, e1RM a PR logika

**Files:**
- Create: `src/domain/performance.ts`
- Test: `src/domain/performance.test.ts`

- [ ] **Step 1: Napísať testy presného správania**

```ts
// src/domain/performance.test.ts
import { describe, expect, it } from "vitest";
import { calculateE1Rm, summarizePerformance } from "./performance";
import type { TopSet } from "./types";

const set = (id: string, date: string, exerciseId: string, weightKg: number, reps: number, rir = 1): TopSet => ({
  id,
  date: date as TopSet["date"],
  exerciseId,
  weightKg,
  reps,
  rir,
  estimated1RmKg: calculateE1Rm(weightKg, reps),
  updatedAtMs: 1
});

describe("performance", () => {
  it("uses the Epley estimate", () => {
    expect(calculateE1Rm(100, 10)).toBeCloseTo(133.33, 2);
  });

  it("compares last-7-day sets with the immediately previous set", () => {
    const summary = summarizePerformance([
      set("a1", "2026-06-10", "rdl", 100, 8),
      set("a2", "2026-06-17", "rdl", 105, 8),
      set("b1", "2026-06-11", "press", 40, 10),
      set("b2", "2026-06-18", "press", 40, 11)
    ], "2026-06-18");

    expect(summary.comparableExercises).toBe(2);
    expect(summary.overallPercent).toBeGreaterThan(0);
    expect(summary.items.every((item) => item.isPr)).toBe(true);
  });

  it("excludes an exercise without a previous comparable set", () => {
    const summary = summarizePerformance([
      set("a1", "2026-06-18", "rdl", 100, 8)
    ], "2026-06-18");

    expect(summary.comparableExercises).toBe(0);
    expect(summary.overallPercent).toBeNull();
  });
});
```

- [ ] **Step 2: Overiť červený test**

Run: `pnpm test -- src/domain/performance.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementovať výpočet**

`src/domain/performance.ts` must export:

```ts
import { differenceInCalendarDays } from "date-fns";
import { fromLocalDate } from "./date";
import type { LocalDate, TopSet } from "./types";

export interface ExercisePerformance {
  exerciseId: string;
  current: TopSet;
  previous: TopSet;
  percentChange: number;
  isPr: boolean;
  reliability: "normal" | "low";
}

export interface PerformanceSummary {
  overallPercent: number | null;
  comparableExercises: number;
  items: ExercisePerformance[];
  repeatedDeclineExerciseIds: string[];
}

export const calculateE1Rm = (weightKg: number, reps: number) =>
  weightKg * (1 + reps / 30);

export function summarizePerformance(sets: TopSet[], endDate: LocalDate): PerformanceSummary {
  const grouped = new Map<string, TopSet[]>();
  for (const item of [...sets].sort((a, b) => a.date.localeCompare(b.date))) {
    grouped.set(item.exerciseId, [...(grouped.get(item.exerciseId) ?? []), item]);
  }
  const items: ExercisePerformance[] = [];

  for (const [exerciseId, exerciseSets] of grouped.entries()) {
    const currentCandidates = exerciseSets.filter((item) => {
      const age = differenceInCalendarDays(fromLocalDate(endDate), fromLocalDate(item.date));
      return age >= 0 && age <= 6;
    });
    const current = currentCandidates.at(-1);
    if (!current) continue;
    const previous = exerciseSets.filter((item) => item.date < current.date).at(-1);
    if (!previous) continue;

    const percentChange =
      ((current.estimated1RmKg - previous.estimated1RmKg) / previous.estimated1RmKg) * 100;
    const bestBefore = Math.max(
      ...exerciseSets.filter((item) => item.date < current.date).map((item) => item.estimated1RmKg)
    );

    items.push({
      exerciseId,
      current,
      previous,
      percentChange,
      isPr: current.estimated1RmKg > bestBefore * 1.005,
      reliability: Math.abs(current.rir - previous.rir) > 1.5 ? "low" : "normal"
    });
  }

  return {
    overallPercent: items.length
      ? items.reduce((sum, item) => sum + item.percentChange, 0) / items.length
      : null,
    comparableExercises: items.length,
    items,
    repeatedDeclineExerciseIds: items
      .filter(({ exerciseId, current, previous }) => {
        const beforePrevious = (grouped.get(exerciseId) ?? [])
          .filter((item) => item.date < previous.date)
          .at(-1);
        if (!beforePrevious) return false;
        const previousDelta =
          ((previous.estimated1RmKg - beforePrevious.estimated1RmKg) /
            beforePrevious.estimated1RmKg) * 100;
        const currentDelta =
          ((current.estimated1RmKg - previous.estimated1RmKg) /
            previous.estimated1RmKg) * 100;
        return previousDelta < -1 && currentDelta < -1;
      })
      .map((item) => item.exerciseId)
  };
}
```

- [ ] **Step 4: Overiť a commitnúť**

Run: `pnpm test -- src/domain/performance.test.ts`

Expected: PASS.

```powershell
git add src/domain/performance*
git commit -m "feat: calculate exercise performance trends"
```

## Task 5: Konzervatívny recommendation engine s tvrdou dátovou brzdou

**Files:**
- Create: `src/domain/recommendations.ts`
- Test: `src/domain/recommendations.test.ts`

- [ ] **Step 1: Napísať najprv bezpečnostné testy**

```ts
// src/domain/recommendations.test.ts
import { describe, expect, it } from "vitest";
import { evaluateRecommendation } from "./recommendations";

const complete = {
  validWeightsWeek1: 7,
  validWeightsWeek2: 7,
  calorieDays: 14,
  waistDays: 10,
  calorieMeanAbsoluteErrorPct: 4,
  weeklyWeightChangePct: 0,
  weeklyWeightChangeKg: 0,
  waistChangeCm: 0,
  performancePercent: 1,
  repeatedExerciseDecline: false,
  averageSleep: 7,
  averageReadiness: 7,
  averageTrainingQuality: 7
};

describe("recommendation guardrails", () => {
  it("never proposes calories when data is incomplete", () => {
    const result = evaluateRecommendation({ ...complete, calorieDays: 8 });
    expect(result.status).toBe("insufficient");
    expect(result.calorieDeltaTraining).toBe(0);
    expect(result.calorieDeltaRest).toBe(0);
    expect(result.missingData).toContain("Potrebných je aspoň 10 dní so zapísanými kalóriami.");
  });

  it("never proposes calories when adherence is weak", () => {
    const result = evaluateRecommendation({ ...complete, calorieMeanAbsoluteErrorPct: 16 });
    expect(result.status).toBe("insufficient");
    expect(result.reasonCodes).toContain("LOW_CALORIE_ADHERENCE");
  });

  it("proposes training-day calories after stable weight, waist and performance", () => {
    const result = evaluateRecommendation(complete);
    expect(result).toMatchObject({
      status: "pending",
      action: "increase_training",
      calorieDeltaTraining: 100,
      calorieDeltaRest: 0
    });
  });

  it("reduces calories only when fast gain and waist growth occur together", () => {
    expect(evaluateRecommendation({
      ...complete,
      weeklyWeightChangePct: 0.6,
      waistChangeCm: 0.6
    }).action).toBe("decrease_all");

    expect(evaluateRecommendation({
      ...complete,
      weeklyWeightChangePct: 0.6,
      waistChangeCm: 0.1
    }).status).toBe("hold");
  });

  it("adds calories for rapid loss only with declining performance", () => {
    expect(evaluateRecommendation({
      ...complete,
      weeklyWeightChangePct: -0.6,
      weeklyWeightChangeKg: -0.49,
      performancePercent: -2
    }).action).toBe("increase_all");
  });
});
```

- [ ] **Step 2: Overiť červené testy**

Run: `pnpm test -- src/domain/recommendations.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementovať explicitný vstup a výsledok**

```ts
// src/domain/recommendations.ts
import type { Confidence, RecommendationStatus } from "./types";

export interface RecommendationMetrics {
  validWeightsWeek1: number;
  validWeightsWeek2: number;
  calorieDays: number;
  waistDays: number;
  calorieMeanAbsoluteErrorPct: number;
  weeklyWeightChangePct: number;
  weeklyWeightChangeKg: number;
  waistChangeCm: number;
  performancePercent: number | null;
  repeatedExerciseDecline: boolean;
  averageSleep: number | null;
  averageReadiness: number | null;
  averageTrainingQuality: number | null;
}

export interface RecommendationResult {
  status: RecommendationStatus;
  action: "increase_training" | "increase_all" | "decrease_all" | "none";
  calorieDeltaTraining: number;
  calorieDeltaRest: number;
  confidence: Confidence;
  reasonCodes: string[];
  missingData: string[];
}

export function evaluateRecommendation(metrics: RecommendationMetrics): RecommendationResult {
  const missingData: string[] = [];
  const reasonCodes: string[] = [];

  if (metrics.validWeightsWeek1 < 5 || metrics.validWeightsWeek2 < 5) {
    missingData.push("Potrebných je aspoň 5 vážení v každom porovnávanom týždni.");
  }
  if (metrics.calorieDays < 10) {
    missingData.push("Potrebných je aspoň 10 dní so zapísanými kalóriami.");
  }
  if (metrics.waistDays < 4) {
    missingData.push("Potrebné sú aspoň 4 merania pásu za 14 dní.");
  }
  if (metrics.calorieMeanAbsoluteErrorPct > 10) {
    reasonCodes.push("LOW_CALORIE_ADHERENCE");
    missingData.push("Priemerná odchýlka od kalorického cieľa je vyššia než 10 %.");
  }
  if (missingData.length) {
    return {
      status: "insufficient",
      action: "none",
      calorieDeltaTraining: 0,
      calorieDeltaRest: 0,
      confidence: "low",
      reasonCodes,
      missingData
    };
  }

  const subjectiveLow = [metrics.averageSleep, metrics.averageReadiness, metrics.averageTrainingQuality]
    .filter((value): value is number => value !== null)
    .some((value) => value <= 4);
  const confidence: Confidence = subjectiveLow ? "medium" : "high";

  if (metrics.weeklyWeightChangePct > 0.5 && metrics.waistChangeCm >= 0.5) {
    return {
      status: "pending",
      action: "decrease_all",
      calorieDeltaTraining: -150,
      calorieDeltaRest: -150,
      confidence,
      reasonCodes: ["FAST_WEIGHT_GAIN", "WAIST_GROWTH"],
      missingData: []
    };
  }

  const rapidLoss =
    metrics.weeklyWeightChangePct < -0.5 || metrics.weeklyWeightChangeKg <= -0.5;
  const performanceDecline =
    metrics.performancePercent !== null &&
    (metrics.performancePercent < 0 || metrics.repeatedExerciseDecline);
  if (rapidLoss && performanceDecline) {
    return {
      status: "pending",
      action: "increase_all",
      calorieDeltaTraining: 100,
      calorieDeltaRest: 100,
      confidence,
      reasonCodes: ["FAST_WEIGHT_LOSS", "PERFORMANCE_DECLINE"],
      missingData: []
    };
  }

  const stableWeight =
    metrics.weeklyWeightChangePct >= -0.2 && metrics.weeklyWeightChangePct <= 0.2;
  if (stableWeight && metrics.waistChangeCm < 0.5) {
    if (metrics.performancePercent === null) {
      return {
        status: "insufficient",
        action: "none",
        calorieDeltaTraining: 0,
        calorieDeltaRest: 0,
        confidence: "low",
        reasonCodes: ["MISSING_PERFORMANCE"],
        missingData: ["Na zvýšenie kalórií je potrebný aspoň jeden porovnateľný hlavný cvik."]
      };
    }
    if (metrics.performancePercent >= 0 && !metrics.repeatedExerciseDecline) {
      return {
        status: "pending",
        action: "increase_training",
        calorieDeltaTraining: 100,
        calorieDeltaRest: 0,
        confidence,
        reasonCodes: ["STABLE_WEIGHT", "STABLE_WAIST", "PERFORMANCE_OK"],
        missingData: []
      };
    }
  }

  return {
    status: "hold",
    action: "none",
    calorieDeltaTraining: 0,
    calorieDeltaRest: 0,
    confidence,
    reasonCodes: ["MONITOR_NEXT_BLOCK"],
    missingData: []
  };
}
```

- [ ] **Step 4: Pridať regresný test: subjektívny stav nesmie vytvoriť návrh**

```ts
it("subjective scores only lower confidence", () => {
  const result = evaluateRecommendation({
    ...complete,
    weeklyWeightChangePct: 0.3,
    averageSleep: 2,
    averageReadiness: 2,
    averageTrainingQuality: 2
  });
  expect(result.status).toBe("hold");
  expect(result.action).toBe("none");
});
```

- [ ] **Step 5: Overiť a commitnúť**

Run: `pnpm test -- src/domain/recommendations.test.ts`

Expected: PASS.

```powershell
git add src/domain/recommendations*
git commit -m "feat: add conservative calorie recommendation engine"
```

## Task 6: Agregácia 14-dňového bloku

**Files:**
- Create: `src/domain/analytics.ts`
- Test: `src/domain/analytics.test.ts`

- [ ] **Step 1: Napísať test agregácie dvoch týždňov**

```ts
import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { toLocalDate } from "./date";
import { buildEvaluationMetrics } from "./analytics";
import { makeDailyEntry } from "../test/fixtures";

it("aggregates two exact seven-day windows", () => {
  const start = new Date(2026, 5, 19);
  const entries = Array.from({ length: 14 }, (_, index) =>
    makeDailyEntry({
      date: toLocalDate(addDays(start, index)),
      weightKg: index < 7 ? 81.4 : 81.6,
      waistCm: 80,
      calories: 2900
    })
  );
  const metrics = buildEvaluationMetrics(
    entries,
    () => ({ calories: 2900, proteinGrams: 180, carbsGrams: 432.5, fatGrams: 50 }),
    {
      overallPercent: 1,
      comparableExercises: 1,
      items: [],
      repeatedDeclineExerciseIds: []
    }
  );

  expect(metrics).toMatchObject({
    validWeightsWeek1: 7,
    validWeightsWeek2: 7,
    calorieDays: 14,
    waistDays: 14,
    calorieMeanAbsoluteErrorPct: 0
  });
  expect(metrics.weeklyWeightChangeKg).toBeCloseTo(0.2, 5);
});
```

- [ ] **Step 2: Overiť červený test**

Run: `pnpm test -- src/domain/analytics.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementovať agregáciu**

`buildEvaluationMetrics(
  entries,
  targetForDate: (date: LocalDate) => MacroTargets,
  performance: PerformanceSummary
)` must:

1. sort the exact 14-day range by local date;
2. split days `0–6` and `7–13`;
3. calculate means from present values only;
4. calculate weekly percent change as `(week2Avg - week1Avg) / week1Avg * 100`;
5. calculate waist change from week averages;
6. calculate calorie mean absolute percentage error against the target valid for each date;
7. return nullable subjective averages;
8. set `performancePercent` to `performance.overallPercent` without turning missing performance into zero;
9. set `repeatedExerciseDecline` to `performance.repeatedDeclineExerciseIds.length > 0`.

Core helper:

```ts
export const mean = (values: Array<number | undefined>): number | null => {
  const present = values.filter((value): value is number => value !== undefined);
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
};
```

- [ ] **Step 4: Overiť a commitnúť**

Run: `pnpm test -- src/domain/analytics.test.ts src/domain/recommendations.test.ts`

Expected: PASS.

```powershell
git add src/domain/analytics*
git commit -m "feat: aggregate stabilization block metrics"
```

## Task 7: Firebase konfigurácia, auth, repository a bezpečnostné pravidlá

**Files:**
- Create: `src/data/TrackerRepository.ts`
- Create: `src/data/firebase.ts`
- Create: `src/data/firebaseAuth.ts`
- Create: `src/data/firestoreTrackerRepository.ts`
- Create: `src/data/syncStore.ts`
- Create: `firestore.rules`
- Create: `firebase.json`
- Create: `.env.e2e`
- Create: `tests/rules/firestore.rules.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Definovať repository kontrakt**

```ts
// src/data/TrackerRepository.ts
import type {
  DailyEntry, Exercise, LocalDate, TargetPeriod, TopSet, TrackerProfile, TrainingDayPlan
} from "../domain/types";
import type { RecommendationMetrics, RecommendationResult } from "../domain/recommendations";

export interface StoredRecommendation extends RecommendationResult {
  id: string;
  windowStart: LocalDate;
  windowEnd: LocalDate;
  metrics: RecommendationMetrics;
  decidedAtMs?: number;
}

export interface TrackerRepository {
  ensureSeedData(profile: TrackerProfile, exercises: Exercise[], plan: TrainingDayPlan[]): Promise<void>;
  subscribeProfile(cb: (profile: TrackerProfile) => void): () => void;
  subscribeDailyEntries(start: LocalDate, end: LocalDate, cb: (rows: DailyEntry[]) => void): () => void;
  saveDailyEntry(entry: DailyEntry): Promise<void>;
  subscribeExercises(cb: (rows: Exercise[]) => void): () => void;
  saveExercise(exercise: Exercise): Promise<void>;
  subscribeTrainingPlan(cb: (rows: TrainingDayPlan[]) => void): () => void;
  saveTrainingDay(day: TrainingDayPlan): Promise<void>;
  subscribeTopSets(start: LocalDate, end: LocalDate, cb: (rows: TopSet[]) => void): () => void;
  saveTopSet(set: TopSet): Promise<void>;
  subscribeTargets(cb: (rows: TargetPeriod[]) => void): () => void;
  subscribeRecommendations(cb: (rows: StoredRecommendation[]) => void): () => void;
  saveRecommendation(value: StoredRecommendation): Promise<void>;
  acceptRecommendation(value: StoredRecommendation, nextTargets: TargetPeriod): Promise<void>;
  rejectRecommendation(value: StoredRecommendation): Promise<void>;
  exportAll(): Promise<Record<string, unknown>>;
}
```

- [ ] **Step 2: Inicializovať Firebase s multi-tab offline cache**

```ts
// src/data/firebase.ts
import { initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
});

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const auth = getAuth(app);

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
```

- [ ] **Step 3: Implementovať Google auth a testovací emulator login**

`firebaseAuth.ts` must export:

```ts
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword,
  signInWithPopup, signInWithRedirect, signOut, type User
} from "firebase/auth";
import { auth } from "./firebase";

export const subscribeUser = (cb: (user: User | null) => void) =>
  onAuthStateChanged(auth, cb);

export const signInWithGoogle = () => {
  const provider = new GoogleAuthProvider();
  return window.matchMedia("(max-width: 799px)").matches
    ? signInWithRedirect(auth, provider)
    : signInWithPopup(auth, provider);
};

export const signInForE2E = () => {
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS !== "true") {
    throw new Error("Test login is available only with Firebase emulators.");
  }
  return signInWithEmailAndPassword(auth, "jozef@example.test", "local-test-password");
};

export const signOutCurrentUser = () => signOut(auth);
```

- [ ] **Step 4: Implementovať Firestore cesty a offline writes**

Use these exact collections:

```text
users/{uid}/profile/main
users/{uid}/dailyEntries/{YYYY-MM-DD}
users/{uid}/exercises/{exerciseId}
users/{uid}/trainingDays/{weekday}
users/{uid}/topSets/{date}__{exerciseId}
users/{uid}/targetHistory/{effectiveDate}
users/{uid}/recommendations/{windowEndDate}
```

Ordinary writes use the pattern:

```ts
await setDoc(
  doc(db, "users", uid, "dailyEntries", entry.date),
  { ...entry, updatedAt: serverTimestamp() },
  { merge: true }
);
```

`acceptRecommendation` uses one `writeBatch` to mark the recommendation accepted and create the next target period. It must not use a Firestore transaction because acceptance must queue offline.

Persist `updatedAt: serverTimestamp()` on every write and map it back to `updatedAtMs`. While a server timestamp is pending offline, preserve the locally supplied `updatedAtMs`. Firestore's document-level last-write-wins behavior is the conflict rule for edits made on two devices.

- [ ] **Step 5: Implementovať sync store**

```ts
// src/data/syncStore.ts
type SyncState = "synced" | "saved-local" | "offline" | "error";

let state: SyncState = navigator.onLine ? "synced" : "offline";
const listeners = new Set<(value: SyncState) => void>();

const emit = (value: SyncState) => {
  state = value;
  listeners.forEach((listener) => listener(value));
};

window.addEventListener("online", () => emit("saved-local"));
window.addEventListener("offline", () => emit("offline"));

export const syncStore = {
  getSnapshot: () => state,
  subscribe(listener: (value: SyncState) => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  markLocal: () => emit(navigator.onLine ? "saved-local" : "offline"),
  markSynced: () => emit("synced"),
  markError: () => emit("error")
};
```

After every repository write:

```ts
syncStore.markLocal();
void waitForPendingWrites(db)
  .then(syncStore.markSynced)
  .catch(syncStore.markError);
```

- [ ] **Step 6: Napísať security rules test**

```ts
// tests/rules/firestore.rules.test.ts
import { readFileSync } from "node:fs";
import {
  assertFails, assertSucceeds, initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

let env: Awaited<ReturnType<typeof initializeTestEnvironment>>;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-lean-bulk",
    firestore: { rules: readFileSync("firestore.rules", "utf8") }
  });
});

afterAll(() => env.cleanup());

describe("user isolation", () => {
  it("allows own data and denies another user's data", async () => {
    const own = env.authenticatedContext("jozef").firestore();
    const other = env.authenticatedContext("other").firestore();
    await assertSucceeds(setDoc(doc(own, "users/jozef/dailyEntries/2026-06-19"), { calories: 2900 }));
    await assertFails(getDoc(doc(other, "users/jozef/dailyEntries/2026-06-19")));
  });
});
```

- [ ] **Step 7: Napísať minimálne pravidlá**

```text
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- [ ] **Step 8: Vytvoriť presnú Firebase/emulator konfiguráciu**

```json
// firebase.json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

```dotenv
# .env.e2e
VITE_FIREBASE_API_KEY=fake-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-lean-bulk.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-lean-bulk
VITE_FIREBASE_APP_ID=demo-app-id
VITE_USE_FIREBASE_EMULATORS=true
```

- [ ] **Step 9: Overiť emulátory a commitnúť**

Run:

```powershell
pnpm test:rules
pnpm test
```

Expected: security test PASS; unit suite PASS.

```powershell
git add src/data firestore.rules firebase.json tests/rules .env.example .env.e2e
git commit -m "feat: add secure offline Firebase data layer"
```

## Task 8: Auth provider, seedovanie a responzívny PWA shell

**Files:**
- Create: `src/app/AuthProvider.tsx`
- Create: `src/app/RepositoryProvider.tsx`
- Create: `src/app/AppShell.tsx`
- Create: `src/app/routes.tsx`
- Create: `src/components/SyncBadge.tsx`
- Create: `src/components/EmptyPage.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`
- Test: `src/app/AppShell.test.tsx`

- [ ] **Step 1: Napísať navigačný test**

```tsx
it("shows the five primary destinations", () => {
  render(
    <MemoryRouter>
      <AppShell />
    </MemoryRouter>
  );
  for (const label of ["Dnes", "Progress", "Tréning", "História", "Nastavenia"]) {
    expect(screen.getByRole("link", { name: label })).toBeVisible();
  }
});
```

- [ ] **Step 2: Overiť červený test**

Run: `pnpm test -- src/app/AppShell.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implementovať auth gate**

`AuthProvider` exposes `{ user, loading, signInWithGoogle, signOut }`. While loading, render a skeleton. Without user, render one centered card with the product purpose and button `Pokračovať cez Google`. In emulator mode also render `Testovacie prihlásenie`.

- [ ] **Step 4: Seedovať iba nový účet**

After first authenticated snapshot, call:

```ts
await repository.ensureSeedData(
  CALIBRATION_PROFILE,
  DEFAULT_EXERCISES,
  DEFAULT_TRAINING_DAYS
);
```

`ensureSeedData` must first read `users/{uid}/profile/main`; if it exists, make no writes. If absent, use one batch for profile, initial target period, exercises and training days.

- [ ] **Step 5: Implementovať shell a routing**

Routes:

```tsx
<Routes>
  <Route element={<AppShell />}>
    <Route index element={<TodayPage />} />
    <Route path="progress" element={<ProgressPage />} />
    <Route path="training" element={<TrainingPage />} />
    <Route path="history" element={<HistoryPage />} />
    <Route path="settings" element={<SettingsPage />} />
  </Route>
</Routes>
```

On mobile `< 800px`, navigation is fixed at the bottom. At `>= 800px`, it is a left sidebar. Use `NavLink` active states and reserve bottom safe-area padding with `env(safe-area-inset-bottom)`.

- [ ] **Step 6: Implementovať automatickú tému**

Use CSS variables:

```css
:root {
  color-scheme: light dark;
  --bg: #f4f7f5;
  --surface: #ffffff;
  --surface-strong: #e8f1ec;
  --text: #142019;
  --muted: #647169;
  --accent: #1f8a5b;
  --positive: #16834f;
  --negative: #c2413b;
  --warning: #b7791f;
  --border: #d9e2dc;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1210;
    --surface: #161d19;
    --surface-strong: #202b25;
    --text: #eef5f0;
    --muted: #9eaaa2;
    --accent: #55d292;
    --positive: #55d292;
    --negative: #ff8178;
    --warning: #f2bd5c;
    --border: #2c3931;
  }
}
```

- [ ] **Step 7: Generovať PWA ikony a overiť**

Run:

```powershell
pnpm icons
pnpm test -- src/app/AppShell.test.tsx
pnpm build
```

Expected: test PASS; manifest a service worker existujú v `dist/`.

- [ ] **Step 8: Commit**

```powershell
git add src/app src/components public vite.config.ts
git commit -m "feat: add authenticated responsive PWA shell"
```

## Task 9: Dnešný zápis a zvýraznený dashboard

**Files:**
- Create: `src/features/today/TodayPage.tsx`
- Create: `src/features/today/TodayEntryForm.tsx`
- Create: `src/features/today/useTodayEntry.ts`
- Create: `src/features/today/CalibrationCard.tsx`
- Create: `src/components/NumberField.tsx`
- Create: `src/components/ScoreField.tsx`
- Test: `src/features/today/TodayEntryForm.test.tsx`

- [ ] **Step 1: Napísať mobilný formulárový test**

Import `makeDailyEntry` from `src/test/fixtures.ts`, Testing Library, `userEvent`, and `vi`.

```tsx
it("saves weight, waist, calories and 1-10 scores", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(
    <TodayEntryForm
      dayType="training"
      initialValue={makeDailyEntry()}
      onSave={onSave}
    />
  );

  await user.type(screen.getByLabelText("Ranná váha"), "81.4");
  await user.type(screen.getByLabelText("Pás"), "80.5");
  await user.type(screen.getByLabelText("Prijaté kalórie"), "2900");
  await user.click(screen.getByRole("radio", { name: "Spánok 8 z 10" }));
  await user.click(screen.getByRole("button", { name: "Uložiť dnešok" }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    weightKg: 81.4,
    waistCm: 80.5,
    calories: 2900,
    sleepScore: 8
  }));
});
```

- [ ] **Step 2: Overiť červený test**

Run: `pnpm test -- src/features/today/TodayEntryForm.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implementovať Today card**

The first visible card contains:

```text
Dnes · piatok 19. júna
TRÉNINGOVÝ DEŇ [Zmeniť na voľno]
2 900 kcal · P 180 g · C 433 g · F 50 g
```

Inputs use `inputMode="decimal"` for weight/waist and `inputMode="numeric"` for calories. Scores use ten accessible radio buttons. `trainingQualityScore` appears only for training days.

- [ ] **Step 4: Implementovať save flow**

1. Keep a local draft so typing never waits for network.
2. Validate on submit.
3. Save one `DailyEntry` document keyed by date.
4. Show field errors inline.
5. Show `SyncBadge`: `Synchronizované`, `Uložené v zariadení`, `Offline`, or `Chyba uloženia`.
6. Allow day-type override without changing the weekly plan.

- [ ] **Step 5: Implementovať kalibračný stav**

`CalibrationCard` displays:

- `Deň N z 14` for dates inside the first block;
- a progress bar clamped to 0–100%;
- text `Počas stabilizačného bloku sa ciele nemenia`;
- no recommendation action before day 14.

Below the summary cards, show the latest seven dates with completion dots for weight, waist, calories and training. Each row links to the History edit dialog for that exact date.

- [ ] **Step 6: Overiť a commitnúť**

Run: `pnpm test -- src/features/today/TodayEntryForm.test.tsx`

Expected: PASS.

```powershell
git add src/features/today src/components
git commit -m "feat: add fast daily entry dashboard"
```

## Task 10: Tréningový deň a zápis najlepších pracovných sérií

**Files:**
- Create: `src/features/training/TrainingPage.tsx`
- Create: `src/features/training/TopSetForm.tsx`
- Create: `src/features/training/ExerciseTopSetCard.tsx`
- Create: `src/features/training/useTrainingSession.ts`
- Test: `src/features/training/TopSetForm.test.tsx`

- [ ] **Step 1: Napísať test top setu**

Import `makeExercise` from `src/test/fixtures.ts`, Testing Library, `userEvent`, and `vi`.

```tsx
it("saves weight, reps, RIR and calculated e1RM", async () => {
  const onSave = vi.fn();
  const user = userEvent.setup();
  render(<TopSetForm exercise={makeExercise()} onSave={onSave} />);

  await user.type(screen.getByLabelText("Váha"), "120");
  await user.type(screen.getByLabelText("Opakovania"), "8");
  await user.type(screen.getByLabelText("RIR"), "2");
  await user.click(screen.getByRole("button", { name: "Uložiť RDL" }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    weightKg: 120,
    reps: 8,
    rir: 2,
    estimated1RmKg: 152
  }));
});
```

- [ ] **Step 2: Overiť červený test**

Run: `pnpm test -- src/features/training/TopSetForm.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implementovať dnešný výber cvikov**

Resolve current day type using schedule plus override. If rest day, show `Dnes je voľno` and a button to switch today to training. If training day, list only active main exercises assigned to that weekday, in configured order.

- [ ] **Step 4: Implementovať exercise card**

Each card shows:

- exercise name and rep range;
- previous top set;
- previous e1RM;
- latest percent change;
- low-reliability badge when RIR difference exceeds 1.5;
- PR badge when current set exceeds prior historical maximum by >0.5%.

Saving uses ID `${date}__${exerciseId}` so editing the same day/exercise updates rather than duplicates.

- [ ] **Step 5: Overiť a commitnúť**

Run: `pnpm test -- src/features/training/TopSetForm.test.tsx src/domain/performance.test.ts`

Expected: PASS.

```powershell
git add src/features/training
git commit -m "feat: add main exercise top set logging"
```

## Task 11: Progress obrazovka a 7-dňový merač cvikov

**Files:**
- Create: `src/features/progress/ProgressPage.tsx`
- Create: `src/features/progress/PerformanceMeter.tsx`
- Create: `src/features/progress/BodyTrendCards.tsx`
- Create: `src/components/LineChart.tsx`
- Test: `src/features/progress/PerformanceMeter.test.tsx`

- [ ] **Step 1: Napísať test transparentného skóre**

Import `makeExercise` and `makeTopSet` from `src/test/fixtures.ts`.

```tsx
it("shows overall percent and included exercise breakdown", () => {
  const performance = (exerciseId: string, percentChange: number) => ({
    exerciseId,
    current: makeTopSet({ exerciseId }),
    previous: makeTopSet({ id: `previous__${exerciseId}`, date: "2026-06-11", exerciseId }),
    percentChange,
    isPr: percentChange > 0.5,
    reliability: "normal" as const
  });
  const exercises = [
    makeExercise({ id: "incline-db-press", name: "Incline DB press" }),
    makeExercise({ id: "hack-squat-leg-press", name: "Hack squat / leg press" }),
    makeExercise({ id: "rdl", name: "RDL" })
  ];
  render(<PerformanceMeter summary={{
    overallPercent: 2.8,
    comparableExercises: 3,
    repeatedDeclineExerciseIds: ["rdl"],
    items: [
      performance("incline-db-press", 4.1),
      performance("hack-squat-leg-press", 5),
      performance("rdl", -0.7)
    ]
  }} exercises={exercises} />);

  expect(screen.getByText("+2,8 %")).toBeVisible();
  expect(screen.getByText("Incline DB press")).toBeVisible();
  expect(screen.getByText("RDL")).toBeVisible();
  expect(screen.getByText("3 porovnateľné cviky")).toBeVisible();
});
```

- [ ] **Step 2: Overiť červený test**

Run: `pnpm test -- src/features/progress/PerformanceMeter.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implementovať merač**

Use an SVG semicircle gauge:

- range display clamped to `−10 % … +10 %`;
- positive accent green, negative red, near-zero muted;
- always display the unclamped numeric value in text;
- expand/collapse exercise breakdown;
- display `Zatiaľ chýbajú dve porovnateľné série` when `overallPercent` is null.

- [ ] **Step 4: Implementovať body trends**

`ProgressPage` contains:

- 7-day average weight and percentage change;
- 7-day waist average and cm change;
- average calorie adherence;
- line chart with daily points and 7-day rolling average;
- performance meter and per-exercise cards.

Reuse compact versions of the 7-day weight, waist, calorie adherence and performance cards below the main Today entry card so the dashboard exposes all essential status without navigating away.

`LineChart` is a dependency-free accessible SVG with `<title>`, labelled min/max, and a table fallback for screen readers.

- [ ] **Step 5: Overiť a commitnúť**

Run: `pnpm test -- src/features/progress/PerformanceMeter.test.tsx`

Expected: PASS.

```powershell
git add src/features/progress src/components/LineChart.tsx
git commit -m "feat: add body and exercise progress dashboard"
```

## Task 12: História a spätná oprava záznamov

**Files:**
- Create: `src/features/history/HistoryPage.tsx`
- Create: `src/features/history/HistoryList.tsx`
- Create: `src/features/history/EditDayDialog.tsx`
- Test: `src/features/history/EditDayDialog.test.tsx`

- [ ] **Step 1: Napísať test spätnej editácie**

Import `makeDailyEntry` from `src/test/fixtures.ts`, Testing Library, `userEvent`, and `vi`.

```tsx
it("edits an old day using the original date", async () => {
  const onSave = vi.fn();
  const user = userEvent.setup();
  render(
    <EditDayDialog
      entry={makeDailyEntry({ date: "2026-06-12", calories: 2900 })}
      onSave={onSave}
    />
  );
  await user.clear(screen.getByLabelText("Prijaté kalórie"));
  await user.type(screen.getByLabelText("Prijaté kalórie"), "2750");
  await user.click(screen.getByRole("button", { name: "Uložiť opravu" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    date: "2026-06-12",
    calories: 2750
  }));
});
```

- [ ] **Step 2: Implementovať históriu**

Requirements:

- newest date first;
- month filter and compact calendar heat strip;
- row summary: date, training/rest, weight, waist, calories, completion status;
- edit dialog reuses `TodayEntryForm` fields but changes submit label;
- no deletion in v1; clearing a field stores it as absent;
- after save, live Firestore subscription causes analytics and recommendations to recalculate.

- [ ] **Step 3: Overiť a commitnúť**

Run: `pnpm test -- src/features/history/EditDayDialog.test.tsx`

Expected: PASS.

```powershell
git add src/features/history
git commit -m "feat: add editable daily history"
```

## Task 13: Nastavenia cvikov a tréningového rozvrhu

**Files:**
- Create: `src/features/settings/SettingsPage.tsx`
- Create: `src/features/settings/ExerciseEditor.tsx`
- Create: `src/features/settings/TrainingPlanEditor.tsx`
- Create: `src/features/settings/ProfileSummary.tsx`
- Test: `src/features/settings/ExerciseEditor.test.tsx`
- Test: `src/features/settings/TrainingPlanEditor.test.tsx`

- [ ] **Step 1: Napísať test pridania a archivácie cviku**

Import `makeExercise` from `src/test/fixtures.ts` for both settings test files.

```tsx
it("adds a main exercise and archives it without deleting history", async () => {
  const onSave = vi.fn();
  const user = userEvent.setup();
  render(<ExerciseEditor exercises={[]} onSave={onSave} />);
  await user.type(screen.getByLabelText("Názov cviku"), "Pendulum squat");
  await user.type(screen.getByLabelText("Partia"), "Quads");
  await user.type(screen.getByLabelText("Minimum opakovaní"), "6");
  await user.type(screen.getByLabelText("Maximum opakovaní"), "10");
  await user.click(screen.getByLabelText("Hlavný cvik"));
  await user.click(screen.getByRole("button", { name: "Pridať cvik" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    name: "Pendulum squat",
    isMain: true
  }));
});
```

- [ ] **Step 2: Napísať test rozvrhu**

```tsx
it("reorders exercises with touch-friendly buttons", async () => {
  const onSave = vi.fn();
  const user = userEvent.setup();
  const monday = {
    weekday: 1 as const,
    label: "Lower",
    enabled: true,
    exerciseIds: ["rdl", "hack-squat-leg-press"]
  };
  render(
    <TrainingPlanEditor
      days={[monday]}
      exercises={[
        makeExercise({ id: "rdl", name: "RDL" }),
        makeExercise({ id: "hack-squat-leg-press", name: "Hack squat / leg press" })
      ]}
      onSave={onSave}
    />
  );
  await user.click(screen.getByRole("button", { name: "Posunúť Hack squat / leg press vyššie" }));
  await user.click(screen.getByRole("button", { name: "Uložiť pondelok" }));
  expect(onSave).toHaveBeenCalledWith({
    ...monday,
    exerciseIds: ["hack-squat-leg-press", "rdl"]
  });
});
```

Use buttons rather than HTML drag-and-drop so the same control works on touch screens.

- [ ] **Step 3: Implementovať exercise editor**

Rules:

- unique slug ID generated once at creation;
- renaming does not change ID;
- archive sets `archivedAtMs` and removes it from future day plans;
- historical top sets continue resolving exercise name;
- rep range validates `1 <= min <= max <= 100`.

- [ ] **Step 4: Implementovať plan editor**

Each weekday card supports:

- training/rest toggle;
- editable label;
- exercise assignment;
- up/down ordering buttons with 44px touch targets;
- save one weekday document.

- [ ] **Step 5: Show fixed recommendation thresholds read-only**

Profile summary lists:

```text
Min. vážení: 5 + 5
Min. dní s kcal: 10 / 14
Min. pás: 4 / 14
Max. priemerná kalorická odchýlka: 10 %
Stabilná váha: −0,2 % až +0,2 % / týždeň
Rýchly rast: nad +0,5 % / týždeň
Rast pásu: aspoň +0,5 cm
```

- [ ] **Step 6: Overiť a commitnúť**

Run: `pnpm test -- src/features/settings`

Expected: PASS.

```powershell
git add src/features/settings
git commit -m "feat: add editable exercises and training plan"
```

## Task 14: Recommendation workflow, prijatie/zamietnutie a história cieľov

**Files:**
- Create: `src/features/recommendations/RecommendationCard.tsx`
- Create: `src/features/recommendations/useRecommendation.ts`
- Create: `src/features/recommendations/TargetHistory.tsx`
- Create: `src/domain/targets.ts`
- Test: `src/features/recommendations/RecommendationCard.test.tsx`
- Test: `src/domain/targets.test.ts`

- [ ] **Step 1: Napísať bezpečnostný UI test**

```tsx
it("shows missing data without accept or reject actions", () => {
  const insufficientRecommendation = {
    id: "2026-07-02",
    windowStart: "2026-06-19" as const,
    windowEnd: "2026-07-02" as const,
    status: "insufficient" as const,
    action: "none" as const,
    calorieDeltaTraining: 0,
    calorieDeltaRest: 0,
    confidence: "low" as const,
    reasonCodes: ["LOW_CALORIE_ADHERENCE"],
    missingData: ["Potrebných je aspoň 10 dní so zapísanými kalóriami."],
    metrics: {
      validWeightsWeek1: 7,
      validWeightsWeek2: 7,
      calorieDays: 8,
      waistDays: 7,
      calorieMeanAbsoluteErrorPct: 16,
      weeklyWeightChangePct: 0.6,
      weeklyWeightChangeKg: 0.49,
      waistChangeCm: 0.6,
      performancePercent: 1,
      repeatedExerciseDecline: false,
      averageSleep: 7,
      averageReadiness: 7,
      averageTrainingQuality: 7
    }
  };
  render(<RecommendationCard recommendation={insufficientRecommendation} />);
  expect(screen.getByText("Zatiaľ nemeníme ciele")).toBeVisible();
  expect(screen.getByText(/10 dní so zapísanými kalóriami/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Prijať" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Napísať test cieľov po prijatí**

```ts
it("applies calorie deltas through carbs from the next day", () => {
  const currentTargets = {
    id: "2026-06-19",
    effectiveDate: "2026-06-19" as const,
    training: { calories: 2900, proteinGrams: 180, carbsGrams: 432.5, fatGrams: 50 },
    rest: { calories: 2700, proteinGrams: 180, carbsGrams: 382.5, fatGrams: 50 },
    reason: "Kalibračná fáza",
    createdAtMs: 1
  };
  const next = applyRecommendation(currentTargets, {
    calorieDeltaTraining: 100,
    calorieDeltaRest: 0
  }, "2026-07-03");

  expect(next.training).toMatchObject({
    calories: 3000,
    proteinGrams: 180,
    fatGrams: 50,
    carbsGrams: 457.5
  });
  expect(next.rest.calories).toBe(2700);
  expect(next.effectiveDate).toBe("2026-07-03");
});
```

- [ ] **Step 3: Implementovať recommendation orchestration**

Implement target math first:

```ts
// src/domain/targets.ts
import { calculateMacros } from "./macros";
import type { LocalDate, TargetPeriod } from "./types";

export function applyRecommendation(
  current: TargetPeriod,
  delta: { calorieDeltaTraining: number; calorieDeltaRest: number },
  effectiveDate: LocalDate
): TargetPeriod {
  return {
    id: effectiveDate,
    effectiveDate,
    training: calculateMacros(
      current.training.calories + delta.calorieDeltaTraining,
      current.training.proteinGrams,
      current.training.fatGrams
    ),
    rest: calculateMacros(
      current.rest.calories + delta.calorieDeltaRest,
      current.rest.proteinGrams,
      current.rest.fatGrams
    ),
    reason: "Potvrdená úprava po 14-dňovom vyhodnotení",
    createdAtMs: Date.now()
  };
}
```

`useRecommendation`:

1. treats the target effective date as day 1, the next 13 dates as the remaining block, and shows the earliest result on the following day; for the initial `2026-06-19` block the first possible result date is `2026-07-03`;
2. loads exact two 7-day windows;
3. builds metrics and calls `evaluateRecommendation`;
4. writes recommendation document keyed by `windowEnd`;
5. never replaces accepted/rejected history;
6. displays insufficient/hold results as informational, without action buttons;
7. after acceptance, starts a new 14-day block on the new target's effective date;
8. after rejection, starts the next 14-day observation block on the decision date;
9. keeps an undecided pending proposal visible and does not generate a replacement.

- [ ] **Step 4: Implementovať transparentnú kartu**

Pending card shows:

- exact old/new kcal and P/C/F;
- reason labels derived from `reasonCodes`;
- valid days counts;
- weight %, waist cm and performance %;
- confidence;
- `Prijať` and `Zamietnuť`.

For `increase_all`, offer `+100` (default) and `+150 kcal`. For `decrease_all`, offer `−150` (default) and `−200 kcal`. `increase_training` stays fixed at `+100 kcal` on training days. The selected conservative default is what `applyRecommendation` receives on acceptance.

Insufficient card headline is always `Zatiaľ nemeníme ciele`. It lists missing/weak data and must not use warning language implying failure or punishment.

Place the compact recommendation card directly below the Today/Calibration cards. Link its detailed metrics to the Progress page and its target history to Settings.

- [ ] **Step 5: Implementovať accept/reject**

Accept:

- calculate next target period effective tomorrow;
- preserve protein/fat;
- put calorie delta into carbs;
- batch-create target and mark recommendation accepted.

Reject:

- mark rejected;
- keep current targets;
- schedule next evaluation 14 days from rejection.

- [ ] **Step 6: Overiť a commitnúť**

Run:

```powershell
pnpm test -- src/domain/targets.test.ts src/features/recommendations/RecommendationCard.test.tsx
```

Expected: PASS.

```powershell
git add src/domain/targets* src/features/recommendations
git commit -m "feat: add confirmed calorie recommendation workflow"
```

## Task 15: Export JSON/CSV a lokálne súkromie

**Files:**
- Create: `src/domain/export.ts`
- Create: `src/features/settings/ExportPanel.tsx`
- Modify: `src/data/firebaseAuth.ts`
- Test: `src/domain/export.test.ts`

- [ ] **Step 1: Napísať export test**

Import `makeDailyEntry` from `src/test/fixtures.ts`.

```ts
it("exports daily entries as stable CSV", () => {
  const entry = makeDailyEntry({
    dayTypeOverride: "training",
    weightKg: 81.4,
    waistCm: 80.5,
    calories: 2900,
    sleepScore: 8,
    readinessScore: 7,
    trainingQualityScore: 9
  });
  expect(dailyEntriesToCsv([entry])).toBe(
    "date,dayTypeOverride,weightKg,waistCm,calories,sleepScore,readinessScore,trainingQualityScore\n" +
    "2026-06-19,training,81.4,80.5,2900,8,7,9"
  );
});
```

- [ ] **Step 2: Implementovať export**

Export panel provides:

- `Stiahnuť kompletnú JSON zálohu`;
- `Stiahnuť denné záznamy CSV`;
- `Stiahnuť top sety CSV`.

Use `Blob`, `URL.createObjectURL`, and file names containing local date. CSV must escape commas, quotes and newlines.

- [ ] **Step 3: Implementovať bezpečné odhlásenie**

Provide two actions:

- `Odhlásiť` — normal Firebase sign-out;
- `Odhlásiť a vymazať lokálne dáta` — sign out, terminate Firestore, clear IndexedDB persistence, reload the app.

Show helper text that persistent offline data remains on a trusted device unless the second action is used.

- [ ] **Step 4: Overiť a commitnúť**

Run: `pnpm test -- src/domain/export.test.ts`

Expected: PASS.

```powershell
git add src/domain/export* src/features/settings/ExportPanel.tsx src/data/firebaseAuth.ts
git commit -m "feat: add portable exports and privacy controls"
```

## Task 16: E2E scenáre, responzívna kontrola a offline synchronizácia

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/helpers/firebaseEmulator.ts`
- Create: `e2e/today-mobile.spec.ts`
- Create: `e2e/training-progress.spec.ts`
- Create: `e2e/recommendation-guard.spec.ts`

- [ ] **Step 1: Nakonfigurovať Playwright a dva lokálne servery**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: [
    {
      command: "pnpm exec firebase emulators:start --project demo-lean-bulk --only auth,firestore",
      port: 8080,
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: "pnpm dev:e2e",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 120_000
    }
  ]
});
```

- [ ] **Step 2: Seednúť Auth emulator používateľa**

Before tests, call Auth emulator REST:

```ts
await fetch(
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "jozef@example.test",
      password: "local-test-password",
      returnSecureToken: true
    })
  }
);
```

The helper accepts HTTP `200` and Firebase `EMAIL_EXISTS`. If the account already exists, sign in through the emulator REST API to obtain its `localId`. Return that UID and clear only `users/{localId}` test documents before each spec through the Firestore emulator REST endpoint.

- [ ] **Step 3: Napísať mobilný today/offline scenár**

At Pixel 7 viewport:

1. test login;
2. verify today card is first;
3. enter weight, waist, calories and scores;
4. set browser context offline before submit;
5. submit and expect `Offline` or `Uložené v zariadení`;
6. restore network;
7. expect `Synchronizované`;
8. reload and verify values remain.

- [ ] **Step 4: Napísať tréning/progress scenár**

1. save two historical RDL sets through repository seed;
2. save current RDL top set through UI;
3. navigate to Progress;
4. verify positive percent and RDL breakdown;
5. verify no exercise with only one set affects the count.

- [ ] **Step 5: Napísať hard-guard scenár**

Seed 14 days with only 8 calorie entries and a fast-looking weight change. Verify:

- headline `Zatiaľ nemeníme ciele`;
- missing calorie message;
- no `Prijať` button;
- no target history mutation.

- [ ] **Step 6: Run full local verification**

Run:

```powershell
pnpm lint
pnpm test
pnpm build
pnpm test:rules
pnpm test:e2e
```

Expected: all commands exit 0.

- [ ] **Step 7: Manuálne skontrolovať UI**

Use the in-app Browser against the known local Vite URL and inspect:

- 390×844 mobile light theme;
- 390×844 mobile dark theme;
- 1440×900 desktop light/dark;
- Today form with keyboard open-width behavior;
- bottom nav safe area;
- no clipped chart labels;
- installable PWA manifest;
- offline reload after one online visit.

Fix only observed defects, rerun the directly affected tests, then rerun `pnpm build`.

- [ ] **Step 8: Commit**

```powershell
git add e2e playwright.config.ts
git commit -m "test: cover critical tracker user journeys"
```

## Task 17: Firebase production project, deployment and handoff

**Files:**
- Create: `.firebaserc.example`
- Create: `README.md`
- Modify: `firebase.json`

- [ ] **Step 1: Document local setup**

README must include exact commands:

```powershell
pnpm install
Copy-Item .env.example .env.local
Copy-Item .firebaserc.example .firebaserc
pnpm exec firebase emulators:start --project demo-lean-bulk --only auth,firestore
pnpm dev
```

Document that emulator mode uses demo config and production requires a Firebase web-app config.

Create:

```json
// .firebaserc.example
{
  "projects": {
    "default": "lean-bulk-tracker-jozef-2026"
  }
}
```

- [ ] **Step 2: Create production Firebase project interactively**

After the user authorizes Firebase CLI login:

```powershell
pnpm exec firebase login
pnpm exec firebase projects:create lean-bulk-tracker-jozef-2026 --display-name "Lean Bulk Tracker Jozef"
pnpm exec firebase use lean-bulk-tracker-jozef-2026
```

If the exact global project ID is unavailable, stop and ask the user to approve a different ID; do not silently choose one.

- [ ] **Step 3: Configure Firebase console**

For project `lean-bulk-tracker-jozef-2026`:

1. create a Web App named `Lean Bulk Tracker`;
2. enable Google provider in Authentication;
3. create Firestore in multi-region `eur3`;
4. keep Spark/no-cost plan;
5. copy the public web config into `.env.production.local` using the exact keys `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`, and set `VITE_USE_FIREBASE_EMULATORS=false`;
6. add the Firebase Hosting domain to authorized auth domains.

- [ ] **Step 4: Deploy rules and hosting**

Run:

```powershell
pnpm verify
pnpm exec firebase deploy --only firestore:rules,hosting
```

Expected: deployment succeeds and prints a Hosting URL.

- [ ] **Step 5: Production smoke test**

On both mobile and PC:

1. sign in with the same Google account;
2. enter a harmless test day;
3. verify sync on the second device;
4. edit the day on PC and verify mobile update;
5. install PWA on mobile;
6. go offline, edit, reconnect, and verify sync;
7. delete the harmless test values through field clearing.

- [ ] **Step 6: Final documentation and commit**

README includes:

- architecture summary;
- production URL;
- backup instructions;
- Firebase free-tier note;
- how to run tests;
- explicit safety rule: weak adherence or missing data yields no calorie proposal.

```powershell
git add README.md .firebaserc.example firebase.json
git commit -m "docs: add deployment and operating guide"
```

## Final acceptance gate

Do not claim completion until all are true:

- `pnpm verify` passes from a clean checkout;
- Firestore rules deny cross-user reads/writes;
- incomplete data and >10% calorie error never expose `Prijať`;
- stabilization days 1–13 never expose a calorie-changing proposal;
- accepted changes begin the following local date and preserve protein/fat;
- mobile and desktop share the same account data;
- one online visit is enough for later offline app loading and writes;
- PWA is installable;
- all dashboard numbers show their source period and included-data count.

## Technical references

- [Firebase web offline persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Vite PWA configuration](https://vite-pwa-org.netlify.app/guide/)
- [React Router declarative routing](https://reactrouter.com/start/declarative/routing)
- [Vitest guide](https://vitest.dev/guide/)
