import { useSyncExternalStore } from "react";
import { syncStore } from "../../data/syncStore";

export function SyncBadge() {
  const state = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot);
  const labels = {
    synced: "Synchronizované",
    "saved-local": "Uložené lokálne",
    offline: "Offline",
    error: "Chyba synchronizácie"
  };
  return <span className={`sync-badge ${state}`}>{labels[state]}</span>;
}

