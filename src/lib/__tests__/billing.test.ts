import { describe, it, expect } from "vitest";
import {
  ceilDollars,
  computeSessionLabor,
  computeTaskTotal,
  computeTaskTotalAllocated,
  computeVehicleTotal,
  previewSessionLabor,
} from "@/lib/billing";
import { formatCurrency } from "@/lib/formatTime";
import type { Task, WorkSession, Vehicle, Client, Settings } from "@/types";

const settings = { defaultHourlyRate: 100 } as Settings;
const client: Client = { id: "c1", name: "X", createdAt: new Date() } as Client;

const period = (durationSec: number, chargeMinimumHour = false) => ({
  id: "p" + Math.random(),
  startTime: new Date(),
  endTime: new Date(),
  duration: durationSec,
  chargeMinimumHour,
});

const session = (over: Partial<WorkSession> = {}): WorkSession => ({
  id: "s" + Math.random(),
  startTime: new Date(),
  periods: [],
  parts: [],
  ...over,
} as WorkSession);

const task = (sessions: WorkSession[], over: Partial<Task> = {}): Task => ({
  id: "t" + Math.random(),
  clientId: "c1",
  vehicleId: "v1",
  customerName: "X",
  carVin: "VIN",
  status: "pending",
  totalTime: 0,
  needsFollowUp: false,
  sessions,
  createdAt: new Date(),
  ...over,
} as Task);

describe("ceilDollars", () => {
  it("0 → 0", () => expect(ceilDollars(0)).toBe(0));
  it("0.1 → 1", () => expect(ceilDollars(0.1)).toBe(1));
  it("99 → 99", () => expect(ceilDollars(99)).toBe(99));
  it("99.4 → 100", () => expect(ceilDollars(99.4)).toBe(100));
  it("clamps negatives to 0", () => expect(ceilDollars(-0.5)).toBe(0));
  it("NaN → 0", () => expect(ceilDollars(NaN)).toBe(0));
  it("Infinity → 0", () => expect(ceilDollars(Infinity)).toBe(0));
});

describe("formatCurrency", () => {
  it("$0", () => expect(formatCurrency(0)).toBe("$0"));
  it("$99", () => expect(formatCurrency(99)).toBe("$99"));
  it("$100", () => expect(formatCurrency(100)).toBe("$100"));
  it("$1,500", () => expect(formatCurrency(1500)).toBe("$1,500"));
  it("99.4 rounds down", () => expect(formatCurrency(99.4)).toBe("$99"));
  it("99.6 rounds up", () => expect(formatCurrency(99.6)).toBe("$100"));
});

describe("computeSessionLabor", () => {
  it("full hour period → hourly", () => {
    const s = session({ periods: [period(3600)] });
    expect(computeSessionLabor(s, client, settings).labor).toBe(100);
  });

  it("sub-hour period with chargeMinimumHour → ceil(hourly)", () => {
    const s = session({ periods: [period(1800, true)] });
    expect(computeSessionLabor(s, client, settings).labor).toBe(100);
  });

  it("sub-hour session min-hour bumps to 1h when no period flag", () => {
    const s = session({ periods: [period(1800)], chargeMinimumHour: true });
    // base: 50 (half hour @ $100), bump: 50 → 100
    expect(computeSessionLabor(s, client, settings).labor).toBe(100);
  });

  it("P0 #3 — period AND session flags → bump applies once (period level)", () => {
    const s = session({
      periods: [period(1800, true)],
      chargeMinimumHour: true,
    });
    // Should be ceil(hourly) only, not doubled.
    expect(computeSessionLabor(s, client, settings).labor).toBe(100);
  });

  it("services flags additive", () => {
    const s = session({
      periods: [period(0)],
      isCloning: true,
      isProgramming: true,
      isAddKey: true,
      isAllKeysLost: true,
    });
    const c: Client = {
      ...client,
      cloningRate: 10,
      programmingRate: 20,
      addKeyRate: 30,
      allKeysLostRate: 40,
    } as Client;
    const r = computeSessionLabor(s, c, settings);
    expect(r.services).toBe(100);
  });
});

describe("computeTaskTotal", () => {
  it("importedSalary short-circuits even with sessions/parts", () => {
    const s = session({
      periods: [period(7200)],
      parts: [{ id: "p1", name: "X", price: 50, quantity: 2 } as any],
    });
    const t = task([s], { importedSalary: 999 });
    const r = computeTaskTotal(t, client, settings);
    expect(r).toEqual({ labor: 999, services: 0, parts: 0, total: 999 });
  });

  it("sums labor / services / parts; skips providedByClient parts", () => {
    const s = session({
      periods: [period(3600)],
      parts: [
        { id: "p1", name: "A", price: 50, quantity: 2 } as any,
        { id: "p2", name: "B", price: 30, quantity: 1, providedByClient: true } as any,
      ],
    });
    const r = computeTaskTotal(task([s]), client, settings);
    expect(r.labor).toBe(100);
    expect(r.parts).toBe(100);
    expect(r.total).toBe(200);
  });
});

describe("computeVehicleTotal & computeTaskTotalAllocated", () => {
  const vehicle = {
    id: "v1",
    clientId: "c1",
    make: "X",
    vin: "VIN",
    discountType: "amount",
    discountValue: 100,
  } as unknown as Vehicle;

  it("uneven discount split: each per-task discount is integer; sum may exceed input", () => {
    // Three tasks with labor pools 33/33/34 → discount weights 0.33/0.33/0.34
    const mk = (dur: number) => task([session({ periods: [period(dur)] })]);
    const tasks = [mk(1188), mk(1188), mk(1224)]; // ~$33/$33/$34
    const allocated = tasks.map((t) =>
      computeTaskTotalAllocated(t, vehicle, tasks, client, settings),
    );
    for (const a of allocated) {
      expect(Number.isInteger(a.discount)).toBe(true);
    }
    const sum = allocated.reduce((s, a) => s + a.discount, 0);
    // Conservative bias: sum may exceed raw discount by up to (n-1) dollars
    expect(sum).toBeGreaterThanOrEqual(100);
    expect(sum).toBeLessThanOrEqual(100 + (tasks.length - 1));
  });

  it("zero-pool vehicle → zero discount, parts pass through", () => {
    const s = session({
      periods: [],
      parts: [{ id: "p1", name: "X", price: 50, quantity: 1 } as any],
    });
    const r = computeVehicleTotal(vehicle, [task([s])], client, settings);
    expect(r.discount).toBe(0);
    expect(r.total).toBe(50);
  });

  it("vehicle discount is integer (ceil)", () => {
    // $100 amount discount on $200 labor → discount = $100 (integer already)
    const s = session({ periods: [period(7200)] });
    const r = computeVehicleTotal(vehicle, [task([s])], client, settings);
    expect(Number.isInteger(r.discount)).toBe(true);
    expect(r.discount).toBe(100);
    expect(r.total).toBe(100);
  });
});

describe("previewSessionLabor", () => {
  it("full hour → hourly", () => {
    expect(previewSessionLabor(3600, 100)).toBe(100);
  });
  it("sub-hour with sessionMinHour bumps to 1h", () => {
    expect(previewSessionLabor(1800, 100, { sessionMinHour: true })).toBe(100);
  });
  it("periodMinHour wins over sessionMinHour (no double bump)", () => {
    expect(
      previewSessionLabor(1800, 100, { sessionMinHour: true, periodMinHour: true }),
    ).toBe(100);
  });
});
