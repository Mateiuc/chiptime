// Helpers for schedule entries that may reference a client/vehicle that is not
// registered in the app yet (name-only entries created by voice or by hand).
import { Client, ScheduleEntry, Vehicle } from '@/types';

export const entryClientName = (entry: ScheduleEntry, clients: Client[]): string => {
  const existing = entry.clientId ? clients.find(c => c.id === entry.clientId) : undefined;
  return existing?.name || entry.clientName?.trim() || 'Unknown client';
};

export const entryIsNewClient = (entry: ScheduleEntry, clients: Client[]): boolean =>
  !(entry.clientId && clients.some(c => c.id === entry.clientId));

export const vehicleLabel = (v?: Vehicle): string => {
  if (!v) return '';
  return [v.year, v.make, v.model].filter(Boolean).join(' ') || v.vin || 'Vehicle';
};

export const entryCarLabel = (entry: ScheduleEntry, vehicles: Vehicle[]): string => {
  const existing = entry.vehicleId ? vehicles.find(v => v.id === entry.vehicleId) : undefined;
  if (existing) return vehicleLabel(existing);
  return entry.carInfo?.trim() || 'Car not specified';
};

export const entryVehicle = (entry: ScheduleEntry, vehicles: Vehicle[]): Vehicle | undefined =>
  entry.vehicleId ? vehicles.find(v => v.id === entry.vehicleId) : undefined;

export const entryIsComplete = (entry: Pick<ScheduleEntry, 'clientId' | 'clientName' | 'vehicleId' | 'carInfo' | 'requestedWork'>): boolean =>
  Boolean((entry.clientId || entry.clientName?.trim()) &&
    (entry.vehicleId || entry.carInfo?.trim()) &&
    entry.requestedWork?.trim());

/** Split a free-text car description into year / make / model where possible. */
export const parseCarInfo = (text: string): { year?: number; make?: string; model?: string } => {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return {};
  const parts = cleaned.split(' ');
  let year: number | undefined;
  const rest: string[] = [];
  for (const p of parts) {
    if (!year && /^(19|20)\d{2}$/.test(p)) { year = parseInt(p, 10); continue; }
    rest.push(p);
  }
  return { year, make: rest[0], model: rest.slice(1).join(' ') || undefined };
};
