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
