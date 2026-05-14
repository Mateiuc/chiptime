import { useState, useEffect, useCallback } from 'react';
import { cloudSyncService, CloudSyncState, SyncStatus } from '@/services/cloudSyncService';
import { googleDriveService, GoogleDriveFile } from '@/services/googleDriveService';
import { capacitorStorage } from '@/lib/capacitorStorage';
import { CloudSyncSettings } from '@/types';
import { useNotifications } from './useNotifications';

export interface UseCloudSyncResult {
  // State
  status: SyncStatus;
  isConnected: boolean;
  userEmail?: string;
  lastSyncDate?: Date;
  lastError?: string;
  settings: CloudSyncSettings | null;
  cloudBackups: GoogleDriveFile[];
  isLoading: boolean;
  
  // Actions
  connect: (clientId: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  syncNow: () => Promise<boolean>;
  restoreFromCloud: (fileId?: string) => Promise<boolean>;
  updateSettings: (updates: Partial<CloudSyncSettings>) => Promise<void>;
  loadCloudBackups: () => Promise<void>;
}

const DEFAULT_SETTINGS: CloudSyncSettings = {
  enabled: false,
  provider: 'none',
  syncIntervalMinutes: 30,
  autoSyncOnChange: false,
};

/** Delay before reloading the page after a successful Google Drive restore,
 *  giving the toast a moment to render. */
const RESTORE_RELOAD_DELAY_MS = 1500;

export function useCloudSync(): UseCloudSyncResult {
  const { toast } = useNotifications();
  const [state, setState] = useState<CloudSyncState>({
    status: 'idle',
    isConnected: false,
  });
  const [settings, setSettings] = useState<CloudSyncSettings | null>(null);
  const [cloudBackups, setCloudBackups] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const appSettings = await capacitorStorage.getSettings();
        const syncSettings = appSettings.cloudSync || DEFAULT_SETTINGS;
        setSettings(syncSettings);
        
        // Initialize service if enabled
        if (syncSettings.enabled && syncSettings.accessToken && appSettings.googleApiKey) {
          await cloudSyncService.initialize(syncSettings, appSettings.googleApiKey);
        }
      } catch (error) {
        console.error('Failed to load cloud sync settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // Subscribe to sync service state changes
  useEffect(() => {
    const unsubscribe = cloudSyncService.subscribe((newState) => {
      setState(newState);
    });
    
    return unsubscribe;
  }, []);
  
  const connect = useCallback(async (clientId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await cloudSyncService.connect(clientId);
      
      if (result.success) {
        // Save connection info
        const appSettings = await capacitorStorage.getSettings();
        const newSettings: CloudSyncSettings = {
          ...DEFAULT_SETTINGS,
          ...settings,
          enabled: true,
          provider: 'google-drive',
          userEmail: result.email,
        };
        
        await capacitorStorage.setSettings({
          ...appSettings,
          cloudSync: newSettings,
        });
        
        setSettings(newSettings);
        
        toast({
          title: 'Connected to Google Drive',
          description: `Signed in as ${result.email}`,
        });
        
        return true;
      } else {
        toast({
          title: 'Connection Failed',
          description: result.error || 'Could not connect to Google Drive',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: 'Connection Error',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [settings, toast]);
  
  const disconnect = useCallback(async (): Promise<void> => {
    try {
      await cloudSyncService.disconnect();
      
      // Clear connection info from settings
      const appSettings = await capacitorStorage.getSettings();
      const newSettings: CloudSyncSettings = {
        ...DEFAULT_SETTINGS,
      };
      
      await capacitorStorage.setSettings({
        ...appSettings,
        cloudSync: newSettings,
      });
      
      setSettings(newSettings);
      setCloudBackups([]);
      
      toast({
        title: 'Disconnected',
        description: 'Google Drive has been disconnected',
      });
    } catch (error: any) {
      toast({
        title: 'Disconnect Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast]);
  
  const syncNow = useCallback(async (): Promise<boolean> => {
    const result = await cloudSyncService.syncNow();
    
    if (result.success) {
      toast({
        title: 'Sync Complete',
        description: 'Your data has been backed up to Google Drive',
      });
    } else {
      toast({
        title: 'Sync Failed',
        description: result.error || 'Could not sync to Google Drive',
        variant: 'destructive',
      });
    }
    
    return result.success;
  }, [toast]);
  
  const restoreFromCloud = useCallback(async (fileId?: string): Promise<boolean> => {
    const result = await cloudSyncService.restoreFromCloud(fileId);
    
    if (result.success) {
      toast({
        title: 'Restore Complete',
        description: 'Your data has been restored from Google Drive. Please refresh the app.',
      });
      
      // Reload page to reflect restored data
      setTimeout(() => {
        window.location.reload();
      }, RESTORE_RELOAD_DELAY_MS);
    } else {
      toast({
        title: 'Restore Failed',
        description: result.error || 'Could not restore from Google Drive',
        variant: 'destructive',
      });
    }
    
    return result.success;
  }, [toast]);
  
  const updateSettings = useCallback(async (updates: Partial<CloudSyncSettings>): Promise<void> => {
    try {
      const appSettings = await capacitorStorage.getSettings();
      const newSettings: CloudSyncSettings = {
        ...DEFAULT_SETTINGS,
        ...settings,
        ...updates,
      };
      
      await capacitorStorage.setSettings({
        ...appSettings,
        cloudSync: newSettings,
      });
      
      setSettings(newSettings);
      
      // Update sync interval if changed
      if (updates.syncIntervalMinutes !== undefined && newSettings.enabled) {
        cloudSyncService.startSyncInterval(updates.syncIntervalMinutes);
      }
      
      // Stop interval if disabled
      if (updates.enabled === false) {
        cloudSyncService.stopSyncInterval();
      }
    } catch (error: any) {
      toast({
        title: 'Settings Error',
        description: 'Failed to update sync settings',
        variant: 'destructive',
      });
    }
  }, [settings, toast]);
  
  const loadCloudBackups = useCallback(async (): Promise<void> => {
    try {
      const backups = await cloudSyncService.getCloudBackups();
      setCloudBackups(backups);
    } catch (error) {
      console.error('Failed to load cloud backups:', error);
    }
  }, []);
  
  return {
    status: state.status,
    isConnected: state.isConnected,
    userEmail: state.userEmail,
    lastSyncDate: state.lastSyncDate,
    lastError: state.lastError,
    settings,
    cloudBackups,
    isLoading,
    connect,
    disconnect,
    syncNow,
    restoreFromCloud,
    updateSettings,
    loadCloudBackups,
  };
}
