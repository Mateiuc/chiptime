import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pencil, Calendar, User as UserIcon, QrCode } from 'lucide-react';
import { ScheduleEntry, Client, Vehicle, Task, WorkSession, Settings } from '@/types';
import { ScheduleEntryDialog } from './ScheduleEntryDialog';
import { useWorkers } from '@/lib/workers';
import { useCanEdit, useCurrentUserId } from '@/lib/permissions';
import { getCurrentUserId } from '@/lib/currentUser';
import { useNotifications } from '@/hooks/useNotifications';
import VinScanner from './VinScanner';
import { decodeVin, validateVin } from '@/lib/vinDecoder';
import VoiceScheduleButton, { VoiceDraft } from './VoiceScheduleButton';
import { entryClientName, entryCarLabel, entryIsNewClient, parseCarInfo } from '@/lib/scheduleEntry';


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
  onAddClient: (c: Client) => Promise<void> | void;

  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => void;
}



const formatWhen = (d?: Date): string => {
  if (!d) return 'Unscheduled';
  const date = new Date(d);
  return date.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

export const ScheduleView = ({ schedule, clients, vehicles, tasks, settings, onAdd, onUpdate, onDelete, onStartTask, onAddVehicle, onAddClient, onUpdateVehicle }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [voiceInitial, setVoiceInitial] = useState<ScheduleEntry | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string | undefined>(undefined);
  const [scanForVehicleId, setScanForVehicleId] = useState<string | null>(null);
  const { getWorker, allWorkers } = useWorkers();
  const uid = useCurrentUserId();
  const { toast } = useNotifications();

  const voiceContext = useMemo(() => ({
    clients: clients.map(c => ({ id: c.id, name: c.name })),
    vehicles: vehicles.map(v => ({
      id: v.id, clientId: v.clientId,
      make: v.make, model: v.model, year: v.year, color: v.color,
    })),
    workers: allWorkers().map(w => ({ id: w.id, firstName: w.firstName })),
  }), [clients, vehicles, allWorkers]);

  const handleVoiceParsed = (draft: VoiceDraft, transcript: string) => {
    let scheduledAt: Date | undefined;
    if (draft.date) {
      const t = draft.time || '09:00';
      scheduledAt = new Date(`${draft.date}T${t}:00`);
    }
    const synthetic: ScheduleEntry = {
      id: 'voice-draft',
      clientId: draft.clientId || undefined,
      clientName: draft.clientId ? undefined : draft.clientName || undefined,
      clientPhone: draft.clientId ? undefined : draft.clientPhone || undefined,
      vehicleId: draft.vehicleId || undefined,
      carInfo: draft.vehicleId ? undefined : draft.carInfo || undefined,
      requestedWork: draft.requestedWork,
      scheduledAt,
      assignedTo: draft.assignedTo || undefined,
      notes: draft.notes || undefined,
      status: 'scheduled',
      createdAt: new Date(),
    };

    setEditing(null);
    setVoiceInitial(synthetic);
    setVoiceTranscript(transcript);
    setDialogOpen(true);
  };

  const handleVinScanned = async (scanned: string) => {
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


  const visible = useMemo(() => {
    return schedule
      .filter(s => s.status !== 'started')
      .sort((a, b) => {
        // unscheduled first, then by date asc
        if (!a.scheduledAt && b.scheduledAt) return -1;
        if (a.scheduledAt && !b.scheduledAt) return 1;
        if (!a.scheduledAt && !b.scheduledAt) return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime();
      });
  }, [schedule]);

  const handleStart = async (entry: ScheduleEntry) => {
    let client = clients.find(c => c.id === entry.clientId);
    let vehicle = vehicles.find(v => v.id === entry.vehicleId);

    // The job may have been booked for someone who isn't in the app yet —
    // register the client and the car on the spot.
    if (!client) {
      const name = entry.clientName?.trim();
      if (!name) {
        toast({ title: 'Cannot start', description: 'No client on this job', variant: 'destructive' });
        return;
      }
      const created: Client = {
        id: crypto.randomUUID(),
        name,
        phone: entry.clientPhone?.trim() || undefined,
        createdAt: new Date(),
        createdBy: getCurrentUserId() || undefined,
      } as Client;
      await onAddClient(created);
      client = created;
    }
    if (!vehicle) {
      const info = entry.carInfo?.trim();
      if (!info) {
        toast({ title: 'Cannot start', description: 'No car on this job', variant: 'destructive' });
        return;
      }
      const parsed = parseCarInfo(info);
      const created: Vehicle = {
        id: crypto.randomUUID(),
        clientId: client.id,
        vin: '',
        make: parsed.make,
        model: parsed.model,
        year: parsed.year,
        createdAt: new Date(),
      } as Vehicle;
      await onAddVehicle(created);
      vehicle = created;
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
    onUpdate(entry.id, { clientId: client.id, vehicleId: vehicle.id, clientName: undefined, carInfo: undefined, status: 'started', startedTaskId: newTask.id });
    toast({ title: 'Timer started', description: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || client.name });
  };


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">Scheduled jobs ({visible.length})</h2>
        <div className="flex items-center gap-2">
          <VoiceScheduleButton context={voiceContext} onParsed={handleVoiceParsed} />
          <Button size="sm" onClick={() => { setEditing(null); setVoiceInitial(null); setVoiceTranscript(undefined); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground space-y-2">
          <div className="text-4xl">📅</div>
          <p className="font-medium text-foreground">Nothing scheduled</p>
          <p className="text-sm">Add a job to plan upcoming work.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(entry => {
            const client = clients.find(c => c.id === entry.clientId);
            const vehicle = vehicles.find(v => v.id === entry.vehicleId);
            const worker = entry.assignedTo ? getWorker(entry.assignedTo) : null;
            const isOverdue = entry.scheduledAt && new Date(entry.scheduledAt) < new Date();
            const canEdit = !entry.createdBy || entry.createdBy === uid;
            const hasVin = !!vehicle?.vin?.trim();
            const isNew = entryIsNewClient(entry, clients);

            return (
              <div key={entry.id} className={`rounded-xl border p-3 space-y-2 ${isOverdue ? 'border-orange-400/60 bg-orange-500/5' : 'border-border bg-card'}`}>
                {/* 1. When */}
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={`gap-1 ${isOverdue ? 'border-orange-500/60 text-orange-700 dark:text-orange-400' : ''}`}>
                    <Calendar className="h-3 w-3" /> {formatWhen(entry.scheduledAt)}
                  </Badge>
                  <div className="flex items-center gap-1 shrink-0">
                    {vehicle && (
                      <Button
                        size="sm"
                        variant={hasVin ? 'outline' : 'default'}
                        className={`h-7 px-2 gap-1 ${!hasVin ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse' : ''}`}
                        title={hasVin ? 'Re-scan VIN' : 'Scan VIN now'}
                        onClick={() => setScanForVehicleId(vehicle.id)}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold">VIN</span>
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(entry); setVoiceInitial(null); setVoiceTranscript(undefined); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStart(entry)}>
                      <Play className="h-3 w-3 mr-1" /> Start
                    </Button>
                  </div>
                </div>

                {/* 2. Client   3. Car */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{entryClientName(entry, clients)}</span>
                    {isNew && (
                      <Badge variant="outline" className="border-sky-500/60 text-sky-700 dark:text-sky-400 text-[10px]">New client</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{entryCarLabel(entry, vehicles)}</div>
                </div>

                {/* 4. Work to be done */}
                <p className="text-sm whitespace-pre-wrap break-words">{entry.requestedWork}</p>

                {/* 5. Notes */}
                {entry.notes && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words border-l-2 border-border pl-2">{entry.notes}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {vehicle && (hasVin ? (
                    <Badge variant="outline" className="font-mono text-[10px]">{vehicle.vin}</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">No VIN yet</Badge>
                  ))}
                  {worker && (
                    <Badge variant="outline" className="gap-1" style={{ borderColor: worker.border, color: worker.color, background: worker.bg }}>
                      <UserIcon className="h-3 w-3" /> {worker.firstName}
                    </Badge>
                  )}
                </div>
              </div>

            );
          })}
        </div>
      )}

      {scanForVehicleId && (
        <VinScanner
          onVinDetected={handleVinScanned}
          onClose={() => setScanForVehicleId(null)}
          ocrProvider={settings.ocrProvider}
        />
      )}



      <ScheduleEntryDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) { setVoiceInitial(null); setVoiceTranscript(undefined); } }}
        clients={clients}
        vehicles={vehicles}
        tasks={tasks}
        settings={settings}
        initial={editing || voiceInitial}
        aiTranscript={voiceTranscript}
        onSave={(entry) => {
          if (editing) onUpdate(editing.id, entry);
          else onAdd({ ...entry, id: crypto.randomUUID() });
        }}
        onDelete={editing ? onDelete : undefined}
        onAddVehicle={onAddVehicle}
      />

    </div>
  );
};
