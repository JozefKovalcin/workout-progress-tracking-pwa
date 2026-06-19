import { describe, expect, it, vi } from "vitest";
import {
  createSyncStore,
  type SyncEnvironment,
  type SyncState
} from "./syncStore";

function environment(initiallyOnline: boolean) {
  let online = initiallyOnline;
  const eventListeners = new Map<"online" | "offline", () => void>();
  const value: SyncEnvironment = {
    isOnline: () => online,
    addEventListener: (event, listener) => {
      eventListeners.set(event, listener);
    }
  };

  return {
    value,
    setOnline(next: boolean) {
      online = next;
    },
    emit(event: "online" | "offline") {
      eventListeners.get(event)?.();
    }
  };
}

describe("createSyncStore", () => {
  it("starts synced when online", () => {
    const store = createSyncStore(environment(true).value);

    expect(store.getSnapshot()).toBe("synced");
  });

  it("starts offline when offline", () => {
    const store = createSyncStore(environment(false).value);

    expect(store.getSnapshot()).toBe("offline");
  });

  it("notifies subscribers about browser connectivity changes", () => {
    const browser = environment(true);
    const store = createSyncStore(browser.value);
    const listener = vi.fn();
    store.subscribe(listener);

    browser.setOnline(false);
    browser.emit("offline");
    browser.setOnline(true);
    browser.emit("online");

    expect(listener.mock.calls).toEqual([["offline"], ["saved-local"]]);
    expect(store.getSnapshot()).toBe("saved-local");
  });

  it("stops notifications after unsubscribe", () => {
    const store = createSyncStore(environment(true).value);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.markError();

    expect(listener).not.toHaveBeenCalled();
  });

  it("marks local, synced, and error states", () => {
    const browser = environment(true);
    const store = createSyncStore(browser.value);
    const states: SyncState[] = [];
    store.subscribe((state) => states.push(state));

    store.markLocal();
    store.markSynced();
    store.markError();
    browser.setOnline(false);
    store.markLocal();

    expect(states).toEqual(["saved-local", "synced", "error", "offline"]);
    expect(store.getSnapshot()).toBe("offline");
  });
});
