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

export function resolveRates(client: Client | null | undefined, settings: Settings) {
  return {
    hourly: num(client?.hourlyRate) || num(settings.defaultHourlyRate),
    cloning: num(client?.cloningRate) || num((settings as any).defaultCloningRate),
    programming: num(client?.programmingRate) || num((settings as any).defaultProgrammingRate),
    addKey: num(client?.addKeyRate) || num((settings as any).defaultAddKeyRate),
    allKeysLost: num(client?.allKeysLostRate) || num((settings as any).defaultAllKeysLostRate),
  };
}

export function computeSessionLabor(
  session: WorkSession,
  client: Client | null | undefined,
  settings: Settings
): SessionLabor {
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

  const labor = baseLabor + minHourAdj;

  let services = 0;
  if (session.isCloning && r.cloning > 0) services += r.cloning;
  if (session.isProgramming && r.programming > 0) services += r.programming;
  if (session.isAddKey && r.addKey > 0) services += r.addKey;
  if (session.isAllKeysLost && r.allKeysLost > 0) services += r.allKeysLost;

  return { labor, services, total: labor + services };
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
 * across all tasks belonging to the same vehicle. The sum of `discount`
 * across a vehicle's tasks equals the vehicle's discount within float
 * rounding, so summing per-task totals matches `computeVehicleTotal`.
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
  const taskDiscount = vehicleDiscount * share;
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
  const { discount } = applyLaborDiscount(labor + services, vehicle || undefined);
  const total = Math.max(0, labor + services - discount) + parts;
  return { labor, services, parts, discount, total };
}
