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

export interface DepositDraw {
  taskId: string;
  label: string;
  /** ISO date the task was paid (drew from the deposit) */
  date: string;
  amount: number;
}

export interface DepositUsage {
  used: number;
  left: number;
  jobs: DepositDraw[];
}

/**
 * Split what paid tasks drew from a deposit pool across the individual deposit
 * entries, oldest deposit first. Display-only: the pool math itself stays in
 * `deposit.ts` (remaining = total − Σ depositApplied).
 */
export const allocateDepositUsage = (
  deposits: DepositEntry[],
  draws: DepositDraw[]
): Record<string, DepositUsage> => {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const ordered = [...deposits].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const usage: Record<string, DepositUsage> = {};
  ordered.forEach(d => { usage[d.id] = { used: 0, left: d.amount, jobs: [] }; });
  const sortedDraws = [...draws].filter(d => d.amount > 0).sort((a, b) => a.date.localeCompare(b.date));
  let i = 0;
  for (const draw of sortedDraws) {
    let remaining = draw.amount;
    while (remaining > 0.005 && i < ordered.length) {
      const u = usage[ordered[i].id];
      const take = Math.min(remaining, u.left);
      if (take > 0.005) {
        u.used = round2(u.used + take);
        u.left = round2(u.left - take);
        u.jobs.push({ ...draw, amount: round2(take) });
        remaining = round2(remaining - take);
      }
      if (u.left <= 0.005) i++;
    }
  }
  return usage;
};
