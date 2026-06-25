import { format, subDays } from "date-fns";
import { sk } from "date-fns/locale";
import { useRef, useState, type FormEvent } from "react";
import { calculateMacros, resolveDayType } from "../../domain/macros";
import { summarizePerformance } from "../../domain/performance";
import {
  classifyCalorieAdherence,
  classifyStrengthTrend,
  classifyWaistTrend,
  classifyWeightTrend
} from "../../domain/trends";
import type { DailyEntry, DayType } from "../../domain/types";
import { validateDailyEntry } from "../../domain/validation";
import type { TrackerDataSource, TrackerSnapshot } from "../../data/trackerData";
import { fromLocalDate, toLocalDate } from "../../domain/date";
import { NumberStepper } from "../components/NumberStepper";
import { RecommendationCard } from "../components/RecommendationCard";
import {
  average,
  currentTargetPeriod,
  fmt,
  numberOrUndefined,
  recentDates,
  targetForEntry,
  targetsForDate,
  trend
} from "../helpers";
import { buildBlockCompleteness } from "../insights";
import { StatCard } from "../ui/StatCard";
import { SyncBadge } from "../ui/SyncBadge";

interface TodayScreenProps {
  snapshot: TrackerSnapshot;
  data: TrackerDataSource;
  uid: string;
  now: Date;
  onTraining(): void;
}

function validValues(values: Array<number | undefined>) {
  return values.filter((value): value is number => Number.isFinite(value));
}

function valueChange(values: Array<number | undefined>) {
  const valid = validValues(values);
  return valid.length < 2 ? Number.NaN : valid.at(-1)! - valid[0];
}

function weightChangePct(values: Array<number | undefined>) {
  const valid = validValues(values);
  if (valid.length < 2 || valid[0] === 0) return Number.NaN;
  return ((valid.at(-1)! - valid[0]) / valid[0]) * 100;
}

