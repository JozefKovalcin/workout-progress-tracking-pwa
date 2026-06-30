import { useState, type ChangeEvent } from "react";
import {
  formatDisplayDate,
  isLocalDate,
  weekdayIso
} from "../../domain/date";
import { resolveDayType } from "../../domain/macros";
import type {
  Exercise,
  LocalDate,
  TrainingDayPlan
} from "../../domain/types";
import type { TrackerDataSource, TrackerSnapshot } from "../../data/trackerData";
import { TopSetForm } from "../components/TopSetForm";
import { SyncBadge } from "../ui/SyncBadge";

interface TrainingScreenProps {
  snapshot: TrackerSnapshot;
  data: TrackerDataSource;
  uid: string;
  today: LocalDate;
  selectedDate: LocalDate;
  onDateChange(value: LocalDate): void;
  onSwitchDayToTraining(value: LocalDate): void;
}

function activeMainExercise(exercise: Exercise | undefined): exercise is Exercise {
  return Boolean(exercise && !exercise.archivedAtMs && exercise.isMain);
}

function exercisesForPlan(plan: TrainingDayPlan | undefined, exercises: Exercise[]) {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const selected: Exercise[] = [];
  const selectedIds = new Set<string>();

  for (const id of plan?.exerciseIds ?? []) {
    const exercise = byId.get(id);
    if (activeMainExercise(exercise)) {
      selected.push(exercise);
      selectedIds.add(exercise.id);
    }
  }

  const categories = new Set(plan?.categoryNames ?? []);
  for (const exercise of exercises) {
    if (
      activeMainExercise(exercise) &&
      categories.has(exercise.muscleGroup) &&
      !selectedIds.has(exercise.id)
    ) {
      selected.push(exercise);
      selectedIds.add(exercise.id);
    }
  }

  return selected;
}

export function TrainingScreen({
  snapshot,
  data,
  uid,
  today,
  selectedDate,
  onDateChange,
  onSwitchDayToTraining
}: TrainingScreenProps) {
  const [dateError, setDateError] = useState("");
  const plan = snapshot.trainingDays.find((item) => item.weekday === weekdayIso(selectedDate));
  const entry = snapshot.dailyEntries.find((item) => item.date === selectedDate);
  const type = resolveDayType(selectedDate, snapshot.trainingDays, entry?.dayTypeOverride);
  const exercises = exercisesForPlan(plan, snapshot.exercises);
  const categoryNames = plan?.categoryNames ?? [];
  const updateDate = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!isLocalDate(value) || value > today) {
      setDateError("Vyber platný dátum najneskôr dnes.");
      return;
    }
    setDateError("");
    onDateChange(value);
  };

  return (
    <div className="screen">
      <header className="screen-header"><div><p className="eyebrow">{formatDisplayDate(selectedDate)}</p><h1>Tréning</h1></div><SyncBadge /></header>
      <section className="panel training-date-panel">
        <label>Dátum tréningu
          <input
            aria-label="Dátum tréningu"
            type="date"
            value={selectedDate}
            min={snapshot.profile?.startDate}
            max={today}
            onChange={updateDate}
          />
        </label>
        <div>
          <small>{plan?.label ?? "Bez plánu"}</small>
          <strong>{formatDisplayDate(selectedDate)}</strong>
          {categoryNames.length > 0 && <span>Kategórie: {categoryNames.join(", ")}</span>}
        </div>
        {selectedDate !== today && <button className="text-button" type="button" onClick={() => onDateChange(today)}>Späť na dnešok</button>}
        {dateError && <p className="error" role="alert">{dateError}</p>}
      </section>
      {type === "rest" ? (
        <section className="panel empty-state"><h2>Tento deň je podľa plánu voľno.</h2><p>Regenerácia je súčasť progresu. Ak si v tento deň trénoval, prepni typ dňa.</p><button className="primary" onClick={() => onSwitchDayToTraining(selectedDate)}>Prepnúť deň na tréning</button></section>
      ) : (
        <div className="exercise-list">
          {exercises.length === 0 && <section className="panel"><p>Pre tento deň nie sú priradené hlavné cviky ani kategórie.</p></section>}
          {exercises.map((exercise) => <TopSetForm key={`${selectedDate}-${exercise.id}`} exercise={exercise} date={selectedDate} sets={snapshot.topSets} save={(value) => data.saveTopSet(uid, value)} />)}
        </div>
      )}
    </div>
  );
}
