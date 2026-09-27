import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Settings, Task, Client, Vehicle, PaymentMethod } from '@/types';
import { ChevronLeft, ChevronRight, Download, Upload, Cloud, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { indexedDB } from '@/lib/indexedDB';
import { exportToXML, downloadXML, parseXMLFile, validateXMLData } from '@/lib/xmlConverter';
import { useNotifications } from '@/hooks/useNotifications';
import { Switch } from '@/components/ui/switch';
import { ManageClientsDialog } from './ManageClientsDialog';
import { computeTaskTotal } from '@/lib/billing';
import { getVehicleColorScheme } from '@/lib/vehicleColors';
import { BackupView } from './BackupView';
import { cn } from '@/lib/utils';
import { WorkspaceManager } from './WorkspaceManager';
import { CameraSettingsSection } from './CameraSettingsSection';
import { Users } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  tasks: Task[];
  clients: Client[];
  vehicles: Vehicle[];
  onMarkBilled: (taskId: string) => void;
  onMarkPaid: (taskId: string) => void;
  onRestartTimer: (taskId: string) => void;
  onUpdateTask: (updatedTask: Task) => void;
  onDelete: (taskId: string) => void;
  onUpdateClient: (id: string, updates: Partial<Client>) => void;
  onDeleteClient: (id: string) => void;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  onDeleteVehicle: (id: string) => void;
  onStartWork: (vehicleId: string) => void;
  onMoveVehicle?: (vehicleId: string, newClientId: string) => void;
}

type DialogView = 'menu' | 'settings' | 'billed' | 'paid' | 'backup';

