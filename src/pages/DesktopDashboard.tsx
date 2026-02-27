import { useState, useMemo, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Users, Search, Car, Upload, Download, Pencil, RotateCcw, Trash2, Receipt, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AddVehicleDialog } from '@/components/AddVehicleDialog';
import { AddClientDialog } from '@/components/AddClientDialog';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ManageClientsDialog } from '@/components/ManageClientsDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { useClients, useVehicles, useTasks, useSettings, useCloudSync, setCloudPushEnabled, pushNow } from '@/hooks/useStorage';
import { Task, Client, Vehicle } from '@/types';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDuration, formatCurrency } from '@/lib/formatTime';
import { photoStorageService } from '@/services/photoStorageService';
import { syncPortalToCloud } from '@/lib/clientPortalUtils';
import { contactsService } from '@/services/contactsService';
import { SyncData } from '@/services/appSyncService';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'pending': { label: 'Pending', variant: 'outline' },
  'in-progress': { label: 'In Progress', variant: 'default' },
  'paused': { label: 'Paused', variant: 'secondary' },
  'completed': { label: 'Completed', variant: 'secondary' },
  'billed': { label: 'Billed', variant: 'default' },
  'paid': { label: 'Paid', variant: 'default' },
};

const DesktopDashboard = () => {
  const clientsHook = useClients();
  const vehiclesHook = useVehicles();
  const tasksHook = useTasks();
  const settingsHook = useSettings();

  const { clients, addClient, updateClient, deleteClient } = clientsHook;
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = vehiclesHook;
  const { tasks, addTask, updateTask, deleteTask } = tasksHook;
  const { settings, setSettings } = settingsHook;

  const { syncing, lastSyncAt, refresh } = useCloudSync({
    clients: clientsHook,
    vehicles: vehiclesHook,
    tasks: tasksHook,
    settings: settingsHook,
  });
  const [saving, setSaving] = useState(false);

  // Desktop: disable auto-push, pull on mount
  useEffect(() => {
    setCloudPushEnabled(false);
    return () => { setCloudPushEnabled(true); };
  }, []);

  // Force pull cloud data on mount (after push is disabled)
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveToCloud = async () => {
    setSaving(true);
    try {
      // Build snapshot from current React state
      const snapshot: SyncData = { clients, vehicles, tasks, settings };
      await pushNow(snapshot);
      toast({ title: 'Saved to Cloud' });
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReloadFromCloud = async () => {
    await refresh();
    toast({ title: 'Reloaded from Cloud' });
  };

  const { toast } = useNotifications();

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showManageClients, setShowManageClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Handlers (no timer logic) ---

  const handleMarkBilled = (taskId: string) => {
    updateTask(taskId, { status: 'billed' });
    toast({ title: 'Task Marked as Billed' });
    const task = tasks.find(t => t.id === taskId);
    const client = task ? clients.find(c => c.id === task.clientId) : null;
    if (client) {
      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status: 'billed' as const } : t);
      syncPortalToCloud(client, vehicles, updatedTasks, settings.defaultHourlyRate)
        .then(portalId => { if (!client.portalId) updateClient(client.id, { portalId }); })
        .catch(err => console.warn('[CloudSync] Portal sync failed:', err));
    }
  };

  const handleMarkPaid = (taskId: string) => {
    updateTask(taskId, { status: 'paid' });
    toast({ title: 'Payment Recorded' });
    const task = tasks.find(t => t.id === taskId);
    const client = task ? clients.find(c => c.id === task.clientId) : null;
    if (client) {
      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status: 'paid' as const } : t);
      syncPortalToCloud(client, vehicles, updatedTasks, settings.defaultHourlyRate)
        .then(portalId => { if (!client.portalId) updateClient(client.id, { portalId }); })
        .catch(err => console.warn('[CloudSync] Portal sync failed:', err));
    }
  };

  const handleDelete = async (taskId: string) => {
    await photoStorageService.deleteAllPhotosForTask(taskId);
    await deleteTask(taskId);
    toast({ title: 'Task Deleted' });
  };

  const handleRestartTimer = (taskId: string) => {
    updateTask(taskId, { status: 'pending', startTime: undefined, activeSessionId: undefined });
    toast({ title: 'Task Reactivated' });
  };

  const handleAddClient = (clientData: Omit<Client, 'id' | 'createdAt'>) => {
    const newClient: Client = { ...clientData, id: crypto.randomUUID(), createdAt: new Date() };
    addClient(newClient);
    toast({ title: 'Client Added' });
  };

  const handleAddVehicle = async (vehicleData: Omit<Vehicle, 'id'>, clientName?: string, phoneContact?: any) => {
    try {
      let finalClientId = vehicleData.clientId;
      let clientForTask: Client | undefined;

      if (clientName && vehicleData.clientId === 'pending') {
        const bestPhone = phoneContact?.phoneNumbers
          ? contactsService.getBestPhoneNumber(phoneContact.phoneNumbers)
          : null;
        const newClient: Client = {
          id: crypto.randomUUID(),
          name: clientName,
          phone: bestPhone || undefined,
          email: phoneContact?.emails?.[0] || undefined,
          createdAt: new Date(),
        };
        await addClient(newClient);
        finalClientId = newClient.id;
        clientForTask = newClient;
      } else {
        clientForTask = clients.find(c => c.id === finalClientId);
      }

      const newVehicle: Vehicle = { ...vehicleData, id: crypto.randomUUID(), clientId: finalClientId };
      await addVehicle(newVehicle);

      const newTask: Task = {
        id: crypto.randomUUID(),
        clientId: finalClientId,
        vehicleId: newVehicle.id,
        customerName: clientForTask?.name || clientName || 'Unknown',
        carVin: newVehicle.vin,
        status: 'pending',
        totalTime: 0,
        needsFollowUp: false,
        sessions: [],
        createdAt: new Date(),
      };
      await addTask(newTask);
      toast({ title: 'Vehicle Added' });
    } catch (error) {
      console.error('Failed to add vehicle:', error);
      toast({ title: 'Error', description: 'Failed to save vehicle.', variant: 'destructive' });
    }
  };

  const handleUpdateClient = (id: string, updates: Partial<Client>) => updateClient(id, updates);
  const handleDeleteClient = (id: string) => {
    const clientTasks = tasks.filter(t => t.clientId === id);
    if (clientTasks.some(t => ['pending', 'in-progress', 'paused'].includes(t.status))) {
      toast({ title: 'Cannot Delete Client', description: 'Client has active tasks.', variant: 'destructive' });
      return;
    }
    vehicles.filter(v => v.clientId === id).forEach(v => deleteVehicle(v.id));
    clientTasks.forEach(t => deleteTask(t.id));
    deleteClient(id);
    if (selectedClientId === id) setSelectedClientId(null);
    toast({ title: 'Client Deleted' });
  };

  const handleUpdateVehicle = (id: string, updates: Partial<Vehicle>) => {
    updateVehicle(id, updates);
    if (updates.vin) {
      tasks.filter(t => t.vehicleId === id).forEach(t => updateTask(t.id, { carVin: updates.vin! }));
    }
    toast({ title: 'Vehicle Updated' });
  };

  const handleDeleteVehicle = (id: string) => {
    const vehicleTasks = tasks.filter(t => t.vehicleId === id);
    if (vehicleTasks.some(t => ['pending', 'in-progress', 'paused'].includes(t.status))) {
      toast({ title: 'Cannot Delete Vehicle', description: 'Vehicle has active tasks.', variant: 'destructive' });
      return;
    }
    vehicleTasks.forEach(t => deleteTask(t.id));
    deleteVehicle(id);
    toast({ title: 'Vehicle Deleted' });
  };

  const handleMoveVehicle = (vehicleId: string, newClientId: string) => {
    const newClient = clients.find(c => c.id === newClientId);
    if (!newClient) return;
    updateVehicle(vehicleId, { clientId: newClientId });
    tasks.filter(t => t.vehicleId === vehicleId).forEach(t => {
      updateTask(t.id, { clientId: newClientId, customerName: newClient.name });
    });
  };

  const handleStartWork = (_vehicleId: string) => {
    toast({ title: 'Timer not available', description: 'Use the mobile app to start timers.' });
  };

  // --- Filtering ---
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (selectedClientId) result = result.filter(t => t.clientId === selectedClientId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => {
        const client = clients.find(c => c.id === t.clientId);
        const vehicle = vehicles.find(v => v.id === t.vehicleId);
        return (
          client?.name.toLowerCase().includes(q) ||
          vehicle?.vin.toLowerCase().includes(q) ||
          vehicle?.make?.toLowerCase().includes(q) ||
          vehicle?.model?.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [tasks, selectedClientId, searchQuery, clients, vehicles]);

  const activeTasks = filteredTasks.filter(t => ['pending', 'in-progress', 'paused'].includes(t.status));
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');
  const billedTasks = filteredTasks.filter(t => t.status === 'billed');
  const paidTasks = filteredTasks.filter(t => t.status === 'paid');

  // Photo thumbnails state
  const [taskPhotos, setTaskPhotos] = useState<Record<string, string[]>>({});
  const [photosLoading, setPhotosLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Load photo thumbnails for visible tasks
  useEffect(() => {
    const loadPhotos = async () => {
      setPhotosLoading(true);
      const photoMap: Record<string, string[]> = {};
      
      for (const task of filteredTasks) {
        const allPhotos = (task.sessions || []).flatMap(s => s.photos || []);
        if (allPhotos.length === 0) continue;
        
        const urls: string[] = [];
        for (const photo of allPhotos.slice(0, 3)) {
          if (photo.cloudUrl) {
            urls.push(photo.cloudUrl);
          } else if (photo.filePath) {
            try {
              const base64 = await photoStorageService.loadPhoto(photo.filePath);
              if (base64) urls.push(`data:image/jpeg;base64,${base64}`);
            } catch { /* skip */ }
          }
        }
        if (urls.length > 0) photoMap[task.id] = urls;
      }
      
      setTaskPhotos(photoMap);
      setPhotosLoading(false);
    };
    
    loadPhotos();
  }, [filteredTasks]);

  const getTaskCost = (task: Task) => {
    const client = clients.find(c => c.id === task.clientId);
    const rate = client?.hourlyRate || settings.defaultHourlyRate;
    const laborCost = (task.totalTime / 3600) * rate;
    const partsCost = (task.sessions || []).reduce((sum, s) => 
      sum + (s.parts || []).reduce((ps, p) => ps + (p.price * p.quantity), 0), 0
    );
    return laborCost + partsCost;
  };

  const getPhotoCount = (task: Task) => 
    (task.sessions || []).reduce((sum, s) => sum + (s.photos?.length || 0), 0);

  const isAllClients = selectedClientId === null;

  const renderTaskTable = (taskList: Task[]) => {
    if (taskList.length === 0) {
      return <div className="text-center py-12 text-muted-foreground">No tasks in this category.</div>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {isAllClients && <TableHead>Client</TableHead>}
            <TableHead>Vehicle</TableHead>
            <TableHead>VIN</TableHead>
            <TableHead>Photos</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Time</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {taskList.map(task => {
            const client = clients.find(c => c.id === task.clientId);
            const vehicle = vehicles.find(v => v.id === task.vehicleId);
            const vehicleLabel = vehicle 
              ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Unknown'
              : 'Unknown';
            const vinShort = (vehicle?.vin || task.carVin || '').slice(0, 8);
            const photos = taskPhotos[task.id] || [];
            const photoCount = getPhotoCount(task);
            const status = statusConfig[task.status] || statusConfig['pending'];
            const cost = getTaskCost(task);

            return (
              <TableRow 
                key={task.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setEditingTask(task)}
              >
                {isAllClients && (
                  <TableCell className="font-medium">{client?.name || 'Unknown'}</TableCell>
                )}
                <TableCell className="font-medium">{vehicleLabel}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{vinShort}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {photosLoading ? (
                      <Skeleton className="h-8 w-8 rounded" />
                    ) : photos.length > 0 ? (
                      <>
                        {photos.map((url, i) => (
                          <img 
                            key={i} 
                            src={url} 
                            alt="Task photo" 
                            className="h-8 w-8 rounded object-cover border border-border"
                          />
                        ))}
                        {photoCount > 3 && (
                          <span className="text-xs text-muted-foreground ml-1">+{photoCount - 3}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatDuration(task.totalTime)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(cost)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTask(task)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {task.status === 'completed' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMarkBilled(task.id)} title="Mark Billed">
                        <Receipt className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {task.status === 'billed' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMarkPaid(task.id)} title="Mark Paid">
                        <DollarSign className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {['completed', 'billed', 'paid'].includes(task.status) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRestartTimer(task.id)} title="Reactivate">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(task.id)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-primary/10 backdrop-blur-sm shadow-sm flex-shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-primary">Auto-Tracker Desktop</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search clients, VINs..."
                className="pl-9 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReloadFromCloud}
              disabled={syncing}
            >
              <Download className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              Reload
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveToCloud}
              disabled={saving}
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className={`h-4 w-4 mr-1 ${saving ? 'animate-pulse' : ''}`} />
              Save to Cloud
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowManageClients(true)}>
              <Users className="h-4 w-4 mr-1" /> Clients
            </Button>
            <Button variant="default" size="sm" onClick={() => setShowAddVehicle(true)}>
              <Plus className="h-4 w-4 mr-1" /> Vehicle
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="h-9 w-9">
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 border-r bg-card flex-shrink-0 flex flex-col">
          <div className="p-3 border-b">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Clients</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              <button
                onClick={() => setSelectedClientId(null)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedClientId === null
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                All Clients
                <span className="ml-1 text-xs opacity-70">({clients.length})</span>
              </button>
              {clients.map(client => {
                const vehicleCount = vehicles.filter(v => v.clientId === client.id).length;
                const taskCount = tasks.filter(t => t.clientId === client.id).length;
                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedClientId === client.id
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="truncate font-medium">{client.name}</div>
                    <div className={`text-xs ${selectedClientId === client.id ? 'opacity-70' : 'text-muted-foreground'}`}>
                      <Car className="inline h-3 w-3 mr-0.5" />{vehicleCount} · {taskCount} tasks
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="active">Active ({activeTasks.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
              <TabsTrigger value="billed">Billed ({billedTasks.length})</TabsTrigger>
              <TabsTrigger value="paid">Paid ({paidTasks.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">{renderTaskTable(activeTasks)}</TabsContent>
            <TabsContent value="completed" className="space-y-4">{renderTaskTable(completedTasks)}</TabsContent>
            <TabsContent value="billed" className="space-y-4">{renderTaskTable(billedTasks)}</TabsContent>
            <TabsContent value="paid" className="space-y-4">{renderTaskTable(paidTasks)}</TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Dialogs */}
      <AddVehicleDialog
        open={showAddVehicle}
        onOpenChange={setShowAddVehicle}
        clients={clients}
        tasks={tasks}
        settings={settings}
        onAddClient={() => { setShowAddVehicle(false); setShowAddClient(true); }}
        onSave={handleAddVehicle}
      />
      <AddClientDialog open={showAddClient} onOpenChange={setShowAddClient} onSave={handleAddClient} />
      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={settings}
        onSave={setSettings}
        tasks={tasks}
        clients={clients}
        vehicles={vehicles}
        onMarkBilled={handleMarkBilled}
        onMarkPaid={handleMarkPaid}
        onRestartTimer={handleRestartTimer}
        onUpdateTask={async (updatedTask) => { await updateTask(updatedTask.id, updatedTask); }}
        onDelete={handleDelete}
        onUpdateClient={handleUpdateClient}
        onDeleteClient={handleDeleteClient}
        onUpdateVehicle={handleUpdateVehicle}
        onDeleteVehicle={handleDeleteVehicle}
        onStartWork={handleStartWork}
        onMoveVehicle={handleMoveVehicle}
      />
      <ManageClientsDialog
        open={showManageClients}
        onOpenChange={setShowManageClients}
        clients={clients}
        vehicles={vehicles}
        tasks={tasks}
        settings={settings}
        onUpdateClient={handleUpdateClient}
        onDeleteClient={handleDeleteClient}
        onUpdateVehicle={handleUpdateVehicle}
        onDeleteVehicle={handleDeleteVehicle}
        onStartWork={handleStartWork}
        onMoveVehicle={handleMoveVehicle}
      />
      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => { if (!open) setEditingTask(null); }}
          task={editingTask}
          onSave={async (updatedTask) => { await updateTask(updatedTask.id, updatedTask); setEditingTask(null); }}
          onDelete={(taskId) => { handleDelete(taskId); setEditingTask(null); }}
        />
      )}
    </div>
  );
};

export default DesktopDashboard;
