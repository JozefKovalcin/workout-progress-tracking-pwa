import { useState, type FormEvent } from "react";
import {
  calculateE1Rm,
  workoutE1Rm
} from "../../domain/performance";
import type { Exercise, LocalDate, TopSet } from "../../domain/types";
import { validateTopSet } from "../../domain/validation";
import { requiredNumber } from "../helpers";
import { describeTrainingFeedback } from "../insights";

interface TopSetFormProps {
  exercise: Exercise;
  date: LocalDate;
  sets: TopSet[];
  save(value: TopSet): Promise<void>;
}

type SetInputs = Array<{
  weightKg: string;
  reps: string;
  rir: string;
}>;

function topSetSets(set: TopSet | undefined) {
  if (!set) return [];
  return set.sets?.length === 2
    ? set.sets
    : [{
        weightKg: set.weightKg,
        reps: set.reps,
        rir: set.rir,
        estimated1RmKg: set.estimated1RmKg
      }];
}

function buildInputs(set: TopSet | undefined): SetInputs {
  const sets = topSetSets(set);
  return [0, 1].map((index) => ({
    weightKg: sets[index]?.weightKg === undefined ? "" : String(sets[index].weightKg),
    reps: sets[index]?.reps === undefined ? "" : String(sets[index].reps),
    rir: sets[index]?.rir === undefined ? "" : String(sets[index].rir)
  }));
}

function liveAverage(inputs: SetInputs) {
  const values = inputs.map((set) => {
    const weightKg = Number(set.weightKg);
    const reps = Number(set.reps);
    return Number.isFinite(weightKg) && weightKg > 0 && Number.isFinite(reps) && reps > 0
      ? calculateE1Rm(weightKg, reps)
      : null;
  });
  return values.every((value): value is number => value !== null)
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

export function TopSetForm({ exercise, date, sets, save }: TopSetFormProps) {
  const current = sets.find((item) => item.date === date && item.exerciseId === exercise.id);
  const previous = [...sets].filter((item) => item.exerciseId === exercise.id && item.date < date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedAverage, setSavedAverage] = useState<number | null>(null);
  const [setInputs, setSetInputs] = useState<SetInputs>(() => buildInputs(current));
  const [note, setNote] = useState(current?.note ?? "");

  const updateSet = (setIndex: number, field: keyof SetInputs[number], value: string) => {
    setSetInputs((currentInputs) =>
      currentInputs.map((item, index) =>
        index === setIndex ? { ...item, [field]: value } : item
      )
    );
  };

  const repeatPrevious = () => {
    setSetInputs(buildInputs(previous));
    setNote(previous?.note ?? "");
    setErrors([]);
    setSaveMessage("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const workingSets = setInputs.map((input) => {
      const weightKg = requiredNumber(input.weightKg);
      const reps = requiredNumber(input.reps);
      return {
        weightKg,
        reps,
        rir: requiredNumber(input.rir),
        estimated1RmKg: calculateE1Rm(weightKg, reps)
      };
    });
    const first = workingSets[0];
    const value: TopSet = {
      id: `${date}__${exercise.id}`,
      date,
      exerciseId: exercise.id,
      weightKg: first.weightKg,
      reps: first.reps,
      rir: first.rir,
      note: note.trim() || undefined,
      estimated1RmKg: first.estimated1RmKg,
      sets: workingSets,
      updatedAtMs: new Date().valueOf()
    };
    const nextErrors = validateTopSet(value);
    setErrors(nextErrors);
    setSaveMessage("");
    if (nextErrors.length) return;

    setSaving(true);
    try {
      await save(value);
      setSavedAverage(workoutE1Rm(value));
      setSaveMessage("Tréning uložený.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Neznáma chyba.";
      setSaveMessage(`Uloženie tréningu zlyhalo: ${detail}`);
    } finally {
      setSaving(false);
    }
  };
  const change = current && previous ? (workoutE1Rm(current) - workoutE1Rm(previous)) / workoutE1Rm(previous) * 100 : null;
  const displayedAverage = savedAverage ?? (current ? workoutE1Rm(current) : null);
  const live = liveAverage(setInputs);
  const liveFeedback = describeTrainingFeedback(live, previous);
  return (
    <form className="exercise-card" onSubmit={submit} noValidate key={`${exercise.id}-${current?.updatedAtMs ?? 0}`}>
      <div className="exercise-heading"><div><small>{exercise.muscleGroup}</small><h3>{exercise.name}</h3></div><span>{exercise.repMin}–{exercise.repMax} op.</span></div>
      {previous && (
        <div className="previous-row">
          <p className="previous">Predtým · priemerné e1RM {workoutE1Rm(previous).toFixed(1)} kg</p>
          <button type="button" className="text-button" onClick={repeatPrevious}>Opakovať minule</button>
        </div>
      )}
      <div className="working-sets">
        {[0, 1].map((setIndex) => (
          <fieldset className="working-set" key={setIndex}>
            <legend>Séria {setIndex + 1}</legend>
            <div className="topset-grid">
              <label>Séria {setIndex + 1} kg<input name={`weightKg${setIndex + 1}`} type="number" step="0.1" value={setInputs[setIndex].weightKg} onChange={(event) => updateSet(setIndex, "weightKg", event.target.value)} /></label>
              <label>Séria {setIndex + 1} opakovania<input name={`reps${setIndex + 1}`} type="number" min="1" value={setInputs[setIndex].reps} onChange={(event) => updateSet(setIndex, "reps", event.target.value)} /></label>
              <label>Séria {setIndex + 1} RIR<input name={`rir${setIndex + 1}`} type="number" step="0.5" min="0" max="10" value={setInputs[setIndex].rir} onChange={(event) => updateSet(setIndex, "rir", event.target.value)} /></label>
            </div>
          </fieldset>
        ))}
      </div>
      <label className="note">Poznámka<input name="note" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      {live !== null && (
        <p className={`set-result ${liveFeedback.tone}`}>
          Live e1RM {live.toFixed(1)} kg · <strong>{liveFeedback.label}</strong> <span>{liveFeedback.detail}</span>
        </p>
      )}
      {displayedAverage !== null && <p className="set-result">Priemerné e1RM {displayedAverage.toFixed(1)} kg {change !== null && `· ${change >= 0 ? "+" : ""}${change.toFixed(1)} %`}</p>}
      {errors.length > 0 && <div className="error" role="alert">{errors.join(" ")}</div>}
      {saveMessage && <div aria-live="polite" role="status" className={saveMessage.startsWith("Uloženie") ? "error" : "save-success"}>{saveMessage}</div>}
      <button className="secondary" type="submit" disabled={saving}>{saving ? "Ukladám…" : "Uložiť 2 série"}</button>
    </form>
  );
}
