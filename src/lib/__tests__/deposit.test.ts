import { describe, it, expect } from 'vitest';
import {
  applyDepositOnPaid,
  remainingClientDeposit,
  remainingVehicleDeposit,
} from '@/lib/deposit';
import type { Client, Settings, Task, Vehicle } from '@/types';

const settings: Settings = { defaultHourlyRate: 100 };

const mkVehicle = (id: string, prepaid: number): Vehicle => ({
  id, clientId: 'c1', vin: 'V' + id, prepaidAmount: prepaid,
});
const mkClient = (prepaid: number): Client => ({
  id: 'c1', name: 'C', prepaidAmount: prepaid, createdAt: new Date(),
});
const mkTask = (id: string, vid: string, amount: number, status: Task['status'] = 'billed'): Task => ({
  id, clientId: 'c1', vehicleId: vid, customerName: 'X', carVin: '',
  status, totalTime: 0, needsFollowUp: false, sessions: [],
  createdAt: new Date(), importedSalary: amount,
});

describe('deposit ledger', () => {
  it('draws from vehicle deposit first when sufficient', () => {
    const v = mkVehicle('v1', 500);
    const c = mkClient(200);
    const t = mkTask('t1', 'v1', 120);
    const r = applyDepositOnPaid(t, [v], [t], c, settings);
    expect(r.vehicle).toBe(120);
    expect(r.client).toBe(0);
  });

  it('spills into client deposit when vehicle is short', () => {
    const v = mkVehicle('v1', 80);
    const c = mkClient(500);
    const t = mkTask('t1', 'v1', 200);
    const r = applyDepositOnPaid(t, [v], [t], c, settings);
    expect(r.vehicle).toBe(80);
    expect(r.client).toBe(120);
  });

  it('caps at total deposits when task exceeds both pools', () => {
    const v = mkVehicle('v1', 50);
    const c = mkClient(30);
    const t = mkTask('t1', 'v1', 500);
    const r = applyDepositOnPaid(t, [v], [t], c, settings);
    expect(r.vehicle).toBe(50);
    expect(r.client).toBe(30);
  });

  it('remaining shrinks after one paid task and lets the next one draw less', () => {
    const v = mkVehicle('v1', 300);
    const c = mkClient(0);
    const t1 = { ...mkTask('t1', 'v1', 200, 'paid'), depositApplied: { vehicle: 200, client: 0, at: new Date() } };
    const t2 = mkTask('t2', 'v1', 200);
    expect(remainingVehicleDeposit(v, [t1, t2])).toBe(100);
    const r = applyDepositOnPaid(t2, [v], [t1, t2], null, settings);
    expect(r.vehicle).toBe(100);
    expect(r.client).toBe(0);
  });

  it('un-marking paid (clearing depositApplied) restores the remaining pool', () => {
    const v = mkVehicle('v1', 300);
    const c = mkClient(100);
    const t1 = { ...mkTask('t1', 'v1', 200, 'paid'), depositApplied: { vehicle: 200, client: 0, at: new Date() } };
    expect(remainingVehicleDeposit(v, [t1])).toBe(100);
    const restored = { ...t1, depositApplied: undefined };
    expect(remainingVehicleDeposit(v, [restored])).toBe(300);
    expect(remainingClientDeposit(c, [restored])).toBe(100);
  });

  it('is idempotent when re-marking an already-paid task', () => {
    const v = mkVehicle('v1', 300);
    const t1 = { ...mkTask('t1', 'v1', 200, 'paid'), depositApplied: { vehicle: 200, client: 0, at: new Date() } };
    // Re-run on the same task: should not double-debit.
    const r = applyDepositOnPaid(t1, [v], [t1], null, settings);
    expect(r.vehicle).toBe(200);
  });
});

import { splitDepositLeft } from '@/lib/deposit';
describe('splitDepositLeft', () => {
  it('gives the deposit to Billed first, the rest to Completed', () => {
    // Lance: $2,392 left, $6,328 billed, $1,138 completed → all to billed
    expect(splitDepositLeft([{ left: 0, billed: 6328, completed: 1138 }], 2392)).toMatchObject({ forBilled: 2392, forCompleted: 0 });
    // Example (not real data): $8,000 left → billed fully covered, $1,138 of the rest to completed
    expect(splitDepositLeft([{ left: 0, billed: 6328, completed: 1138 }], 8000)).toMatchObject({ forBilled: 6328, forCompleted: 1138 });
    // Car deposit covers its own car first, client deposit the rest
    const s = splitDepositLeft([{ left: 100, billed: 300, completed: 50 }, { left: 0, billed: 200, completed: 0 }], 450);
    expect(s.perCar[0]).toEqual({ forBilled: 100, forCompleted: 0 });
    expect(s).toMatchObject({ clientForBilled: 400, clientForCompleted: 50, forBilled: 500, forCompleted: 50 });
  });
});

import { depositForTask } from '@/lib/deposit';
describe('depositForTask', () => {
  it('gives the client deposit to billed tasks first, then completed', () => {
    const mk = (id: string, status: any, created: string) => ({ id, clientId: 'c', vehicleId: 'v', status, createdAt: new Date(created), sessions: [] } as any);
    const tasks = [mk('done', 'completed', '2026-01-01'), mk('b1', 'billed', '2026-02-01'), mk('b2', 'billed', '2026-03-01')];
    const cost: Record<string, number> = { done: 100, b1: 300, b2: 300 };
    const client = { id: 'c', prepaidAmount: 500, createdAt: new Date() } as any;
    const v = [{ id: 'v', clientId: 'c', vin: '' } as any];
    const f = (id: string) => depositForTask(tasks.find(t => t.id === id), v, tasks, client, t => cost[t.id]);
    expect(f('b1')).toBe(300);
    expect(f('b2')).toBe(200);
    expect(f('done')).toBe(0);
  });
});
