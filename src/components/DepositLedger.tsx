import { useState } from 'react';
import { DepositEntry, DepositMethod } from '@/types';
import { addDeposit, updateDeposit, removeDeposit, depositTotal } from '@/lib/depositLedger';
import { formatCurrency } from '@/lib/formatTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Pencil, Check, X, Plus } from 'lucide-react';

const METHODS: { value: DepositMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'other', label: 'Other' },
];

interface Props {
  deposits: DepositEntry[];
  onChange: (deposits: DepositEntry[], total: number) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export const DepositLedger = ({ deposits, onChange, readOnly = false, compact = false }: Props) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<DepositEntry>>({});
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<DepositEntry>>({
    date: new Date().toISOString().slice(0, 10),
    method: 'cash',
    amount: 0,
    note: '',
  });

  const emit = (updated: DepositEntry[]) => onChange(updated, depositTotal(updated));

  const handleAdd = () => {
    if (!newEntry.amount || newEntry.amount <= 0) return;
    const updated = addDeposit(deposits, {
      amount: newEntry.amount!,
      date: newEntry.date || new Date().toISOString().slice(0, 10),
      method: newEntry.method,
      note: newEntry.note || undefined,
    });
    emit(updated);
    setAdding(false);
    setNewEntry({ date: new Date().toISOString().slice(0, 10), method: 'cash', amount: 0, note: '' });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const updated = updateDeposit(deposits, editingId, editValues);
    emit(updated);
    setEditingId(null);
    setEditValues({});
  };

  const handleDelete = (id: string) => {
    emit(removeDeposit(deposits, id));
  };

  const total = depositTotal(deposits);
  const methodLabel = (m?: string) => METHODS.find(x => x.value === m)?.label || m || '';

  return (
    <div className="space-y-1">
      {/* Entries */}
      {deposits.map(d => (
        <div key={d.id} className={`flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2 ${compact ? 'text-xs' : 'text-sm'}`}>
          {editingId === d.id ? (
            <>
              <Input type="date" value={editValues.date ?? d.date} onChange={e => setEditValues(v => ({ ...v, date: e.target.value }))} className="h-7 text-xs w-32 shrink-0" />
              <Input type="number" min="0" step="0.01" value={editValues.amount ?? d.amount} onChange={e => setEditValues(v => ({ ...v, amount: parseFloat(e.target.value) || 0 }))} className="h-7 text-xs w-24 shrink-0" onFocus={e => e.target.select()} />
              <select value={editValues.method ?? d.method ?? ''} onChange={e => setEditValues(v => ({ ...v, method: e.target.value as DepositMethod }))} className="h-7 text-xs border border-input rounded-md px-2 bg-background shrink-0">
                <option value="">—</option>
                {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <Input value={editValues.note ?? d.note ?? ''} onChange={e => setEditValues(v => ({ ...v, note: e.target.value }))} className="h-7 text-xs flex-1" placeholder="Note" />
              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={handleSaveEdit}><Check className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingId(null); setEditValues({}); }}><X className="h-3 w-3" /></Button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground shrink-0 w-24">{d.date}</span>
              <span className="font-semibold text-green-700 dark:text-green-400 shrink-0 w-20 text-right">{formatCurrency(d.amount)}</span>
              {d.method && <span className="shrink-0 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">{methodLabel(d.method)}</span>}
              {d.note && <span className="text-muted-foreground italic flex-1 truncate">"{d.note}"</span>}
              {!d.note && <span className="flex-1" />}
              {!readOnly && (
                <>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0" onClick={() => { setEditingId(d.id); setEditValues({}); }}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(d.id)}><Trash2 className="h-3 w-3" /></Button>
                </>
              )}
            </>
          )}
        </div>
      ))}

      {/* Add row */}
      {!readOnly && (
        adding ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
            <Input type="date" value={newEntry.date} onChange={e => setNewEntry(v => ({ ...v, date: e.target.value }))} className="h-7 text-xs w-32 shrink-0" />
            <Input type="number" min="0" step="0.01" value={newEntry.amount || ''} onChange={e => setNewEntry(v => ({ ...v, amount: parseFloat(e.target.value) || 0 }))} className="h-7 text-xs w-24 shrink-0" placeholder="Amount" onFocus={e => e.target.select()} />
            <select value={newEntry.method ?? 'cash'} onChange={e => setNewEntry(v => ({ ...v, method: e.target.value as DepositMethod }))} className="h-7 text-xs border border-input rounded-md px-2 bg-background shrink-0">
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <Input value={newEntry.note ?? ''} onChange={e => setNewEntry(v => ({ ...v, note: e.target.value }))} className="h-7 text-xs flex-1" placeholder="Note (optional)" />
            <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 shrink-0" onClick={handleAdd}><Check className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setAdding(false)}><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground w-full justify-start gap-1 hover:text-primary" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3" /> Add Deposit
          </Button>
        )
      )}

      {/* Total */}
      {deposits.length > 0 && (
        <div className={`flex justify-between items-center border-t border-border/50 pt-2 mt-1 font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
          <span className="text-muted-foreground">Total ({deposits.length} payment{deposits.length !== 1 ? 's' : ''})</span>
          <span className="text-green-700 dark:text-green-400">{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  );
};

/** Read-only compact variant for client portal */
export const DepositLedgerReadOnly = ({ deposits }: { deposits: DepositEntry[] }) => (
  <DepositLedger deposits={deposits} onChange={() => {}} readOnly compact />
);
