import { useState, useMemo, useEffect } from 'react';
import { Settings as SettingsIcon, Search, Upload, Download, Pencil, RotateCcw, Trash2, Receipt, DollarSign, ChevronDown, ChevronRight, ImageOff, Car, Mail, Phone, CreditCard, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { DesktopSettingsView } from '@/components/DesktopSettingsView';
import { useClients, useVehicles, useTasks, useSettings, useCloudSync, setCloudPushEnabled, pushNow } from '@/hooks/useStorage';
import { Task, Client, Vehicle, WorkSession } from '@/types';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDuration, formatCurrency, formatTime } from '@/lib/formatTime';
import { photoStorageService } from '@/services/photoStorageService';
import { syncPortalToCloud } from '@/lib/clientPortalUtils';
import { SyncData } from '@/services/appSyncService';
import { getVehicleColorScheme } from '@/lib/vehicleColors';
import { getSessionColorScheme } from '@/lib/sessionColors';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type FilterType = 'all' | 'active' | 'completed' | 'billed' | 'paid';

const statusMatches = (status: string, filter: FilterType): boolean => {
  switch (filter) {
    case 'all': return true;
    case 'active': return ['pending', 'in-progress', 'paused'].includes(status);
    case 'completed': return status === 'completed';
    case 'billed': return status === 'billed';
    case 'paid': return status === 'paid';
    default: return true;
  }
};

