import { useState, useMemo, useEffect } from 'react';
import { Settings as SettingsIcon, Search, Upload, Download, Pencil, Trash2, Receipt, DollarSign, ChevronDown, ChevronRight, ImageOff, Car, Mail, Phone, CreditCard, ArrowRightLeft, TrendingUp, Plus, FileText, ExternalLink, Save, X, UserPlus, ArrowUp, ArrowDown, BarChart3, Printer, KeyRound, Link2, Eye, Users, FileUp } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TaskInlineEditor } from '@/components/TaskInlineEditor';
import { ImportedBadge } from '@/components/ImportedBadge';
import { DesktopSettingsView } from '@/components/DesktopSettingsView';
import { DesktopReportsView } from '@/components/DesktopReportsView';
import { DesktopInvoiceView } from '@/components/DesktopInvoiceView';
import { DesktopClientsView } from '@/components/DesktopClientsView';
import { AddClientDialog } from '@/components/AddClientDialog';
import { AddClientPage } from '@/components/AddClientPage';
import { AddVehiclePage } from '@/components/AddVehiclePage';
import { AddVehicleDialog } from '@/components/AddVehicleDialog';

import { useClients, useVehicles, useTasks, useSettings, useCloudSync, setCloudPushEnabled, pushNow } from '@/hooks/useStorage';
import { capacitorStorage } from '@/lib/capacitorStorage';
import { Task, Client, Vehicle, WorkSession } from '@/types';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDuration, formatCurrency, formatTime, calcPeriodCost } from '@/lib/formatTime';
import { applyLaborDiscount } from '@/lib/discount';
import { computeTaskTotal, computeVehicleTotal } from '@/lib/billing';
import { photoStorageService } from '@/services/photoStorageService';
import { syncPortalToCloud, generateAccessCode, calculateClientCosts, encodeClientData, generatePortalHtmlFile, PORTAL_BASE_URL } from '@/lib/clientPortalUtils';
import { parseWorkHistoryXls } from '@/lib/xlsImporter';
import { SyncData } from '@/services/appSyncService';
import { getVehicleColorScheme } from '@/lib/vehicleColors';
import { getSessionColorScheme } from '@/lib/sessionColors';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PhoneContact } from '@/services/contactsService';
import jsPDF from 'jspdf';
import { stripDiacritics, mergePdfs } from '@/lib/pdfUtils';
import { renderBillPdf } from '@/lib/billPdfRenderer';
import { supabase } from '@/integrations/supabase/client';
import { resolveDiagnosticPdfUrl } from '@/services/diagnosticPdfService';

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
  const { tasks, setTasks, addTask, updateTask, deleteTask } = tasksHook;
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

  // After a backup import, re-read all data from storage and update React state directly
  useEffect(() => {
    const handleImportComplete = async () => {
      const [freshClients, freshVehicles, freshTasks, freshSettings] = await Promise.all([
        capacitorStorage.getClients(),
        capacitorStorage.getVehicles(),
        capacitorStorage.getTasks(),
        capacitorStorage.getSettings(),
      ]);
      clientsHook.replaceAll(freshClients);
      vehiclesHook.replaceAll(freshVehicles);
      tasksHook.replaceAll(freshTasks);
      settingsHook.replaceAll(freshSettings);
    };
    window.addEventListener('chiptime:import-complete', handleImportComplete);
    return () => window.removeEventListener('chiptime:import-complete', handleImportComplete);
  }, [clientsHook, vehiclesHook, tasksHook, settingsHook]);

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

  const [desktopView, setDesktopView] = useState<'tree' | 'settings' | 'reports' | 'invoices' | 'clients' | 'addClient' | 'addVehicle'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Dialog state
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [addVehicleClientId, setAddVehicleClientId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Client>>({});
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleEditData, setVehicleEditData] = useState<{ vin: string; make: string; model: string; year: string; color: string; prepaidAmount: string; discountType: 'fixed' | 'percent'; discountValue: string }>({ vin: '', make: '', model: '', year: '', color: '', prepaidAmount: '', discountType: 'fixed', discountValue: '' });
  const [importingClientId, setImportingClientId] = useState<string | null>(null);
  // Delete confirmation dialogs
  const [deleteVehicleDialog, setDeleteVehicleDialog] = useState<{ open: boolean; vehicleId: string | null }>({ open: false, vehicleId: null });
  const [deleteTaskDialog, setDeleteTaskDialog] = useState<{ open: boolean; taskId: string | null }>({ open: false, taskId: null });
  const [chartClient, setChartClient] = useState<string>('all');
  const [drillMonth, setDrillMonth] = useState<string | null>(null);
  const [drillSortField, setDrillSortField] = useState<'date' | 'cost'>('date');
  const [drillSortDir, setDrillSortDir] = useState<'asc' | 'desc'>('desc');
  const [drillShowCompleted, setDrillShowCompleted] = useState(true);
  const [drillShowBilled, setDrillShowBilled] = useState(true);
  const [drillShowPaid, setDrillShowPaid] = useState(true);
  const [chartShowCompleted, setChartShowCompleted] = useState(true);
  const [chartShowBilled, setChartShowBilled] = useState(true);
  const [chartShowPaid, setChartShowPaid] = useState(true);
  const [photoSignedUrls, setPhotoSignedUrls] = useState<Record<string, string>>({});

  // Mint short-lived signed URLs for all cloud session photos so they can be
  // displayed from the private bucket. Refresh periodically (signed URLs expire).
  useEffect(() => {
    const paths = new Set<string>();
    for (const t of tasks) {
      for (const s of t.sessions || []) {
        for (const p of s.photos || []) {
          const path = p.cloudPath || photoStorageService.derivePathFromCloudUrl(p.cloudUrl);
          if (path) paths.add(path);
        }
      }
    }
    if (paths.size === 0) {
      setPhotoSignedUrls({});
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      const arr = Array.from(paths);
      const chunks: string[][] = [];
      for (let i = 0; i < arr.length; i += 200) chunks.push(arr.slice(i, i + 200));
      const merged: Record<string, string> = {};
      for (const c of chunks) {
        const map = await photoStorageService.signPhotoUrls(c);
        Object.assign(merged, map);
      }
      if (!cancelled) setPhotoSignedUrls(merged);
    };
    refresh();
    const id = setInterval(refresh, 50 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [tasks]);

  // --- XLS Import handler ---
  const handleImportXls = async (file: File, clientId: string) => {
    try {
      const sessions = await parseWorkHistoryXls(file);
      if (sessions.length === 0) {
        toast({ title: 'No data found', description: 'The file contained no valid work rows.', variant: 'destructive' });
        return;
      }

      const client = clients.find(c => c.id === clientId);
      const clientName = client?.name || 'Unknown';

      // Vehicle cache for deduplication by tag
      const vehicleCache = new Map<string, Vehicle>();
      const newVehicles: Vehicle[] = [];
      const newTasks: Task[] = [];

      for (const s of sessions) {
        const tag = s.tag || '';
        const vinSlug = tag ? `IMPORT-${tag.toUpperCase().replace(/\s+/g, '-')}` : 'IMPORT-UNKNOWN';

        // Find or create vehicle for this tag
        let vehicle = vehicleCache.get(vinSlug) || vehicles.find(v => v.clientId === clientId && v.vin === vinSlug);
        if (!vehicle) {
          vehicle = {
            id: crypto.randomUUID(),
            clientId,
            vin: vinSlug,
            make: tag || 'Unknown',
            model: '',
          };
          newVehicles.push(vehicle);
        }
        vehicleCache.set(vinSlug, vehicle);

        // One task per row with a single work session
        const workSession: WorkSession = {
          id: crypto.randomUUID(),
          createdAt: s.startTime,
          completedAt: s.endTime,
          description: s.description || undefined,
          periods: s.periods.map(p => ({
            id: crypto.randomUUID(),
            startTime: p.startTime,
            endTime: p.endTime,
            duration: p.duration,
          })),
          parts: [],
        };

        const task: Task = {
          id: crypto.randomUUID(),
          clientId,
          vehicleId: vehicle.id,
          customerName: clientName,
          carVin: vehicle.vin,
          status: s.paid ? 'paid' : 'completed',
          totalTime: s.relDurationSeconds,
          needsFollowUp: false,
          createdAt: s.date,
          importedSalary: s.relSalary,
          sessions: [workSession],
        };

        newTasks.push(task);
      }

      // Batch save all vehicles and tasks at once
      if (newVehicles.length > 0) {
        await vehiclesHook.setVehicles([...vehicles, ...newVehicles]);
      }
      await setTasks([...tasks, ...newTasks]);

      toast({ title: `Imported ${newTasks.length} tasks (${newVehicles.length} new vehicles)`, description: `Added to ${clientName}` });
    } catch (err: any) {
      console.error('XLS import failed:', err);
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setImportingClientId(null);
    }
  };

  // Expand all clients by default
  useEffect(() => {
    setExpandedClients(new Set(clients.map(c => c.id)));
  }, [clients.length]);

  // --- Client inline edit ---
  const startEditClient = (client: Client) => {
    setEditingClientId(client.id);
    setEditFormData({ name: client.name, email: client.email, phone: client.phone, hourlyRate: client.hourlyRate, cloningRate: client.cloningRate, programmingRate: client.programmingRate, addKeyRate: client.addKeyRate, allKeysLostRate: client.allKeysLostRate, prepaidAmount: client.prepaidAmount });
  };
  const saveEditClient = () => {
    if (!editingClientId || !editFormData.name?.trim()) return;
    updateClient(editingClientId, editFormData);
    setEditingClientId(null);
    toast({ title: 'Client Updated' });
  };
  const cancelEditClient = () => setEditingClientId(null);

  // --- Add vehicle for specific client ---
  const openAddVehicleForClient = (clientId: string) => {
    setAddVehicleClientId(clientId);
    setDesktopView('addVehicle');
  };

  // --- Bill PDF generation ---
  // Desktop bill PDF — thin wrapper around the shared renderer.
  // Same renderer the mobile TaskCard uses, so layout, photos, totals and
  // backgrounds stay in sync between platforms.
  const generateBillPdf = async (task: Task, client: Client, vehicle: Vehicle) => {
    try {
      const doc = await renderBillPdf({ task, client, vehicle, settings });
      const fileName = `invoice-${stripDiacritics(client.name)}-${vehicle.vin || 'vehicle'}.pdf`;

      // Merge diagnostic PDF if present.
      if (task.diagnosticPdfUrl || task.diagnosticPdfPath) {
        try {
          const freshUrl = await resolveDiagnosticPdfUrl({ path: task.diagnosticPdfPath, url: task.diagnosticPdfUrl });
          if (!freshUrl) throw new Error('Could not resolve diagnostic PDF URL');
          const billBlob = doc.output('blob');
          const mergedBlob = await mergePdfs(billBlob, freshUrl);
          const url = URL.createObjectURL(mergedBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: 'Bill PDF Generated', description: 'Includes diagnostic report' });
          return;
        } catch (mergeError) {
          console.warn('Failed to merge diagnostic PDF, saving without it:', mergeError);
        }
      }

      doc.save(fileName);
      toast({ title: 'Bill PDF Generated' });
    } catch (err) {
      console.error('Bill PDF generation error:', err);
      toast({ title: 'Bill Generation Failed', description: 'Could not create the bill PDF.', variant: 'destructive' });
    }
  };

  // --- Upload diagnostic PDF for a task ---
  const handleUploadDiagnosticPdf = async (taskId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        toast({ title: 'Uploading...', description: 'Uploading diagnostic PDF' });
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke('upload-diagnostic', {
          body: { base64, taskId, fileName: file.name },
        });

        if (error) throw error;
        updateTask(taskId, { diagnosticPdfUrl: data.url, diagnosticPdfPath: data.path });
        toast({ title: 'Uploaded', description: 'Diagnostic PDF attached to this task' });
      } catch (err) {
        console.error('Upload diagnostic error:', err);
        toast({ title: 'Upload Failed', description: 'Could not upload diagnostic PDF', variant: 'destructive' });
      }
    };
    input.click();
  };

  const handleGenerateBillAndMarkBilled = (task: Task) => {
    const client = clients.find(c => c.id === task.clientId);
    const vehicle = vehicles.find(v => v.id === task.vehicleId);
    if (client && vehicle) {
      generateBillPdf(task, client, vehicle);
      handleMarkBilled(task.id);
    }
  };

  const handlePreviewBill = (task: Task) => {
    const client = clients.find(c => c.id === task.clientId);
    const vehicle = vehicles.find(v => v.id === task.vehicleId);
    if (client && vehicle) generateBillPdf(task, client, vehicle);
  };

  const handleAddVehicleSave = (vehicleData: Omit<Vehicle, 'id'>, clientName?: string, phoneContact?: PhoneContact) => {
    let finalClientId = vehicleData.clientId;
    if (finalClientId === 'pending' && clientName) {
      const newClient: Omit<Client, 'id' | 'createdAt'> = {
        name: clientName,
        email: phoneContact?.emails?.[0] as string | undefined,
        phone: phoneContact?.phoneNumbers?.[0]?.number,
      };
      const id = crypto.randomUUID();
      addClient({ ...newClient, id, createdAt: new Date() } as any);
      finalClientId = id;
    }
    const vid = crypto.randomUUID();
    addVehicle({ ...vehicleData, id: vid, clientId: finalClientId } as any);
    const newClient = clients.find(c => c.id === finalClientId) || { name: clientName || 'Unknown' };
    addTask({
      id: crypto.randomUUID(),
      clientId: finalClientId,
      vehicleId: vid,
      customerName: newClient.name || clientName || '',
      carVin: vehicleData.vin,
      status: 'pending',
      totalTime: 0,
      needsFollowUp: false,
      sessions: [],
      createdAt: new Date(),
    } as any);
    toast({ title: 'Vehicle & Task Created' });
  };

  // --- Handlers ---
  const handleMarkBilled = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const client = task ? clients.find(c => c.id === task.clientId) : null;
    // Phase 2: pure status flip — totals are always live (or importedSalary).
    updateTask(taskId, { status: 'billed' });
    toast({ title: 'Task Marked as Billed' });
    if (client) {
      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status: 'billed' as const } : t);
      syncPortalToCloud(client, vehicles, updatedTasks, settings.defaultHourlyRate, settings.defaultCloningRate, settings.defaultProgrammingRate, settings.defaultAddKeyRate, settings.defaultAllKeysLostRate, settings.paymentLink, settings.paymentLabel, settings.paymentMethods, client.portalLogoUrl || settings.portalLogoUrl, client.portalBgColor || settings.portalBgColor, client.portalBusinessName || settings.portalBusinessName, client.portalBgImageUrl || settings.portalBgImageUrl)
        .then(result => { if (!client.portalId) updateClient(client.id, { portalId: result.portalId, accessCode: result.accessCode }); })
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
      syncPortalToCloud(client, vehicles, updatedTasks, settings.defaultHourlyRate, settings.defaultCloningRate, settings.defaultProgrammingRate, settings.defaultAddKeyRate, settings.defaultAllKeysLostRate, settings.paymentLink, settings.paymentLabel, settings.paymentMethods, client.portalLogoUrl || settings.portalLogoUrl, client.portalBgColor || settings.portalBgColor, client.portalBusinessName || settings.portalBusinessName, client.portalBgImageUrl || settings.portalBgImageUrl)
        .then(result => { if (!client.portalId) updateClient(client.id, { portalId: result.portalId, accessCode: result.accessCode }); })
        .catch(err => console.warn('[CloudSync] Portal sync failed:', err));
    }
  };

  const handleDelete = async (taskId: string) => {
    await photoStorageService.deleteAllPhotosForTask(taskId);
    await deleteTask(taskId);
    toast({ title: 'Task Deleted' });
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

  // --- Helpers (Phase 1: route through shared billing utility) ---
  const getTaskCost = (task: Task) => {
    const client = clients.find(c => c.id === task.clientId) || null;
    const vehicle = vehicles.find(v => v.id === task.vehicleId);
    const t = computeTaskTotal(task, client, settings);
    const { laborAfter } = applyLaborDiscount(t.labor + t.services, vehicle);
    return laborAfter + t.parts;
  };

  // Pre-discount cost (for headline display alongside Discount/Deposit chips).
  const getTaskCostGross = (task: Task) => {
    const client = clients.find(c => c.id === task.clientId) || null;
    return computeTaskTotal(task, client, settings).total;
  };

  // Per-vehicle discount applied ONCE to the sum of un-billed task labor.
  const getVehicleDiscount = (vehicle: Vehicle | undefined, vehicleTasks: Task[]) => {
    if (!vehicle?.discountType || !vehicle.discountValue || vehicleTasks.length === 0) return 0;
    const client = clients.find(c => c.id === vehicleTasks[0].clientId) || null;
    const labor = vehicleTasks.reduce((sum, task) => {
      const t = computeTaskTotal(task, client, settings);
      return sum + t.labor + t.services;
    }, 0);
    return applyLaborDiscount(labor, vehicle).discount;
  };

  // --- Money Over Time chart data ---
  const monthlyRevenueData = useMemo(() => {
    const filtered = chartClient === 'all' ? tasks : tasks.filter(t => t.clientId === chartClient);
    const statusFiltered = filtered.filter(t => {
      if (t.status === 'completed' && !chartShowCompleted) return false;
      if (t.status === 'billed' && !chartShowBilled) return false;
      if (t.status === 'paid' && !chartShowPaid) return false;
      return true;
    });
    const monthMap: Record<string, number> = {};
    statusFiltered.forEach(t => {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = (monthMap[key] || 0) + getTaskCost(t);
    });
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }));
  }, [tasks, chartClient, clients, settings, chartShowCompleted, chartShowBilled, chartShowPaid]);

  // --- Drill-down data for Money Over Time chart ---
  const drillDownData = useMemo(() => {
    if (!drillMonth) return [];
    const filtered = chartClient === 'all' ? tasks : tasks.filter(t => t.clientId === chartClient);
    const monthTasks = filtered.filter(t => {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === drillMonth;
    });
    const statusFiltered = monthTasks.filter(t => {
      if (t.status === 'completed' && !drillShowCompleted) return false;
      if (t.status === 'billed' && !drillShowBilled) return false;
      if (t.status === 'paid' && !drillShowPaid) return false;
      return true;
    });
    return statusFiltered.map(t => ({
      id: t.id,
      vehicle: vehicles.find(v => v.id === t.vehicleId),
      description: t.sessions?.find(s => s.description)?.description || '—',
      date: new Date(t.createdAt).toLocaleDateString(),
      rawDate: new Date(t.createdAt).getTime(),
      timeWorked: formatDuration(t.totalTime || 0),
      client: clients.find(c => c.id === t.clientId)?.name || 'Unknown',
      cost: getTaskCost(t),
      status: t.status,
    })).sort((a, b) => {
      const factor = drillSortDir === 'asc' ? 1 : -1;
      return drillSortField === 'date'
        ? (a.rawDate - b.rawDate) * factor
        : (a.cost - b.cost) * factor;
    });
  }, [drillMonth, tasks, vehicles, clients, chartClient, settings, drillSortField, drillSortDir, drillShowCompleted, drillShowBilled, drillShowPaid]);

  const getSessionDuration = (session: WorkSession) =>
    (session.periods || []).reduce((sum, p) => sum + (p.duration || 0), 0);

  // --- Client financials for PDF ---
  const getClientFinancials = (clientId: string) => {
    const clientTasks = tasks.filter(t => t.clientId === clientId);
    const client = clients.find(c => c.id === clientId);
    const hourlyRate = client?.hourlyRate || settings.defaultHourlyRate;
    const cloningRate = client?.cloningRate || settings.defaultCloningRate || 0;
    const programmingRate = client?.programmingRate || settings.defaultProgrammingRate || 0;
    const addKeyRate = client?.addKeyRate || settings.defaultAddKeyRate || 0;
    const allKeysLostRate = client?.allKeysLostRate || settings.defaultAllKeysLostRate || 0;
    let totalLaborCost = 0, totalPartsCost = 0, totalTime = 0;
    let totalMinHourAdj = 0, totalCloning = 0, totalProgramming = 0, totalAddKey = 0, totalAllKeysLost = 0;
    clientTasks.forEach(task => {
      totalTime += task.totalTime;
      task.sessions.forEach(session => {
        const sessionDuration = session.periods.reduce((sum, p) => sum + p.duration, 0);
        const baseCost = (sessionDuration / 3600) * hourlyRate;
        let minAdj = 0, cloneCost = 0, progCost = 0, addKeyCost = 0, allKeysLostCost = 0;
        if (session.chargeMinimumHour && sessionDuration < 3600) minAdj = ((3600 - sessionDuration) / 3600) * hourlyRate;
        if (session.isCloning && cloningRate > 0) cloneCost = cloningRate;
        if (session.isProgramming && programmingRate > 0) progCost = programmingRate;
        if (session.isAddKey && addKeyRate > 0) addKeyCost = addKeyRate;
        if (session.isAllKeysLost && allKeysLostRate > 0) allKeysLostCost = allKeysLostRate;
        totalLaborCost += baseCost + minAdj + cloneCost + progCost + addKeyCost + allKeysLostCost;
        totalMinHourAdj += minAdj;
        totalCloning += cloneCost;
        totalProgramming += progCost;
        totalAddKey += addKeyCost;
        totalAllKeysLost += allKeysLostCost;
      });
      task.sessions.forEach(session => {
        session.parts?.forEach(part => { totalPartsCost += part.price * part.quantity; });
      });
    });
    return {
      totalTime, totalLaborCost, totalPartsCost, totalCost: totalLaborCost + totalPartsCost,
      totalMinHourAdj, totalCloning, totalProgramming, totalAddKey, totalAllKeysLost,
      completedTasks: clientTasks.filter(t => ['completed', 'billed', 'paid'].includes(t.status)).length,
      activeTasks: clientTasks.filter(t => ['pending', 'in-progress', 'paused'].includes(t.status)).length,
      totalTasks: clientTasks.length,
    };
  };

  const getVehicleStats = (vehicleId: string) => {
    const vehicleTasks = tasks.filter(t => t.vehicleId === vehicleId);
    return { active: vehicleTasks.filter(t => ['pending', 'in-progress', 'paused'].includes(t.status)).length, total: vehicleTasks.length };
  };

  const getVehicleFinancials = (vehicleId: string, clientId: string) => {
    const vehicleTasks = tasks.filter(t => t.vehicleId === vehicleId);
    const client = clients.find(c => c.id === clientId);
    const hourlyRate = client?.hourlyRate || settings.defaultHourlyRate;
    const cloningRate = client?.cloningRate || settings.defaultCloningRate || 0;
    const programmingRate = client?.programmingRate || settings.defaultProgrammingRate || 0;
    const addKeyRate = client?.addKeyRate || settings.defaultAddKeyRate || 0;
    const allKeysLostRate = client?.allKeysLostRate || settings.defaultAllKeysLostRate || 0;
    let totalLaborCost = 0, totalPartsCost = 0, totalTime = 0;
    let totalMinHourAdj = 0, totalCloning = 0, totalProgramming = 0, totalAddKey = 0, totalAllKeysLost = 0;
    vehicleTasks.forEach(task => {
      task.sessions.forEach(session => {
        const sessionDuration = session.periods.reduce((sum, p) => sum + p.duration, 0);
        const baseCost = (sessionDuration / 3600) * hourlyRate;
        let minAdj = 0, cloneCost = 0, progCost = 0, addKeyCost = 0, allKeysLostCost = 0;
        if (session.chargeMinimumHour && sessionDuration < 3600) minAdj = ((3600 - sessionDuration) / 3600) * hourlyRate;
        if (session.isCloning && cloningRate > 0) cloneCost = cloningRate;
        if (session.isProgramming && programmingRate > 0) progCost = programmingRate;
        if (session.isAddKey && addKeyRate > 0) addKeyCost = addKeyRate;
        if (session.isAllKeysLost && allKeysLostRate > 0) allKeysLostCost = allKeysLostRate;
        totalLaborCost += baseCost + minAdj + cloneCost + progCost + addKeyCost + allKeysLostCost;
        totalMinHourAdj += minAdj;
        totalCloning += cloneCost;
        totalProgramming += progCost;
        totalAddKey += addKeyCost;
        totalAllKeysLost += allKeysLostCost;
      });
      totalTime += task.totalTime;
      task.sessions.forEach(session => {
        session.parts?.forEach(part => { totalPartsCost += part.price * part.quantity; });
      });
    });
    return { totalTime, totalLaborCost, totalPartsCost, totalCost: totalLaborCost + totalPartsCost, totalMinHourAdj, totalCloning, totalProgramming, totalAddKey, totalAllKeysLost, taskCount: vehicleTasks.length };
  };

  const generateClientPDF = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) { toast({ title: 'Error', description: 'Client not found', variant: 'destructive' }); return; }
    const clientVehicles = vehicles.filter(v => v.clientId === clientId);
    const financials = getClientFinancials(clientId);
    toast({ title: 'Generating PDF', description: 'Creating client report...' });
    const doc = new jsPDF();
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('Client Report', 105, 20, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US')}`, 105, 28, { align: 'center' });
    let yPos = 45;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Client Information', 20, yPos); yPos += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${client.name}`, 25, yPos); yPos += 6;
    if (client.email) { doc.text(`Email: ${client.email}`, 25, yPos); yPos += 6; }
    if (client.phone) { doc.text(`Phone: ${client.phone}`, 25, yPos); yPos += 6; }
    doc.text(`Hourly Rate: ${formatCurrency(client.hourlyRate || 0)}/hr`, 25, yPos); yPos += 12;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Summary', 20, yPos); yPos += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Total Tasks: ${financials.totalTasks} (${financials.activeTasks} active, ${financials.completedTasks} completed)`, 25, yPos); yPos += 6;
    doc.text(`Total Vehicles: ${clientVehicles.length}`, 25, yPos); yPos += 6;
    doc.text(`Total Labor Time: ${formatDuration(financials.totalTime)}`, 25, yPos); yPos += 6;
    const baseLab = financials.totalLaborCost - (financials.totalCloning || 0) - (financials.totalProgramming || 0);
    doc.text(`Labor Cost: ${formatCurrency(baseLab)}`, 25, yPos); yPos += 6;
    if (financials.totalCloning > 0) { doc.text(`Cloning: ${formatCurrency(financials.totalCloning)}`, 25, yPos); yPos += 6; }
    if (financials.totalProgramming > 0) { doc.text(`Programming: ${formatCurrency(financials.totalProgramming)}`, 25, yPos); yPos += 6; }
    doc.text(`Total Parts Cost: ${formatCurrency(financials.totalPartsCost)}`, 25, yPos); yPos += 6;
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatCurrency(financials.totalCost)}`, 25, yPos); yPos += 6;
    const vehicleDeposits = clientVehicles.reduce((sum, v) => sum + (v.prepaidAmount || 0), 0);
    const clientDeposit = client.prepaidAmount || 0;
    const totalDeposits = vehicleDeposits + clientDeposit;
    if (totalDeposits > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 0, 0);
      if (vehicleDeposits > 0) { doc.text(`Vehicle Deposits: -${formatCurrency(vehicleDeposits)}`, 25, yPos); yPos += 6; }
      if (clientDeposit > 0) { doc.text(`Client Deposit: -${formatCurrency(clientDeposit)}`, 25, yPos); yPos += 6; }
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`Balance Due: ${formatCurrency(Math.max(0, financials.totalCost - totalDeposits))}`, 25, yPos);
    }
    doc.setFont('helvetica', 'normal'); yPos += 12;
    if (clientVehicles.length > 0) {
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('Vehicles', 20, yPos); yPos += 8;
      clientVehicles.forEach((vehicle, index) => {
        if (yPos > 250) { doc.addPage(); yPos = 20; }
        const vehicleName = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'Unknown Vehicle';
        const vStats = getVehicleStats(vehicle.id);
        const vFin = getVehicleFinancials(vehicle.id, clientId);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${vehicleName}`, 25, yPos); yPos += 6;
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(`VIN: ${vehicle.vin}`, 30, yPos); yPos += 5;
        if (vehicle.color) { doc.text(`Color: ${vehicle.color}`, 30, yPos); yPos += 5; }
        doc.text(`Tasks: ${vStats.total} (${vStats.active} active)`, 30, yPos); yPos += 5;
        doc.text(`Total Time: ${formatDuration(vFin.totalTime)}`, 30, yPos); yPos += 5;
        const vBaseLab = vFin.totalLaborCost - (vFin.totalCloning || 0) - (vFin.totalProgramming || 0);
        doc.text(`Labor Cost: ${formatCurrency(vBaseLab)}`, 30, yPos); yPos += 5;
        if (vFin.totalCloning > 0) { doc.text(`Cloning: ${formatCurrency(vFin.totalCloning)}`, 30, yPos); yPos += 5; }
        if (vFin.totalProgramming > 0) { doc.text(`Programming: ${formatCurrency(vFin.totalProgramming)}`, 30, yPos); yPos += 5; }
        doc.text(`Parts Cost: ${formatCurrency(vFin.totalPartsCost)}`, 30, yPos); yPos += 5;
        doc.setFont('helvetica', 'bold');
        doc.text(`Total: ${formatCurrency(vFin.totalCost)}`, 30, yPos);
        doc.setFont('helvetica', 'normal'); yPos += 5;
        const vDeposit = vehicle.prepaidAmount || 0;
        if (vDeposit > 0) {
          doc.setTextColor(200, 0, 0);
          doc.text(`Deposit: -${formatCurrency(vDeposit)}`, 30, yPos); yPos += 5;
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'bold');
          doc.text(`Balance Due: ${formatCurrency(Math.max(0, vFin.totalCost - vDeposit))}`, 30, yPos);
          doc.setFont('helvetica', 'normal');
        }
        yPos += 8;
      });
    }
    const sanitizedName = client.name.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toLocaleDateString('en-US').replace(/\//g, '-');
    doc.save(`Client_Report_${sanitizedName}_${dateStr}.pdf`);
    toast({ title: 'PDF Generated', description: 'Client report downloaded successfully' });
  };

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
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-primary-foreground leading-tight">Chip's Time</h1>
              <p className="text-xs text-primary-foreground/60">Desktop Dashboard</p>
            </div>
            {/* Quick KPI pills */}
            <div className="hidden lg:flex items-center gap-2 ml-2">
              {countByStatus.active > 0 && (
                <span className="flex items-center gap-1.5 bg-blue-500/25 text-blue-100 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-400/30">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-300"></span>
                  </span>
                  {countByStatus.active} active
                </span>
              )}
              {countByStatus.completed > 0 && (
                <span className="bg-orange-500/25 text-orange-100 text-xs font-semibold px-2.5 py-1 rounded-full border border-orange-400/30">
                  {countByStatus.completed} to bill
                </span>
              )}
              {countByStatus.paid > 0 && (
                <span className="bg-emerald-500/25 text-emerald-100 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-400/30">
                  {countByStatus.paid} paid
                </span>
              )}
            </div>
          </div>
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
              <Button size="sm" onClick={() => setDesktopView('addClient')}
                className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border border-primary-foreground/30">
                <UserPlus className="h-4 w-4 mr-1" /> Client
              </Button>
              <Button size="sm" onClick={() => { setAddVehicleClientId(null); setDesktopView('addVehicle'); }}
                className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border border-primary-foreground/30">
                <Plus className="h-4 w-4 mr-1" /> Vehicle
              </Button>
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
            <div className="h-6 w-px bg-primary-foreground/20 mx-1" />
            {[
              { view: 'clients' as const, icon: Users, label: 'Clients' },
              { view: 'invoices' as const, icon: Receipt, label: 'Invoices' },
              { view: 'reports' as const, icon: BarChart3, label: 'Reports' },
              { view: 'settings' as const, icon: SettingsIcon, label: 'Settings' },
            ].map(({ view, icon: Icon, label }) => (
              <button
                key={view}
                onClick={() => setDesktopView(desktopView === view ? 'tree' : view)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all text-primary-foreground ${
                  desktopView === view
                    ? 'bg-white/25 ring-2 ring-white/40'
                    : 'hover:bg-primary-foreground/10 opacity-70 hover:opacity-100'
                }`}
                title={desktopView === view ? `Close ${label}` : `Open ${label}`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-semibold leading-none">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>


      {/* Main content */}
      {desktopView === 'settings' ? (
        <div className="flex-1 overflow-y-auto">
          <DesktopSettingsView settings={settings} onSave={setSettings} />
        </div>
      ) : desktopView === 'reports' ? (
        <DesktopReportsView tasks={tasks} clients={clients} vehicles={vehicles} settings={settings} />
      ) : desktopView === 'addClient' ? (
        <AddClientPage
          onSave={(clientData) => { addClient({ ...clientData, id: crypto.randomUUID(), createdAt: new Date() } as any); setDesktopView('tree'); }}
          onCancel={() => setDesktopView('tree')}
          settings={settings}
        />
      ) : desktopView === 'addVehicle' ? (
        <AddVehiclePage
          clients={clients}
          tasks={tasks}
          settings={settings}
          onSave={(vehicleData) => { handleAddVehicleSave(vehicleData); setDesktopView('tree'); }}
          onCancel={() => setDesktopView('tree')}
        />
      ) : desktopView === 'invoices' ? (
        <DesktopInvoiceView settings={settings} />
      ) : desktopView === 'clients' ? (
        <DesktopClientsView
          clients={clients}
          vehicles={vehicles}
          tasks={tasks}
          settings={settings}
          onUpdateClient={updateClient}
          onDeleteClient={deleteClient}
          onUpdateVehicle={updateVehicle}
          onDeleteVehicle={deleteVehicle}
          onMoveVehicle={handleMoveVehicle}
        />
      ) : (
        /* === NEW TWO-PANEL TREE VIEW === */
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR */}
          <div className="w-[280px] shrink-0 border-r bg-card flex flex-col overflow-hidden">
            {/* Status filter pills */}
            <div className="p-3 space-y-1.5 border-b">
              {([
                { key: 'all' as FilterType, label: 'All', color: 'bg-muted text-foreground' },
                { key: 'active' as FilterType, label: 'Active', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
                { key: 'completed' as FilterType, label: 'Completed', color: 'bg-green-500/15 text-green-700 dark:text-green-400' },
                { key: 'billed' as FilterType, label: 'Billed', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400' },
                { key: 'paid' as FilterType, label: 'Paid', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setSelectedClientId(null); }}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    filter === f.key
                      ? `${f.color} ring-2 ring-primary/30`
                      : 'hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <span className="capitalize">{f.label}</span>
                  <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${filter === f.key ? 'bg-background/50' : 'bg-muted'}`}>
                    {countByStatus[f.key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Summary stats */}
            <div className="px-3 py-2 border-b text-xs text-muted-foreground flex justify-between">
              <span>{filteredTree.length} clients</span>
              <span>{filteredTree.reduce((s, c) => s + c.vehicles.length, 0)} vehicles</span>
              <span className="font-semibold text-foreground">{formatCurrency(totalRevenue)}</span>
            </div>

            {/* Client list */}
            <div className="flex-1 overflow-y-auto">
              {filteredTree.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No {filter === 'all' ? 'clients' : `${filter} tasks`} found.
                </div>
              )}
              {filteredTree.map(({ client, vehicles: clientVehicles }) => {
                const clientRevenue = clientVehicles.flatMap(v => v.tasks).reduce((sum, t) => sum + getTaskCost(t), 0);
                const taskCount = clientVehicles.flatMap(v => v.tasks).length;
                const isSelected = selectedClientId === client.id;
                const clientColor = getVehicleColorScheme(client.id);
                const clientDeposits = clientVehicles.reduce((sum, cv) => sum + (cv.vehicle?.prepaidAmount || 0), 0) + (client.prepaidAmount || 0);
                const unpaidRevenue = clientVehicles.flatMap(v => v.tasks).filter(t => t.status !== 'paid').reduce((sum, t) => sum + getTaskCost(t), 0);
                const isFullyPaid = unpaidRevenue === 0 && clientRevenue > 0;
                const balanceDue = Math.max(0, unpaidRevenue - clientDeposits);

                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(isSelected ? null : client.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border-2 mb-2 transition-all ${clientColor.border} ${clientColor.gradient} ${
                      isSelected ? 'ring-2 ring-primary ring-offset-1' : 'hover:shadow-sm'
                    }`}
                  >
                    <div className="font-bold text-sm truncate">{client.name}</div>
                    {client.companyName && <div className="text-xs text-muted-foreground truncate">{client.companyName}</div>}
                    <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                      <span>{clientVehicles.length} vehicles · {taskCount} tasks</span>
                      {clientRevenue > 0 && (
                        <span className={`font-semibold ${
                          isFullyPaid ? 'text-emerald-600 dark:text-emerald-400' :
                          balanceDue > 0 ? 'text-orange-600 dark:text-orange-400' :
                          filter === 'billed' ? 'text-amber-600 dark:text-amber-400' :
                          filter === 'active' ? 'text-blue-600 dark:text-blue-400' :
                          'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {isFullyPaid
                            ? formatCurrency(clientRevenue)
                            : (balanceDue > 0 ? `Due: ${formatCurrency(balanceDue)}` : formatCurrency(clientRevenue))}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT CONTENT PANEL */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!selectedClientId ? (
              /* Overview — no client selected */
              <div>
                <h2 className="text-lg font-bold mb-4 text-muted-foreground">
                  {filter === 'all' ? 'All Clients' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Tasks`} — Select a client from the left
                </h2>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredTree.map(({ client, vehicles: clientVehicles }) => {
                    const clientRevenue = clientVehicles.flatMap(v => v.tasks).reduce((sum, t) => sum + getTaskCost(t), 0);
                    const taskCount = clientVehicles.flatMap(v => v.tasks).length;
                    const clientColor = getVehicleColorScheme(client.id);
                    return (
                      <div
                        key={client.id}
                        className={`rounded-xl border-2 p-4 cursor-pointer hover:shadow-md transition-shadow ${clientColor.border} ${clientColor.gradient}`}
                        onClick={() => setSelectedClientId(client.id)}
                      >
                        <div className="font-bold text-base">{client.name}</div>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <span>{clientVehicles.length} vehicles</span>
                          <span>{taskCount} tasks</span>
                        </div>
                        {clientRevenue > 0 && (() => {
                          const clientDeposits = clientVehicles.reduce((sum, cv) => sum + (cv.vehicle?.prepaidAmount || 0), 0) + (client.prepaidAmount || 0);
                          const unpaidRevenue = clientVehicles.flatMap(v => v.tasks).filter(t => t.status !== 'paid').reduce((sum, t) => sum + getTaskCost(t), 0);
                          const isFullyPaid = unpaidRevenue === 0;
                          const balanceDue = Math.max(0, unpaidRevenue - clientDeposits);
                          return (
                            <div className="mt-2">
                              <div className={`text-lg font-bold ${
                              isFullyPaid ? 'text-emerald-600 dark:text-emerald-400' :
                              balanceDue > 0 ? 'text-orange-600 dark:text-orange-400' :
                              filter === 'billed' ? 'text-amber-600 dark:text-amber-400' :
                              filter === 'active' ? 'text-blue-600 dark:text-blue-400' :
                              'text-emerald-600 dark:text-emerald-400'
                            }`}>{formatCurrency(clientRevenue)}</div>
                              {clientDeposits > 0 && isFullyPaid && (
                                <div className="text-xs font-semibold text-muted-foreground">Deposit: -{formatCurrency(clientDeposits)}</div>
                              )}
                              {clientDeposits > 0 && !isFullyPaid && (
                                <>
                                  <div className="text-xs font-semibold text-red-500">Deposit: -{formatCurrency(clientDeposits)}</div>
                                  {balanceDue > 0 && <div className="text-sm font-bold text-orange-600 dark:text-orange-400">Due: {formatCurrency(balanceDue)}</div>}
                                </>
                              )}
                            </div>
                          );
                        })()}
                        {client.phone && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* Money Over Time Chart in overview */}
                <div className="mt-6 rounded-xl border-2 bg-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      {drillMonth ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setDrillMonth(null); setDrillSortField('date'); setDrillSortDir('desc'); setDrillShowCompleted(true); setDrillShowBilled(true); setDrillShowPaid(true); }} className="mr-1 h-7 px-2">
                            ← Back
                          </Button>
                          Details for {drillMonth}
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-5 w-5" />
                          Money Over Time
                        </>
                      )}
                    </h3>
                    {!drillMonth && (
                      <select
                        value={chartClient}
                        onChange={e => { setChartClient(e.target.value); setDrillMonth(null); }}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="all">All Clients</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {drillMonth ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs text-muted-foreground mr-1">Show:</span>
                        <Button variant={drillShowCompleted ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-xs" onClick={() => setDrillShowCompleted(v => !v)}>Completed</Button>
                        <Button variant={drillShowBilled ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-xs" onClick={() => setDrillShowBilled(v => !v)}>Billed</Button>
                        <Button variant={drillShowPaid ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-xs" onClick={() => setDrillShowPaid(v => !v)}>Paid</Button>
                      </div>
                      <div className="h-[220px] overflow-auto">
                        {drillDownData.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card">
                              <tr className="border-b">
                                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vehicle</th>
                                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Description</th>
                                <th className="text-left py-2 px-2 font-medium text-muted-foreground cursor-pointer select-none" onClick={() => { if (drillSortField === 'date') setDrillSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setDrillSortField('date'); setDrillSortDir('desc'); } }}>
                                  Date {drillSortField === 'date' && (drillSortDir === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                                </th>
                                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Time</th>
                                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Client</th>
                                <th className="text-right py-2 px-2 font-medium text-muted-foreground cursor-pointer select-none" onClick={() => { if (drillSortField === 'cost') setDrillSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setDrillSortField('cost'); setDrillSortDir('desc'); } }}>
                                  Cost {drillSortField === 'cost' && (drillSortDir === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {drillDownData.map((row, i) => (
                                <tr key={row.id || i} className="border-b border-border/50">
                                  <td className="py-2 px-2">
                                    {row.vehicle ? `${row.vehicle.year || ''} ${row.vehicle.make || ''} ${row.vehicle.model || ''}`.trim() || row.vehicle.vin : 'Unknown'}
                                  </td>
                                  <td className="py-2 px-2 text-muted-foreground">{row.description}</td>
                                  <td className="py-2 px-2 text-muted-foreground">{row.date}</td>
                                  <td className="py-2 px-2 font-mono text-muted-foreground">{row.timeWorked}</td>
                                  <td className="py-2 px-2">{row.client}</td>
                                  <td className="py-2 px-2 text-right font-medium">{formatCurrency(row.cost)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="sticky bottom-0 bg-card">
                              <tr className="border-t-2">
                                <td colSpan={5} className="py-2 px-2 font-bold">Total</td>
                                <td className="py-2 px-2 text-right font-bold">{formatCurrency(drillDownData.reduce((s, r) => s + r.cost, 0))}</td>
                              </tr>
                            </tfoot>
                          </table>
                        ) : (
                          <p className="text-muted-foreground text-center py-8">No data for this month</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs text-muted-foreground mr-1">Show:</span>
                        <Button variant={chartShowCompleted ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-xs" onClick={() => setChartShowCompleted(v => !v)}>Completed</Button>
                        <Button variant={chartShowBilled ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-xs" onClick={() => setChartShowBilled(v => !v)}>Billed</Button>
                        <Button variant={chartShowPaid ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-xs" onClick={() => setChartShowPaid(v => !v)}>Paid</Button>
                      </div>
                      {monthlyRevenueData.length > 0 ? (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyRevenueData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              <Bar dataKey="revenue" fill="hsl(var(--chart-1, 12 76% 61%))" radius={[4, 4, 0, 0]} className="cursor-pointer" onClick={(data: any) => { setDrillMonth(data.month); setDrillShowCompleted(chartShowCompleted); setDrillShowBilled(chartShowBilled); setDrillShowPaid(chartShowPaid); }} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">No data</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Selected client detail view */
              (() => {
                const clientData = filteredTree.find(c => c.client.id === selectedClientId);
                if (!clientData) {
                  return (
                    <div className="text-center py-20 text-muted-foreground">
                      <p>Client not found in current filter.</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setSelectedClientId(null)}>Back to Overview</Button>
                    </div>
                  );
                }
                const { client, vehicles: clientVehicles } = clientData;
                const clientColor = getVehicleColorScheme(client.id);
                const rate = client.hourlyRate || settings.defaultHourlyRate;

                return (
                  <div className="space-y-4">
                    {/* Client header card */}
                    <div className={`rounded-xl border-2 overflow-hidden ${clientColor.border}`}>
                      <div className={`${clientColor.gradient} px-5 py-4`}>
                        {/* Name + labeled action buttons */}
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <h2 className="text-xl font-bold">{client.name}</h2>
                            {client.companyName && <p className="text-sm text-muted-foreground font-medium">{client.companyName}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => startEditClient(client)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => generateClientPDF(client.id)}>
                              <Printer className="h-3.5 w-3.5" /> PDF
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={async () => {
                              if (client.accessCode) {
                                navigator.clipboard.writeText(client.accessCode);
                                toast({ title: 'PIN Copied!', description: `PIN: ${client.accessCode}` });
                              } else {
                                try {
                                  const result = await syncPortalToCloud(client, vehicles, tasks, settings.defaultHourlyRate, settings.defaultCloningRate, settings.defaultProgrammingRate, settings.defaultAddKeyRate, settings.defaultAllKeysLostRate, settings.paymentLink, settings.paymentLabel, settings.paymentMethods, client.portalLogoUrl || settings.portalLogoUrl, client.portalBgColor || settings.portalBgColor, client.portalBusinessName || settings.portalBusinessName, client.portalBgImageUrl || settings.portalBgImageUrl);
                                  updateClient(client.id, { portalId: result.portalId, accessCode: result.accessCode });
                                  navigator.clipboard.writeText(result.accessCode);
                                  toast({ title: 'PIN Copied!', description: `PIN: ${result.accessCode}` });
                                } catch {
                                  toast({ title: 'Error', description: 'Could not generate PIN', variant: 'destructive' });
                                }
                              }
                            }}>
                              <KeyRound className="h-3.5 w-3.5" />
                              {client.accessCode ? `PIN: ${client.accessCode}` : 'Set PIN'}
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={async () => {
                              // Open synchronously to preserve user-gesture (avoids popup blocker)
                              const win = window.open('about:blank', '_blank');
                              try {
                                const result = await syncPortalToCloud(client, vehicles, tasks, settings.defaultHourlyRate, settings.defaultCloningRate, settings.defaultProgrammingRate, settings.defaultAddKeyRate, settings.defaultAllKeysLostRate, settings.paymentLink, settings.paymentLabel, settings.paymentMethods, client.portalLogoUrl || settings.portalLogoUrl, client.portalBgColor || settings.portalBgColor, client.portalBusinessName || settings.portalBusinessName, client.portalBgImageUrl || settings.portalBgImageUrl);
                                updateClient(client.id, { portalId: result.portalId, accessCode: result.accessCode });
                                const url = `${PORTAL_BASE_URL}/client-view?id=${result.portalId}&preview=1`;
                                if (win) win.location.href = url;
                                else window.open(url, '_blank');
                              } catch {
                                if (win) win.close();
                                toast({ title: 'Error', description: 'Could not open portal preview', variant: 'destructive' });
                              }
                            }}>
                              <Eye className="h-3.5 w-3.5" /> Portal
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={async () => {
                              try {
                                const result = await syncPortalToCloud(client, vehicles, tasks, settings.defaultHourlyRate, settings.defaultCloningRate, settings.defaultProgrammingRate, settings.defaultAddKeyRate, settings.defaultAllKeysLostRate, settings.paymentLink, settings.paymentLabel, settings.paymentMethods, client.portalLogoUrl || settings.portalLogoUrl, client.portalBgColor || settings.portalBgColor, client.portalBusinessName || settings.portalBusinessName, client.portalBgImageUrl || settings.portalBgImageUrl);
                                updateClient(client.id, { portalId: result.portalId, accessCode: result.accessCode });
                                const url = `${PORTAL_BASE_URL}/client-view?id=${result.portalId}`;
                                await navigator.clipboard.writeText(url);
                                toast({ title: 'Link Copied!', description: `Share this link with PIN: ${result.accessCode}` });
                                return;
                              } catch (err) {
                                console.warn('[Share] Cloud sync failed, falling back:', err);
                              }
                              const code = client.accessCode || generateAccessCode();
                              if (!client.accessCode) updateClient(client.id, { accessCode: code });
                              const summary = calculateClientCosts(client, vehicles, tasks, settings.defaultHourlyRate, settings.defaultCloningRate, settings.defaultProgrammingRate, settings.defaultAddKeyRate, settings.defaultAllKeysLostRate);
                              const encoded = await encodeClientData(summary, code);
                              const url = `${PORTAL_BASE_URL}/client-view#${encoded}`;
                              if (url.length <= 2000) {
                                await navigator.clipboard.writeText(url);
                                toast({ title: 'Link Copied!', description: `Share this link with PIN: ${code}` });
                              } else {
                                const htmlBlob = await generatePortalHtmlFile(summary, code);
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(htmlBlob);
                                a.download = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_portal.html`;
                                a.click();
                                URL.revokeObjectURL(a.href);
                                toast({ title: 'File Downloaded', description: `Send it to your client. PIN: ${code}` });
                              }
                            }}>
                              <Link2 className="h-3.5 w-3.5" /> Share
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => { setImportingClientId(client.id); const input = document.getElementById(`xls-import-${client.id}`) as HTMLInputElement; input?.click(); }}>
                              <Upload className="h-3.5 w-3.5" /> Import XLS
                            </Button>
                            <input id={`xls-import-${client.id}`} type="file" accept=".xls,.xlsx" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleImportXls(file, client.id); e.target.value = ''; }} />
                          </div>
                        </div>

                        {/* Full info row */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm text-muted-foreground">
                          {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
                          {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
                          <span className="flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" />{formatCurrency(rate)}/hr</span>
                          <span className="text-xs">{formatCurrency(client.cloningRate ?? settings.defaultCloningRate ?? 0)}/clone</span>
                          <span className="text-xs">{formatCurrency(client.programmingRate ?? settings.defaultProgrammingRate ?? 0)}/prog</span>
                          <span className="text-xs">{formatCurrency(client.addKeyRate ?? settings.defaultAddKeyRate ?? 0)}/add-key</span>
                          <span className="text-xs">{formatCurrency(client.allKeysLostRate ?? settings.defaultAllKeysLostRate ?? 0)}/AKL</span>
                        </div>
                        {(client.address || client.city || client.state) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {[client.address, [client.city, client.state, client.zip].filter(Boolean).join(', ')].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {client.notes && <p className="text-xs text-muted-foreground italic mt-1">{client.notes}</p>}

                        {/* Totals */}
                        {(() => {
                          const clientGross = clientVehicles.flatMap(v => v.tasks).reduce((sum, t) => sum + getTaskCostGross(t), 0);
                          const clientDiscount = clientVehicles.reduce((sum, cv) => sum + getVehicleDiscount(cv.vehicle, cv.tasks), 0);
                          const clientRevenue = Math.max(0, clientGross - clientDiscount);
                          const vehicleDeps = clientVehicles.reduce((sum, cv) => sum + (cv.vehicle?.prepaidAmount || 0), 0);
                          const clientDep = client.prepaidAmount || 0;
                          const unpaidGross = clientVehicles.flatMap(v => v.tasks).filter(t => t.status !== 'paid').reduce((sum, t) => sum + getTaskCostGross(t), 0);
                          const unpaidDiscount = clientVehicles.reduce((sum, cv) => sum + getVehicleDiscount(cv.vehicle, cv.tasks.filter(t => t.status !== 'paid')), 0);
                          const unpaidRevenue = Math.max(0, unpaidGross - unpaidDiscount);
                          const isFullyPaid = unpaidRevenue === 0 && clientRevenue > 0;
                          const balanceDue = Math.max(0, unpaidRevenue - vehicleDeps - clientDep);
                          if (clientGross <= 0) return null;
                          return (
                            <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                              <span className={`font-semibold ${
                                isFullyPaid ? 'text-emerald-600 dark:text-emerald-400' :
                                filter === 'billed' ? 'text-amber-600 dark:text-amber-400' :
                                filter === 'active' ? 'text-blue-600 dark:text-blue-400' :
                                'text-emerald-600 dark:text-emerald-400'
                              }`}>Total: {formatCurrency(clientGross)}</span>
                              {clientDiscount > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-bold">Discount: -{formatCurrency(clientDiscount)}</span>}
                              {(vehicleDeps > 0 || clientDep > 0 || clientDiscount > 0) && balanceDue > 0 && !isFullyPaid && <span className="text-orange-600 font-bold">Due: {formatCurrency(balanceDue)}</span>}
                              {vehicleDeps > 0 && <span className={isFullyPaid ? 'text-muted-foreground' : 'text-red-500'}>Car Deposits: {formatCurrency(vehicleDeps)}</span>}
                              {clientDep > 0 && <span className={isFullyPaid ? 'text-muted-foreground' : 'text-red-500'}>Client Deposit: {formatCurrency(clientDep)}</span>}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Inline client edit form */}
                      {editingClientId === client.id && (
                        <div className="px-5 py-3 bg-card/50 border-b flex items-center gap-3 flex-wrap" onClick={e => e.stopPropagation()}>
                          <Input className="w-48 h-8 text-sm" placeholder="Name" value={editFormData.name || ''} onChange={e => setEditFormData(p => ({ ...p, name: e.target.value }))} />
                          <Input className="w-48 h-8 text-sm" placeholder="Email" value={editFormData.email || ''} onChange={e => setEditFormData(p => ({ ...p, email: e.target.value }))} />
                          <Input className="w-40 h-8 text-sm" placeholder="Phone" value={editFormData.phone || ''} onChange={e => setEditFormData(p => ({ ...p, phone: e.target.value }))} />
                          <Input className="w-28 h-8 text-sm" type="number" placeholder="Rate" value={editFormData.hourlyRate ?? ''} onChange={e => setEditFormData(p => ({ ...p, hourlyRate: e.target.value ? parseFloat(e.target.value) : undefined }))} />
                          <Input className="w-28 h-8 text-sm" type="number" placeholder="Deposit" value={editFormData.prepaidAmount ?? ''} onChange={e => setEditFormData(p => ({ ...p, prepaidAmount: e.target.value ? parseFloat(e.target.value) : undefined }))} />
                          <Button size="sm" className="h-8" onClick={saveEditClient}><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={cancelEditClient}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </div>

                    {/* Vehicles as cards */}
                    {clientVehicles.length === 0 && (
                      <div className="text-sm text-muted-foreground py-8 text-center border rounded-xl bg-muted/20">
                        No vehicles{filter !== 'all' ? ` with ${filter} tasks` : ''}.
                      </div>
                    )}
                    {clientVehicles.map(({ vehicle, tasks: vehicleTasks }) => {
                      const vColor = getVehicleColorScheme(vehicle.id);
                      const isVExpanded = expandedVehicles.has(vehicle.id);
                      const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Unknown Vehicle';
                      const vehicleGross = vehicleTasks.reduce((sum, t) => sum + getTaskCostGross(t), 0);
                      const vehicleDiscount = getVehicleDiscount(vehicle, vehicleTasks);
                      const vehicleCost = Math.max(0, vehicleGross - vehicleDiscount);
                      const vehicleUnpaidGross = vehicleTasks.filter(t => t.status !== 'paid').reduce((sum, t) => sum + getTaskCostGross(t), 0);
                      const vehicleUnpaidDiscount = getVehicleDiscount(vehicle, vehicleTasks.filter(t => t.status !== 'paid'));
                      const vehicleUnpaid = Math.max(0, vehicleUnpaidGross - vehicleUnpaidDiscount);
                      const deposit = vehicle.prepaidAmount || 0;
                      const vehicleFullyPaid = vehicleUnpaid === 0 && vehicleCost > 0;
                      const balanceDue = Math.max(0, vehicleUnpaid - deposit);

                      return (
                        <div key={vehicle.id} className={`rounded-xl border-2 overflow-hidden ${vColor.border}`}>
                          {/* Vehicle header */}
                          <div
                            className={`${vColor.card} px-4 py-3 cursor-pointer flex items-center justify-between`}
                            onClick={() => toggleVehicle(vehicle.id)}
                          >
                            <div className="flex items-center gap-3 flex-wrap">
                              {isVExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <Car className="h-4 w-4" />
                              <span className="font-bold">{vehicleLabel}</span>
                              {vehicle.vin && <span className="text-xs font-mono text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(vehicle.vin); toast({ title: 'VIN Copied!', description: vehicle.vin }); }} title="Click to copy VIN">VIN: {vehicle.vin}</span>}
                              {vehicle.color && <Badge variant="outline" className="text-xs">{vehicle.color}</Badge>}
                              {vehicleGross > 0 && (
                                <span className={`font-bold text-sm ml-1 ${
                                  vehicleFullyPaid ? 'text-emerald-600 dark:text-emerald-400' :
                                  filter === 'billed' ? 'text-amber-600 dark:text-amber-400' :
                                  filter === 'active' ? 'text-blue-600 dark:text-blue-400' :
                                  'text-emerald-600 dark:text-emerald-400'
                                }`}>{formatCurrency(vehicleGross)}</span>
                              )}
                              {vehicleDiscount > 0 && vehicleGross > 0 && (
                                <span className="font-bold text-sm ml-1 text-emerald-600 dark:text-emerald-400" title={vehicle.discountType === 'percent' ? `${vehicle.discountValue}% off labor` : 'Fixed labor discount'}>
                                  Discount: -{formatCurrency(vehicleDiscount)}
                                </span>
                              )}
                              {deposit > 0 && vehicleGross > 0 && (
                                <span className={`font-bold text-sm ml-1 ${vehicleFullyPaid ? 'text-muted-foreground' : 'text-destructive'}`}>Deposit: -{formatCurrency(deposit)}</span>
                              )}
                              {vehicleGross > 0 && (deposit > 0 || vehicleDiscount > 0) && (
                                vehicleFullyPaid || balanceDue === 0 ? (
                                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 ml-1">Paid</span>
                                ) : (
                                  <span className="font-bold text-sm text-orange-500 ml-1">Balance Due: {formatCurrency(balanceDue)}</span>
                                )
                              )}
                            </div>
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <Badge variant="secondary" className="text-xs">{vehicleTasks.length} tasks</Badge>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                setEditingVehicleId(vehicle.id);
                                setVehicleEditData({ vin: vehicle.vin, make: vehicle.make || '', model: vehicle.model || '', year: vehicle.year?.toString() || '', color: vehicle.color || '', prepaidAmount: vehicle.prepaidAmount?.toString() || '', discountType: vehicle.discountType || 'fixed', discountValue: vehicle.discountValue?.toString() || '' });
                              }} title="Edit Vehicle">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
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
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteVehicleDialog({ open: true, vehicleId: vehicle.id })} title="Delete Vehicle">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          {/* Inline vehicle edit form */}
                          {editingVehicleId === vehicle.id && (
                            <div className="px-4 py-2.5 bg-card/50 border-b flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                              <Input className="w-56 h-8 text-sm font-mono" placeholder="VIN (17 chars)" maxLength={17} value={vehicleEditData.vin} onChange={e => setVehicleEditData(p => ({ ...p, vin: e.target.value.toUpperCase() }))} />
                              <Input className="w-36 h-8 text-sm" placeholder="Make" value={vehicleEditData.make} onChange={e => setVehicleEditData(p => ({ ...p, make: e.target.value }))} />
                              <Input className="w-36 h-8 text-sm" placeholder="Model" value={vehicleEditData.model} onChange={e => setVehicleEditData(p => ({ ...p, model: e.target.value }))} />
                              <Input className="w-20 h-8 text-sm" placeholder="Year" type="number" value={vehicleEditData.year} onChange={e => setVehicleEditData(p => ({ ...p, year: e.target.value }))} />
                              <Input className="w-28 h-8 text-sm" placeholder="Color" value={vehicleEditData.color} onChange={e => setVehicleEditData(p => ({ ...p, color: e.target.value }))} />
                              <Input className="w-28 h-8 text-sm" placeholder="Deposit $" type="number" step="0.01" value={vehicleEditData.prepaidAmount} onChange={e => setVehicleEditData(p => ({ ...p, prepaidAmount: e.target.value }))} />
                              <div className="flex items-center gap-1">
                                <div className="flex rounded-md border-2 border-input overflow-hidden shrink-0 h-8">
                                  <button type="button" onClick={() => setVehicleEditData(p => ({ ...p, discountType: 'fixed' }))} className={`px-2 h-full text-xs font-bold ${vehicleEditData.discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'}`}>$</button>
                                  <button type="button" onClick={() => setVehicleEditData(p => ({ ...p, discountType: 'percent' }))} className={`px-2 h-full text-xs font-bold border-l-2 border-input ${vehicleEditData.discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'}`}>%</button>
                                </div>
                                <Input className="w-24 h-8 text-sm" placeholder="Discount" type="number" step="0.01" min="0" max={vehicleEditData.discountType === 'percent' ? 100 : undefined} value={vehicleEditData.discountValue} onChange={e => setVehicleEditData(p => ({ ...p, discountValue: e.target.value }))} />
                              </div>
                              <Button size="sm" className="h-8" onClick={() => {
                                const trimmedVin = vehicleEditData.vin.trim().toUpperCase();
                                if (!trimmedVin || trimmedVin.length !== 17) {
                                  toast({ title: 'Invalid VIN', description: 'VIN must be 17 characters', variant: 'destructive' });
                                  return;
                                }
                                const duplicate = vehicles.find(v => v.id !== vehicle.id && v.vin === trimmedVin);
                                if (duplicate) {
                                  toast({ title: 'Duplicate VIN', description: 'This VIN already exists', variant: 'destructive' });
                                  return;
                                }
                                const updates: Partial<Vehicle> = {
                                  vin: trimmedVin,
                                  make: vehicleEditData.make.trim() || undefined,
                                  model: vehicleEditData.model.trim() || undefined,
                                  year: vehicleEditData.year ? parseInt(vehicleEditData.year) : undefined,
                                  color: vehicleEditData.color.trim() || undefined,
                                  prepaidAmount: vehicleEditData.prepaidAmount ? parseFloat(vehicleEditData.prepaidAmount) : undefined,
                                };
                                const parsedDisc = vehicleEditData.discountValue ? parseFloat(vehicleEditData.discountValue) : 0;
                                const validDisc = !isNaN(parsedDisc) && parsedDisc > 0
                                  ? (vehicleEditData.discountType === 'percent' ? Math.min(100, Math.max(0, parsedDisc)) : Math.max(0, parsedDisc))
                                  : 0;
                                updates.discountType = validDisc > 0 ? vehicleEditData.discountType : undefined;
                                updates.discountValue = validDisc > 0 ? validDisc : undefined;
                                updateVehicle(vehicle.id, updates);
                                if (updates.vin) {
                                  tasks.filter(t => t.vehicleId === vehicle.id).forEach(t => updateTask(t.id, { carVin: updates.vin! }));
                                }
                                setEditingVehicleId(null);
                                toast({ title: 'Vehicle Updated' });
                              }}><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
                              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingVehicleId(null)}><X className="h-3.5 w-3.5" /></Button>
                            </div>
                          )}

                          {/* Tasks table within vehicle */}
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
                                  <div key={task.id} className={`rounded-lg border p-3 ${sessionColor.session}`}>
                                    {/* Task header row */}
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-sm">Task {tIdx + 1}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : ''}
                                        </span>
                                        <Badge className={`text-xs border ${statusColors[task.status] || ''}`}>{task.status}</Badge>
                                        <span className="font-mono text-sm font-semibold">{formatDuration(task.totalTime)}</span>
                                        <span className="font-bold text-sm">{formatCurrency(cost)}</span>
                                        {vehicle.discountType && (vehicle.discountValue || 0) > 0 && (
                                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/40 bg-emerald-500/10">
                                            🏷 {vehicle.discountType === 'percent' ? `-${vehicle.discountValue}%` : `-${formatCurrency(vehicle.discountValue || 0)}`}
                                          </Badge>
                                        )}
                                        {(task.importedSalary != null && task.importedSalary > 0) && <ImportedBadge />}
                                        {task.needsFollowUp && (
                                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-400/50 bg-orange-500/10">
                                            ⚑ Follow-up
                                          </Badge>
                                        )}
                                        {photoCount > 0 && <span className="text-xs text-muted-foreground">📷 {photoCount}</span>}
                                        {task.diagnosticPdfUrl && (
                                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/40">
                                            <FileUp className="h-3 w-3 mr-1" />PDF
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTaskId(editingTaskId === task.id ? null : task.id)} title="Edit">
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        {task.status === 'completed' && (
                                          <>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handlePreviewBill(task)} title="Preview Bill">
                                              <FileText className="h-3.5 w-3.5 mr-1" />Bill
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleGenerateBillAndMarkBilled(task)} title="Bill & Mark Billed">
                                              <Receipt className="h-3.5 w-3.5 mr-1" />Bill & Mark
                                            </Button>
                                          </>
                                        )}
                                        {task.status === 'billed' && (
                                          <>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handlePreviewBill(task)} title="Re-generate Bill">
                                              <FileText className="h-3.5 w-3.5 mr-1" />Bill
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMarkPaid(task.id)} title="Mark Paid">
                                              <DollarSign className="h-3.5 w-3.5" />
                                            </Button>
                                          </>
                                        )}
                                        {task.status === 'paid' && (
                                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handlePreviewBill(task)} title="Print Detail">
                                            <FileText className="h-3.5 w-3.5 mr-1" />Detail
                                          </Button>
                                        )}
                                        {client.portalId && (
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`${PORTAL_BASE_URL}/client-view?id=${client.portalId}&preview=1`, '_blank')} title="Client Portal">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUploadDiagnosticPdf(task.id)} title={task.diagnosticPdfUrl ? 'Replace Diagnostic PDF' : 'Upload Diagnostic PDF'}>
                                          <FileUp className={`h-3.5 w-3.5 ${task.diagnosticPdfUrl ? 'text-emerald-600' : ''}`} />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTaskDialog({ open: true, taskId: task.id })} title="Delete">
                                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Inline task editor */}
                                    {editingTaskId === task.id && (
                                      <TaskInlineEditor
                                        task={task}
                                        onSave={async (updatedTask) => { await updateTask(updatedTask.id, updatedTask); setEditingTaskId(null); }}
                                        onCancel={() => setEditingTaskId(null)}
                                        onDelete={(taskId) => { handleDelete(taskId); setEditingTaskId(null); }}
                                      />
                                    )}
                                    {editingTaskId !== task.id && (task.sessions || []).map((session, sIdx) => {
                                      const sDur = getSessionDuration(session);
                                      return (
                                        <div key={session.id || sIdx} className={`rounded-md p-2 mt-1 ${sessionColor.session}`}>
                                          <div className="flex items-center gap-2 text-xs flex-wrap">
                                            <span className="font-medium">Session {sIdx + 1}</span>
                                            <span className="font-mono">{formatDuration(sDur)}</span>
                                            {session.description && <span className="text-muted-foreground">— {session.description}</span>}
                                            {session.chargeMinimumHour && <Badge variant="outline" className="text-[10px] px-1">Min 1hr</Badge>}
                                            {session.isCloning && <Badge variant="outline" className="text-[10px] px-1">Cloning</Badge>}
                                            {session.isProgramming && <Badge variant="outline" className="text-[10px] px-1">Programming</Badge>}
                                            {session.isAddKey && <Badge variant="outline" className="text-[10px] px-1">Add Key</Badge>}
                                            {session.isAllKeysLost && <Badge variant="outline" className="text-[10px] px-1">All Keys Lost</Badge>}
                                          </div>
                                          {/* Parts inline */}
                                          {(session.parts || []).length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-1">
                                              {session.parts.map((part, pi) => (
                                                <span key={pi} className={`text-xs px-2 py-0.5 rounded border ${sessionColor.part} ${part.providedByClient ? 'opacity-60' : ''}`}>
                                                  {part.providedByClient && <span className="text-green-700 dark:text-green-400 font-medium mr-1">[C]</span>}
                                                  {part.name} ×{part.quantity}{!part.providedByClient && ` = ${formatCurrency(part.price * part.quantity)}`}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          {/* Photos */}
                                          {(session.photos || []).length > 0 && (() => {
                                            const photosWithUrl = (session.photos || []).map(p => {
                                              const path = p.cloudPath || photoStorageService.derivePathFromCloudUrl(p.cloudUrl);
                                              const signed = path ? photoSignedUrls[path] : undefined;
                                              return { photo: p, url: signed || (p.cloudUrl && !p.cloudUrl.includes('/object/public/') ? p.cloudUrl : undefined) };
                                            });
                                            const viewable = photosWithUrl.filter(x => x.url);
                                            const deviceOnly = photosWithUrl.length - viewable.length;
                                            return (
                                              <div className="flex gap-2 mt-1">
                                                {viewable.map(({ photo, url }) => (
                                                  <a key={photo.id} href={url} target="_blank" rel="noopener noreferrer">
                                                    <img src={url} alt="Photo" className="h-10 w-10 rounded object-cover border-2 border-border hover:ring-2 hover:ring-primary" />
                                                  </a>
                                                ))}
                                                {deviceOnly > 0 && (
                                                  <div className="h-10 px-2 rounded border border-dashed flex items-center gap-1 text-xs text-muted-foreground">
                                                    <ImageOff className="h-3 w-3" />
                                                    {deviceOnly} device only
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })()}
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

                    {/* Expected Gain — shown on completed filter */}
                    {filter === 'completed' && clientVehicles.length > 0 && (() => {
                      const completedTasks = clientVehicles.flatMap(v => v.tasks);
                      const totalGain = completedTasks.reduce((sum, t) => sum + getTaskCost(t), 0);
                      if (completedTasks.length === 0) return null;
                      return (
                        <div className="rounded-xl border-2 p-5 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-300 dark:border-amber-700">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            <h3 className="font-bold text-lg">Expected Gain</h3>
                          </div>
                          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(totalGain)}</div>
                          <div className="text-sm text-muted-foreground mt-1">{completedTasks.length} completed tasks</div>
                        </div>
                      );
                    })()}

                    {/* Revenue Charts — shown on paid filter */}
                    {filter === 'paid' && revenueChartData.length > 0 && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border-2 p-4 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-300 dark:border-emerald-700">
                          <h3 className="font-bold mb-3">Monthly Revenue</h3>
                          <ResponsiveContainer width="100%" height={200}>
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
                          <ResponsiveContainer width="100%" height={200}>
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
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* Add Client Dialog */}
      <AddClientDialog
        open={showAddClient}
        onOpenChange={setShowAddClient}
        onSave={(clientData) => {
          addClient({ ...clientData, id: crypto.randomUUID(), createdAt: new Date() } as any);
          toast({ title: 'Client Added' });
        }}
      />

      {/* Add Vehicle Dialog */}
      <AddVehicleDialog
        open={showAddVehicle}
        onOpenChange={setShowAddVehicle}
        clients={addVehicleClientId ? clients.filter(c => c.id === addVehicleClientId) : clients}
        tasks={tasks}
        settings={settings}
        onAddClient={() => setShowAddClient(true)}
        onSave={handleAddVehicleSave}
      />

      {/* Delete Vehicle Confirmation */}
      <AlertDialog open={deleteVehicleDialog.open} onOpenChange={open => !open && setDeleteVehicleDialog({ open: false, vehicleId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteVehicleDialog.vehicleId && (() => {
                const v = vehicles.find(x => x.id === deleteVehicleDialog.vehicleId);
                const vName = [v?.year, v?.make, v?.model].filter(Boolean).join(' ') || 'this vehicle';
                const taskCount = tasks.filter(t => t.vehicleId === deleteVehicleDialog.vehicleId).length;
                return `Delete ${vName}? This will permanently remove the vehicle and all ${taskCount} associated task${taskCount !== 1 ? 's' : ''}. This cannot be undone.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteVehicleDialog.vehicleId) handleDeleteVehicle(deleteVehicleDialog.vehicleId);
                setDeleteVehicleDialog({ open: false, vehicleId: null });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Task Confirmation */}
      <AlertDialog open={deleteTaskDialog.open} onOpenChange={open => !open && setDeleteTaskDialog({ open: false, taskId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTaskDialog.taskId && (() => {
                const t = tasks.find(x => x.id === deleteTaskDialog.taskId);
                const v = t ? vehicles.find(x => x.id === t.vehicleId) : null;
                const vName = [v?.year, v?.make, v?.model].filter(Boolean).join(' ') || 'this vehicle';
                return `Delete the work session for ${vName}? All time records, parts, and photos will be permanently removed. This cannot be undone.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteTaskDialog.taskId) { handleDelete(deleteTaskDialog.taskId); setEditingTaskId(null); }
                setDeleteTaskDialog({ open: false, taskId: null });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default DesktopDashboard;