export const SettingsDialog = ({ 
  open, 
  onOpenChange, 
  settings, 
  onSave, 
  tasks, 
  clients, 
  vehicles,
  onMarkBilled,
  onMarkPaid,
  onRestartTimer,
  onUpdateTask,
  onDelete,
  onUpdateClient,
  onDeleteClient,
  onUpdateVehicle,
  onDeleteVehicle,
  onStartWork,
  onMoveVehicle,
}: SettingsDialogProps) => {
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [currentView, setCurrentView] = useState<DialogView>('menu');
  const [hourlyRate, setHourlyRate] = useState(settings.defaultHourlyRate.toString());
  const [cloningRate, setCloningRate] = useState(settings.defaultCloningRate?.toString() || '');
  const [programmingRate, setProgrammingRate] = useState(settings.defaultProgrammingRate?.toString() || '');
  const [addKeyRate, setAddKeyRate] = useState(settings.defaultAddKeyRate?.toString() || '');
  const [allKeysLostRate, setAllKeysLostRate] = useState(settings.defaultAllKeysLostRate?.toString() || '');
  const [showManageClients, setShowManageClients] = useState(false);
  const [collapsedBilledClients, setCollapsedBilledClients] = useState<Set<string>>(new Set());
  const [collapsedPaidClients, setCollapsedPaidClients] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useNotifications();

  useEffect(() => {
    setHourlyRate(settings.defaultHourlyRate.toString());
    setCloningRate(settings.defaultCloningRate?.toString() || '');
    setProgrammingRate(settings.defaultProgrammingRate?.toString() || '');
    setAddKeyRate(settings.defaultAddKeyRate?.toString() || '');
    setAllKeysLostRate(settings.defaultAllKeysLostRate?.toString() || '');
  }, [settings]);

  useEffect(() => {
    if (!open) {
      setCurrentView('menu');
    }
  }, [open]);

  const [ocrProvider, setOcrProvider] = useState<'claude' | 'tesseract'>(settings.ocrProvider || 'claude');
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled !== false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    settings.paymentMethods || (settings.paymentLink ? [{ label: settings.paymentLabel || 'Pay', url: settings.paymentLink }] : [])
  );

  useEffect(() => {
    setOcrProvider(settings.ocrProvider || 'claude');
    setNotificationsEnabled(settings.notificationsEnabled !== false);
    setPaymentMethods(
      settings.paymentMethods || (settings.paymentLink ? [{ label: settings.paymentLabel || 'Pay', url: settings.paymentLink }] : [])
    );
  }, [settings.ocrProvider, settings.notificationsEnabled, settings.paymentMethods, settings.paymentLink, settings.paymentLabel]);


  const handleSaveSettings = () => {
    onSave({
      defaultHourlyRate: parseFloat(hourlyRate) || 75,
      defaultCloningRate: cloningRate ? parseFloat(cloningRate) : undefined,
      defaultProgrammingRate: programmingRate ? parseFloat(programmingRate) : undefined,
      defaultAddKeyRate: addKeyRate ? parseFloat(addKeyRate) : undefined,
      defaultAllKeysLostRate: allKeysLostRate ? parseFloat(allKeysLostRate) : undefined,
      googleApiKey: settings.googleApiKey,
      ocrProvider,

      backup: settings.backup,
      notificationsEnabled,
      paymentMethods: paymentMethods.filter(m => m.label.trim() && m.url.trim()),
    });
    setCurrentView('menu');
  };

  const handleExportData = async () => {
    try {
      const allData = await indexedDB.exportAllData();
      const xmlString = exportToXML(allData);
      const filename = `autotime-backup-${new Date().toISOString().split('T')[0]}.xml`;
      downloadXML(xmlString, filename);
      toast({ 
        title: 'Data Exported', 
        description: 'Backup file downloaded successfully',
      });
    } catch (error) {
      toast({ 
        title: 'Export Failed', 
        description: 'Could not export data', 
        variant: 'destructive',
      });
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const data = await parseXMLFile(file);
      if (!validateXMLData(data)) {
        throw new Error('Invalid XML format');
      }
      
      // Show confirmation dialog
      if (confirm('This will replace all existing data. Continue?')) {
        await indexedDB.importAllData(data);
        toast({ 
          title: 'Data Imported', 
          description: 'Successfully restored from backup. Reloading...',
        });
        // Reload to show imported data
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      toast({ 
        title: 'Import Failed', 
        description: 'Invalid or corrupted file', 
        variant: 'destructive',
      });
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const billedTasks = tasks.filter(t => t.status === 'billed');
  const paidTasks = tasks.filter(t => t.status === 'paid');

  // Group tasks by client
  const groupTasksByClient = (taskList: Task[]) => {
    return taskList.reduce((acc, task) => {
      if (!acc[task.clientId]) {
        acc[task.clientId] = [];
      }
      acc[task.clientId].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
  };

  const calculateClientTotalCost = (clientTasks: Task[], clientId: string) => {
    const client = clients.find(c => c.id === clientId) || null;
    return clientTasks.reduce(
      (total, task) => total + computeTaskTotal(task, client, settings).total,
      0,
    );
  };

  const billedTasksByClient = groupTasksByClient(billedTasks);
  const paidTasksByClient = groupTasksByClient(paidTasks);

  // Default: collapse all client groups when entering the view
  useEffect(() => {
    if (currentView === 'billed') {
      setCollapsedBilledClients(new Set(Object.keys(billedTasksByClient)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);
  useEffect(() => {
    if (currentView === 'paid') {
      setCollapsedPaidClients(new Set(Object.keys(paidTasksByClient)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const toggleClientCollapse = (which: 'billed' | 'paid', clientId: string) => {
    const setter = which === 'billed' ? setCollapsedBilledClients : setCollapsedPaidClients;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId); else next.add(clientId);
      return next;
    });
  };
  const toggleAllCollapse = (which: 'billed' | 'paid') => {
    const map = which === 'billed' ? billedTasksByClient : paidTasksByClient;
    const current = which === 'billed' ? collapsedBilledClients : collapsedPaidClients;
    const setter = which === 'billed' ? setCollapsedBilledClients : setCollapsedPaidClients;
    const allKeys = Object.keys(map);
    const allCollapsed = allKeys.every(k => current.has(k));
    setter(allCollapsed ? new Set() : new Set(allKeys));
  };

  const getDialogTitle = () => {
    switch (currentView) {
      case 'menu':
        return 'Menu';
      case 'settings':
        return 'Settings';
      case 'billed':
        return `Billed Tasks (${billedTasks.length})`;
      case 'paid':
        return `Paid Tasks (${paidTasks.length})`;
      case 'backup':
        return 'Backup & Restore';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full m-0 p-0 rounded-none flex flex-col">
        <header className={cn(
          "border-b backdrop-blur-sm shadow-sm transition-colors",
          currentView === 'menu' && "bg-primary/10",
          currentView === 'settings' && "bg-primary/10",
          currentView === 'billed' && "bg-blue-500/10",
          currentView === 'paid' && "bg-green-500/10",
          currentView === 'backup' && "bg-orange-500/10"
        )}>
          <div className="px-4 py-3 flex items-center gap-2">
            {currentView !== 'menu' && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Back to settings menu"
                onClick={() => setCurrentView('menu')}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-lg font-bold text-primary">{getDialogTitle()}</DialogTitle>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {currentView === 'menu' && (
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-4 bg-primary/20 hover:bg-primary/30 border-primary/30 font-semibold"
                onClick={() => setCurrentView('settings')}
              >
                <span>Settings</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-4 bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 font-semibold"
                onClick={() => setCurrentView('billed')}
              >
                <span>View Billed Tasks</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">({billedTasks.length})</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-4 bg-green-500/20 hover:bg-green-500/30 border-green-500/30 font-semibold"
                onClick={() => setCurrentView('paid')}
              >
                <span>View Paid Tasks</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">({paidTasks.length})</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-4 bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/30 font-semibold"
                onClick={() => setShowManageClients(true)}
              >
                <span>Manage Clients</span>
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2 px-1">Data Management</p>
                <Button
                  variant="outline"
                  className="w-full justify-between h-auto py-4 bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30 font-semibold"
                  onClick={() => setCurrentView('backup')}
                >
                  <span>Backup & Restore</span>
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between h-auto py-4 bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 font-semibold mt-2"
                  onClick={() => setShowWorkspace(true)}
                >
                  <span>Workspace & Account</span>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Button>
              </div>
            </div>
          )}

          {currentView === 'settings' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Default Hourly Rate ($)</Label>
                <Input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  min={0}
                  step={0.01}
                />
                <p className="text-xs text-muted-foreground">
                  This rate will be used unless a custom rate is set for a specific client
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default Cloning Rate ($)</Label>
                <Input
                  type="number"
                  value={cloningRate}
                  onChange={(e) => setCloningRate(e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder="Leave empty if not used"
                />
                <p className="text-xs text-muted-foreground">
                  This rate is added per session when marked as "Cloning"
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default Programming Rate ($)</Label>
                <Input
                  type="number"
                  value={programmingRate}
                  onChange={(e) => setProgrammingRate(e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder="Leave empty if not used"
                />
                <p className="text-xs text-muted-foreground">
                  This rate is added per session when marked as "Programming"
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default Add Key Rate ($)</Label>
                <Input
                  type="number"
                  value={addKeyRate}
                  onChange={(e) => setAddKeyRate(e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder="Leave empty if not used"
                />
                <p className="text-xs text-muted-foreground">
                  This rate is added per session when marked as "Add Key"
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default All Keys Lost Rate ($)</Label>
                <Input
                  type="number"
                  value={allKeysLostRate}
                  onChange={(e) => setAllKeysLostRate(e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder="Leave empty if not used"
                />
                <p className="text-xs text-muted-foreground">
                  This rate is added per session when marked as "All Keys Lost"
                </p>
              </div>

              <CameraSettingsSection />



              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label>Show Popup Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    When disabled, confirmation and status messages won't appear
                  </p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label className="text-base font-bold">Client Payment Methods</Label>
                {paymentMethods.map((method, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={method.label}
                        onChange={(e) => {
                          const updated = [...paymentMethods];
                          updated[idx] = { ...updated[idx], label: e.target.value };
                          setPaymentMethods(updated);
                        }}
                        placeholder="e.g. Zelle"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">URL</Label>
                      <Input
                        value={method.url}
                        onChange={(e) => {
                          const updated = [...paymentMethods];
                          updated[idx] = { ...updated[idx], url: e.target.value };
                          setPaymentMethods(updated);
                        }}
                        placeholder="https://..."
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove payment method"
                      className="h-10 w-10 text-destructive"
                      onClick={() => setPaymentMethods(paymentMethods.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentMethods([...paymentMethods, { label: '', url: '' }])}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Payment Method
                </Button>
                <p className="text-xs text-muted-foreground">
                  These appear as "Pay Now" buttons in the client portal
                </p>
              </div>

              <div className="space-y-2">
                <Label>VIN Scanning</Label>
                <RadioGroup value={ocrProvider} onValueChange={(value) => setOcrProvider(value as 'claude' | 'tesseract')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="claude" id="claude" />
                    <Label htmlFor="claude" className="font-normal cursor-pointer">Smart reader (online, recommended)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="tesseract" id="tesseract" />
                    <Label htmlFor="tesseract" className="font-normal cursor-pointer">Offline reader (works with no signal)</Label>
                  </div>
                </RadioGroup>
              </div>

              {ocrProvider === 'claude' && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    ✓ Nothing to set up — reading happens through the app, no key needed.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Needs an internet connection. Switch to the offline reader when you have no signal.
                  </p>
                </div>
              )}

              {ocrProvider === 'tesseract' && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    ✓ Runs entirely on this device — works with no signal.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    First scan takes a few seconds to download the language pack (~4MB, kept afterwards). Less accurate than the smart reader.
                  </p>
                </div>
              )}

            </div>
          )}

          {currentView === 'billed' && (
            <div className="space-y-4">
              {Object.keys(billedTasksByClient).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No billed tasks yet.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground font-medium">
                      {Object.keys(billedTasksByClient).length} client{Object.keys(billedTasksByClient).length !== 1 ? 's' : ''} · {billedTasks.length} task{billedTasks.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => toggleAllCollapse('billed')}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors font-medium"
                    >
                      {Object.keys(billedTasksByClient).every(k => collapsedBilledClients.has(k)) ? 'Expand all ↓' : 'Collapse all ↑'}
                    </button>
                  </div>
                  {Object.entries(billedTasksByClient).map(([clientId, clientTasks]) => {
                    const client = clients.find(c => c.id === clientId);
                    const clientTotal = calculateClientTotalCost(clientTasks, clientId);
                    const isCollapsed = collapsedBilledClients.has(clientId);
                    return (
                      <div key={clientId} className="rounded-xl border-2 overflow-hidden bg-muted/30 border-border/50 shadow-md">
                        <button
                          type="button"
                          onClick={() => toggleClientCollapse('billed', clientId)}
                          className="w-full flex items-center justify-between p-3 border-b-2 border-border/30 bg-background/10 hover:bg-background/30 transition-colors text-left"
                        >
                          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            {client?.name || 'Unknown Client'}
                            <span className="text-xs font-normal text-muted-foreground">({clientTasks.length})</span>
                          </h2>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-sm font-bold bg-background/50 text-foreground border-border/30">
                              ${clientTotal.toFixed(2)}
                            </Badge>
                            {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </button>
                        {!isCollapsed && (
                          <div className="p-2 space-y-2">
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
                                  onMarkBilled={onMarkBilled}
                                  onMarkPaid={onMarkPaid}
                                  onRestartTimer={onRestartTimer}
                                  onUpdateTask={onUpdateTask}
                                  onDelete={onDelete}
                                  vehicleColorScheme={colorScheme}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {currentView === 'paid' && (
            <div className="space-y-4">
              {Object.keys(paidTasksByClient).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No paid tasks yet.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground font-medium">
                      {Object.keys(paidTasksByClient).length} client{Object.keys(paidTasksByClient).length !== 1 ? 's' : ''} · {paidTasks.length} task{paidTasks.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => toggleAllCollapse('paid')}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors font-medium"
                    >
                      {Object.keys(paidTasksByClient).every(k => collapsedPaidClients.has(k)) ? 'Expand all ↓' : 'Collapse all ↑'}
                    </button>
                  </div>
                  {Object.entries(paidTasksByClient).map(([clientId, clientTasks]) => {
                    const client = clients.find(c => c.id === clientId);
                    const clientTotal = calculateClientTotalCost(clientTasks, clientId);
                    const isCollapsed = collapsedPaidClients.has(clientId);
                    return (
                      <div key={clientId} className="rounded-xl border-2 overflow-hidden bg-muted/30 border-border/50 shadow-md">
                        <button
                          type="button"
                          onClick={() => toggleClientCollapse('paid', clientId)}
                          className="w-full flex items-center justify-between p-3 border-b-2 border-border/30 bg-background/10 hover:bg-background/30 transition-colors text-left"
                        >
                          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            {client?.name || 'Unknown Client'}
                            <span className="text-xs font-normal text-muted-foreground">({clientTasks.length})</span>
                          </h2>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-sm font-bold bg-background/50 text-foreground border-border/30">
                              ${clientTotal.toFixed(2)}
                            </Badge>
                            {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </button>
                        {!isCollapsed && (
                          <div className="p-2 space-y-2">
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
                                  onMarkBilled={onMarkBilled}
                                  onMarkPaid={onMarkPaid}
                                  onRestartTimer={onRestartTimer}
                                  onUpdateTask={onUpdateTask}
                                  onDelete={onDelete}
                                  vehicleColorScheme={colorScheme}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {currentView === 'backup' && (
            <BackupView onBack={() => setCurrentView('menu')} />
          )}
        </div>

        {currentView === 'settings' && (
          <DialogFooter className="px-4 py-3 border-t bg-card/80 backdrop-blur-sm">
            <Button variant="outline" onClick={() => setCurrentView('menu')}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>
              Save Settings
            </Button>
          </DialogFooter>
        )}
      </DialogContent>

      <ManageClientsDialog
        open={showManageClients}
        onOpenChange={setShowManageClients}
        clients={clients}
        vehicles={vehicles}
        tasks={tasks}
        settings={settings}
        onUpdateClient={onUpdateClient}
        onDeleteClient={onDeleteClient}
        onUpdateVehicle={onUpdateVehicle}
        onDeleteVehicle={onDeleteVehicle}
        onStartWork={onStartWork}
        onMoveVehicle={onMoveVehicle}
      />
      <WorkspaceManager open={showWorkspace} onOpenChange={setShowWorkspace} />
    </Dialog>
  );
};
