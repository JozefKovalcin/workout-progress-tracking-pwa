import { addDays, format, subDays } from "date-fns";
import { sk } from "date-fns/locale";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent
} from "react";
import { buildEvaluationMetrics } from "../domain/analytics";
import { fromLocalDate, toLocalDate, weekdayIso } from "../domain/date";
import { calculateMacros, resolveDayType } from "../domain/macros";
import { calculateE1Rm, summarizePerformance } from "../domain/performance";
import { evaluateRecommendation } from "../domain/recommendations";
import type {
  DailyEntry,
  DayType,
  Exercise,
  LocalDate,
  MacroTargets,
  TargetPeriod,
  TopSet,
  TrainingDayPlan
} from "../domain/types";
import { validateDailyEntry, validateTopSet } from "../domain/validation";
import { createDemoTrackerData } from "../data/demoData";
import { syncStore } from "../data/syncStore";
import type {
  StoredRecommendation,
  TrackerDataSource,
  TrackerSnapshot
} from "../data/trackerData";
import {
  advanceInformationalBlocks,
  anchorBlockEntries,
  deriveBlock
} from "./recommendationFlow";

type Mode = "demo" | "cloud";
type Screen = "today" | "training" | "progress" | "settings";

interface AppProps {
  initialMode?: Mode;
  now?: Date;
}

const MODE_KEY = "lean-bulk-tracker-mode";
const EMPTY: TrackerSnapshot = {
  profile: null,
  dailyEntries: [],
  exercises: [],
  trainingDays: [],
  topSets: [],
  targets: [],
  recommendations: []
};
const nav: Array<[Screen, string]> = [
  ["today", "Dnes"],
  ["training", "Tréning"],
  ["progress", "Progress"],
  ["settings", "Nastavenia"]
];
const reasonLabels: Record<string, string> = {
  FAST_WEIGHT_GAIN: "Hmotnosť rastie príliš rýchlo",
  WAIST_GROWTH: "Pás rastie",
  FAST_WEIGHT_LOSS: "Hmotnosť klesá",
  PERFORMANCE_DECLINE: "Výkon klesá",
  STABLE_WEIGHT: "Hmotnosť je stabilná",
  STABLE_WAIST: "Pás je stabilný",
  PERFORMANCE_OK: "Výkon je stabilný",
  MONITOR_NEXT_BLOCK: "Pokračuj bez zmeny"
};

