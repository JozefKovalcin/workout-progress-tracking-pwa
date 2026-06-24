import { useState } from "react";
import {
  buildDailySeries,
  buildStrengthSeries,
  type ProgressRange
} from "../../domain/progress";
import {
  summarizePerformance,
  workoutE1Rm
} from "../../domain/performance";
import type { LocalDate } from "../../domain/types";
import type { TrackerSnapshot } from "../../data/trackerData";
import { LineChart } from "../components/LineChart";
import { average, fmt, targetForEntry } from "../helpers";
import {
  buildMovingAverageSeries,
  summarizeTrend
} from "../insights";
import { StatCard } from "../ui/StatCard";

interface ProgressScreenProps {
  snapshot: TrackerSnapshot;
  today: LocalDate;
}

export function ProgressScreen({ snapshot, today }: ProgressScreenProps) {
  const [range, setRange] = useState<ProgressRange>(7);
  const mainExercises = snapshot.exercises.filter((exercise) => exercise.isMain && !exercise.archivedAtMs);
  const [exerciseId, setExerciseId] = useState(mainExercises[0]?.id ?? "");
  const selectedExercise = mainExercises.find((exercise) => exercise.id === exerciseId) ?? mainExercises[0];
  const weight = buildDailySeries(snapshot.dailyEntries, "weightKg", today, range);
  const waist = buildDailySeries(snapshot.dailyEntries, "waistCm", today, range);
  const calories = buildDailySeries(snapshot.dailyEntries, "calories", today, range);
  const weightAverage = buildMovingAverageSeries(weight, 7);
  const strength = selectedExercise
    ? buildStrengthSeries(snapshot.topSets, selectedExercise.id, today, range)
    : [];
  const performance = summarizePerformance(snapshot.topSets, today);
  const calorieAdherence = average(calories.map((point) => {
    const entry = snapshot.dailyEntries.find((item) => item.date === point.date);
    if (!entry?.calories) return undefined;
    const target = targetForEntry(snapshot, entry.date, entry.dayTypeOverride);
    return Math.abs(entry.calories - target.calories) / target.calories * 100;
  }));
  const rangeLabel = range === "all" ? "Všetky dáta" : `Posledných ${range} dní`;
  return (
    <div className="screen">
      <header className="screen-header"><div><p className="eyebrow">{rangeLabel}</p><h1>Progress</h1></div></header>
      <div className="stats-grid">
        <StatCard label="Trend hmotnosti" value={summarizeTrend(weight, "kg")} detail={weightAverage.length ? "7-dňový priemer" : "zbieraj merania"} />
        <StatCard label="Trend pásu" value={summarizeTrend(waist, "cm")} detail="nižší pás je lepší signál" />
        <StatCard label="Kalorická presnosť" value={fmt(calorieAdherence, " %")} detail="priemerná odchýlka" />
        <StatCard label="Trend sily" value={summarizeTrend(strength, "kg")} detail={`${performance.comparableExercises} porovnaní`} />
      </div>
      <section className="progress-controls">
        <div className="range-selector" aria-label="Obdobie grafov">
          {([
            [7, "7 dní"],
            [30, "30 dní"],
            [90, "90 dní"],
            ["all", "Všetko"]
          ] as Array<[ProgressRange, string]>).map(([value, label]) => (
            <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{label}</button>
          ))}
        </div>
        <label>Cvik pre graf sily
          <select aria-label="Cvik pre graf sily" value={selectedExercise?.id ?? ""} onChange={(event) => setExerciseId(event.target.value)}>
            {mainExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
          </select>
        </label>
      </section>
      <div className="progress-grid chart-grid">
        <LineChart title="Hmotnosť" ariaLabel="Graf hmotnosti" points={weight} unit=" kg" secondaryPoints={weightAverage} secondaryLabel="7-dňový priemer" />
        <LineChart title="Pás" ariaLabel="Graf pásu" points={waist} unit=" cm" />
        <LineChart title="Kalórie" ariaLabel="Graf kalórií" points={calories} unit=" kcal" />
        <LineChart title={`Sila · ${selectedExercise?.name ?? "vyber cvik"}`} ariaLabel={`Graf sily ${selectedExercise?.name ?? ""}`.trim()} points={strength} unit=" kg" />
      </div>
      <section className="panel">
        <div className="section-title"><div><small>Hlavné cviky</small><h2>Výkon {fmt(performance.overallPercent, " %")}</h2></div><span className="pill">{performance.comparableExercises} porovnaní</span></div>
        <div className="performance-list">
          {performance.items.length === 0 && <p>Na porovnanie potrebuješ dva top sety rovnakého cviku.</p>}
          {performance.items.map((item) => {
            const exercise = snapshot.exercises.find((row) => row.id === item.exerciseId);
            return <div key={item.exerciseId}><span>{exercise?.name ?? item.exerciseId}<small>Priemerné e1RM {workoutE1Rm(item.current).toFixed(1)} kg</small></span><strong className={item.percentChange >= 0 ? "positive" : "negative"}>{item.percentChange >= 0 ? "+" : ""}{item.percentChange.toFixed(1)} %</strong></div>;
          })}
        </div>
      </section>
    </div>
  );
}
