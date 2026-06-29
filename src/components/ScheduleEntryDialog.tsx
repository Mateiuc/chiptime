import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Scan, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { ScheduleEntry, Client, Vehicle, Task, Settings } from '@/types';
import { useWorkers } from '@/lib/workers';
import { getCurrentUserId } from '@/lib/currentUser';
import { decodeVin, validateVin } from '@/lib/vinDecoder';
import { useNotifications } from '@/hooks/useNotifications';
import VinScanner from './VinScanner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: Client[];
  vehicles: Vehicle[];
  tasks: Task[];
  settings: Settings;
  initial?: ScheduleEntry | null;
  onSave: (entry: ScheduleEntry) => void;
  onDelete?: (id: string) => void;
  onAddVehicle: (v: Vehicle) => Promise<void> | void;
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

const NEW_VEHICLE = '__new__';

export const ScheduleEntryDialog = ({ open, onOpenChange, clients, vehicles, tasks, settings, initial, onSave, onDelete, onAddVehicle }: Props) => {
  const { allWorkers } = useWorkers();
  const { toast } = useNotifications();
  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [requestedWork, setRequestedWork] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('any');
  const [notes, setNotes] = useState('');

  // Inline new-vehicle sub-form
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [nvVin, setNvVin] = useState('');
  const [nvMake, setNvMake] = useState('');
  const [nvModel, setNvModel] = useState('');
  const [nvYear, setNvYear] = useState('');
  const [nvColor, setNvColor] = useState('');
  const [nvDecoding, setNvDecoding] = useState(false);
  const [nvSaving, setNvSaving] = useState(false);
  const [showVinScanner, setShowVinScanner] = useState(false);

  const resetNewVehicle = () => {
    setShowNewVehicle(false);
    setNvVin(''); setNvMake(''); setNvModel(''); setNvYear(''); setNvColor('');
  };

  useEffect(() => {
    if (!open) return;
    setClientId(initial?.clientId || '');
    setVehicleId(initial?.vehicleId || '');
    setRequestedWork(initial?.requestedWork || '');
    setDateStr(toLocalDate(initial?.scheduledAt));
    setTimeStr(toLocalTime(initial?.scheduledAt));
    setAssignedTo(initial?.assignedTo || 'any');
    setNotes(initial?.notes || '');
    resetNewVehicle();
  }, [open, initial]);

  const clientVehicles = useMemo(
    () => vehicles.filter(v => !clientId || v.clientId === clientId),
    [vehicles, clientId],
  );

  const handleVehicleSelect = (v: string) => {
    if (v === NEW_VEHICLE) {
      setShowNewVehicle(true);
      return;
    }
    setVehicleId(v);
  };

  const handleDecodeVin = async (vinCode?: string) => {
    const vinToCheck = (vinCode || nvVin).trim().toUpperCase();
    if (!validateVin(vinToCheck)) {
      toast({ title: 'Invalid VIN', description: 'VIN must be 17 characters', variant: 'destructive' });
      return;
    }
    setNvDecoding(true);
    const decoded = await decodeVin(vinToCheck);
    setNvDecoding(false);
    if (decoded) {
      setNvMake(decoded.make);
      setNvModel(decoded.model);
      setNvYear(String(decoded.year));
    }
  };

  const handleVinScanned = (scanned: string) => {
    setNvVin(scanned);
    setShowVinScanner(false);
    handleDecodeVin(scanned);
  };

  const handleSaveNewVehicle = async () => {
    if (!clientId) return;
    const vinTrimmed = nvVin.trim().toUpperCase();
    if (!vinTrimmed && !nvMake.trim() && !nvModel.trim()) {
      toast({ title: 'Need VIN, Make, or Model', description: 'Provide at least one to identify the vehicle', variant: 'destructive' });
      return;
    }
    if (vinTrimmed) {
      const activeTasks = tasks.filter(t => !['billed', 'paid'].includes(t.status));
      if (activeTasks.find(t => t.carVin.toUpperCase() === vinTrimmed)) {
        toast({ title: 'Duplicate VIN', description: 'Already in an active task', variant: 'destructive' });
        return;
      }
    }
    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),
      clientId,
      vin: vinTrimmed,
      make: nvMake || undefined,
      model: nvModel || undefined,
      year: nvYear ? parseInt(nvYear) : undefined,
      color: nvColor || undefined,
      createdAt: new Date(),
    } as Vehicle;
    setNvSaving(true);
    try {
      await onAddVehicle(newVehicle);
      setVehicleId(newVehicle.id);
      resetNewVehicle();
      toast({ title: 'Vehicle added' });
    } finally {
      setNvSaving(false);
    }
  };


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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="text-lg">{initial ? 'Edit scheduled job' : 'New scheduled job'}</DialogTitle>
          <p className="text-xs text-muted-foreground">Plan upcoming work for a client.</p>
        </DialogHeader>

        <div className="overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* LEFT COLUMN */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Client</Label>
                <Select value={clientId} onValueChange={v => { setClientId(v); setVehicleId(''); resetNewVehicle(); }}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Vehicle</Label>
                <Select value={vehicleId} onValueChange={handleVehicleSelect} disabled={!clientId}>
                  <SelectTrigger><SelectValue placeholder={clientId ? 'Select vehicle' : 'Pick a client first'} /></SelectTrigger>
                  <SelectContent>
                    {clientId && (
                      <SelectItem value={NEW_VEHICLE}>
                        <span className="flex items-center gap-1 text-primary font-medium"><Plus className="h-3.5 w-3.5" /> Add new vehicle</span>
                      </SelectItem>
                    )}
                    {clientVehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {[v.year, v.make, v.model].filter(Boolean).join(' ') || v.vin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-3">
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
                <Label className="text-xs">Requested work</Label>
                <Textarea
                  value={requestedWork}
                  onChange={e => setRequestedWork(e.target.value)}
                  placeholder="What did the client ask for?"
                  rows={4}
                />
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
              </div>
            </div>

            {/* NEW VEHICLE — spans full width */}
            {showNewVehicle && (
              <div className="sm:col-span-2 rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">New vehicle</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={resetNewVehicle}>Cancel</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-emerald-500/20 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/30 dark:text-emerald-300"
                    onClick={() => setShowVinScanner(true)}
                  >
                    <Scan className="h-4 w-4 mr-2" /> Scan VIN with Camera
                  </Button>
                  <Input
                    value={nvVin}
                    onChange={e => {
                      const v = e.target.value.toUpperCase();
                      setNvVin(v);
                      if (v.length === 17 && validateVin(v)) handleDecodeVin(v);
                    }}
                    placeholder="VIN (optional — can scan later)"
                    maxLength={17}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">No VIN? Save now and scan later from the schedule card.</p>
                {nvDecoding && (
                  <p className="text-xs text-primary flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Decoding VIN…</p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Input value={nvMake} onChange={e => setNvMake(e.target.value)} placeholder="Make" />
                  <Input value={nvModel} onChange={e => setNvModel(e.target.value)} placeholder="Model" />
                  <Input type="number" value={nvYear} onChange={e => setNvYear(e.target.value)} placeholder="Year" />
                  <Input value={nvColor} onChange={e => setNvColor(e.target.value)} placeholder="Color" />
                </div>
                <Button size="sm" className="w-full" onClick={handleSaveNewVehicle} disabled={nvSaving || (!nvVin.trim() && !nvMake.trim() && !nvModel.trim())}>
                  {nvSaving ? 'Saving…' : 'Save vehicle'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t shrink-0 gap-2 sm:gap-2 bg-muted/30">
          {initial && onDelete && (
            <Button variant="destructive" onClick={() => { onDelete(initial.id); onOpenChange(false); }} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!clientId || !vehicleId || !requestedWork.trim()} className="min-w-24">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {showVinScanner && (
      <VinScanner
        onVinDetected={handleVinScanned}
        onClose={() => setShowVinScanner(false)}
        googleApiKey={settings.googleApiKey}
        grokApiKey={settings.grokApiKey}
        ocrSpaceApiKey={settings.ocrSpaceApiKey}
        ocrProvider={settings.ocrProvider}
      />
    )}
    </>
  );
};