const statusColors: Record<string, string> = {
  'pending': 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/40',
  'in-progress': 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/40',
  'paused': 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/40',
  'completed': 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40',
  'billed': 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/40',
  'paid': 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40',
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

  useEffect(() => {
    setCloudPushEnabled(false);
    return () => { setCloudPushEnabled(true); };
  }, []);

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveToCloud = async () => {
    setSaving(true);
    try {
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

  const [desktopView, setDesktopView] = useState<'tree' | 'settings'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Expand all clients by default
  useEffect(() => {
    setExpandedClients(new Set(clients.map(c => c.id)));
  }, [clients.length]);

  // --- Handlers ---
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

  const handleDeleteClient = (id: string) => {
    const clientTasks = tasks.filter(t => t.clientId === id);
    if (clientTasks.some(t => ['pending', 'in-progress', 'paused'].includes(t.status))) {
      toast({ title: 'Cannot Delete Client', description: 'Client has active tasks.', variant: 'destructive' });
      return;
    }
    vehicles.filter(v => v.clientId === id).forEach(v => deleteVehicle(v.id));
    clientTasks.forEach(t => deleteTask(t.id));
    deleteClient(id);
    toast({ title: 'Client Deleted' });
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
    toast({ title: 'Vehicle Moved' });
  };

  // --- Helpers ---
  const getTaskCost = (task: Task) => {
    const client = clients.find(c => c.id === task.clientId);
    const rate = client?.hourlyRate || settings.defaultHourlyRate;
    const laborCost = (task.totalTime / 3600) * rate;
    const partsCost = (task.sessions || []).reduce((sum, s) =>
      sum + (s.parts || []).reduce((ps, p) => ps + (p.price * p.quantity), 0), 0
    );
    return laborCost + partsCost;
  };

  const getSessionDuration = (session: WorkSession) =>
    (session.periods || []).reduce((sum, p) => sum + (p.duration || 0), 0);

  // --- Filtered tree data ---
  const filteredTree = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return clients.map(client => {
      const clientVehicles = vehicles.filter(v => v.clientId === client.id).map(vehicle => {
        const vehicleTasks = tasks
          .filter(t => t.vehicleId === vehicle.id && statusMatches(t.status, filter))
          .filter(t => {
            if (!q) return true;
            return client.name.toLowerCase().includes(q) ||
              vehicle.vin?.toLowerCase().includes(q) ||
              vehicle.make?.toLowerCase().includes(q) ||
              vehicle.model?.toLowerCase().includes(q);
          });
        return { vehicle, tasks: vehicleTasks };
      }).filter(v => filter === 'all' ? true : v.tasks.length > 0);
      return { client, vehicles: clientVehicles };
    }).filter(c => {
      if (q && !c.client.name.toLowerCase().includes(q) && c.vehicles.length === 0) return false;
      if (filter !== 'all' && c.vehicles.length === 0) return false;
      return true;
    });
  }, [clients, vehicles, tasks, filter, searchQuery]);

  // --- Stats ---
  const allFilteredTasks = filteredTree.flatMap(c => c.vehicles.flatMap(v => v.tasks));
  const totalRevenue = allFilteredTasks.reduce((sum, t) => sum + getTaskCost(t), 0);
  const countByStatus = {
    all: tasks.length,
    active: tasks.filter(t => statusMatches(t.status, 'active')).length,
    completed: tasks.filter(t => t.status === 'completed').length,
    billed: tasks.filter(t => t.status === 'billed').length,
    paid: tasks.filter(t => t.status === 'paid').length,
  };

  // --- Revenue chart data (for paid filter) ---
  const revenueChartData = useMemo(() => {
    const paidTasks = tasks.filter(t => t.status === 'paid');
    const monthMap: Record<string, { revenue: number; cars: number }> = {};
    paidTasks.forEach(t => {
      const date = new Date(t.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { revenue: 0, cars: 0 };
      monthMap[key].revenue += getTaskCost(t);
      monthMap[key].cars += 1;
    });
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));
  }, [tasks, clients, settings.defaultHourlyRate]);

  const toggleClient = (id: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleVehicle = (id: string) => {
    setExpandedVehicles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 shadow-lg shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-foreground">ChipTime Desktop</h1>
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/60" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search clients, vehicles, VINs..."
                className="pl-9 h-9 w-80 bg-primary-foreground/15 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-primary-foreground/30"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleReloadFromCloud} disabled={syncing}
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              <Download className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              Reload
            </Button>
            <Button size="sm" onClick={handleSaveToCloud} disabled={saving}
              className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border border-primary-foreground/30">
              <Upload className={`h-4 w-4 mr-1 ${saving ? 'animate-pulse' : ''}`} />
              Save
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDesktopView(desktopView === 'settings' ? 'tree' : 'settings')}
              className={`h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10 ${desktopView === 'settings' ? 'bg-primary-foreground/20' : ''}`}>
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="px-6 py-2 border-b bg-card shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {(['all', 'active', 'completed', 'billed', 'paid'] as FilterType[]).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f} ({countByStatus[f]})
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{filteredTree.length}</strong> clients</span>
          <span><strong className="text-foreground">{filteredTree.reduce((s, c) => s + c.vehicles.length, 0)}</strong> vehicles</span>
          <span><strong className="text-foreground">{formatCurrency(totalRevenue)}</strong> total</span>
        </div>
      </div>

      {/* Main content */}
      {desktopView === 'settings' ? (
        <div className="flex-1 overflow-y-auto">
          <DesktopSettingsView settings={settings} onSave={setSettings} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredTree.length === 0 && (
            <div className="text-center py-20 text-muted-foreground text-lg">
              No {filter === 'all' ? 'clients' : `${filter} tasks`} found.
            </div>
          )}

          {/* Client tree */}
          {filteredTree.map(({ client, vehicles: clientVehicles }) => {
            const clientColor = getVehicleColorScheme(client.id);
            const isExpanded = expandedClients.has(client.id);
            const rate = client.hourlyRate || settings.defaultHourlyRate;

            return (
              <div key={client.id} className={`rounded-xl border-2 overflow-hidden ${clientColor.border}`}>
                {/* Client header */}
                <div
                  className={`${clientColor.gradient} px-5 py-3 cursor-pointer flex items-center justify-between`}
                  onClick={() => toggleClient(client.id)}
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    <h2 className="text-lg font-bold">{client.name}</h2>
                    {client.email && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" /> {client.email}
                      </span>
                    )}
                    {client.phone && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /> {client.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5" /> {formatCurrency(rate)}/hr
                    </span>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Badge variant="secondary" className="text-xs">{clientVehicles.length} vehicles</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteClient(client.id)} title="Delete Client">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Client body — vehicles */}
                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {clientVehicles.length === 0 && (
                      <div className="text-sm text-muted-foreground py-4 text-center">No vehicles{filter !== 'all' ? ` with ${filter} tasks` : ''}.</div>
                    )}
                    {clientVehicles.map(({ vehicle, tasks: vehicleTasks }) => {
                      const vColor = getVehicleColorScheme(vehicle.id);
                      const isVExpanded = expandedVehicles.has(vehicle.id);
                      const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Unknown Vehicle';

                      return (
                        <div key={vehicle.id} className={`rounded-lg border-2 overflow-hidden ${vColor.border}`}>
                          {/* Vehicle header */}
                          <div
                            className={`${vColor.card} px-4 py-2.5 cursor-pointer flex items-center justify-between`}
                            onClick={() => toggleVehicle(vehicle.id)}
                          >
                            <div className="flex items-center gap-3">
                              {isVExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <Car className="h-4 w-4" />
                              <span className="font-bold">{vehicleLabel}</span>
                              {vehicle.vin && (
                                <span className="text-xs font-mono text-muted-foreground">VIN: {vehicle.vin}</span>
                              )}
                              {vehicle.color && (
                                <Badge variant="outline" className="text-xs">{vehicle.color}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <Badge variant="secondary" className="text-xs">{vehicleTasks.length} tasks</Badge>
                              {/* Move vehicle dropdown — simple select */}
                              {clients.length > 1 && (
                                <select
                                  className="h-7 text-xs border rounded px-1 bg-background"
                                  value=""
                                  onChange={e => { if (e.target.value) handleMoveVehicle(vehicle.id, e.target.value); }}
                                  title="Move to client"
                                >
                                  <option value="">Move…</option>
                                  {clients.filter(c => c.id !== client.id).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteVehicle(vehicle.id)} title="Delete Vehicle">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          {/* Vehicle body — tasks/sessions */}
                          {isVExpanded && (
                            <div className="p-3 space-y-2">
                              {vehicleTasks.length === 0 && (
                                <div className="text-sm text-muted-foreground py-3 text-center">No tasks.</div>
                              )}
                              {vehicleTasks.map((task, tIdx) => {
                                const sessionColor = getSessionColorScheme(task.id);
                                const cost = getTaskCost(task);
                                const photoCount = (task.sessions || []).reduce((s, ses) => s + (ses.photos?.length || 0), 0);

                                return (
                                  <div key={task.id} className={`rounded-lg border p-4 ${sessionColor.session}`}>
                                    {/* Task header row */}
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-3">
                                        <span className="font-bold text-sm">Task {tIdx + 1}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : ''}
                                        </span>
                                        <Badge className={`text-xs border ${statusColors[task.status] || ''}`}>{task.status}</Badge>
                                        <span className="font-mono text-sm font-semibold">{formatDuration(task.totalTime)}</span>
                                        <span className="font-bold text-sm">{formatCurrency(cost)}</span>
                                        {photoCount > 0 && (
                                          <span className="text-xs text-muted-foreground">📷 {photoCount}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
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
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(task.id)} title="Delete">
                                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Sessions inline */}
                                    {(task.sessions || []).map((session, sIdx) => {
                                      const sDur = getSessionDuration(session);
                                      return (
                                        <div key={session.id} className={`rounded-md border px-3 py-2 mt-2 ${sessionColor.period}`}>
                                          <div className="flex items-center gap-3 text-sm">
                                            <span className="font-semibold">Session {sIdx + 1}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : ''}
                                            </span>
                                            <span className="font-mono text-xs">{formatDuration(sDur)}</span>
                                          </div>
                                          {/* Periods inline */}
                                          {(session.periods || []).length > 0 && (
                                            <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                              {session.periods.map((p, pIdx) => (
                                                <span key={p.id || pIdx}>
                                                  {formatTime(p.startTime)}→{formatTime(p.endTime)} ({formatDuration(p.duration)})
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          {/* Parts inline */}
                                          {(session.parts || []).length > 0 && (
                                            <div className={`flex flex-wrap gap-2 mt-2`}>
                                              {session.parts.map((part, pi) => (
                                                <span key={pi} className={`text-xs px-2 py-0.5 rounded border ${sessionColor.part}`}>
                                                  {part.name} ×{part.quantity} = {formatCurrency(part.price * part.quantity)}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          {/* Photos */}
                                          {(session.photos || []).length > 0 && (
                                            <div className="flex gap-2 mt-2">
                                              {session.photos!.filter(p => p.cloudUrl).map(photo => (
                                                <a key={photo.id} href={photo.cloudUrl} target="_blank" rel="noopener noreferrer">
                                                  <img src={photo.cloudUrl} alt="Photo" className="h-12 w-12 rounded object-cover border-2 border-border hover:ring-2 hover:ring-primary" />
                                                </a>
                                              ))}
                                              {session.photos!.filter(p => !p.cloudUrl).length > 0 && (
                                                <div className="h-12 px-2 rounded border border-dashed flex items-center gap-1 text-xs text-muted-foreground">
                                                  <ImageOff className="h-3 w-3" />
                                                  {session.photos!.filter(p => !p.cloudUrl).length} device only
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Revenue Charts — shown on paid filter */}
          {filter === 'paid' && revenueChartData.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="rounded-xl border-2 p-4 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-300 dark:border-emerald-700">
                <h3 className="font-bold mb-3">Monthly Revenue</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border-2 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-300 dark:border-blue-700">
                <h3 className="font-bold mb-3">Cars by Month</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="cars" fill="hsl(var(--chart-2, 220 70% 50%))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Task Dialog */}
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
