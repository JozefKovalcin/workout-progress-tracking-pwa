import { useEffect, useState } from "react";
import { toLocalDate } from "../domain/date";
import { createDemoTrackerData } from "../data/demoData";
import { signInWithGoogle } from "../data/firebaseAuth";
import type {
  TrackerDataSource,
  TrackerSnapshot
} from "../data/trackerData";
import type { Mode, Screen } from "./appTypes";
import {
  EMPTY_SNAPSHOT,
  MODE_KEY,
  nav
} from "./helpers";
import { ProgressScreen } from "./screens/ProgressScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { TrainingScreen } from "./screens/TrainingScreen";
import { AuthGate } from "./ui/AuthGate";
import { SyncBadge } from "./ui/SyncBadge";

interface AppProps {
  initialMode?: Mode;
  now?: Date;
}

export function App({ initialMode, now = new Date() }: AppProps) {
  const [mode, setMode] = useState<Mode | null>(() => initialMode ?? localStorage.getItem(MODE_KEY) as Mode | null);
  const [uid, setUid] = useState<string | null>(mode === "demo" ? "demo" : null);
  const [data, setData] = useState<TrackerDataSource | null>(() => mode === "demo" ? createDemoTrackerData(localStorage) : null);
  const [snapshotState, setSnapshotState] = useState<{
    ownerUid: string | null;
    snapshot: TrackerSnapshot;
  }>({ ownerUid: null, snapshot: EMPTY_SNAPSHOT });
  const [screen, setScreen] = useState<Screen>("today");
  const [authError, setAuthError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const today = toLocalDate(now);
  const allowDemo = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" || initialMode === "demo";
  const snapshot = snapshotState.ownerUid === uid ? snapshotState.snapshot : EMPTY_SNAPSHOT;

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
              : { ownerUid: nextUid, snapshot: EMPTY_SNAPSHOT }
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
    setSnapshotState({ ownerUid: "demo", snapshot: EMPTY_SNAPSHOT });
    setData(createDemoTrackerData(localStorage));
  };
  const enterCloud = async () => {
    if (authenticating) return;
    setAuthenticating(true);
    setAuthError("");
    try {
      await signInWithGoogle();
      const cloud = await import("../data/trackerData");
      localStorage.setItem(MODE_KEY, "cloud");
      setMode("cloud");
      setData(cloud.cloudTrackerData);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Prihlásenie zlyhalo.");
    } finally {
      setAuthenticating(false);
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
    setSnapshotState({ ownerUid: null, snapshot: EMPTY_SNAPSHOT });
  };
  const switchTodayToTraining = async () => {
    if (!data || !uid) return;
    const current = snapshot.dailyEntries.find((item) => item.date === today);
    await data.saveDailyEntry(uid, { ...current, date: today, dayTypeOverride: "training", updatedAtMs: new Date().valueOf() });
    setScreen("training");
  };

  if (!mode || !uid || !data) {
    return (
      <AuthGate
        allowDemo={allowDemo}
        onDemo={enterDemo}
        onGoogle={() => void enterCloud()}
        error={authError}
        authenticating={authenticating}
      />
    );
  }
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

