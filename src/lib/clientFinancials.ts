/**
 * Shared, canonical client/vehicle financial roll-ups for client-report PDFs.
 *
 * Wraps the source-of-truth billing engine (`src/lib/billing.ts`) and
 * returns the legacy shape the four `generateClientPDF` callers expect:
 *   { totalTime, totalLaborCost, totalPartsCost, totalCost,
 *     totalMinHourAdj, totalCloning, totalProgramming, totalAddKey,
 *     totalAllKeysLost, ... }
 *
 * Replaces 4 buggy inline duplicates that ignored:
 *   - importedSalary lock
 *   - providedByClient parts exclusion
 *   - per-period chargeMinimumHour flags
 *   - minute-rounding via calcPeriodCost
 *   - DesktopClientsView's $0 hourly-rate fallback
 */
import type { Client, Settings, Task, Vehicle } from '@/types';
import {
  computeSessionLaborDetails,
  computeSessionParts,
  computeTaskTotal,
  computeVehicleTotal,
} from '@/lib/billing';

export interface FinancialsBreakdown {
  totalTime: number;          // seconds (sum of period.duration — authoritative)
  totalLaborCost: number;     // labor + services (pre-discount)
  totalPartsCost: number;     // billable parts only (providedByClient excluded)
  totalCost: number;          // totalLaborCost + totalPartsCost (pre-discount)
  totalMinHourAdj: number;
  totalCloning: number;
  totalProgramming: number;
  totalAddKey: number;
  totalAllKeysLost: number;
}

const empty = (): FinancialsBreakdown => ({
  totalTime: 0, totalLaborCost: 0, totalPartsCost: 0, totalCost: 0,
  totalMinHourAdj: 0, totalCloning: 0, totalProgramming: 0,
  totalAddKey: 0, totalAllKeysLost: 0,
});

function aggregate(
  tasksForScope: Task[],
  client: Client | null | undefined,
  settings: Settings
): FinancialsBreakdown {
  const acc = empty();
  for (const task of tasksForScope) {
    // Sum period durations (authoritative). task.totalTime is a cached field
    // that can drift when sessions are edited.
    acc.totalTime += (task.sessions || []).reduce(
      (s, sess) => s + (sess.periods || []).reduce((ps, p) => ps + (p.duration || 0), 0),
      0
    );

    // Imported (XLS) tasks lock to importedSalary; no per-session math.
    if (task.importedSalary != null && task.importedSalary > 0) {
      acc.totalLaborCost += task.importedSalary;
      continue;
    }

    for (const session of task.sessions || []) {
      const d = computeSessionLaborDetails(session, client, settings);
      acc.totalLaborCost += d.total;
      acc.totalMinHourAdj += d.minHourAdj;
      acc.totalCloning += d.cloning;
      acc.totalProgramming += d.programming;
      acc.totalAddKey += d.addKey;
      acc.totalAllKeysLost += d.allKeysLost;
      acc.totalPartsCost += computeSessionParts(session);
    }
  }
  acc.totalCost = acc.totalLaborCost + acc.totalPartsCost;
  return acc;
}

export function getClientFinancials(
  clientId: string,
  clients: Client[],
  tasks: Task[],
  settings: Settings
): FinancialsBreakdown & {
  completedTasks: number;
  activeTasks: number;
  totalTasks: number;
} {
  const client = clients.find(c => c.id === clientId) || null;
  const clientTasks = tasks.filter(t => t.clientId === clientId);
  return {
    ...aggregate(clientTasks, client, settings),
    completedTasks: clientTasks.filter(t => ['completed', 'billed', 'paid'].includes(t.status)).length,
    activeTasks: clientTasks.filter(t => ['pending', 'in-progress', 'paused'].includes(t.status)).length,
    totalTasks: clientTasks.length,
  };
}

export function getVehicleFinancials(
  vehicleId: string,
  clientId: string,
  clients: Client[],
  tasks: Task[],
  settings: Settings
): FinancialsBreakdown & { taskCount: number } {
  const client = clients.find(c => c.id === clientId) || null;
  const vehicleTasks = tasks.filter(t => t.vehicleId === vehicleId);
  return {
    ...aggregate(vehicleTasks, client, settings),
    taskCount: vehicleTasks.length,
  };
}

// Re-export for callers that also need per-task totals.
export { computeTaskTotal };
