import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/test/mockSupabase";

let mock: MockSupabase;

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return mock.supabase;
  },
}));

beforeEach(async () => {
  mock = createMockSupabase();
  localStorage.clear();
  localStorage.setItem("app_sync_workspace_id", "ws-test");
  vi.resetModules(); // reset module-local lastKnownVersion cache
});

const makeData = (over: any = {}) => ({
  clients: [],
  vehicles: [],
  tasks: [],
  settings: { defaultHourlyRate: 75 },
  ...over,
});

describe("appSyncService.pushToCloud", () => {
  it("A — successful UPDATE with matching version", async () => {
    const { appSyncService } = await import("@/services/appSyncService");
    // 1. First pull seeds lastKnownVersion=5
    mock.queue.push({
      data: { data: makeData(), updated_at: "2026-01-01T00:00:00Z", data_version: 5 },
      error: null,
    });
    await appSyncService.pullFromCloud();

    // 2. Conditional UPDATE returns row at version 6
    mock.queue.push({
      data: { data_version: 6, updated_at: "2026-01-01T00:00:01Z" },
      error: null,
    });
    const result = await appSyncService.pushToCloud(makeData());

    expect(result).toEqual({ version: 6, updatedAt: "2026-01-01T00:00:01Z" });
    // The conditional UPDATE must have used eq('data_version', 5)
    expect(mock.calls).toContainEqual({ method: "eq", args: ["data_version", 5] });
  });

  it("B — VersionConflictError on row mismatch", async () => {
    const { appSyncService, VersionConflictError } = await import(
      "@/services/appSyncService"
    );
    // Seed lastKnownVersion=5
    mock.queue.push({
      data: { data: makeData(), updated_at: "t0", data_version: 5 },
      error: null,
    });
    await appSyncService.pullFromCloud();

    // UPDATE returns null (zero rows matched)
    mock.queue.push({ data: null, error: null });
    // Subsequent pullFromCloud returns fresh remote at v7
    const remote = makeData({ tasks: [{ id: "T1", remote: true } as any] });
    mock.queue.push({
      data: { data: remote, updated_at: "t1", data_version: 7 },
      error: null,
    });

    await expect(appSyncService.pushToCloud(makeData())).rejects.toMatchObject({
      name: "VersionConflictError",
      remoteVersion: 7,
    });
    const err = await appSyncService.pushToCloud(makeData()).catch((e) => e);
    // (sanity — second invocation will hit empty queue; we only check class above)
    expect(err).toBeDefined();
  });

  it("C — insert path for fresh workspace", async () => {
    const { appSyncService } = await import("@/services/appSyncService");
    // getRemoteVersion → no row
    mock.queue.push({ data: null, error: null });
    // INSERT returns version 1
    mock.queue.push({
      data: { data_version: 1, updated_at: "t-insert" },
      error: null,
    });

    const result = await appSyncService.pushToCloud(makeData({ tasks: [{ id: "x" } as any] }));
    expect(result).toEqual({ version: 1, updatedAt: "t-insert" });
    expect(mock.payloads.find((p) => p.op === "insert")).toBeDefined();
  });

  it("D — insert 23505 → VersionConflictError fallback", async () => {
    const { appSyncService } = await import("@/services/appSyncService");
    // getRemoteVersion → no row (so we go to insert path)
    mock.queue.push({ data: null, error: null });
    // INSERT errors with unique-violation
    mock.queue.push({ data: null, error: { code: "23505", message: "dup" } });
    // Recovery: getRemoteVersion → 3
    mock.queue.push({ data: { data_version: 3 }, error: null });
    // Recovery: pullFromCloud → fresh remote at v3
    mock.queue.push({
      data: { data: makeData({ tasks: [{ id: "remote" } as any] }), updated_at: "tr", data_version: 3 },
      error: null,
    });

    await expect(
      appSyncService.pushToCloud(makeData({ tasks: [{ id: "local" } as any] })),
    ).rejects.toMatchObject({ name: "VersionConflictError", remoteVersion: 3 });
  });

  it("E — pullFromCloud returns data + version and seeds cache", async () => {
    const { appSyncService } = await import("@/services/appSyncService");
    mock.queue.push({
      data: {
        data: makeData({ tasks: [{ id: "T" } as any] }),
        updated_at: "ts",
        data_version: 42,
      },
      error: null,
    });
    const r = await appSyncService.pullFromCloud();
    expect(r?.version).toBe(42);
    expect(r?.data.tasks).toHaveLength(1);

    // Next push should use eq('data_version', 42)
    mock.queue.push({ data: { data_version: 43, updated_at: "ts2" }, error: null });
    await appSyncService.pushToCloud(makeData());
    expect(mock.calls).toContainEqual({ method: "eq", args: ["data_version", 42] });
  });

  it("F — sanitizes accessCode & ocr keys before sending", async () => {
    const { appSyncService } = await import("@/services/appSyncService");
    // seed v=5
    mock.queue.push({
      data: { data: makeData(), updated_at: "t", data_version: 5 },
      error: null,
    });
    await appSyncService.pullFromCloud();

    mock.queue.push({ data: { data_version: 6, updated_at: "t2" }, error: null });
    await appSyncService.pushToCloud(
      makeData({
        clients: [{ id: "c1", name: "x", accessCode: "1234", createdAt: new Date() } as any],
        settings: {
          defaultHourlyRate: 75,
          googleApiKey: "gkey",
          grokApiKey: "xkey",
          ocrSpaceApiKey: "okey",
        },
      }),
    );
    const updatePayload = mock.payloads.find((p) => p.op === "update")!;
    expect(updatePayload).toBeDefined();
    const sentData = updatePayload.data.data;
    expect(sentData.clients[0]).not.toHaveProperty("accessCode");
    expect(sentData.settings).not.toHaveProperty("googleApiKey");
    expect(sentData.settings).not.toHaveProperty("grokApiKey");
    expect(sentData.settings).not.toHaveProperty("ocrSpaceApiKey");
  });
});
