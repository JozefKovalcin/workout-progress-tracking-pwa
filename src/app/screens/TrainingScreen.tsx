import { weekdayIso } from "../../domain/date";
import { resolveDayType } from "../../domain/macros";
import type { Exercise, LocalDate } from "../../domain/types";
import type { TrackerDataSource, TrackerSnapshot } from "../../data/trackerData";
import { TopSetForm } from "../components/TopSetForm";
import { SyncBadge } from "../ui/SyncBadge";

interface TrainingScreenProps {
  snapshot: TrackerSnapshot;
  data: TrackerDataSource;
  uid: string;
  today: LocalDate;
  onSwitchToday(): void;
}

export function TrainingScreen({
  snapshot,
  data,
  uid,
  today,
  onSwitchToday
}: TrainingScreenProps) {
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
