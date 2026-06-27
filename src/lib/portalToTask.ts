import type { Task, Client, Vehicle, WorkSession, WorkPeriod, Part, SessionPhoto, Settings } from '@/types';
import type { VehicleCostSummary, SessionCostDetail } from '@/lib/clientPortalUtils';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function makePeriod(p: { start: Date; end: Date }, idx: number): WorkPeriod {
  const duration = Math.max(0, Math.floor((p.end.getTime() - p.start.getTime()) / 1000));
  return {
    id: `pp-${idx}`,
    startTime: p.start,
    endTime: p.end,
    duration,
  };
}

function makeSession(s: SessionCostDetail, idx: number): WorkSession {
  return {
    id: `ps-${idx}`,
    createdAt: new Date(s.date),
    completedAt: new Date(s.date),
    description: s.description,
    periods: (s.periods || []).map(makePeriod),
    parts: (s.parts || []).map((p, i) => ({ ...p, name: p.name || `Part ${i + 1}` })),
    photos: (s.photoUrls || []).map((url, i) => ({
      id: `ph-${i}`,
      cloudUrl: url,
      capturedAt: new Date(s.date),
      sessionNumber: idx + 1,
    })),
    chargeMinimumHour: (s.minHourAdj || 0) > 0,
    isCloning: (s.cloningCost || 0) > 0,
    isProgramming: (s.programmingCost || 0) > 0,
    isAddKey: (s.addKeyCost || 0) > 0,
    isAllKeysLost: (s.allKeysLostCost || 0) > 0,
  };
}

function deriveRates(sessions: SessionCostDetail[]) {
  const rates: number[] = [];
  let maxCloning = 0;
  let maxProgramming = 0;
  let maxAddKey = 0;
  let maxAllKeysLost = 0;

  for (const s of sessions) {
    const baseLabor = Math.max(
      0,
      s.laborCost -
        (s.minHourAdj || 0) -
        (s.cloningCost || 0) -
        (s.programmingCost || 0) -
        (s.addKeyCost || 0) -
        (s.allKeysLostCost || 0),
    );
    const totalMinutes = Math.round(s.duration / 60);
    const hours = totalMinutes / 60;
    if (baseLabor > 0 && hours > 0) {
      rates.push(baseLabor / hours);
    }
    if (s.cloningCost) maxCloning = Math.max(maxCloning, s.cloningCost);
    if (s.programmingCost) maxProgramming = Math.max(maxProgramming, s.programmingCost);
    if (s.addKeyCost) maxAddKey = Math.max(maxAddKey, s.addKeyCost);
    if (s.allKeysLostCost) maxAllKeysLost = Math.max(maxAllKeysLost, s.allKeysLostCost);
  }

  const hourly = rates.length > 0
    ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100
    : 0;

  return { hourly, maxCloning, maxProgramming, maxAddKey, maxAllKeysLost };
}

export interface PortalTaskBundle {
  task: Task;
  client: Client;
  vehicle: Vehicle;
  settings: Pick<Settings, 'defaultHourlyRate' | 'defaultCloningRate' | 'defaultProgrammingRate' | 'defaultAddKeyRate' | 'defaultAllKeysLostRate'>;
}

export function vehicleSummaryToTaskBundle(vehicleSummary: VehicleCostSummary, clientName: string): PortalTaskBundle {
  const v = vehicleSummary.vehicle;
  const sessions = vehicleSummary.sessions.map(makeSession);
  const rates = deriveRates(vehicleSummary.sessions);

  const totalTime = sessions.reduce((sum, s) => sum + (s.periods || []).reduce((p, pp) => p + pp.duration, 0), 0);

  const task: Task = {
    id: uuid(),
    clientId: uuid(),
    vehicleId: uuid(),
    customerName: clientName,
    carVin: v.vin,
    status: 'billed',
    totalTime,
    needsFollowUp: false,
    sessions,
    createdAt: sessions[0]?.createdAt || new Date(),
  };

  const client: Client = {
    id: task.clientId,
    name: clientName,
    createdAt: new Date(),
    hourlyRate: rates.hourly || undefined,
    cloningRate: rates.maxCloning || undefined,
    programmingRate: rates.maxProgramming || undefined,
    addKeyRate: rates.maxAddKey || undefined,
    allKeysLostRate: rates.maxAllKeysLost || undefined,
    prepaidAmount: v.prepaidAmount,
  };

  const vehicle: Vehicle = {
    id: task.vehicleId,
    clientId: client.id,
    vin: v.vin,
    make: v.make,
    model: v.model,
    year: v.year,
    color: v.color,
    prepaidAmount: v.prepaidAmount,
    discountType: v.discountType,
    discountValue: v.discountValue,
  };

  const settings = {
    defaultHourlyRate: rates.hourly || 0,
    defaultCloningRate: rates.maxCloning || undefined,
    defaultProgrammingRate: rates.maxProgramming || undefined,
    defaultAddKeyRate: rates.maxAddKey || undefined,
    defaultAllKeysLostRate: rates.maxAllKeysLost || undefined,
  };

  return { task, client, vehicle, settings };
}