export function TodayScreen({
  snapshot,
  data,
  uid,
  now,
  onTraining
}: TodayScreenProps) {
  const today = toLocalDate(now);
  const [date, setDate] = useState(today);
  const entry = snapshot.dailyEntries.find((item) => item.date === date);
  const scheduledType = resolveDayType(date, snapshot.trainingDays);
  const [dayTypeOverride, setDayTypeOverride] = useState<DayType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const caloriesInputRef = useRef<HTMLInputElement>(null);
  const dayType = dayTypeOverride ?? entry?.dayTypeOverride ?? scheduledType;
  const target = targetsForDate(snapshot.targets, date, dayType);
  const previousDate = toLocalDate(subDays(fromLocalDate(date), 1));
  const previousEntry = snapshot.dailyEntries.find((item) => item.date === previousDate);
  const previousCalories = previousEntry?.calories;
  const completeness = buildBlockCompleteness(snapshot, today);
  const missingRows = [
    ["Hmotnosť", completeness.missing.weight],
    ["Pás", completeness.missing.waist],
    ["Kalórie", completeness.missing.calories],
    ["Kvalita tréningu", completeness.missing.trainingQuality]
  ] as const;
  const weekDates = new Set(recentDates(today, 7));
  const weekEntries = snapshot.dailyEntries.filter((item) => weekDates.has(item.date));
  const weekRows = recentDates(today, 7).reverse().map((item) => snapshot.dailyEntries.find((entry) => entry.date === item));
  const weights = weekEntries.map((item) => item.weightKg);
  const waists = weekEntries.map((item) => item.waistCm);
  const weightTrendValues = weekRows.map((row) => row?.weightKg);
  const waistTrendValues = weekRows.map((row) => row?.waistCm);
  const adherence = average(weekEntries.map((item) => item.calories === undefined ? undefined : Math.abs(item.calories - targetForEntry(snapshot, item.date, item.dayTypeOverride).calories) / targetForEntry(snapshot, item.date, item.dayTypeOverride).calories * 100));
  const performance = summarizePerformance(snapshot.topSets, today);
  const weightClassification = classifyWeightTrend({
    weeklyChangePct: weightChangePct(weightTrendValues),
    targetGainMinPct: snapshot.profile?.targetGainMinPct ?? Number.NaN,
    targetGainMaxPct: snapshot.profile?.targetGainMaxPct ?? Number.NaN
  });
  const waistClassification = classifyWaistTrend(valueChange(waistTrendValues));
  const adherenceClassification = classifyCalorieAdherence(adherence);
  const performanceClassification = classifyStrengthTrend(performance.overallPercent ?? Number.NaN);
  const currentPeriod = currentTargetPeriod(snapshot.targets, today);

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
      <section className="panel completeness-card" aria-label="Kompletnosť dát">
        <div className="section-title">
          <div><small>Aktuálny 14-dňový blok</small><h2>Blok dát</h2></div>
          <span className="pill">{completeness.completed}/{completeness.total}</span>
        </div>
        <div className="completeness-meter" aria-hidden="true">
          <span style={{ width: `${completeness.total ? completeness.completed / completeness.total * 100 : 0}%` }} />
        </div>
        <div className="missing-grid">
          {missingRows.map(([label, dates]) => (
            <div key={label} className={dates.length ? "missing" : "complete"}>
              <strong>{label}</strong>
              <span>{dates.length ? dates.join(", ") : "OK"}</span>
            </div>
          ))}
        </div>
      </section>
      <form className="panel entry-form" key={`${date}-${entry?.updatedAtMs ?? 0}`} onSubmit={save} noValidate>
        <div className="section-title"><div><small>Záznam</small><h2>{date}</h2></div>{dayType === "training" && <button type="button" className="text-button" onClick={onTraining}>Otvoriť tréning →</button>}</div>
        <div className="form-grid">
          <NumberStepper label="Hmotnosť (kg)" name="weightKg" step={0.1} min={30} max={300} precision={1} suffix="kg" defaultValue={entry?.weightKg ?? ""} />
          <NumberStepper label="Pás (cm)" name="waistCm" step={0.1} min={40} max={250} precision={1} suffix="cm" defaultValue={entry?.waistCm ?? ""} />
          <div className="field-with-action">
            <NumberStepper label="Kalórie" name="calories" step={50} min={0} max={10000} suffix="kcal" defaultValue={entry?.calories ?? ""} inputRef={(node) => { caloriesInputRef.current = node; }} />
            {previousCalories !== undefined && <button type="button" className="text-button" onClick={() => { if (caloriesInputRef.current) caloriesInputRef.current.value = String(previousCalories); }}>Kopírovať včerajšie kalórie</button>}
          </div>
          <NumberStepper label="Spánok 1–10" name="sleepScore" step={1} min={1} max={10} precision={0} defaultValue={entry?.sleepScore ?? ""} />
          <NumberStepper label="Pripravenosť 1–10" name="readinessScore" step={1} min={1} max={10} precision={0} defaultValue={entry?.readinessScore ?? ""} />
          {dayType === "training" && <NumberStepper label="Kvalita tréningu 1–10" name="trainingQualityScore" step={1} min={1} max={10} precision={0} defaultValue={entry?.trainingQualityScore ?? ""} />}
        </div>
        {errors.length > 0 && <div className="error" role="alert">{errors.map((item) => <div key={item}>{item}</div>)}</div>}
        {saveMessage && <div aria-live="polite" role="status" className={saveMessage.startsWith("Uloženie zlyhalo") ? "error" : "save-success"}>{saveMessage}</div>}
        <button className="primary" type="submit" disabled={saving}>{saving ? "Ukladám…" : "Uložiť deň"}</button>
      </form>
      <div className="stats-grid">
        <StatCard label="7 dní · hmotnosť" value={fmt(average(weights), " kg")} detail={trend(weightTrendValues, "kg")} toneClassName={weightClassification.className} badge={weightClassification.badge} />
        <StatCard label="7 dní · pás" value={fmt(average(waists), " cm")} detail={trend(waistTrendValues, "cm")} toneClassName={waistClassification.className} badge={waistClassification.badge} />
        <StatCard label="Kalorická odchýlka" value={fmt(adherence, " %")} detail="nižšie je lepšie" toneClassName={adherenceClassification.className} badge={adherenceClassification.badge} />
        <StatCard label="Výkon" value={fmt(performance.overallPercent, " %")} detail={`${performance.comparableExercises} porovnateľných cvikov`} toneClassName={performanceClassification.className} badge={performanceClassification.badge} />
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