const numberOrUndefined = (value: FormDataEntryValue | null) => {
  if (value === null || String(value).trim() === "") return undefined;
  return Number(value);
};
const average = (values: Array<number | undefined>) => {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};
const fmt = (value: number | null, suffix = "") =>
  value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}${suffix}`;
const trend = (values: Array<number | undefined>, suffix: string) => {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length < 2) return "zbieraj merania";
  const change = valid.at(-1)! - valid[0];
  return `trend ${change >= 0 ? "+" : ""}${change.toFixed(1)} ${suffix}`;
};

function targetsForDate(targets: TargetPeriod[], date: LocalDate, dayType: DayType): MacroTargets {
  const period = [...targets]
    .filter((item) => item.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  return period?.[dayType] ?? calculateMacros(dayType === "training" ? 2900 : 2700, 180, 50);
}

function recentDates(end: LocalDate, count: number) {
  return Array.from({ length: count }, (_, index) => toLocalDate(subDays(fromLocalDate(end), index)));
}

function AuthGate({ allowDemo, onDemo, onGoogle, error }: {
  allowDemo: boolean;
  onDemo(): void;
  onGoogle(): void;
  error: string;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">LB</div>
        <p className="eyebrow">Osobný tréningový dashboard</p>
        <h1>Lean Bulk Tracker</h1>
        <p>Zapisuj dáta, sleduj výkon a kalórie meň až po bezpečnom 14-dňovom vyhodnotení.</p>
        {error && <p className="error">{error}</p>}
        <button className="primary" onClick={onGoogle}>Pokračovať cez Google</button>
        {allowDemo && <button className="secondary" onClick={onDemo}>Lokálny demo režim</button>}
      </section>
    </main>
  );
}

function SyncBadge() {
  const state = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot);
  const labels = {
    synced: "Synchronizované",
    "saved-local": "Uložené lokálne",
    offline: "Offline",
    error: "Chyba synchronizácie"
  };
  return <span className={`sync-badge ${state}`}>{labels[state]}</span>;
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function RecommendationCard({
  snapshot,
  today,
  currentTargets,
  data,
  uid
}: {
  snapshot: TrackerSnapshot;
  today: LocalDate;
  currentTargets: { training: MacroTargets; rest: MacroTargets };
  data: TrackerDataSource;
  uid: string;
}) {
  const [open, setOpen] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const decidingRef = useRef(false);
  const profile = snapshot.profile!;
  const markerBlock = deriveBlock(
    profile,
    snapshot.targets,
    snapshot.recommendations,
    today
  );
  const evaluateBlock = (blockStart: LocalDate, blockEnd: LocalDate) => {
    const performance = summarizePerformance(snapshot.topSets, blockEnd);
    const blockEntries = anchorBlockEntries(
      snapshot.dailyEntries,
      blockStart,
      blockEnd
    );
    const metrics = buildEvaluationMetrics(
      blockEntries,
      (date) =>
        targetsForDate(
          snapshot.targets,
          date,
          resolveDayType(
            date,
            snapshot.trainingDays,
            blockEntries.find((row) => row.date === date)?.dayTypeOverride
          )
        ),
      performance
    );
    const stored = snapshot.recommendations.find((item) => item.id === blockEnd);
    return {
      metrics,
      result: stored ?? evaluateRecommendation(metrics)
    };
  };
  const { blockStart, blockEnd, day, actionable } =
    advanceInformationalBlocks(
      markerBlock.blockStart,
      profile.evaluationDays,
      today,
      (start, end) => evaluateBlock(start, end).result.status
    );
  const evaluation = actionable ? evaluateBlock(blockStart, blockEnd) : null;
  const metrics = evaluation?.metrics;
  const result = evaluation?.result ?? null;

  const decide = async (accepted: boolean) => {
    if (!result || !metrics || decidingRef.current) return;
    decidingRef.current = true;
    setDeciding(true);
    setDecisionError("");
    const recommendation: StoredRecommendation = {
      ...result,
      id: blockEnd,
      windowStart: blockStart,
      windowEnd: blockEnd,
      metrics,
      status: accepted ? "accepted" : "rejected",
      decidedAtMs: fromLocalDate(today).valueOf()
    };
    let next: TargetPeriod | undefined;
    if (accepted) {
      const effectiveDate = toLocalDate(addDays(fromLocalDate(today), 1));
      next = {
        id: effectiveDate,
        effectiveDate,
        training: calculateMacros(currentTargets.training.calories + result.calorieDeltaTraining, profile.proteinGrams, profile.fatGrams),
        rest: calculateMacros(currentTargets.rest.calories + result.calorieDeltaRest, profile.proteinGrams, profile.fatGrams),
        reason: result.reasonCodes.join(", "),
        createdAtMs: fromLocalDate(today).valueOf()
      };
    }
    try {
      await data.decideRecommendation(uid, recommendation, next);
    } catch (error) {
      setDecisionError(
        error instanceof Error
          ? error.message
          : "Rozhodnutie sa nepodarilo uložiť."
      );
    } finally {
      decidingRef.current = false;
      setDeciding(false);
    }
  };

  return (
    <section className="panel recommendation">
      <button className="panel-toggle" aria-label="Odporúčanie" onClick={() => setOpen(!open)}>
        <span><small>Kalibrácia deň {day}/14</small><strong>Odporúčanie</strong></span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="recommendation-body">
          {!result && <p><strong>Najprv dokonči 14-dňový blok.</strong> Dovtedy sa kalórie nemenia.</p>}
          {result?.status === "insufficient" && (
            <><p><strong>Dáta zatiaľ nestačia.</strong> Chýbajúce alebo slabé dáta nikdy nevytvoria kalorickú akciu.</p>
              <ul>{result.missingData.map((item) => <li key={item}>{item}</li>)}</ul></>
          )}
          {result?.status === "hold" && <p><strong>Bez zmeny.</strong> Pokračuj ďalší blok a zbieraj konzistentné dáta.</p>}
          {(result?.status === "accepted" || result?.status === "rejected") && <p><strong>{result.status === "accepted" ? "Odporúčanie prijaté" : "Odporúčanie odmietnuté"}.</strong></p>}
          {result?.status === "pending" && (
            <>
              <div className="recommendation-grid">
                <div><small>Tréning</small><strong>{currentTargets.training.calories} → {currentTargets.training.calories + result.calorieDeltaTraining} kcal</strong></div>
                <div><small>Voľno</small><strong>{currentTargets.rest.calories} → {currentTargets.rest.calories + result.calorieDeltaRest} kcal</strong></div>
              </div>
              <p>Istota: <strong>{result.confidence}</strong></p>
              <ul>{result.reasonCodes.map((code) => <li key={code}>{reasonLabels[code] ?? code}</li>)}</ul>
              <div className="button-row"><button className="primary" disabled={deciding} onClick={() => void decide(true)}>{deciding ? "Ukladám…" : "Prijať"}</button><button className="secondary" disabled={deciding} onClick={() => void decide(false)}>Odmietnuť</button></div>
              {decisionError && <p className="error">{decisionError}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function TodayScreen({ snapshot, data, uid, now, onTraining }: {
  snapshot: TrackerSnapshot;
  data: TrackerDataSource;
  uid: string;
  now: Date;
  onTraining(): void;
}) {
  const today = toLocalDate(now);
  const [date, setDate] = useState(today);
  const entry = snapshot.dailyEntries.find((item) => item.date === date);
  const scheduledType = resolveDayType(date, snapshot.trainingDays);
  const [dayTypeOverride, setDayTypeOverride] = useState<DayType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const dayType = dayTypeOverride ?? entry?.dayTypeOverride ?? scheduledType;
  const target = targetsForDate(snapshot.targets, date, dayType);
  const weekDates = new Set(recentDates(today, 7));
  const weekEntries = snapshot.dailyEntries.filter((item) => weekDates.has(item.date));
  const weekRows = recentDates(today, 7).reverse().map((item) => snapshot.dailyEntries.find((entry) => entry.date === item));
  const weights = weekEntries.map((item) => item.weightKg);
  const waists = weekEntries.map((item) => item.waistCm);
  const adherence = average(weekEntries.map((item) => item.calories === undefined ? undefined : Math.abs(item.calories - targetsForDate(snapshot.targets, item.date, resolveDayType(item.date, snapshot.trainingDays, item.dayTypeOverride)).calories) / targetsForDate(snapshot.targets, item.date, resolveDayType(item.date, snapshot.trainingDays, item.dayTypeOverride)).calories * 100));
  const performance = summarizePerformance(snapshot.topSets, today);
  const currentPeriod = [...snapshot.targets]
    .filter((period) => period.effectiveDate <= today)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value: DailyEntry = {
      date,
      dayTypeOverride: dayType === scheduledType ? undefined : dayType,
      weightKg: numberOrUndefined(form.get("weightKg")),
      waistCm: numberOrUndefined(form.get("waistCm")),
      calories: numberOrUndefined(form.get("calories")),
      sleepScore: numberOrUndefined(form.get("sleepScore")),
      readinessScore: numberOrUndefined(form.get("readinessScore")),
      trainingQualityScore: dayType === "training" ? numberOrUndefined(form.get("trainingQualityScore")) : undefined,
      updatedAtMs: new Date().valueOf()
    };
    const nextErrors = validateDailyEntry(value);
    setErrors(nextErrors);
    setSaveMessage("");
    if (nextErrors.length) return;

    setSaving(true);
    try {
      await data.saveDailyEntry(uid, value);
      setSaveMessage("Deň uložený.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Neznáma chyba.";
      setSaveMessage(`Uloženie zlyhalo: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div><p className="eyebrow">{format(fromLocalDate(date), "EEEE, d. MMMM", { locale: sk })}</p><h1>Dnes</h1></div>
        <SyncBadge />
      </header>
      {date !== today && <button className="text-button" onClick={() => { setDate(today); setDayTypeOverride(null); }}>← Späť na dnešok</button>}
      <section className="hero-card">
        <div><span className="pill">{dayType === "training" ? "Tréningový deň" : "Voľný deň"}</span><h2>{target.calories} kcal</h2><p>{target.proteinGrams} P · {Math.round(target.carbsGrams)} C · {target.fatGrams} F</p></div>
        <button className="day-toggle" onClick={() => setDayTypeOverride(dayType === "training" ? "rest" : "training")}>Prepnúť na {dayType === "training" ? "voľno" : "tréning"}</button>
      </section>
      <form className="panel entry-form" key={`${date}-${entry?.updatedAtMs ?? 0}`} onSubmit={save} noValidate>
        <div className="section-title"><div><small>Záznam</small><h2>{date}</h2></div>{dayType === "training" && <button type="button" className="text-button" onClick={onTraining}>Otvoriť tréning →</button>}</div>
        <div className="form-grid">
          <label>Hmotnosť (kg)<input name="weightKg" type="number" step="0.1" defaultValue={entry?.weightKg ?? ""} /></label>
          <label>Pás (cm)<input name="waistCm" type="number" step="0.1" defaultValue={entry?.waistCm ?? ""} /></label>
          <label>Kalórie<input name="calories" type="number" defaultValue={entry?.calories ?? ""} /></label>
          <label>Spánok 1–10<input name="sleepScore" type="number" min="1" max="10" defaultValue={entry?.sleepScore ?? ""} /></label>
          <label>Pripravenosť 1–10<input name="readinessScore" type="number" min="1" max="10" defaultValue={entry?.readinessScore ?? ""} /></label>
          {dayType === "training" && <label>Kvalita tréningu 1–10<input name="trainingQualityScore" type="number" min="1" max="10" defaultValue={entry?.trainingQualityScore ?? ""} /></label>}
        </div>
        {errors.length > 0 && <div className="error">{errors.map((item) => <div key={item}>{item}</div>)}</div>}
        {saveMessage && <div className={saveMessage.startsWith("Uloženie zlyhalo") ? "error" : "save-success"}>{saveMessage}</div>}
        <button className="primary" type="submit" disabled={saving}>{saving ? "Ukladám…" : "Uložiť deň"}</button>
      </form>
      <div className="stats-grid">
        <StatCard label="7 dní · hmotnosť" value={fmt(average(weights), " kg")} detail={trend(weekRows.map((row) => row?.weightKg), "kg")} />
        <StatCard label="7 dní · pás" value={fmt(average(waists), " cm")} detail={trend(weekRows.map((row) => row?.waistCm), "cm")} />
        <StatCard label="Kalorická odchýlka" value={fmt(adherence, " %")} detail="nižšie je lepšie" />
        <StatCard label="Výkon" value={fmt(performance.overallPercent, " %")} detail={`${performance.comparableExercises} porovnateľných cvikov`} />
      </div>
      <RecommendationCard
        snapshot={snapshot}
        today={today}
        currentTargets={{
          training: currentPeriod?.training ?? calculateMacros(2900, 180, 50),
          rest: currentPeriod?.rest ?? calculateMacros(2700, 180, 50)
        }}
        data={data}
        uid={uid}
      />
      <section className="panel">
        <div className="section-title"><div><small>História</small><h2>Posledných 7 dní</h2></div></div>
        <div className="history-list">{recentDates(today, 7).map((item) => {
          const row = snapshot.dailyEntries.find((candidate) => candidate.date === item);
          return <button key={item} className={date === item ? "active" : ""} onClick={() => { setDate(item); setDayTypeOverride(null); }}><span>{format(fromLocalDate(item), "EEE d.M.", { locale: sk })}</span><span>{row?.weightKg ? `${row.weightKg} kg` : "bez záznamu"}</span></button>;
        })}</div>
      </section>
    </div>
  );
}

