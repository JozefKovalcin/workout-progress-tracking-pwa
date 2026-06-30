import { useState, type ChangeEvent, type FormEvent } from "react";
import { formatDisplayDate, toLocalDate } from "../../domain/date";
import type { Exercise, TrainingDayPlan } from "../../domain/types";
import type { TrackerDataSource, TrackerSnapshot } from "../../data/trackerData";
import type { Mode } from "../appTypes";

const CATEGORY_DATALIST_ID = "exercise-category-options";

function ExerciseEditor({
  exercise,
  onSave,
  onArchive
}: {
  exercise: Exercise;
  onSave(value: Exercise): Promise<void>;
  onArchive(value: Exercise): void;
}) {
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
    <input aria-label="Kategória cviku" name="muscleGroup" list={CATEGORY_DATALIST_ID} defaultValue={exercise.muscleGroup} />
    <input aria-label="Minimum opakovaní" name="repMin" type="number" defaultValue={exercise.repMin} />
    <input aria-label="Maximum opakovaní" name="repMax" type="number" defaultValue={exercise.repMax} />
    <label className="check"><input name="isMain" type="checkbox" defaultChecked={exercise.isMain} /> hlavný</label>
    <button className="secondary" type="submit">Uložiť</button>
    <button type="button" className="text-button danger" onClick={() => onArchive(exercise)}>Archivovať</button>
  </form>;
}

interface SettingsScreenProps {
  snapshot: TrackerSnapshot;
  data: TrackerDataSource;
  uid: string;
  mode: Mode;
  onSignOut(): void;
}

