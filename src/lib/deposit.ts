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

export interface DepositSplitInput {
  /** Deposit left on this car (after paid jobs drew from it). */
  left: number;
  /** Unpaid billed total for this car. */
  billed: number;
  /** Unpaid completed (not billed yet) total for this car. */
  completed: number;
}

export interface DepositSplit {
  forBilled: number;
  forCompleted: number;
  perCar: { forBilled: number; forCompleted: number }[];
  clientForBilled: number;
  clientForCompleted: number;
}

/**
 * How the deposit left is set against open work (decided with the user):
 * Billed work gets the deposit first, whatever remains goes to Completed work.
 * In-progress and paid work never take deposit. A car's own deposit only
 * covers that car; the client deposit covers what the car deposits did not.
 */
export function splitDepositLeft(cars: DepositSplitInput[], clientLeft: number): DepositSplit {
  let remBilled = 0;
  let remCompleted = 0;
  const perCar = cars.map(c => {
    const left = Math.max(0, c.left);
    const b = Math.min(left, Math.max(0, c.billed));
    const cc = Math.min(left - b, Math.max(0, c.completed));
    remBilled += Math.max(0, c.billed) - b;
    remCompleted += Math.max(0, c.completed) - cc;
    return { forBilled: round2(b), forCompleted: round2(cc) };
  });
  const cl = Math.max(0, clientLeft);
  const clientForBilled = Math.min(cl, remBilled);
  const clientForCompleted = Math.min(cl - clientForBilled, remCompleted);
  return {
    forBilled: round2(perCar.reduce((s, p) => s + p.forBilled, 0) + clientForBilled),
    forCompleted: round2(perCar.reduce((s, p) => s + p.forCompleted, 0) + clientForCompleted),
    perCar,
    clientForBilled: round2(clientForBilled),
    clientForCompleted: round2(clientForCompleted),
  };
}

export interface OpenBalance {
  billed: number;
  completed: number;
  inProgress: number;
  /** Deposit set against open work (Billed first, rest to Completed). */
  deposit: number;
  balanceDue: number;
  perCar: Record<string, { open: number; deposit: number; balanceDue: number }>;
}

/** What the client still owes on unpaid work, using the Billed-first deposit rule. */
export function computeOpenBalance(
  client: Client,
  vehicles: Vehicle[],
  tasks: Task[],
  costOf: (task: Task) => number
): OpenBalance {
  const clientVehicles = vehicles.filter(v => v.clientId === client.id);
  const sum = (list: Task[]) => list.reduce((s, t) => s + costOf(t), 0);
  const isActive = (t: Task) => ['pending', 'in-progress', 'paused'].includes(t.status);
  const cars = clientVehicles.map(v => {
    const vTasks = tasks.filter(t => t.vehicleId === v.id);
    return {
      id: v.id,
      left: remainingVehicleDeposit(v, tasks),
      billed: sum(vTasks.filter(t => t.status === 'billed')),
      completed: sum(vTasks.filter(t => t.status === 'completed')),
      inProgress: sum(vTasks.filter(isActive)),
    };
  });
  const split = splitDepositLeft(cars, remainingClientDeposit(client, tasks));
  const billed = cars.reduce((s, c) => s + c.billed, 0);
  const completed = cars.reduce((s, c) => s + c.completed, 0);
  const inProgress = cars.reduce((s, c) => s + c.inProgress, 0);
  const deposit = round2(split.forBilled + split.forCompleted);
  const perCar: OpenBalance['perCar'] = {};
  cars.forEach((c, i) => {
    const open = c.billed + c.completed + c.inProgress;
    const dep = split.perCar[i].forBilled + split.perCar[i].forCompleted;
    perCar[c.id] = { open, deposit: dep, balanceDue: Math.max(0, open - dep) };
  });
  return { billed, completed, inProgress, deposit, balanceDue: Math.max(0, billed + completed + inProgress - deposit), perCar };
}

/**
 * Deposit set against ONE unpaid task, using the Billed-first rule: the car's
 * own deposit covers that car's billed tasks, then its completed tasks; the
 * client deposit then covers what is left, billed before completed (oldest
 * task first within each group). Other statuses get 0.
 */
export function depositForTask(
  task: Task,
  vehicles: Vehicle[],
  tasks: Task[],
  client: Client | null | undefined,
  costOf: (t: Task) => number
): number {
  if (task.status !== 'billed' && task.status !== 'completed') return 0;
  const byAge = (a: Task, b: Task) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  const open = tasks
    .filter(t => (client ? t.clientId === client.id : t.vehicleId === task.vehicleId) && (t.status === 'billed' || t.status === 'completed'))
    .sort((a, b) => (a.status === b.status ? byAge(a, b) : a.status === 'billed' ? -1 : 1));
  const owed = new Map(open.map(t => [t.id, costOf(t)]));
  const got = new Map<string, number>();
  const take = (t: Task, pool: number) => {
    const amt = Math.min(pool, owed.get(t.id) || 0);
    owed.set(t.id, (owed.get(t.id) || 0) - amt);
    got.set(t.id, (got.get(t.id) || 0) + amt);
    return pool - amt;
  };
  const carIds = Array.from(new Set(open.map(t => t.vehicleId)));
  carIds.forEach(id => {
    let pool = remainingVehicleDeposit(vehicles.find(v => v.id === id), tasks);
    open.filter(t => t.vehicleId === id).forEach(t => { pool = take(t, pool); });
  });
  let clientPool = remainingClientDeposit(client, tasks);
  open.forEach(t => { clientPool = take(t, clientPool); });
  return round2(got.get(task.id) || 0);
}