function TopSetForm({ exercise, date, sets, save }: {
  exercise: Exercise;
  date: LocalDate;
  sets: TopSet[];
  save(value: TopSet): Promise<void>;
}) {
  const current = sets.find((item) => item.date === date && item.exerciseId === exercise.id);
  const previous = [...sets].filter((item) => item.exerciseId === exercise.id && item.date < date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const [errors, setErrors] = useState<string[]>([]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weightKg = Number(form.get("weightKg"));
    const reps = Number(form.get("reps"));
    const value: TopSet = {
      id: `${date}__${exercise.id}`,
      date,
      exerciseId: exercise.id,
      weightKg,
      reps,
      rir: Number(form.get("rir")),
      note: String(form.get("note") ?? "").trim() || undefined,
      estimated1RmKg: calculateE1Rm(weightKg, reps),
      updatedAtMs: new Date().valueOf()
    };
    const nextErrors = validateTopSet(value);
    setErrors(nextErrors);
    if (!nextErrors.length) await save(value);
  };
  const change = current && previous ? (current.estimated1RmKg - previous.estimated1RmKg) / previous.estimated1RmKg * 100 : null;
  return (
    <form className="exercise-card" onSubmit={submit} key={`${exercise.id}-${current?.updatedAtMs ?? 0}`}>
      <div className="exercise-heading"><div><small>{exercise.muscleGroup}</small><h3>{exercise.name}</h3></div><span>{exercise.repMin}–{exercise.repMax} op.</span></div>
      {previous && <p className="previous">Predtým {previous.weightKg} kg × {previous.reps} · e1RM {previous.estimated1RmKg.toFixed(1)} kg</p>}
      <div className="topset-grid">
        <label>kg<input required name="weightKg" type="number" step="0.1" defaultValue={current?.weightKg ?? ""} /></label>
        <label>op.<input required name="reps" type="number" min="1" defaultValue={current?.reps ?? ""} /></label>
        <label>RIR<input required name="rir" type="number" step="0.5" min="0" max="10" defaultValue={current?.rir ?? ""} /></label>
        <label className="note">Poznámka<input name="note" defaultValue={current?.note ?? ""} /></label>
      </div>
      {current && <p className="set-result">e1RM {current.estimated1RmKg.toFixed(1)} kg {change !== null && `· ${change >= 0 ? "+" : ""}${change.toFixed(1)} %`}</p>}
      {errors.length > 0 && <div className="error">{errors.join(" ")}</div>}
      <button className="secondary" type="submit">Uložiť top set</button>
    </form>
  );
}

function TrainingScreen({ snapshot, data, uid, today, onSwitchToday }: {
  snapshot: TrackerSnapshot;
  data: TrackerDataSource;
  uid: string;
  today: LocalDate;
  onSwitchToday(): void;
}) {
  const plan = snapshot.trainingDays.find((item) => item.weekday === weekdayIso(today));
  const entry = snapshot.dailyEntries.find((item) => item.date === today);
  const type = resolveDayType(today, snapshot.trainingDays, entry?.dayTypeOverride);
  const exercises = (plan?.exerciseIds ?? []).map((id) => snapshot.exercises.find((item) => item.id === id)).filter((item): item is Exercise => Boolean(item && !item.archivedAtMs && item.isMain));
  return (
    <div className="screen">
      <header className="screen-header"><div><p className="eyebrow">{plan?.label ?? "Dnešný plán"}</p><h1>Tréning</h1></div><SyncBadge /></header>
      {type === "rest" ? (
        <section className="panel empty-state"><h2>Dnes je podľa plánu voľno.</h2><p>Regenerácia je súčasť progresu. Ak dnes predsa trénuješ, prepni typ dňa.</p><button className="primary" onClick={onSwitchToday}>Prepnúť dnešok na tréning</button></section>
      ) : (
        <div className="exercise-list">
          {exercises.length === 0 && <section className="panel"><p>Pre tento deň nie sú priradené hlavné cviky.</p></section>}
          {exercises.map((exercise) => <TopSetForm key={exercise.id} exercise={exercise} date={today} sets={snapshot.topSets} save={(value) => data.saveTopSet(uid, value)} />)}
        </div>
      )}
    </div>
  );
}

function MiniLine({ values }: { values: Array<number | undefined> }) {
  const points = values.map((value, index) => ({ value, index })).filter((item): item is { value: number; index: number } => Number.isFinite(item.value));
  if (points.length < 2) return <div className="chart-empty">Aspoň 2 merania zobrazia trend.</div>;
  const min = Math.min(...points.map((item) => item.value));
  const max = Math.max(...points.map((item) => item.value));
  const range = max - min || 1;
  const d = points.map((item, index) => `${index ? "L" : "M"} ${item.index / Math.max(values.length - 1, 1) * 100} ${38 - ((item.value - min) / range) * 32}`).join(" ");
  return <svg className="mini-line" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true"><path d={d} /></svg>;
}

function ProgressScreen({ snapshot, today }: { snapshot: TrackerSnapshot; today: LocalDate }) {
  const dates = recentDates(today, 7).reverse();
  const rows = dates.map((date) => snapshot.dailyEntries.find((entry) => entry.date === date));
  const performance = summarizePerformance(snapshot.topSets, today);
  return (
    <div className="screen">
      <header className="screen-header"><div><p className="eyebrow">Posledných 7 dní</p><h1>Progress</h1></div></header>
      <div className="progress-grid">
        <section className="panel chart-card"><small>Hmotnosť</small><h2>{fmt(average(rows.map((row) => row?.weightKg)), " kg")}</h2><MiniLine values={rows.map((row) => row?.weightKg)} /></section>
        <section className="panel chart-card"><small>Pás</small><h2>{fmt(average(rows.map((row) => row?.waistCm)), " cm")}</h2><MiniLine values={rows.map((row) => row?.waistCm)} /></section>
      </div>
      <section className="panel">
        <div className="section-title"><div><small>Hlavné cviky</small><h2>Výkon {fmt(performance.overallPercent, " %")}</h2></div><span className="pill">{performance.comparableExercises} porovnaní</span></div>
        <div className="performance-list">
          {performance.items.length === 0 && <p>Na porovnanie potrebuješ dva top sety rovnakého cviku.</p>}
          {performance.items.map((item) => {
            const exercise = snapshot.exercises.find((row) => row.id === item.exerciseId);
            return <div key={item.exerciseId}><span>{exercise?.name ?? item.exerciseId}<small>{item.current.weightKg} kg × {item.current.reps} · RIR {item.current.rir}</small></span><strong className={item.percentChange >= 0 ? "positive" : "negative"}>{item.percentChange >= 0 ? "+" : ""}{item.percentChange.toFixed(1)} %</strong></div>;
          })}
        </div>
      </section>
    </div>
  );
}

function ExerciseEditor({ exercise, onSave }: { exercise: Exercise; onSave(value: Exercise): Promise<void> }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    return onSave({
      ...exercise,
      name: String(form.get("name")),
      muscleGroup: String(form.get("muscleGroup")),
      repMin: Number(form.get("repMin")),
      repMax: Number(form.get("repMax")),
      isMain: form.get("isMain") === "on"
    });
  };
  return <form className="settings-row" onSubmit={(event) => void submit(event)}>
    <input aria-label="Názov cviku" name="name" defaultValue={exercise.name} />
    <input aria-label="Svalová skupina" name="muscleGroup" defaultValue={exercise.muscleGroup} />
    <input aria-label="Minimum opakovaní" name="repMin" type="number" defaultValue={exercise.repMin} />
    <input aria-label="Maximum opakovaní" name="repMax" type="number" defaultValue={exercise.repMax} />
    <label className="check"><input name="isMain" type="checkbox" defaultChecked={exercise.isMain} /> hlavný</label>
    <button className="secondary" type="submit">Uložiť</button>
    <button type="button" className="text-button danger" onClick={() => void onSave({ ...exercise, archivedAtMs: new Date().valueOf() })}>Archivovať</button>
  </form>;
}

