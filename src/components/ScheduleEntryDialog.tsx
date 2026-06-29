import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScheduleEntry, Client, Vehicle } from '@/types';
import { useWorkers } from '@/lib/workers';
import { getCurrentUserId } from '@/lib/currentUser';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: Client[];
  vehicles: Vehicle[];
  initial?: ScheduleEntry | null;
  onSave: (entry: ScheduleEntry) => void;
  onDelete?: (id: string) => void;
}

const toLocalDate = (d?: Date) => {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const toLocalTime = (d?: Date) => {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

export const ScheduleEntryDialog = ({ open, onOpenChange, clients, vehicles, initial, onSave, onDelete }: Props) => {
  const { allWorkers } = useWorkers();
  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [requestedWork, setRequestedWork] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('any');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setClientId(initial?.clientId || '');
    setVehicleId(initial?.vehicleId || '');
    setRequestedWork(initial?.requestedWork || '');
    setDateStr(toLocalDate(initial?.scheduledAt));
    setTimeStr(toLocalTime(initial?.scheduledAt));
    setAssignedTo(initial?.assignedTo || 'any');
    setNotes(initial?.notes || '');
  }, [open, initial]);

  const clientVehicles = useMemo(
    () => vehicles.filter(v => !clientId || v.clientId === clientId),
    [vehicles, clientId],
  );

  const handleSave = () => {
    if (!clientId || !vehicleId || !requestedWork.trim()) return;
    let scheduledAt: Date | undefined;
    if (dateStr) {
      const t = timeStr || '09:00';
      scheduledAt = new Date(`${dateStr}T${t}:00`);
    }
    const entry: ScheduleEntry = {
      id: initial?.id || crypto.randomUUID(),
      clientId,
      vehicleId,
      requestedWork: requestedWork.trim(),
      scheduledAt,
      assignedTo: assignedTo === 'any' ? undefined : assignedTo,
      notes: notes.trim() || undefined,
      status: initial?.status || 'scheduled',
      startedTaskId: initial?.startedTaskId,
      createdAt: initial?.createdAt || new Date(),
      createdBy: initial?.createdBy || getCurrentUserId() || undefined,
    };
    onSave(entry);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit scheduled job' : 'New scheduled job'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Client</Label>
            <Select value={clientId} onValueChange={v => { setClientId(v); setVehicleId(''); }}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId} disabled={!clientId}>
              <SelectTrigger><SelectValue placeholder={clientId ? 'Select vehicle' : 'Pick a client first'} /></SelectTrigger>
              <SelectContent>
                {clientVehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {[v.year, v.make, v.model].filter(Boolean).join(' ') || v.vin}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Requested work</Label>
            <Textarea
              value={requestedWork}
              onChange={e => setRequestedWork(e.target.value)}
              placeholder="What did the client ask for?"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Date (optional)</Label>
              <Input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Time (optional)</Label>
              <Input type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)} disabled={!dateStr} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Assigned worker</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Anyone</SelectItem>
                {allWorkers().map(w => <SelectItem key={w.id} value={w.id}>{w.firstName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {initial && onDelete && (
            <Button variant="destructive" onClick={() => { onDelete(initial.id); onOpenChange(false); }} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!clientId || !vehicleId || !requestedWork.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
