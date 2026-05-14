import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { backupManager } from '@/lib/backupManager';
import { useBackupSettings } from '@/hooks/useBackupSettings';
import { useCloudSync } from '@/hooks/useCloudSync';
import { useNotifications } from '@/hooks/useNotifications';
import { 
  Loader2, Upload, Download, FileText, Calendar, ArrowLeft, 
  AlertTriangle, CheckCircle2, Cloud, CloudOff, RefreshCw,
  Settings2, Link, Unlink
} from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Capacitor } from '@capacitor/core';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { SYNC_INTERVALS } from '@/config/googleDrive';
import { Input } from './ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface BackupViewProps {
  onBack: () => void;
  googleApiKey?: string;
}

export function BackupView({ onBack, googleApiKey }: BackupViewProps) {
  const { backupSettings, setBackupSettings } = useBackupSettings();
  const { toast } = useNotifications();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backups, setBackups] = useState<Array<{ name: string; created: Date }>>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [exportingLatest, setExportingLatest] = useState(false);
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  
  const {
    status: syncStatus,
    isConnected,
    userEmail,
    lastSyncDate,
    lastError,
    settings: cloudSettings,
    cloudBackups,
    isLoading: cloudLoading,
    connect,
    disconnect,
    syncNow,
    restoreFromCloud,
    updateSettings,
    loadCloudBackups,
  } = useCloudSync();

  useEffect(() => {
    loadBackups();
  }, []);
  
  useEffect(() => {
    if (isConnected) {
      loadCloudBackups();
    }
  }, [isConnected, loadCloudBackups]);

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const files = await backupManager.listLocalBackups();
      setBackups(files);
    } catch (error) {
      console.error('Failed to load backups:', error);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await backupManager.exportBackup();
      loadBackups();
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to create backup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await backupManager.importBackup();
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to restore backup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };

  const handleAutoBackupToggle = async (enabled: boolean) => {
    try {
      await setBackupSettings({ autoBackupEnabled: enabled });
      toast({
        title: enabled ? "Auto-Backup Enabled" : "Auto-Backup Disabled",
        description: enabled 
          ? "Daily backups will be created automatically and kept for one week."
          : "Auto-backup has been disabled.",
      });
    } catch (error) {
      toast({
        title: "Settings Error",
        description: "Failed to update auto-backup settings.",
        variant: "destructive"
      });
    }
  };

  const handleExportLatest = async () => {
    setExportingLatest(true);
    try {
      await backupManager.exportLatestAutoBackup();
      toast({
        title: "Backup Exported",
        description: "Latest auto-backup has been shared.",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export latest backup.",
        variant: "destructive"
      });
    } finally {
      setExportingLatest(false);
    }
  };
  
  const handleConnectGoogleDrive = async () => {
    const clientId = googleApiKey || clientIdInput;
    if (!clientId) {
      setShowClientIdInput(true);
      return;
    }
    
    const success = await connect(clientId);
    if (success) {
      setShowClientIdInput(false);
      setClientIdInput('');
    }
  };
  
  const handleDisconnect = async () => {
    await disconnect();
    setShowDisconnectConfirm(false);
  };
  
  const handleSyncNow = async () => {
    await syncNow();
  };
  
  const handleRestoreFromCloud = async () => {
    setShowRestoreConfirm(false);
    await restoreFromCloud();
  };
  
  const handleSyncToggle = async (enabled: boolean) => {
    await updateSettings({ enabled });
    if (enabled && cloudSettings?.syncIntervalMinutes) {
      toast({
        title: "Cloud Sync Enabled",
        description: `Your data will sync every ${cloudSettings.syncIntervalMinutes} minutes.`,
      });
    }
  };
  
  const handleIntervalChange = async (value: string) => {
    await updateSettings({ syncIntervalMinutes: parseInt(value) });
  };
  
  const handleAutoSyncToggle = async (enabled: boolean) => {
    await updateSettings({ autoSyncOnChange: enabled });
  };

  const isWeb = Capacitor.getPlatform() === 'web';
  
  const getSyncStatusIcon = () => {
    if (syncStatus === 'syncing') {
      return <RefreshCw className="h-4 w-4 animate-spin text-primary" />;
    }
    if (syncStatus === 'error') {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (syncStatus === 'success') {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return <Cloud className="h-4 w-4 text-muted-foreground" />;
  };
  
  const getSyncStatusText = () => {
    if (syncStatus === 'syncing') return 'Syncing...';
    if (syncStatus === 'error') return 'Sync failed';
    if (lastSyncDate) {
      return `Last synced: ${formatDate(lastSyncDate)}`;
    }
    return 'Not synced yet';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold">Backup & Sync</h2>
      </div>
      
      {/* Cloud Sync Section */}
      <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Cloud Sync</h3>
        </div>
        
        {!isConnected ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect to Google Drive to automatically backup your data and sync across devices.
            </p>
            
            {showClientIdInput && !googleApiKey && (
              <div className="space-y-2">
                <Label htmlFor="client-id">Google OAuth Client ID</Label>
                <Input
                  id="client-id"
                  placeholder="Enter your Google OAuth Client ID"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Create one at{' '}
                  <a 
                    href="https://console.cloud.google.com/apis/credentials" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Google Cloud Console
                  </a>
                </p>
              </div>
            )}
            
            <Button 
              onClick={handleConnectGoogleDrive}
              disabled={cloudLoading || (showClientIdInput && !clientIdInput && !googleApiKey)}
              className="w-full"
            >
              {cloudLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Connect Google Drive
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  Connected as <span className="font-medium">{userEmail}</span>
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDisconnectConfirm(true)}
              >
                <Unlink className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Enable Sync Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="cloud-sync">Enable Cloud Sync</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically backup to Google Drive
                </p>
              </div>
              <Switch
                id="cloud-sync"
                checked={cloudSettings?.enabled || false}
                onCheckedChange={handleSyncToggle}
              />
            </div>
            
            {cloudSettings?.enabled && (
              <>
                {/* Sync Interval */}
                <div className="space-y-2">
                  <Label>Sync Interval</Label>
                  <Select 
                    value={String(cloudSettings.syncIntervalMinutes || 30)}
                    onValueChange={handleIntervalChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYNC_INTERVALS.map(interval => (
                        <SelectItem key={interval.value} value={String(interval.value)}>
                          {interval.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Auto Sync on Change */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-sync-change">Sync on Data Change</Label>
                    <p className="text-xs text-muted-foreground">
                      Sync automatically when you make changes
                    </p>
                  </div>
                  <Switch
                    id="auto-sync-change"
                    checked={cloudSettings.autoSyncOnChange || false}
                    onCheckedChange={handleAutoSyncToggle}
                  />
                </div>
                
                {/* Sync Status */}
                <div className="flex items-center gap-2 text-sm">
                  {getSyncStatusIcon()}
                  <span className="text-muted-foreground">{getSyncStatusText()}</span>
                </div>
                
                {lastError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{lastError}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={handleSyncNow}
                disabled={syncStatus === 'syncing' || !cloudSettings?.enabled}
                variant="secondary"
              >
                {syncStatus === 'syncing' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>
              
              <Button 
                onClick={() => setShowRestoreConfirm(true)}
                disabled={syncStatus === 'syncing'}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Restore
              </Button>
            </div>
            
            {/* Cloud Backups List */}
            {cloudBackups.length > 0 && (
              <div className="space-y-2">
                <Label>Cloud Backups ({cloudBackups.length})</Label>
                <ScrollArea className="h-[120px] rounded-md border bg-background">
                  <div className="p-2 space-y-1">
                    {cloudBackups.slice(0, 5).map((backup) => (
                      <div
                        key={backup.id}
                        className="flex items-center gap-2 p-2 rounded text-sm bg-muted/50"
                      >
                        <Cloud className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{backup.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(backup.createdTime).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-Backup Toggle */}
      {!isWeb && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-backup" className="text-base font-semibold">
                Daily Auto-Backup (Local)
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically backup every 24 hours and keep for one week
              </p>
            </div>
            <Switch
              id="auto-backup"
              checked={backupSettings.autoBackupEnabled || false}
              onCheckedChange={handleAutoBackupToggle}
            />
          </div>

          {/* Backup Status */}
          {backupSettings.lastBackupStatus && (
            <Alert variant={backupSettings.lastBackupStatus === 'failed' ? 'destructive' : 'default'}>
              {backupSettings.lastBackupStatus === 'failed' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription>
                {backupSettings.lastBackupStatus === 'failed' 
                  ? 'Last auto-backup failed. You will receive a notification when backup fails.'
                  : 'Auto-backups are working correctly'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          {isWeb ? (
            <>Export your data as an XML file to save it on your computer. Import a backup file to restore your data.</>
          ) : (
            <>
              <strong>Manual Export:</strong> Creates a new backup and lets you save it anywhere.<br/>
              <strong>Export Latest Auto-Backup:</strong> Share your most recent daily auto-backup to Google Drive or other locations.<br/>
              Auto-backups are kept for 7 days in your device's Documents folder.
            </>
          )}
        </p>
      </div>

      {/* Export & Import Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button onClick={handleExport} disabled={exporting} size="lg" className="h-24">
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              Creating Backup...
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6" />
              <span>Export Backup</span>
            </div>
          )}
        </Button>

        <Button onClick={handleImport} disabled={importing} variant="outline" size="lg" className="h-24">
          {importing ? (
            <>
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              Restoring...
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Download className="h-6 w-6" />
              <span>Import Backup</span>
            </div>
          )}
        </Button>
      </div>

      {/* Export Latest Auto-Backup (Mobile Only) */}
      {!isWeb && backupSettings.autoBackupEnabled && backups.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3">
          <div>
            <Label className="text-base font-semibold">Quick Access</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Export your most recent auto-backup ({formatDate(backups[0].created)})
            </p>
          </div>
          <Button 
            onClick={handleExportLatest} 
            disabled={exportingLatest}
            variant="secondary"
            className="w-full"
          >
            {exportingLatest ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting Latest Backup...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Export Latest Auto-Backup
              </>
            )}
          </Button>
        </div>
      )}

      {/* Last Backup Date */}
      {backupSettings.lastBackupDate && (
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Last backup: {formatDate(new Date(backupSettings.lastBackupDate))}
          </p>
        </div>
      )}

      {/* Recent Backups (Mobile Only) */}
      {!isWeb && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label>Recent Local Backups</Label>
            <Button variant="outline" size="sm" onClick={loadBackups} disabled={loadingBackups}>
              {loadingBackups ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </Button>
          </div>

          <ScrollArea className="h-[200px] rounded-md border">
            <div className="p-4 space-y-2">
              {backups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No backups found in Documents folder
                </p>
              ) : (
                backups.map((backup, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{backup.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(backup.created)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <p className="text-xs text-muted-foreground">
            Backups are automatically created daily and stored here for 7 days. Use "Export Latest Auto-Backup" above for quick access.
          </p>
        </div>
      )}
      
      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from Cloud?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all your current data with the latest backup from Google Drive. 
              This action cannot be undone. The app will reload after restore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreFromCloud}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
            <AlertDialogDescription>
              Cloud sync will be disabled. Your data will remain on your device and in Google Drive, 
              but automatic syncing will stop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
