import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Settings, Task, Client, Vehicle } from '@/types';
import { ChevronLeft, ChevronRight, Download, Upload, Cloud } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { indexedDB } from '@/lib/indexedDB';
import { exportToXML, downloadXML, parseXMLFile, validateXMLData } from '@/lib/xmlConverter';
import { useNotifications } from '@/hooks/useNotifications';
import { Switch } from '@/components/ui/switch';
import { ManageClientsDialog } from './ManageClientsDialog';
import { getVehicleColorScheme } from '@/lib/vehicleColors';
import { BackupView } from './BackupView';
import { cn } from '@/lib/utils';

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
  onStartWork
}: SettingsDialogProps) => {
  const [currentView, setCurrentView] = useState<DialogView>('menu');
  const [hourlyRate, setHourlyRate] = useState(settings.defaultHourlyRate.toString());
  const [showManageClients, setShowManageClients] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useNotifications();

  useEffect(() => {
    setHourlyRate(settings.defaultHourlyRate.toString());
  }, [settings]);

  useEffect(() => {
    if (!open) {
      setCurrentView('menu');
    }
  }, [open]);

  const [googleApiKey, setGoogleApiKey] = useState(settings.googleApiKey || '');
  const [grokApiKey, setGrokApiKey] = useState(settings.grokApiKey || '');
  const [ocrSpaceApiKey, setOcrSpaceApiKey] = useState(settings.ocrSpaceApiKey || '');
  const [ocrProvider, setOcrProvider] = useState<'gemini' | 'grok' | 'ocrspace' | 'tesseract'>(settings.ocrProvider || 'gemini');
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled !== false);

  useEffect(() => {
    setGoogleApiKey(settings.googleApiKey || '');
    setGrokApiKey(settings.grokApiKey || '');
    setOcrSpaceApiKey(settings.ocrSpaceApiKey || '');
    setOcrProvider(settings.ocrProvider || 'gemini');
    setNotificationsEnabled(settings.notificationsEnabled !== false);
  }, [settings.googleApiKey, settings.grokApiKey, settings.ocrSpaceApiKey, settings.ocrProvider, settings.notificationsEnabled]);

  const handleSaveSettings = () => {
    onSave({
      defaultHourlyRate: parseFloat(hourlyRate) || 75,
      googleApiKey: googleApiKey.trim() || undefined,
      grokApiKey: grokApiKey.trim() || undefined,
      ocrSpaceApiKey: ocrSpaceApiKey.trim() || undefined,
      ocrProvider,
      backup: settings.backup,
      notificationsEnabled,
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
    const client = clients.find(c => c.id === clientId);
    const hourlyRate = client?.hourlyRate || settings.defaultHourlyRate;
    
    return clientTasks.reduce((total, task) => {
      // Labor cost
      const laborCost = task.totalTime / 3600 * hourlyRate;
      
      // Parts cost
      const partsCost = (task.sessions || []).reduce((sessionTotal, session) => {
        return sessionTotal + (session.parts || []).reduce((sum, part) => 
          sum + part.price * part.quantity, 0
        );
      }, 0);
      
      return total + laborCost + partsCost;
    }, 0);
  };

  const billedTasksByClient = groupTasksByClient(billedTasks);
  const paidTasksByClient = groupTasksByClient(paidTasks);

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

              <div className="space-y-2">
                <Label>OCR Provider (for VIN Scanning)</Label>
                <RadioGroup value={ocrProvider} onValueChange={(value) => setOcrProvider(value as 'gemini' | 'grok' | 'ocrspace' | 'tesseract')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="tesseract" id="tesseract" />
                    <Label htmlFor="tesseract" className="font-normal cursor-pointer">Tesseract.js (Free - Offline)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="gemini" id="gemini" />
                    <Label htmlFor="gemini" className="font-normal cursor-pointer">Google Gemini</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="grok" id="grok" />
                    <Label htmlFor="grok" className="font-normal cursor-pointer">Grok AI</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ocrspace" id="ocrspace" />
                    <Label htmlFor="ocrspace" className="font-normal cursor-pointer">OCR Space</Label>
                  </div>
                </RadioGroup>
              </div>

              {ocrProvider === 'tesseract' && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    ✓ Tesseract.js runs entirely in your browser — no API key needed!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    First scan may take a few seconds to download the language model (~4MB, cached afterward).
                  </p>
                </div>
              )}

              {ocrProvider === 'gemini' && (
                <div className="space-y-2">
                  <Label>Google AI API Key</Label>
                  <Input
                    type="password"
                    value={googleApiKey}
                    onChange={(e) => setGoogleApiKey(e.target.value)}
                    placeholder="Enter API key from aistudio.google.com/apikey"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Get your key from{' '}
                    <a 
                      href="https://aistudio.google.com/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline text-primary"
                    >
                      Google AI Studio
                    </a>
                    . Restrict by HTTP referrer for security.
                  </p>
                </div>
              )}

              {ocrProvider === 'grok' && (
                <div className="space-y-2">
                  <Label>Grok API Key</Label>
                  <Input
                    type="password"
                    value={grokApiKey}
                    onChange={(e) => setGrokApiKey(e.target.value)}
                    placeholder="Enter API key from console.x.ai"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Get your key from{' '}
                    <a 
                      href="https://console.x.ai" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline text-primary"
                    >
                      xAI Console
                    </a>
                    . Enables Grok-powered VIN scanning.
                  </p>
                </div>
              )}

              {ocrProvider === 'ocrspace' && (
                <div className="space-y-2">
                  <Label>OCR Space API Key</Label>
                  <Input
                    type="password"
                    value={ocrSpaceApiKey}
                    onChange={(e) => setOcrSpaceApiKey(e.target.value)}
                    placeholder="Enter API key from ocr.space"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Get your free key from{' '}
                    <a 
                      href="https://ocr.space/ocrapi" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline text-primary"
                    >
                      OCR Space API
                    </a>
                    . 25,000 requests/month on free tier.
                  </p>
                </div>
              )}

              {(ocrProvider === 'gemini' || ocrProvider === 'grok' || ocrProvider === 'ocrspace') && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                    ⚠️ Security Notice
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    API keys are stored locally on your device. To protect your keys:
                  </p>
                  <ul className="text-xs text-amber-600 dark:text-amber-400 mt-1 list-disc list-inside space-y-0.5">
                    <li>Restrict keys by HTTP referrer/domain in provider settings</li>
                    <li>Use keys with limited quotas or spending limits</li>
                    <li>Avoid installing untrusted browser extensions</li>
                    <li>Consider using Tesseract.js for fully offline scanning</li>
                  </ul>
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
                Object.entries(billedTasksByClient).map(([clientId, clientTasks]) => {
                  const client = clients.find(c => c.id === clientId);
                  const clientTotal = calculateClientTotalCost(clientTasks, clientId);
                  
                  return (
                    <div key={clientId} className="rounded-xl border-2 overflow-hidden bg-muted/30 border-border/50 shadow-md">
                      <div className="flex items-center justify-between p-3 border-b-2 border-border/30 bg-background/10">
                        <h2 className="text-lg font-semibold text-foreground">
                          {client?.name || 'Unknown Client'}
                        </h2>
                        <Badge variant="secondary" className="text-sm font-bold bg-background/50 text-foreground border-border/30">
                          ${clientTotal.toFixed(2)}
                        </Badge>
                      </div>
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
                    </div>
                  );
                })
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
                Object.entries(paidTasksByClient).map(([clientId, clientTasks]) => {
                  const client = clients.find(c => c.id === clientId);
                  const clientTotal = calculateClientTotalCost(clientTasks, clientId);
                  
                  return (
                    <div key={clientId} className="rounded-xl border-2 overflow-hidden bg-muted/30 border-border/50 shadow-md">
                      <div className="flex items-center justify-between p-3 border-b-2 border-border/30 bg-background/10">
                        <h2 className="text-lg font-semibold text-foreground">
                          {client?.name || 'Unknown Client'}
                        </h2>
                        <Badge variant="secondary" className="text-sm font-bold bg-background/50 text-foreground border-border/30">
                          ${clientTotal.toFixed(2)}
                        </Badge>
                      </div>
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
                    </div>
                  );
                })
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
      />
    </Dialog>
  );
};
