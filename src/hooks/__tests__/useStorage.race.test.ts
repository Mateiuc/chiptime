import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Task } from "@/types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ toast: toastMock }));

// In-memory capacitor storage
const store: { clients: any[]; vehicles: any[]; tasks: any[]; settings: any } = {
  clients: [],
  vehicles: [],
  tasks: [],
  settings: { defaultHourlyRate: 75 },
};
vi.mock("@/lib/capacitorStorage", () => ({
  capacitorStorage: {
    getClients: async () => store.clients,
    getVehicles: async () => store.vehicles,
    getTasks: async () => store.tasks,
    getSettings: async () => store.settings,
    setClients: async (v: any[]) => { store.clients = v; },
    setVehicles: async (v: any[]) => { store.vehicles = v; },
    setTasks: async (v: any[]) => { store.tasks = v; },
    setSettings: async (v: any) => { store.settings = v; },
  },
}));

// Programmable appSyncService that preserves the real VersionConflictError class
const pushSpy = vi.fn();
const pullSpy = vi.fn();
vi.mock("@/services/appSyncService", async () => {
  const actual = await vi.importActual<any>("@/services/appSyncService");
  return {
    VersionConflictError: actual.VersionConflictError,
    appSyncService: {
      pushToCloud: (...a: any[]) => pushSpy(...a),
      pullFromCloud: (...a: any[]) => pullSpy(...a),
      getWorkspaceId: () => "ws-test",
      setLocalUpdatedAt: () => {},
    },
  };
});

// AuthContext is imported by useStorage's useCloudSync (not used in our tests)
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ workspace: null, workspaceReady: false }),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeTask = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  clientId: "c1",
  vehicleId: "v1",
  customerName: "Cust",
  carVin: "VIN",
  status: "pending",
  totalTime: 0,
  needsFollowUp: false,
  sessions: [],
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

beforeEach(() => {
  store.clients = [];
  store.vehicles = [];
  store.tasks = [];
  store.settings = { defaultHourlyRate: 75 };
  toastMock.mockClear();
  pushSpy.mockReset();
  pullSpy.mockReset();
  vi.resetModules();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useStorage reconciliation", () => {
  it("G — non-overlapping changes merge silently", async () => {
    const { VersionConflictError } = await import("@/services/appSyncService");
    const { useTasks, cloudSyncEvents } = await import("@/hooks/useStorage");
    const { renderHook, act } = await import("@testing-library/react");

    const A = makeTask("A", { customerName: "A-local-edit" });
    const B = makeTask("B", { customerName: "B-orig" });
    store.tasks = [A, B];

    // Remote: A unchanged from original, B edited remotely
    const A_remote = makeTask("A", { customerName: "A-orig" });
    const B_remote = makeTask("B", { customerName: "B-remote-edit" });

    pushSpy
      .mockImplementationOnce(() => {
        throw new VersionConflictError(
          {
            clients: [],
            vehicles: [],
            tasks: [A_remote, B_remote],
            settings: { defaultHourlyRate: 75 },
          },
          6,
          "t-remote",
        );
      })
      .mockResolvedValueOnce({ version: 7, updatedAt: "t-final" });

    const pullEvents = vi.fn();
    cloudSyncEvents.onPull(pullEvents);

    const { result } = renderHook(() => useTasks());
    // Wait for initial load
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.setTasks([A, B], ["A"]);
    });

    expect(pushSpy).toHaveBeenCalledTimes(2);
    // Final stored state: local A wins, remote B wins
    const idMap = new Map(store.tasks.map((t) => [t.id, t]));
    expect(idMap.get("A")?.customerName).toBe("A-local-edit");
    expect(idMap.get("B")?.customerName).toBe("B-remote-edit");
    // No overlap → no conflict toast
    expect(toastMock).not.toHaveBeenCalled();
    // triggerPull fired
    expect(pullEvents).toHaveBeenCalled();
  });

  it("H — same-field conflict surfaces soft toast and retries", async () => {
    const { VersionConflictError } = await import("@/services/appSyncService");
    const { useTasks } = await import("@/hooks/useStorage");
    const { renderHook, act } = await import("@testing-library/react");

    const A_local = makeTask("A", { status: "paid" });
    store.tasks = [A_local];
    const A_remote = makeTask("A", { status: "billed" });

    pushSpy
      .mockImplementationOnce(() => {
        throw new VersionConflictError(
          { clients: [], vehicles: [], tasks: [A_remote], settings: { defaultHourlyRate: 75 } },
          6,
          "tr",
        );
      })
      .mockResolvedValueOnce({ version: 7, updatedAt: "tf" });

    const { result } = renderHook(() => useTasks());
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.setTasks([A_local], ["A"]);
    });

    expect(store.tasks[0].status).toBe("paid");
    expect(toastMock).toHaveBeenCalledTimes(1);
    const call = toastMock.mock.calls[0][0];
    expect(call.variant).toBe("destructive");
    expect(call.title).toMatch(/Conflicting edits reconciled/i);
  });

  it("I — hard conflict (both pushes fail) shows reload toast, no infinite loop", async () => {
    const { VersionConflictError } = await import("@/services/appSyncService");
    const { useTasks } = await import("@/hooks/useStorage");
    const { renderHook, act } = await import("@testing-library/react");

    const A = makeTask("A", { status: "paid" });
    store.tasks = [A];
    const A_remote = makeTask("A", { status: "billed" });

    pushSpy.mockImplementation(() => {
      throw new VersionConflictError(
        { clients: [], vehicles: [], tasks: [A_remote], settings: { defaultHourlyRate: 75 } },
        99,
        "t",
      );
    });

    const { result } = renderHook(() => useTasks());
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.setTasks([A], ["A"]);
    });

    // Exactly 2 push attempts (initial + 1 retry), no infinite loop
    expect(pushSpy).toHaveBeenCalledTimes(2);
    // Last toast should be the hard "Sync conflict / reload" one
    const lastToast = toastMock.mock.calls[toastMock.mock.calls.length - 1][0];
    expect(lastToast.variant).toBe("destructive");
    expect(lastToast.description).toMatch(/reload/i);
  });

  it("J — pushNow (desktop) merges remote-only items, local wins all changedIds", async () => {
    const { VersionConflictError } = await import("@/services/appSyncService");
    const { pushNow } = await import("@/hooks/useStorage");

    const A = makeTask("A", { customerName: "A-local" });
    const B = makeTask("B", { customerName: "B-local" });
    const C = makeTask("C", { customerName: "C-local" });
    const D_remote = makeTask("D", { customerName: "D-remote-only" });

    pushSpy
      .mockImplementationOnce(() => {
        throw new VersionConflictError(
          {
            clients: [],
            vehicles: [],
            tasks: [makeTask("A", { customerName: "stale" }), D_remote],
            settings: { defaultHourlyRate: 75 },
          },
          5,
          "t",
        );
      })
      .mockResolvedValueOnce({ version: 6, updatedAt: "tf" });

    await pushNow({
      clients: [],
      vehicles: [],
      tasks: [A, B, C],
      settings: { defaultHourlyRate: 75 },
    });

    expect(pushSpy).toHaveBeenCalledTimes(2);
    const ids = store.tasks.map((t) => t.id).sort();
    expect(ids).toEqual(["A", "B", "C", "D"]);
    const a = store.tasks.find((t) => t.id === "A")!;
    expect(a.customerName).toBe("A-local");
  });
});