export function SettingsScreen({
  snapshot,
  data,
  uid,
  mode,
  onSignOut
}: SettingsScreenProps) {
  const [newName, setNewName] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const activeExercises = snapshot.exercises.filter((item) => !item.archivedAtMs);
  const exerciseCategories = Array.from(
    new Set(
      activeExercises
        .map((exercise) => exercise.muscleGroup.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, "sk"));
  const categoryOptions = [...new Set([...exerciseCategories, "Iné"])];

  const exportJson = async () => {
    const blob = new Blob([JSON.stringify(await data.exportAll(uid), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lean-bulk-export-${toLocalDate(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !data.importAll) return;
    setImportMessage("");
    try {
      await data.importAll(uid, JSON.parse(await file.text()));
      setImportMessage("Import hotový.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Neznáma chyba.";
      setImportMessage(`Import zlyhal: ${detail}`);
    } finally {
      event.target.value = "";
    }
  };
  const addExercise = async () => {
    const id = `${newName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${new Date().valueOf().toString(36)}`;
    await data.saveExercise(uid, { id, name: newName.trim(), muscleGroup: "Iné", repMin: 6, repMax: 12, isMain: true });
    setNewName("");
  };
  const saveDay = (day: TrainingDayPlan, patch: Partial<TrainingDayPlan>) => data.saveTrainingDay(uid, { ...day, ...patch });
  const archiveExercise = (exercise: Exercise) => {
    if (!window.confirm(`Archivovať cvik ${exercise.name}?`)) return;
    void data.saveExercise(uid, { ...exercise, archivedAtMs: new Date().valueOf() });
  };
  const resetDemo = () => {
    if (!window.confirm("Resetovať všetky demo dáta?")) return;
    data.reset?.();
  };

  return (
    <div className="screen">
      <header className="screen-header"><div><p className="eyebrow">{mode === "demo" ? "Lokálne dáta" : "Firebase účet"}</p><h1>Nastavenia</h1></div></header>
      <section className="panel settings-section">
        <div className="section-title"><div><small>Profil</small><h2>Kalibrácia</h2></div></div>
        <div className="settings-summary">
          <div><span>Štart</span><strong>{snapshot.profile ? formatDisplayDate(snapshot.profile.startDate) : "—"}</strong></div>
          <div><span>Tréning</span><strong>{snapshot.profile?.trainingCalories ?? "—"} kcal</strong></div>
          <div><span>Voľno</span><strong>{snapshot.profile?.restCalories ?? "—"} kcal</strong></div>
          <div><span>Vyhodnotenie</span><strong>14 dní</strong></div>
        </div>
      </section>
      <section className="panel">
        <div className="section-title"><div><small>Cviky</small><h2>Hlavné cviky</h2></div></div>
        <datalist id={CATEGORY_DATALIST_ID}>
          {categoryOptions.map((category) => <option key={category} value={category} />)}
        </datalist>
        <div className="add-row"><input placeholder="Nový cvik" value={newName} onChange={(event) => setNewName(event.target.value)} /><button className="primary" disabled={!newName.trim()} onClick={() => void addExercise()}>Pridať</button></div>
        <div className="settings-list">{activeExercises.map((exercise) => <ExerciseEditor key={exercise.id} exercise={exercise} onArchive={archiveExercise} onSave={(value) => data.saveExercise(uid, value)} />)}</div>
      </section>
      <section className="panel">
        <div className="section-title"><div><small>Tréningový týždeň</small><h2>Tréningové dni</h2></div></div>
        <div className="day-settings">{snapshot.trainingDays.map((day) => {
          const dayCategoryNames = day.categoryNames ?? [];
          return (
            <details key={day.weekday}>
              <summary><span>{day.weekday}. {day.label}</span><span>{day.enabled ? "Zapnutý" : "Voľno"}{dayCategoryNames.length ? ` · ${dayCategoryNames.length} kateg.` : ""}</span></summary>
              <div className="day-editor">
                <label className="check"><input type="checkbox" checked={day.enabled} onChange={(event) => void saveDay(day, { enabled: event.target.checked })} /> Tréningový deň</label>
                <label>Názov<input value={day.label} onChange={(event) => void saveDay(day, { label: event.target.value })} /></label>
                {exerciseCategories.length > 0 && (
                  <div className="day-picker-group">
                    <small>Kategórie</small>
                    <div className="checkbox-list">{exerciseCategories.map((category) => {
                      const checked = dayCategoryNames.includes(category);
                      return <div key={category}><label className="check"><input type="checkbox" checked={checked} onChange={() => void saveDay(day, { categoryNames: checked ? dayCategoryNames.filter((item) => item !== category) : [...dayCategoryNames, category] })} />Kategória {category}</label></div>;
                    })}</div>
                  </div>
                )}
                <div className="day-picker-group">
                  <small>Samostatné cviky</small>
                  <div className="checkbox-list">{activeExercises.map((exercise) => {
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
              </div>
            </details>
          );
        })}</div>
      </section>
      <section className="panel thresholds"><small>Bezpečnostné prahy · iba na čítanie</small><h2>Vyhodnotenie po 14 dňoch</h2><p>Min. 5 vážení v každom týždni · 10 kalorických dní · 4 merania pásu · kalorická odchýlka max. 10 %.</p><p>Chýbajúce, slabé alebo protichodné dáta nikdy nevytvoria akciu na zmenu kalórií.</p></section>
      <section className="panel button-stack">
        <div className="section-title"><div><small>Dáta</small><h2>Export a import</h2></div></div>
        <button className="secondary" onClick={() => void exportJson()}>Exportovať JSON</button>
        {data.importAll && (
          <label className="import-control">Importovať JSON
            <input aria-label="Importovať JSON" type="file" accept="application/json" onChange={(event) => void importJson(event)} />
          </label>
        )}
        {importMessage && <p aria-live="polite" role="status" className={importMessage.startsWith("Import zlyhal") ? "error" : "save-success"}>{importMessage}</p>}
        {mode === "demo" && <button className="secondary danger" onClick={resetDemo}>Resetovať demo dáta</button>}
        <button className="text-button danger" onClick={onSignOut}>Odhlásiť sa</button>
      </section>
    </div>
  );
}
