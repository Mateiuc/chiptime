import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Plus, Play, Trash2, Calendar, User as UserIcon, QrCode, Scan, Loader2, CalendarDays, Clock } from 'lucide-react';
import { ScheduleEntry, Client, Vehicle, Task, WorkSession, Settings } from '@/types';
import { useWorkers } from '@/lib/workers';
import { useCurrentUserId } from '@/lib/permissions';
import { getCurrentUserId } from '@/lib/currentUser';
import { useNotifications } from '@/hooks/useNotifications';
import VinScanner from './VinScanner';
import { decodeVin, validateVin } from '@/lib/vinDecoder';

interface Props {
  schedule: ScheduleEntry[];
  clients: Client[];
  vehicles: Vehicle[];
  tasks: Task[];
  settings: Settings;
  onAdd: (entry: ScheduleEntry) => void;
  onUpdate: (id: string, updates: Partial<ScheduleEntry>) => void;
  onDelete: (id: string) => void;
  onStartTask: (task: Task) => void;
  onAddVehicle: (v: Vehicle) => Promise<void> | void;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => void;
}

const NEW_VEHICLE = '__new__';
const DRAFT_ID = '__draft__';

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
const formatWhen = (d?: Date): string => {
  if (!d) return 'Unscheduled';
  return new Date(d).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

export const DesktopScheduleView = ({
  schedule, clients, vehicles, tasks, settings,
  onAdd, onUpdate, onDelete, onStartTask, onAddVehicle, onUpdateVehicle,
}: Props) => {
  const { getWorker, allWorkers } = useWorkers();
  const uid = useCurrentUserId();
  const { toast } = useNotifications();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [previewDate, setPreviewDate] = useState<Date>(new Date());
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [draftDefaultDate, setDraftDefaultDate] = useState<string>('');

  // Editor form state
  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [requestedWork, setRequestedWork] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('any');
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);

  // New-vehicle sub-form
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [nvVin, setNvVin] = useState('');
  const [nvMake, setNvMake] = useState('');
  const [nvModel, setNvModel] = useState('');
  const [nvYear, setNvYear] = useState('');
  const [nvColor, setNvColor] = useState('');
  const [nvDecoding, setNvDecoding] = useState(false);
  const [nvSaving, setNvSaving] = useState(false);
  const [showVinScanner, setShowVinScanner] = useState(false);

  // VIN scan from list card
  const [scanForVehicleId, setScanForVehicleId] = useState<string | null>(null);

  const resetNewVehicle = () => {
    setShowNewVehicle(false);
    setNvVin(''); setNvMake(''); setNvModel(''); setNvYear(''); setNvColor('');
  };

  const visible = useMemo(() => {
    return schedule
      .filter(s => s.status !== 'started')
      .sort((a, b) => {
        if (!a.scheduledAt && b.scheduledAt) return -1;
        if (a.scheduledAt && !b.scheduledAt) return 1;
        if (!a.scheduledAt && !b.scheduledAt) return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime();
      });
  }, [schedule]);

  const dayKey = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const { jobsByDay, unscheduled, daysWithJobs, overdueDays } = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    const unsc: ScheduleEntry[] = [];
    for (const e of visible) {
      if (!e.scheduledAt) { unsc.push(e); continue; }
      const k = dayKey(new Date(e.scheduledAt));
      const arr = map.get(k) || [];
      arr.push(e);
      map.set(k, arr);
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const withJobs: Date[] = [];
    const overdue: Date[] = [];
    map.forEach((_v, k) => {
      const [y, m, d] = k.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      withJobs.push(date);
      if (date < today) overdue.push(date);
    });
    return { jobsByDay: map, unscheduled: unsc, daysWithJobs: withJobs, overdueDays: overdue };
  }, [visible]);

  const previewKey = dayKey(previewDate);
  const previewEntries = showUnscheduled ? unscheduled : (jobsByDay.get(previewKey) || []);

  const selectedEntry = !isDraft && selectedId ? schedule.find(s => s.id === selectedId) : null;



  // Load entry into form on selection
  useEffect(() => {
    if (isDraft) {
      setClientId(''); setVehicleId(''); setRequestedWork('');
      setDateStr(draftDefaultDate); setTimeStr(''); setAssignedTo('any'); setNotes('');
      setDirty(false); resetNewVehicle();
      return;
    }
    if (!selectedEntry) return;
    setClientId(selectedEntry.clientId || '');
    setVehicleId(selectedEntry.vehicleId || '');
    setRequestedWork(selectedEntry.requestedWork || '');
    setDateStr(toLocalDate(selectedEntry.scheduledAt));
    setTimeStr(toLocalTime(selectedEntry.scheduledAt));
    setAssignedTo(selectedEntry.assignedTo || 'any');
    setNotes(selectedEntry.notes || '');
    setDirty(false);
    resetNewVehicle();
  }, [selectedId, isDraft, selectedEntry?.id]);

  const markDirty = () => setDirty(true);

  const clientVehicles = useMemo(
    () => vehicles.filter(v => !clientId || v.clientId === clientId),
    [vehicles, clientId],
  );

  const handleVehicleSelect = (v: string) => {
    if (v === NEW_VEHICLE) { setShowNewVehicle(true); return; }
    setVehicleId(v); markDirty();
  };

  const handleDecodeVin = async (vinCode?: string) => {
    const vin = (vinCode || nvVin).trim().toUpperCase();
    if (!validateVin(vin)) {
      toast({ title: 'Invalid VIN', description: 'VIN must be 17 characters', variant: 'destructive' });
      return;
    }
    setNvDecoding(true);
    const decoded = await decodeVin(vin);
    setNvDecoding(false);
    if (decoded) {
      setNvMake(decoded.make); setNvModel(decoded.model); setNvYear(String(decoded.year));
    }
  };

  const handleVinScanned = (scanned: string) => {
    setNvVin(scanned); setShowVinScanner(false); handleDecodeVin(scanned);
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
      markDirty();
      resetNewVehicle();
      toast({ title: 'Vehicle added' });
    } finally { setNvSaving(false); }
  };

  // List actions
  const handleNewDraft = (defaultDate?: string) => {
    setDraftDefaultDate(defaultDate || '');
    setIsDraft(true);
    setSelectedId(DRAFT_ID);
  };

  const handleSelectEntry = (id: string) => {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    setIsDraft(false);
    setSelectedId(id);
  };

  const handleSave = () => {
    if (!clientId || !vehicleId || !requestedWork.trim()) {
      toast({ title: 'Missing fields', description: 'Client, vehicle and requested work are required', variant: 'destructive' });
      return;
    }
    let scheduledAt: Date | undefined;
    if (dateStr) {
      const t = timeStr || '09:00';
      scheduledAt = new Date(`${dateStr}T${t}:00`);
    }
    if (isDraft) {
      const entry: ScheduleEntry = {
        id: crypto.randomUUID(),
        clientId, vehicleId,
        requestedWork: requestedWork.trim(),
        scheduledAt,
        assignedTo: assignedTo === 'any' ? undefined : assignedTo,
        notes: notes.trim() || undefined,
        status: 'scheduled',
        createdAt: new Date(),
        createdBy: getCurrentUserId() || undefined,
      };
      onAdd(entry);
      setIsDraft(false);
      setSelectedId(entry.id);
      toast({ title: 'Job scheduled' });
    } else if (selectedEntry) {
      onUpdate(selectedEntry.id, {
        clientId, vehicleId,
        requestedWork: requestedWork.trim(),
        scheduledAt,
        assignedTo: assignedTo === 'any' ? undefined : assignedTo,
        notes: notes.trim() || undefined,
      });
      toast({ title: 'Saved' });
    }
    setDirty(false);
  };

  const handleCancel = () => {
    if (isDraft) { setIsDraft(false); setSelectedId(null); }
    else if (selectedEntry) {
      // reload from source
      setClientId(selectedEntry.clientId);
      setVehicleId(selectedEntry.vehicleId);
      setRequestedWork(selectedEntry.requestedWork);
      setDateStr(toLocalDate(selectedEntry.scheduledAt));
      setTimeStr(toLocalTime(selectedEntry.scheduledAt));
      setAssignedTo(selectedEntry.assignedTo || 'any');
      setNotes(selectedEntry.notes || '');
    }
    setDirty(false);
    resetNewVehicle();
  };

  const handleDelete = () => {
    if (!selectedEntry) return;
    if (!confirm('Delete this scheduled job?')) return;
    onDelete(selectedEntry.id);
    setSelectedId(null);
    setDirty(false);
  };

  const handleStart = (entry: ScheduleEntry) => {
    const client = clients.find(c => c.id === entry.clientId);
    const vehicle = vehicles.find(v => v.id === entry.vehicleId);
    if (!client || !vehicle) {
      toast({ title: 'Cannot start', description: 'Client or vehicle missing', variant: 'destructive' });
      return;
    }
    const session: WorkSession = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      description: entry.requestedWork,
      periods: [],
      parts: [],
      createdBy: getCurrentUserId() || undefined,
    };
    const newTask: Task = {
      id: crypto.randomUUID(),
      clientId: client.id,
      vehicleId: vehicle.id,
      customerName: client.name,
      carVin: vehicle.vin,
      status: 'in-progress',
      totalTime: 0,
      needsFollowUp: false,
      sessions: [session],
      createdAt: new Date(),
      startTime: new Date(),
      activeSessionId: session.id,
      createdBy: getCurrentUserId() || undefined,
    };
    onStartTask(newTask);
    onUpdate(entry.id, { status: 'started', startedTaskId: newTask.id });
    toast({ title: 'Timer started', description: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() });
  };

  const handleScanForCard = async (scanned: string) => {
    const vid = scanForVehicleId;
    setScanForVehicleId(null);
    if (!vid) return;
    const vin = scanned.trim().toUpperCase();
    if (!validateVin(vin)) {
      toast({ title: 'Invalid VIN', description: 'Must be 17 characters', variant: 'destructive' });
      return;
    }
    const activeTasks = tasks.filter(t => !['billed', 'paid'].includes(t.status));
    if (activeTasks.find(t => t.carVin.toUpperCase() === vin)) {
      toast({ title: 'Duplicate VIN', description: 'Already in an active task', variant: 'destructive' });
      return;
    }
    const veh = vehicles.find(v => v.id === vid);
    const updates: Partial<Vehicle> = { vin };
    if (veh && (!veh.make || !veh.model || !veh.year)) {
      const decoded = await decodeVin(vin);
      if (decoded) {
        if (!veh.make && decoded.make) updates.make = decoded.make;
        if (!veh.model && decoded.model) updates.model = decoded.model;
        if (!veh.year && decoded.year) updates.year = decoded.year;
      }
    }
    onUpdateVehicle(vid, updates);
    toast({ title: 'VIN saved', description: vin });
  };

  const selectionLabel = (() => {
    if (isDraft) return 'New scheduled job';
    if (!selectedEntry) return null;
    const c = clients.find(x => x.id === selectedEntry.clientId);
    const v = vehicles.find(x => x.id === selectedEntry.vehicleId);
    return `${c?.name || 'Client'} — ${v ? ([v.year, v.make, v.model].filter(Boolean).join(' ') || v.vin || 'vehicle') : 'vehicle'}`;
  })();

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* LEFT: list */}
      <div className="w-[360px] border-r flex flex-col bg-muted/20">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm">Scheduled jobs</h2>
            <p className="text-[11px] text-muted-foreground">{visible.length} pending</p>
          </div>
          <Button size="sm" onClick={() => handleNewDraft()}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1.5">
            {isDraft && (
              <div className="rounded-lg border-2 border-primary bg-primary/10 p-3 text-sm font-medium">
                New job (unsaved)
              </div>
            )}
            {visible.length === 0 && !isDraft ? (
              <div className="text-center py-12 text-muted-foreground space-y-1">
                <CalendarDays className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-sm font-medium">Nothing scheduled</p>
                <p className="text-xs">Click + Add to plan a job.</p>
              </div>
            ) : visible.map(entry => {
              const client = clients.find(c => c.id === entry.clientId);
              const vehicle = vehicles.find(v => v.id === entry.vehicleId);
              const worker = entry.assignedTo ? getWorker(entry.assignedTo) : null;
              const isOverdue = entry.scheduledAt && new Date(entry.scheduledAt) < new Date();
              const isSelected = !isDraft && selectedId === entry.id;
              const hasVin = !!vehicle?.vin?.trim();
              return (
                <button
                  key={entry.id}
                  onClick={() => handleSelectEntry(entry.id)}
                  className={`w-full text-left rounded-lg border p-2.5 space-y-1.5 transition ${
                    isSelected ? 'border-primary bg-primary/10 shadow-sm' :
                    isOverdue ? 'border-orange-400/60 bg-orange-500/5 hover:bg-orange-500/10' :
                    'border-border bg-card hover:bg-accent/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">{client?.name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vin || 'Vehicle' : 'Unknown vehicle'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      {vehicle && (
                        <Button
                          size="sm"
                          variant={hasVin ? 'outline' : 'default'}
                          className={`h-6 px-1.5 gap-1 ${!hasVin ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse' : ''}`}
                          title={hasVin ? 'Re-scan VIN' : 'Scan VIN now'}
                          onClick={() => setScanForVehicleId(vehicle.id)}
                        >
                          <QrCode className="h-3 w-3" />
                          <span className="text-[10px] font-bold">VIN</span>
                        </Button>
                      )}
                      <Button size="sm" className="h-6 px-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStart(entry)}>
                        <Play className="h-2.5 w-2.5 mr-0.5" /> Start
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2">{entry.requestedWork}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className={`gap-1 text-[10px] h-5 ${isOverdue ? 'border-orange-500/60 text-orange-700 dark:text-orange-400' : ''}`}>
                      <Calendar className="h-2.5 w-2.5" /> {formatWhen(entry.scheduledAt)}
                    </Badge>
                    {worker && (
                      <Badge variant="outline" className="gap-1 text-[10px] h-5" style={{ borderColor: worker.border, color: worker.color, background: worker.bg }}>
                        <UserIcon className="h-2.5 w-2.5" /> {worker.firstName}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT: editor */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!selectedId ? (
          <ScrollArea className="flex-1">
            <div className="p-6 max-w-3xl mx-auto space-y-6">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" /> Schedule overview
                </h2>
                <p className="text-xs text-muted-foreground">Pick a day to see the cars scheduled, or click a job in the list on the left.</p>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="rounded-lg border-2 bg-card p-2 shrink-0">
                  <CalendarUI
                    mode="single"
                    selected={previewDate}
                    onSelect={(d) => { if (d) { setPreviewDate(d); setShowUnscheduled(false); } }}
                    modifiers={{ hasJobs: daysWithJobs, overdue: overdueDays }}
                    modifiersClassNames={{
                      hasJobs: 'font-bold relative after:content-[""] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary',
                      overdue: 'text-orange-600 dark:text-orange-400 after:!bg-orange-500',
                    }}
                    className="pointer-events-auto"
                  />
                  <div className="px-2 pb-2 pt-1 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> scheduled</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> overdue</span>
                    {unscheduled.length > 0 && (
                      <button
                        onClick={() => setShowUnscheduled(s => !s)}
                        className={`ml-auto px-2 py-0.5 rounded-full border text-[11px] ${showUnscheduled ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                      >
                        Unscheduled ({unscheduled.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {showUnscheduled
                        ? `Unscheduled (${unscheduled.length})`
                        : previewDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      {!showUnscheduled && (
                        <Badge variant="secondary" className="h-5 text-[10px]">{previewEntries.length}</Badge>
                      )}
                    </h3>
                    {!showUnscheduled && (
                      <Button size="sm" variant="outline" onClick={() => handleNewDraft(previewKey)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add on this day
                      </Button>
                    )}
                  </div>

                  {previewEntries.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
                      {showUnscheduled ? 'No unscheduled jobs.' : 'No jobs scheduled for this day.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {previewEntries.map(entry => {
                        const client = clients.find(c => c.id === entry.clientId);
                        const vehicle = vehicles.find(v => v.id === entry.vehicleId);
                        const worker = entry.assignedTo ? getWorker(entry.assignedTo) : null;
                        const time = entry.scheduledAt
                          ? new Date(entry.scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                          : '—';
                        const isOverdue = entry.scheduledAt && new Date(entry.scheduledAt) < new Date();
                        return (
                          <button
                            key={entry.id}
                            onClick={() => handleSelectEntry(entry.id)}
                            className={`w-full text-left rounded-lg border-2 p-3 flex items-center gap-3 transition hover:bg-accent/40 ${
                              isOverdue ? 'border-orange-400/60 bg-orange-500/5' : 'border-border bg-card'
                            }`}
                          >
                            <div className="w-16 shrink-0 text-center">
                              <div className="font-bold text-sm tabular-nums">{time}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm truncate">{client?.name || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vin || 'Vehicle' : 'Unknown vehicle'}
                              </div>
                              <div className="text-xs text-foreground/70 truncate mt-0.5">{entry.requestedWork}</div>
                            </div>
                            {worker && (
                              <Badge variant="outline" className="gap-1 text-[10px] h-5 shrink-0" style={{ borderColor: worker.border, color: worker.color, background: worker.bg }}>
                                <UserIcon className="h-2.5 w-2.5" /> {worker.firstName}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <>
            <div className="px-6 py-3 border-b flex items-center justify-between bg-background">
              <div className="min-w-0">
                <h2 className="font-bold truncate">{selectionLabel}</h2>
                <p className="text-xs text-muted-foreground">{isDraft ? 'Fill in the details and save.' : 'Edit job details.'}</p>
              </div>
              {dirty && <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">Unsaved changes</Badge>}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 max-w-4xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* LEFT COL */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs">Client</Label>
                      <Select value={clientId} onValueChange={v => { setClientId(v); setVehicleId(''); resetNewVehicle(); markDirty(); }}>
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
                      <Select value={assignedTo} onValueChange={v => { setAssignedTo(v); markDirty(); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Anyone</SelectItem>
                          {allWorkers().map(w => <SelectItem key={w.id} value={w.id}>{w.firstName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* RIGHT COL */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Date (optional)</Label>
                        <Input type="date" value={dateStr} onChange={e => { setDateStr(e.target.value); markDirty(); }} />
                      </div>
                      <div>
                        <Label className="text-xs">Time (optional)</Label>
                        <Input type="time" value={timeStr} onChange={e => { setTimeStr(e.target.value); markDirty(); }} disabled={!dateStr} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Requested work</Label>
                      <Textarea
                        value={requestedWork}
                        onChange={e => { setRequestedWork(e.target.value); markDirty(); }}
                        placeholder="What did the client ask for?"
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Notes (optional)</Label>
                      <Textarea value={notes} onChange={e => { setNotes(e.target.value); markDirty(); }} rows={2} />
                    </div>
                  </div>

                  {/* NEW VEHICLE — full width */}
                  {showNewVehicle && (
                    <div className="lg:col-span-2 rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-bold">New vehicle</Label>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={resetNewVehicle}>Cancel</Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                          type="button" variant="outline" size="sm"
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
                      <p className="text-[11px] text-muted-foreground">No VIN? Save now and scan later from the job card.</p>
                      {nvDecoding && (
                        <p className="text-xs text-primary flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Decoding VIN…</p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Input value={nvMake} onChange={e => setNvMake(e.target.value)} placeholder="Make" />
                        <Input value={nvModel} onChange={e => setNvModel(e.target.value)} placeholder="Model" />
                        <Input type="number" value={nvYear} onChange={e => setNvYear(e.target.value)} placeholder="Year" />
                        <Input value={nvColor} onChange={e => setNvColor(e.target.value)} placeholder="Color" />
                      </div>
                      <Button size="sm" onClick={handleSaveNewVehicle} disabled={nvSaving || (!nvVin.trim() && !nvMake.trim() && !nvModel.trim())}>
                        {nvSaving ? 'Saving…' : 'Save vehicle'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <div className="px-6 py-3 border-t flex items-center gap-2 bg-muted/30">
              {!isDraft && selectedEntry && (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  {isDraft ? 'Discard' : 'Reset'}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!dirty && !isDraft} className="min-w-24">
                  {isDraft ? 'Create job' : (dirty ? 'Save changes' : 'Saved')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

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
      {scanForVehicleId && (
        <VinScanner
          onVinDetected={handleScanForCard}
          onClose={() => setScanForVehicleId(null)}
          googleApiKey={settings.googleApiKey}
          grokApiKey={settings.grokApiKey}
          ocrSpaceApiKey={settings.ocrSpaceApiKey}
          ocrProvider={settings.ocrProvider}
        />
      )}
    </div>
  );
};
