import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pencil, Calendar, User as UserIcon, Scan } from 'lucide-react';
import { ScheduleEntry, Client, Vehicle, Task, WorkSession, Settings } from '@/types';
import { ScheduleEntryDialog } from './ScheduleEntryDialog';
import { useWorkers } from '@/lib/workers';
import { useCanEdit, useCurrentUserId } from '@/lib/permissions';
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



const formatWhen = (d?: Date): string => {
  if (!d) return 'Unscheduled';
  const date = new Date(d);
  return date.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

export const ScheduleView = ({ schedule, clients, vehicles, tasks, settings, onAdd, onUpdate, onDelete, onStartTask, onAddVehicle, onUpdateVehicle }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [scanForVehicleId, setScanForVehicleId] = useState<string | null>(null);
  const { getWorker } = useWorkers();
  const uid = useCurrentUserId();
  const { toast } = useNotifications();

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Scheduled jobs ({visible.length})</h2>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
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
            return (
              <div key={entry.id} className={`rounded-xl border p-3 space-y-2 ${isOverdue ? 'border-orange-400/60 bg-orange-500/5' : 'border-border bg-card'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{client?.name || 'Unknown client'}</div>
                    <div className="text-xs text-muted-foreground">
                      {vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vin || 'Vehicle (no info yet)' : 'Unknown vehicle'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {vehicle && (
                      <Button
                        size="icon"
                        variant={hasVin ? 'ghost' : 'default'}
                        className={`h-7 w-7 ${!hasVin ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse' : ''}`}
                        title={hasVin ? 'Re-scan VIN' : 'Scan VIN now'}
                        onClick={() => setScanForVehicleId(vehicle.id)}
                      >
                        <Scan className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(entry); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStart(entry)}>
                      <Play className="h-3 w-3 mr-1" /> Start
                    </Button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{entry.requestedWork}</p>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <Badge variant="outline" className={`gap-1 ${isOverdue ? 'border-orange-500/60 text-orange-700 dark:text-orange-400' : ''}`}>
                    <Calendar className="h-3 w-3" /> {formatWhen(entry.scheduledAt)}
                  </Badge>
                  {hasVin ? (
                    <Badge variant="outline" className="font-mono text-[10px]">{vehicle!.vin}</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">No VIN yet</Badge>
                  )}
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
          googleApiKey={settings.googleApiKey}
          grokApiKey={settings.grokApiKey}
          ocrSpaceApiKey={settings.ocrSpaceApiKey}
          ocrProvider={settings.ocrProvider}
        />
      )}



      <ScheduleEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clients={clients}
        vehicles={vehicles}
        tasks={tasks}
        settings={settings}
        initial={editing}
        onSave={(entry) => {
          if (editing) onUpdate(editing.id, entry);
          else onAdd(entry);
        }}
        onDelete={editing ? onDelete : undefined}
        onAddVehicle={onAddVehicle}
      />

    </div>
  );
};
