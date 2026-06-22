/**
 * Deposit ledger — single source of truth for "what's left of a deposit?"
 *
 * Model: the original `vehicle.prepaidAmount` and `client.prepaidAmount`
 * are immutable. Every time a task is marked **Paid**, the helper
 * `applyDepositOnPaid` records how much of that task's total was paid out
 * of the vehicle deposit vs the client deposit, into `task.depositApplied`.
 *
 * Remaining deposit is always derived (never stored):
 *   remaining = original − Σ depositApplied across this scope's tasks
 *
 * Allocation order (decided with the user): vehicle deposit first, then
 * client deposit. Any leftover task amount is unpaid (balance still owed).
 *
 * Un-marking a task as paid should clear `task.depositApplied`, which
 * automatically restores the remaining pools.
 */
import type { Client, Settings, Task, Vehicle } from '@/types';
import { computeTaskCost } from '@/lib/billing';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function sumDepositAppliedToVehicle(vehicleId: string, tasks: Task[]): number {
  return tasks.reduce(
    (s, t) => (t.vehicleId === vehicleId && t.depositApplied ? s + (t.depositApplied.vehicle || 0) : s),
    0
  );
}

export function sumDepositAppliedToClient(clientId: string, tasks: Task[]): number {
  return tasks.reduce(
    (s, t) => (t.clientId === clientId && t.depositApplied ? s + (t.depositApplied.client || 0) : s),
    0
  );
}

export function remainingVehicleDeposit(
  vehicle: Vehicle | null | undefined,
  tasks: Task[]
): number {
  if (!vehicle) return 0;
  const orig = vehicle.prepaidAmount || 0;
  return Math.max(0, round2(orig - sumDepositAppliedToVehicle(vehicle.id, tasks)));
}

export function remainingClientDeposit(
  client: Client | null | undefined,
  tasks: Task[]
): number {
  if (!client) return 0;
  const orig = client.prepaidAmount || 0;
  return Math.max(0, round2(orig - sumDepositAppliedToClient(client.id, tasks)));
}

export interface DepositApplied {
  vehicle: number;
  client: number;
  at: Date;
}

/**
 * Compute how much of `task`'s total should be drawn from deposits when
 * it transitions to status='paid'. Vehicle deposit drains first, then
 * client deposit. The current task is excluded from the "already applied"
 * sums so re-marking a paid task is idempotent.
 */
export function applyDepositOnPaid(
  task: Task,
  vehicles: Vehicle[],
  allTasks: Task[],
  client: Client | null | undefined,
  settings: Settings
): DepositApplied {
  const others = allTasks.filter(t => t.id !== task.id);
  const vehicle = vehicles.find(v => v.id === task.vehicleId) || null;
  const taskTotal = computeTaskCost(task, vehicles, allTasks, client, settings);
  const vRem = remainingVehicleDeposit(vehicle, others);
  const vDraw = Math.min(taskTotal, vRem);
  const cRem = remainingClientDeposit(client, others);
  const cDraw = Math.min(Math.max(0, taskTotal - vDraw), cRem);
  return { vehicle: round2(vDraw), client: round2(cDraw), at: new Date() };
}
