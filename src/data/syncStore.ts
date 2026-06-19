export type SyncState = "synced" | "saved-local" | "offline" | "error";

export interface SyncEnvironment {
  isOnline(): boolean;
  addEventListener?(
    event: "online" | "offline",
    listener: () => void
  ): void;
}

export interface SyncStore {
  getSnapshot(): SyncState;
  subscribe(listener: (value: SyncState) => void): () => void;
  markLocal(): void;
  markSynced(): void;
  markError(): void;
}

export function createSyncStore(environment?: SyncEnvironment): SyncStore {
  let state: SyncState =
    environment === undefined || environment.isOnline() ? "synced" : "offline";
  const listeners = new Set<(value: SyncState) => void>();

  const emit = (value: SyncState) => {
    state = value;
    listeners.forEach((listener) => listener(value));
  };

  environment?.addEventListener?.("online", () => emit("saved-local"));
  environment?.addEventListener?.("offline", () => emit("offline"));

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    markLocal: () =>
      emit(environment === undefined || environment.isOnline()
        ? "saved-local"
        : "offline"),
    markSynced: () => emit("synced"),
    markError: () => emit("error")
  };
}

const browserEnvironment: SyncEnvironment | undefined =
  typeof window !== "undefined" && typeof navigator !== "undefined"
    ? {
        isOnline: () => navigator.onLine,
        addEventListener: (event, listener) =>
          window.addEventListener(event, listener)
      }
    : undefined;

export const syncStore = createSyncStore(browserEnvironment);
