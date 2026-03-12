import { googleDriveService, SyncResult } from './googleDriveService';
import { capacitorStorage } from '@/lib/capacitorStorage';
import { exportToXML, parseXMLString } from '@/lib/xmlConverter';
import { CloudSyncSettings } from '@/types';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface CloudSyncState {
  status: SyncStatus;
  lastSyncDate?: Date;
  lastError?: string;
  isConnected: boolean;
  userEmail?: string;
}

type SyncEventListener = (state: CloudSyncState) => void;

class CloudSyncService {
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private state: CloudSyncState = {
    status: 'idle',
    isConnected: false,
  };
  private listeners: Set<SyncEventListener> = new Set();
  private isInitialized = false;
  
  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    // Immediately send current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }
  
  private updateState(updates: Partial<CloudSyncState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }
  
  getState(): CloudSyncState {
    return { ...this.state };
  }
  
  async initialize(settings: CloudSyncSettings, clientId: string): Promise<void> {
    if (this.isInitialized || !settings.enabled || !clientId) {
      return;
    }
    
    try {
      await googleDriveService.initialize(clientId);
      
      // Restore access token if available
      if (settings.accessToken) {
        googleDriveService.setAccessToken(settings.accessToken);
        this.updateState({
          isConnected: true,
          userEmail: settings.userEmail,
          status: 'idle',
        });
        
        // Start sync interval
        this.startSyncInterval(settings.syncIntervalMinutes);
      }
      
      this.isInitialized = true;
    } catch (error: any) {
      console.error('Failed to initialize cloud sync:', error);
      this.updateState({ status: 'error', lastError: error.message });
    }
  }
  
  async connect(clientId: string): Promise<{ success: boolean; email?: string; error?: string }> {
    try {
      await googleDriveService.initialize(clientId);
      const result = await googleDriveService.signIn();
      
      this.updateState({
        isConnected: true,
        userEmail: result.email,
        status: 'idle',
      });
      
      return { success: true, email: result.email };
    } catch (error: any) {
      console.error('Google Drive connection error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async disconnect(): Promise<void> {
    await googleDriveService.signOut();
    this.stopSyncInterval();
    this.updateState({
      isConnected: false,
      userEmail: undefined,
      status: 'idle',
      lastError: undefined,
    });
  }
  
  startSyncInterval(intervalMinutes: number): void {
    this.stopSyncInterval();
    
    if (intervalMinutes <= 0) return;
    
    const intervalMs = intervalMinutes * 60 * 1000;
    this.syncInterval = setInterval(() => {
      this.syncNow();
    }, intervalMs);
  }
  
  stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  /**
   * Debounced sync - waits 5 seconds after last call before syncing
   * Used for "sync on data change" feature
   */
  debouncedSync(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    
    this.syncDebounceTimer = setTimeout(() => {
      this.syncNow();
    }, 5000);
  }
  
  async syncNow(): Promise<SyncResult> {
    if (!googleDriveService.isSignedIn()) {
      return { success: false, error: 'Not connected to Google Drive' };
    }
    
    if (this.state.status === 'syncing') {
      return { success: false, error: 'Sync already in progress' };
    }
    
    this.updateState({ status: 'syncing' });
    
    try {
      // Export current data
      const data = await capacitorStorage.exportAllData();
      const xmlContent = exportToXML(data);
      
      // Upload to Google Drive
      const result = await googleDriveService.uploadBackup(xmlContent);
      
      if (result.success) {
        const now = new Date();
        this.updateState({
          status: 'success',
          lastSyncDate: now,
          lastError: undefined,
        });
        
        // Update settings with last sync info
        const settings = await capacitorStorage.getSettings();
        await capacitorStorage.setSettings({
          ...settings,
          cloudSync: {
            ...settings.cloudSync!,
            lastSyncDate: now.toISOString(),
            lastSyncStatus: 'success',
          },
        });
        
        return { success: true, fileId: result.fileId };
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Sync failed:', error);
      this.updateState({
        status: 'error',
        lastError: error.message,
      });
      
      // Update settings with error info
      const settings = await capacitorStorage.getSettings();
      await capacitorStorage.setSettings({
        ...settings,
        cloudSync: {
          ...settings.cloudSync!,
          lastSyncStatus: 'failed',
        },
      });
      
      return { success: false, error: error.message };
    }
  }
  
  async restoreFromCloud(fileId?: string): Promise<{ success: boolean; error?: string }> {
    if (!googleDriveService.isSignedIn()) {
      return { success: false, error: 'Not connected to Google Drive' };
    }
    
    try {
      this.updateState({ status: 'syncing' });
      
      let content: string | null = null;
      
      if (fileId) {
        content = await googleDriveService.downloadBackup(fileId);
      } else {
        const latest = await googleDriveService.getLatestBackup();
        content = latest?.content || null;
      }
      
      if (!content) {
        throw new Error('No backup found to restore');
      }
      
      // Parse and import the backup
      const data = await parseXMLString(content);
      await capacitorStorage.importAllData(data);
      
      this.updateState({ status: 'success' });
      
      return { success: true };
    } catch (error: any) {
      console.error('Restore failed:', error);
      this.updateState({
        status: 'error',
        lastError: error.message,
      });
      return { success: false, error: error.message };
    }
  }
  
  async getCloudBackups() {
    return googleDriveService.listBackups();
  }
}

export const cloudSyncService = new CloudSyncService();
