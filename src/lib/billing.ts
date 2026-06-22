import type { Client, Settings, Task, Vehicle, WorkSession } from '@/types';
import { calcPeriodCost } from '@/lib/formatTime';
import { applyLaborDiscount } from '@/lib/discount';

/**
 * Phase 2 — Single source of truth for billing math.
 *
 * - `task.importedSalary` (XLS-imported tasks) short-circuits `computeTaskTotal`:
 *   the task's labor equals the imported value, parts/services on the task
 *   are not billed. The amber "Imported" badge surfaces this in the UI.
 * - `task.billedAmount` no longer exists (Phase 2 removed it).
 * - Status (pending / billed / paid) does not branch the calculation. Every
 *   surface (desktop dashboard, mobile task card, client portal) routes
 *   through these helpers so totals are always consistent.
 */

export interface SessionLabor {
  labor: number;     // pure time-based labor (incl. min-hour rule)
  services: number;  // cloning + programming + add-key + all-keys-lost
  total: number;     // labor + services
}

/**
 * Granular per-session breakdown used by the bill renderer and the client
 * portal cost calculator. `labor` (= baseLabor + minHourAdj) and `services`
 * match `computeSessionLabor`'s output; the additional fields expose each
 * billable component so callers can render itemised rows or counters.
 */
export interface SessionLaborDetails {
  baseLabor: number;
  minHourAdj: number;
  cloning: number;
  programming: number;
  addKey: number;
  allKeysLost: number;
  /** baseLabor + minHourAdj */
  labor: number;
  /** cloning + programming + addKey + allKeysLost */
  services: number;
  /** labor + services */
  total: number;
}

export interface TaskTotal {
  labor: number;
  services: number;
  parts: number;
  total: number;     // labor + services + parts (no discount applied here)
}

export interface VehicleTotal {
  labor: number;
  services: number;
  parts: number;
  discount: number;
  total: number;     // max(0, labor + services - discount) + parts
}

const num = (v: any): number => (typeof v === 'number' && isFinite(v) ? v : 0);

/**
 * Round a dollar amount up to the next whole dollar (billing-conservative).
 * Negatives and non-finite values clamp to 0. Centralizes the rounding rule
 * so display-layer formatters (formatCurrency) can stay pure.
 */
export function ceilDollars(amount: number): number {
  if (!isFinite(amount)) return 0;
  if (amount <= 0) return 0;
  return Math.ceil(amount);
}

export function resolveRates(client: Client | null | undefined, settings: Settings) {
  return {
    hourly: num(client?.hourlyRate) || num(settings.defaultHourlyRate),
    cloning: num(client?.cloningRate) || num(settings.defaultCloningRate),
    programming: num(client?.programmingRate) || num(settings.defaultProgrammingRate),
    addKey: num(client?.addKeyRate) || num(settings.defaultAddKeyRate),
    allKeysLost: num(client?.allKeysLostRate) || num(settings.defaultAllKeysLostRate),
  };
}

export function computeSessionLabor(
  session: WorkSession,
  client: Client | null | undefined,
  settings: Settings
): SessionLabor {
  const d = computeSessionLaborDetails(session, client, settings);
  return { labor: d.labor, services: d.services, total: d.total };
}

/**
 * Per-session labor breakdown — single source of truth for the per-period
 * min-hour rule and the per-service charges. `computeSessionLabor` is a thin
 * wrapper for callers that don't need the breakdown.
 */
export function computeSessionLaborDetails(
  session: WorkSession,
  client: Client | null | undefined,
  settings: Settings
): SessionLaborDetails {
  const r = resolveRates(client, settings);

  // Per-period cost — preserves existing min-hour rule per period.
  const baseLabor = (session.periods || []).reduce((sum, period) => {
    if (period.chargeMinimumHour && period.duration < 3600) {
      return sum + Math.ceil(r.hourly);
    }
    return sum + calcPeriodCost(period.duration, r.hourly);
  }, 0);

  // Per-session min-hour bump only applies when no period-level flag exists.
  const sessionDur = (session.periods || []).reduce((s, p) => s + p.duration, 0);
  const hasPeriodFlags = (session.periods || []).some(p => p.chargeMinimumHour);
  const minHourAdj = (!hasPeriodFlags && session.chargeMinimumHour && sessionDur < 3600)
    ? Math.ceil(((3600 - sessionDur) / 3600) * r.hourly)
    : 0;

  const cloning = (session.isCloning && r.cloning > 0) ? r.cloning : 0;
  const programming = (session.isProgramming && r.programming > 0) ? r.programming : 0;
  const addKey = (session.isAddKey && r.addKey > 0) ? r.addKey : 0;
  const allKeysLost = (session.isAllKeysLost && r.allKeysLost > 0) ? r.allKeysLost : 0;

  const labor = baseLabor + minHourAdj;
  const services = cloning + programming + addKey + allKeysLost;

  return {
    baseLabor, minHourAdj, cloning, programming, addKey, allKeysLost,
    labor, services, total: labor + services,
  };
}

export function computeSessionParts(session: WorkSession): number {
  return (session.parts || []).reduce(
    (sum, p) => sum + (p.providedByClient ? 0 : p.price * p.quantity),
    0
  );
}

