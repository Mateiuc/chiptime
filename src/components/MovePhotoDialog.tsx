import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Search, Camera as CameraIcon, ChevronRight } from 'lucide-react';
import type { Task, Client, Vehicle, WorkSession, SessionPhoto } from '@/types';
import { formatDuration } from '@/lib/formatTime';

interface MovePhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTask: Task;
  fromSessionId: string;
  photo: SessionPhoto;
  photoThumbUrl?: string;
  allTasks: Task[];
  clients: Client[];
  vehicles: Vehicle[];
  /** Called with the destination task id + session id when the user confirms. */
  onConfirm: (destTaskId: string, destSessionId: string) => Promise<void> | void;
}

type Step = 'task' | 'session';

export const MovePhotoDialog = ({
  open,
  onOpenChange,
  sourceTask,
  fromSessionId,
  photo,
  photoThumbUrl,
  allTasks,
  clients,
  vehicles,
  onConfirm,
}: MovePhotoDialogProps) => {
  const [step, setStep] = useState<Step>('task');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep('task');
    setSelectedTaskId(null);
    setQuery('');
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // Build searchable rows for every task in the workspace
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTasks
      .map(t => {
        const c = clients.find(cl => cl.id === t.clientId);
        const v = vehicles.find(ve => ve.id === t.vehicleId);
        const vehicleLabel = v
          ? [v.year, v.make, v.model].filter(Boolean).join(' ') || v.vin || 'Vehicle'
          : 'Vehicle';
        const label = `${c?.name || t.customerName || 'Unknown'} — ${vehicleLabel}`;
        return { task: t, client: c, vehicle: v, label, vehicleLabel, vin: t.carVin || v?.vin || '' };
      })
      .filter(r => {
        if (!q) return true;
        return (
          r.label.toLowerCase().includes(q) ||
          r.vin.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => +new Date(b.task.createdAt) - +new Date(a.task.createdAt));
  }, [allTasks, clients, vehicles, query]);

  const selectedTask = selectedTaskId ? allTasks.find(t => t.id === selectedTaskId) : null;

  const doConfirm = async (destSessionId: string) => {
    if (!selectedTask) return;
    setBusy(true);
    try {
      await onConfirm(selectedTask.id, destSessionId);
      handleOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg p-0 rounded-xl overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-center gap-3">
            {step === 'session' && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setStep('task'); setSelectedTaskId(null); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {photoThumbUrl ? (
                <img src={photoThumbUrl} alt="" className="h-10 w-10 rounded object-cover border" />
              ) : (
                <div className="h-10 w-10 rounded border flex items-center justify-center text-muted-foreground">
                  <CameraIcon className="h-4 w-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base leading-tight">Move photo</DialogTitle>
                <div className="text-xs text-muted-foreground truncate">
                  {step === 'task' ? 'Pick the destination task' : `To session in ${selectedTask ? (clients.find(c => c.id === selectedTask.clientId)?.name || 'Unknown') : ''}`}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {step === 'task' && (
          <div className="p-3 space-y-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by client, vehicle, or VIN"
                className="pl-8 h-9"
              />
            </div>
            <div className="max-h-[55vh] overflow-y-auto -mx-1">
              {rows.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6">No tasks match.</div>
              )}
              {rows.map(r => {
                const isCurrent = r.task.id === sourceTask.id;
                return (
                  <button
                    key={r.task.id}
                    type="button"
                    onClick={() => { setSelectedTaskId(r.task.id); setStep('session'); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted rounded-md flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.client?.name || r.task.customerName || 'Unknown'}
                        {isCurrent && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">(current task)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{r.vehicleLabel}{r.vin ? ` · ${r.vin}` : ''}</div>
                    </div>
                    <span className="text-[10px] uppercase text-muted-foreground shrink-0">{r.task.status}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'session' && selectedTask && (
          <div className="p-3 space-y-2">
            {(selectedTask.sessions || []).length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                This task has no sessions yet. Open the task and add a session first.
              </div>
            )}
            <div className="max-h-[55vh] overflow-y-auto -mx-1">
              {(selectedTask.sessions || []).map((s: WorkSession, idx) => {
                const isSameSpot = selectedTask.id === sourceTask.id && s.id === fromSessionId;
                const duration = (s.periods || []).reduce((sum, p) => sum + (p.duration || 0), 0);
                const dateLabel = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '';
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isSameSpot || busy}
                    onClick={() => doConfirm(s.id)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted rounded-md flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        Session {idx + 1}
                        {isSameSpot && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">(current)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {dateLabel}{duration ? ` · ${formatDuration(duration)}` : ''}
                        {(s.photos || []).length > 0 ? ` · ${(s.photos || []).length} photo${(s.photos || []).length > 1 ? 's' : ''}` : ''}
                        {s.description ? ` · ${s.description}` : ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="px-4 py-3 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
