/**
 * Deposit ledger — a list of individual deposit payments for a client or vehicle.
 *
 * `prepaidAmount` remains the stored TOTAL and the single field every
 * calculation reads. Whenever the list changes we rewrite `prepaidAmount`
 * to `sum(deposits)`, so no downstream logic changes and older/offline
 * clients keep working.
 */
import type { Client, DepositEntry, Vehicle } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type DepositHolder = Pick<Client | Vehicle, never> & {
  prepaidAmount?: number;
  deposits?: DepositEntry[];
  createdAt?: Date | string;
};

export function depositTotal(entries: DepositEntry[] | undefined | null): number {
  if (!entries || entries.length === 0) return 0;
  return round2(entries.reduce((s, e) => s + (Number(e.amount) || 0), 0));
}

export function newDepositId(): string {
  return `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Returns the deposit list for an entity, back-filling a single
 * "Initial deposit" entry when only the legacy `prepaidAmount` exists.
 * Pure — does not mutate the entity.
 */
export function normalizeDeposits(entity: DepositHolder | null | undefined): DepositEntry[] {
  if (!entity) return [];
  if (entity.deposits && entity.deposits.length > 0) {
    return entity.deposits.map(e => ({ ...e, date: e.date ? new Date(e.date) : new Date() }));
  }
  const amount = entity.prepaidAmount || 0;
  if (!amount) return [];
  const created = entity.createdAt ? new Date(entity.createdAt) : new Date();
  return [
    {
      id: 'dep-initial',
      amount,
      date: isNaN(created.getTime()) ? new Date() : created,
      note: 'Initial deposit',
    },
  ];
}

/** Patch to persist a new deposit list (keeps `prepaidAmount` in sync). */
export function depositsPatch(entries: DepositEntry[]): { deposits: DepositEntry[]; prepaidAmount: number } {
  const clean = entries
    .filter(e => Number(e.amount) > 0)
    .map(e => ({ ...e, amount: round2(Number(e.amount)), date: new Date(e.date) }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return { deposits: clean, prepaidAmount: depositTotal(clean) };
}

export function addDeposit(entries: DepositEntry[], entry: Omit<DepositEntry, 'id'> & { id?: string }): DepositEntry[] {
  return [...entries, { ...entry, id: entry.id || newDepositId() }];
}

export function updateDeposit(entries: DepositEntry[], id: string, updates: Partial<DepositEntry>): DepositEntry[] {
  return entries.map(e => (e.id === id ? { ...e, ...updates } : e));
}

export function removeDeposit(entries: DepositEntry[], id: string): DepositEntry[] {
  return entries.filter(e => e.id !== id);
}

export const DEPOSIT_METHODS = ['cash', 'card', 'zelle', 'transfer', 'check', 'other'] as const;