export function computeTaskTotal(
  task: Task,
  client: Client | null | undefined,
  settings: Settings
): TaskTotal {
  // Phase 2: imported (XLS) tasks lock to importedSalary. Parts/services
  // added afterwards are NOT billed. The vehicle-level discount still
  // applies — the imported value contributes to the labor pool downstream
  // in computeVehicleTotal.
  if (task.importedSalary != null && task.importedSalary > 0) {
    const v = task.importedSalary;
    return { labor: v, services: 0, parts: 0, total: v };
  }
  let labor = 0;
  let services = 0;
  let parts = 0;
  for (const session of task.sessions || []) {
    const sl = computeSessionLabor(session, client, settings);
    labor += sl.labor;
    services += sl.services;
    parts += computeSessionParts(session);
  }
  return { labor, services, parts, total: labor + services + parts };
}

export interface TaskTotalAllocated {
  labor: number;
  services: number;
  parts: number;
  discount: number;
  total: number;
}

/**
 * Per-task total with the vehicle-level discount allocated proportionally
 * across all tasks belonging to the same vehicle.
 *
 * Each per-task `discount` is ceiled to a whole dollar via `ceilDollars`.
 * Because every share is rounded up, the sum of per-task discounts may
 * exceed the vehicle's raw discount by up to (taskCount - 1) dollars —
 * intentional billing-conservative bias. This means summing per-task
 * `total` across a vehicle's tasks may be a few dollars LESS than
 * `computeVehicleTotal.total`. UI surfaces should rely on
 * `computeVehicleTotal` for rollups and `computeTaskTotalAllocated` for
 * per-task display rows; do not double-aggregate.
 */
export function computeTaskTotalAllocated(
  task: Task,
  vehicle: Vehicle | null | undefined,
  allVehicleTasks: Task[],
  client: Client | null | undefined,
  settings: Settings
): TaskTotalAllocated {
  const t = computeTaskTotal(task, client, settings);
  const taskPool = t.labor + t.services;
  const vehiclePool = allVehicleTasks.reduce((s, vt) => {
    const x = computeTaskTotal(vt, client, settings);
    return s + x.labor + x.services;
  }, 0);
  const vehicleDiscount = applyLaborDiscount(vehiclePool, vehicle || undefined).discount;
  const share = vehiclePool > 0 ? taskPool / vehiclePool : 0;
  const taskDiscount = ceilDollars(vehicleDiscount * share);
  return {
    labor: t.labor,
    services: t.services,
    parts: t.parts,
    discount: taskDiscount,
    total: Math.max(0, taskPool - taskDiscount) + t.parts,
  };
}

export function computeVehicleTotal(
  vehicle: Vehicle | null | undefined,
  vehicleTasks: Task[],
  client: Client | null | undefined,
  settings: Settings
): VehicleTotal {
  let labor = 0;
  let services = 0;
  let parts = 0;
  for (const task of vehicleTasks) {
    const t = computeTaskTotal(task, client, settings);
    labor += t.labor;
    services += t.services;
    parts += t.parts;
  }
  const rawDiscount = applyLaborDiscount(labor + services, vehicle || undefined).discount;
  const discount = ceilDollars(rawDiscount);
  const total = Math.max(0, labor + services - discount) + parts;
  return { labor, services, parts, discount, total };
}

/**
 * THE single helper for "what dollar amount goes on this task chip?".
 *
 * Looks up the task's vehicle and sibling tasks, then defers to
 * `computeTaskTotalAllocated` (pooled vehicle discount, allocated per task
 * with ceil bias). Every surface — mobile TaskCard, DesktopDashboard chips,
 * DesktopReportsView rows, drill-down tables — calls this so chip totals
 * across a vehicle reconcile to `computeVehicleTotal` (modulo ≤ n-1 ceil
 * dollars, documented in `computeTaskTotalAllocated`).
 *
 * Do NOT inline `Math.ceil(...)` or `applyLaborDiscount(...)` in callers.
 */
export function computeTaskCost(
  task: Task,
  vehicles: Vehicle[],
  allTasks: Task[],
  client: Client | null | undefined,
  settings: Settings
): number {
  const vehicle = vehicles.find(v => v.id === task.vehicleId);
  const vehicleTasks = allTasks.filter(t => t.vehicleId === task.vehicleId);
  return computeTaskTotalAllocated(task, vehicle, vehicleTasks, client, settings).total;
}

/**
 * Lightweight preview helper for the SettingsDialog rate calculator.
 * Mirrors `computeSessionLabor` but takes raw inputs (no full WorkSession).
 */
export function previewSessionLabor(
  durationSec: number,
  hourly: number,
  opts: { sessionMinHour?: boolean; periodMinHour?: boolean } = {}
): number {
  const { sessionMinHour = false, periodMinHour = false } = opts;
  if (periodMinHour && durationSec < 3600) {
    return ceilDollars(hourly);
  }
  const base = Math.ceil((Math.round(durationSec / 60) / 60) * hourly);
  if (!periodMinHour && sessionMinHour && durationSec < 3600) {
    return base + Math.ceil(((3600 - durationSec) / 3600) * hourly);
  }
  return base;
}
