import { DepositEntry } from '@/types';

/** Total of all deposit entries */
export const depositTotal = (deposits: DepositEntry[]): number =>
  deposits.reduce((sum, d) => sum + d.amount, 0);

/** Back-fill a single entry from legacy prepaidAmount if deposits list is empty */
export const normalizeDeposits = (entity: {
  prepaidAmount?: number;
  deposits?: DepositEntry[];
  createdAt?: Date;
}): DepositEntry[] => {
  if (entity.deposits && entity.deposits.length > 0) return entity.deposits;
  if (entity.prepaidAmount && entity.prepaidAmount > 0) {
    const date = entity.createdAt
      ? new Date(entity.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return [{ id: crypto.randomUUID(), amount: entity.prepaidAmount, date, note: 'Initial deposit' }];
  }
  return [];
};

export const addDeposit = (deposits: DepositEntry[], entry: Omit<DepositEntry, 'id'>): DepositEntry[] =>
  [...deposits, { ...entry, id: crypto.randomUUID() }];

export const updateDeposit = (deposits: DepositEntry[], id: string, changes: Partial<Omit<DepositEntry, 'id'>>): DepositEntry[] =>
  deposits.map(d => d.id === id ? { ...d, ...changes } : d);

export const removeDeposit = (deposits: DepositEntry[], id: string): DepositEntry[] =>
  deposits.filter(d => d.id !== id);