function SettingsScreen({ snapshot, data, uid, mode, onSignOut }: {
  snapshot: TrackerSnapshot;
  data: TrackerDataSource;
  uid: string;
  mode: Mode;
  onSignOut(): void;
}) {
  const [newName, setNewName] = useState("");
  const exportJson = async () => {
    const blob = new Blob([JSON.stringify(await data.exportAll(uid), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lean-bulk-export-${toLocalDate(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const addExercise = async () => {
    const id = `${newName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${new Date().valueOf().toString(36)}`;
    await data.saveExercise(uid, { id, name: newName.trim(), muscleGroup: "Iné", repMin: 6, repMax: 12, isMain: true });
    setNewName("");
  };
  const saveDay = (day: TrainingDayPlan, patch: Partial<TrainingDayPlan>) => data.saveTrainingDay(uid, { ...day, ...patch });
  return (
    <div className="screen">
      <header className="screen-header"><div><p className="eyebrow">{mode === "demo" ? "Lokálne dáta" : "Firebase účet"}</p><h1>Nastavenia</h1></div></header>
      <section className="panel">
        <div className="section-title"><div><small>Program</small><h2>Cviky</h2></div></div>
        <div className="add-row"><input placeholder="Nový cvik" value={newName} onChange={(event) => setNewName(event.target.value)} /><button className="primary" disabled={!newName.trim()} onClick={() => void addExercise()}>Pridať</button></div>
        <div className="settings-list">{snapshot.exercises.filter((item) => !item.archivedAtMs).map((exercise) => <ExerciseEditor key={exercise.id} exercise={exercise} onSave={(value) => data.saveExercise(uid, value)} />)}</div>
      </section>
      <section className="panel">
        <div className="section-title"><div><small>Týždeň</small><h2>Tréningové dni</h2></div></div>
        <div className="day-settings">{snapshot.trainingDays.map((day) => (
          <details key={day.weekday}>
            <summary><span>{day.weekday}. {day.label}</span><span>{day.enabled ? "Zapnutý" : "Voľno"}</span></summary>
            <div className="day-editor">
              <label className="check"><input type="checkbox" checked={day.enabled} onChange={(event) => void saveDay(day, { enabled: event.target.checked })} /> Tréningový deň</label>
              <label>Názov<input value={day.label} onChange={(event) => void saveDay(day, { label: event.target.value })} /></label>
              <div className="checkbox-list">{snapshot.exercises.filter((exercise) => !exercise.archivedAtMs).map((exercise) => {
                const index = day.exerciseIds.indexOf(exercise.id);
                const checked = index >= 0;
                return <div key={exercise.id}><label className="check"><input type="checkbox" checked={checked} onChange={() => void saveDay(day, { exerciseIds: checked ? day.exerciseIds.filter((id) => id !== exercise.id) : [...day.exerciseIds, exercise.id] })} />{exercise.name}</label>
                  {checked && <span><button aria-label={`${exercise.name} hore`} disabled={index === 0} onClick={() => {
                    const ids = [...day.exerciseIds]; [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; void saveDay(day, { exerciseIds: ids });
                  }}>↑</button><button aria-label={`${exercise.name} dole`} disabled={index === day.exerciseIds.length - 1} onClick={() => {
                    const ids = [...day.exerciseIds]; [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]]; void saveDay(day, { exerciseIds: ids });
                  }}>↓</button></span>}
                </div>;
              })}</div>
            </div>
          </details>
        ))}</div>
      </section>
      <section className="panel thresholds"><small>Bezpečnostné prahy · iba na čítanie</small><h2>Vyhodnotenie po 14 dňoch</h2><p>Min. 5 vážení v každom týždni · 10 kalorických dní · 4 merania pásu · kalorická odchýlka max. 10 %.</p><p>Chýbajúce, slabé alebo protichodné dáta nikdy nevytvoria akciu na zmenu kalórií.</p></section>
      <section className="panel button-stack">
        <button className="secondary" onClick={() => void exportJson()}>Exportovať JSON</button>
        {mode === "demo" && <button className="secondary danger" onClick={() => data.reset?.()}>Resetovať demo dáta</button>}
        <button className="text-button danger" onClick={onSignOut}>Odhlásiť sa</button>
      </section>
    </div>
  );
}

export function App({ initialMode, now = new Date() }: AppProps) {
  const [mode, setMode] = useState<Mode | null>(() => initialMode ?? localStorage.getItem(MODE_KEY) as Mode | null);
  const [uid, setUid] = useState<string | null>(mode === "demo" ? "demo" : null);
  const [data, setData] = useState<TrackerDataSource | null>(() => mode === "demo" ? createDemoTrackerData(localStorage) : null);
  const [snapshotState, setSnapshotState] = useState<{
    ownerUid: string | null;
    snapshot: TrackerSnapshot;
  }>({ ownerUid: null, snapshot: EMPTY });
  const [screen, setScreen] = useState<Screen>("today");
  const [authError, setAuthError] = useState("");
  const today = toLocalDate(now);
  const allowDemo = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" || initialMode === "demo";
  const snapshot = snapshotState.ownerUid === uid ? snapshotState.snapshot : EMPTY;

  useEffect(() => {
    if (mode !== "cloud") return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void import("../data/trackerData").then((cloud) => {
      if (cancelled) return;
      setData(cloud.cloudTrackerData);
      const nextUnsubscribe = cloud.subscribeUser((user) => {
        if (!cancelled) {
          const nextUid = user?.uid ?? null;
          setUid(nextUid);
          setSnapshotState((current) =>
            current.ownerUid === nextUid
              ? current
              : { ownerUid: nextUid, snapshot: EMPTY }
          );
        }
      });
      if (cancelled) nextUnsubscribe();
      else unsubscribe = nextUnsubscribe;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [mode]);

  useEffect(() => {
    if (!data || !uid) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void data.seedIfNeeded(uid).then(() => {
      if (cancelled) return;
      const nextUnsubscribe = data.subscribeTracker(uid, (value) => {
        if (!cancelled) setSnapshotState({ ownerUid: uid, snapshot: value });
      });
      if (cancelled) nextUnsubscribe();
      else unsubscribe = nextUnsubscribe;
    }).catch((error: unknown) => {
      if (!cancelled) {
        setAuthError(error instanceof Error ? error.message : "Dáta sa nepodarilo načítať.");
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [data, uid]);

  const enterDemo = () => {
    localStorage.setItem(MODE_KEY, "demo");
    setMode("demo");
    setUid("demo");
    setSnapshotState({ ownerUid: "demo", snapshot: EMPTY });
    setData(createDemoTrackerData(localStorage));
  };
  const enterCloud = async () => {
    try {
      const cloud = await import("../data/trackerData");
      localStorage.setItem(MODE_KEY, "cloud");
      setMode("cloud");
      setData(cloud.cloudTrackerData);
      await cloud.signInWithGoogle();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Prihlásenie zlyhalo.");
    }
  };
  const signOut = async () => {
    if (mode === "cloud") {
      const cloud = await import("../data/trackerData");
      await cloud.signOutCurrentUser();
    }
    localStorage.removeItem(MODE_KEY);
    setMode(null);
    setUid(null);
    setData(null);
    setSnapshotState({ ownerUid: null, snapshot: EMPTY });
  };
  const switchTodayToTraining = async () => {
    if (!data || !uid) return;
    const current = snapshot.dailyEntries.find((item) => item.date === today);
    await data.saveDailyEntry(uid, { ...current, date: today, dayTypeOverride: "training", updatedAtMs: new Date().valueOf() });
    setScreen("training");
  };

  if (!mode || !uid || !data) return <AuthGate allowDemo={allowDemo} onDemo={enterDemo} onGoogle={() => void enterCloud()} error={authError} />;
  if (!snapshot.profile) return <main className="loading"><div className="brand-mark">LB</div><p>Pripravujem tracker…</p></main>;

  const content = {
    today: <TodayScreen snapshot={snapshot} data={data} uid={uid} now={now} onTraining={() => setScreen("training")} />,
    training: <TrainingScreen snapshot={snapshot} data={data} uid={uid} today={today} onSwitchToday={() => void switchTodayToTraining()} />,
    progress: <ProgressScreen snapshot={snapshot} today={today} />,
    settings: <SettingsScreen snapshot={snapshot} data={data} uid={uid} mode={mode} onSignOut={() => void signOut()} />
  }[screen];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">LB</div><div><strong>Lean Bulk</strong><small>Personal tracker</small></div></div>
        <nav>{nav.map(([id, label]) => <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id)}>{label}</button>)}</nav>
        <SyncBadge />
      </aside>
      <main className="content">{content}</main>
      <nav className="bottom-nav">{nav.map(([id, label]) => <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id)}>{label}</button>)}</nav>
    </div>
  );
}
