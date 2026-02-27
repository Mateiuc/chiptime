import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, Plus, Users, Search, Car, RefreshCw, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskCard } from '@/components/TaskCard';
import { AddVehicleDialog } from '@/components/AddVehicleDialog';
import { AddClientDialog } from '@/components/AddClientDialog';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ManageClientsDialog } from '@/components/ManageClientsDialog';
import { useClients, useVehicles, useTasks, useSettings, useCloudSync, setCloudPushEnabled, pushNow } from '@/hooks/useStorage';
import { Task, Client, Vehicle } from '@/types';
import { useNotifications } from '@/hooks/useNotifications';
import { getVehicleColorScheme } from '@/lib/vehicleColors';
import { photoStorageService } from '@/services/photoStorageService';
import { syncPortalToCloud } from '@/lib/clientPortalUtils';
import { contactsService } from '@/services/contactsService';
import { appSyncService, SyncData } from '@/services/appSyncService';

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
  const [searchParams, setSearchParams] = useSearchParams();

  // Desktop: disable auto-push, pull on mount
  useEffect(() => {
    setCloudPushEnabled(false);
    return () => { setCloudPushEnabled(true); };
  }, []);

  // Auto-link via ?sync= URL param
  useEffect(() => {
    const syncParam = searchParams.get('sync');
    if (syncParam) {
      appSyncService.setSyncId(syncParam);
      // Clean URL
      searchParams.delete('sync');
      setSearchParams(searchParams, { replace: true });
      // Pull data with new sync ID
      refresh().then(() => {
        toast({ title: 'Linked & Loaded', description: 'Connected to your phone\'s data.' });
      });
    }
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

  const groupByClient = (taskList: Task[]) => {
    return taskList.reduce((acc, task) => {
      if (!acc[task.clientId]) acc[task.clientId] = [];
      acc[task.clientId].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
  };

  const renderTaskGroup = (taskList: Task[]) => {
    const grouped = groupByClient(taskList);
    if (Object.keys(grouped).length === 0) {
      return <div className="text-center py-12 text-muted-foreground">No tasks in this category.</div>;
    }
    return Object.entries(grouped).map(([clientId, clientTasks]) => {
      const client = clients.find(c => c.id === clientId);
      return (
        <div key={clientId} className="rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-foreground">
              {client?.name || 'Unknown Client'}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({vehicles.filter(v => v.clientId === clientId).length} vehicles)
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {clientTasks.map(task => {
              const vehicle = vehicles.find(v => v.id === task.vehicleId);
              const colorScheme = getVehicleColorScheme(vehicle?.id || task.vehicleId);
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  client={client}
                  vehicle={vehicle}
                  settings={settings}
                  onMarkBilled={handleMarkBilled}
                  onMarkPaid={handleMarkPaid}
                  onRestartTimer={handleRestartTimer}
                  onUpdateTask={async (updatedTask) => { await updateTask(updatedTask.id, updatedTask); }}
                  onDelete={handleDelete}
                  vehicleColorScheme={colorScheme}
                />
              );
            })}
          </div>
        </div>
      );
    });
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

            <TabsContent value="active" className="space-y-4">{renderTaskGroup(activeTasks)}</TabsContent>
            <TabsContent value="completed" className="space-y-4">{renderTaskGroup(completedTasks)}</TabsContent>
            <TabsContent value="billed" className="space-y-4">{renderTaskGroup(billedTasks)}</TabsContent>
            <TabsContent value="paid" className="space-y-4">{renderTaskGroup(paidTasks)}</TabsContent>
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
    </div>
  );
};

export default DesktopDashboard;
