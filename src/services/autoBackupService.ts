import { dlog } from '@/lib/devLog';
import { BackgroundTask } from '@capawesome/capacitor-background-task';
import { Capacitor } from '@capacitor/core';
import { backupManager } from '@/lib/backupManager';
import { capacitorStorage } from '@/lib/capacitorStorage';

class AutoBackupService {
  private taskId?: string;
  private intervalId?: number;

  async initialize(): Promise<void> {
    const settings = await capacitorStorage.getSettings();
    
    if (settings.backup?.autoBackupEnabled) {
      await this.start();
    }
  }

  async start(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      // Web: Use simple interval (24 hours)
      this.startWebInterval();
    } else {
      // Mobile: Use background task
      await this.startBackgroundTask();
    }
  }

  async stop(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      this.stopWebInterval();
    } else {
      await this.stopBackgroundTask();
    }
  }

  private startWebInterval(): void {
    // Check if should backup (once per day)
    this.intervalId = window.setInterval(async () => {
      await this.performBackupCheck();
    }, 60 * 60 * 1000); // Check every hour

    // Initial check
    this.performBackupCheck();
  }

  private stopWebInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private async startBackgroundTask(): Promise<void> {
    try {
      const taskId = await BackgroundTask.beforeExit(async () => {
        await this.performBackupCheck();
        BackgroundTask.finish({ taskId });
      });
      this.taskId = taskId;
    } catch (error) {
      console.error('Failed to start background task:', error);
    }
  }

  private async stopBackgroundTask(): Promise<void> {
    if (this.taskId) {
      try {
        await BackgroundTask.finish({ taskId: this.taskId });
        this.taskId = undefined;
      } catch (error) {
        console.error('Failed to stop background task:', error);
      }
    }
  }

  private async performBackupCheck(): Promise<void> {
    try {
      const settings = await capacitorStorage.getSettings();
      
      if (!settings.backup?.autoBackupEnabled) {
        return;
      }

      const lastBackup = settings.backup.lastBackupDate 
        ? new Date(settings.backup.lastBackupDate)
        : null;

      const now = new Date();
      const shouldBackup = !lastBackup || 
        (now.getTime() - lastBackup.getTime()) > 24 * 60 * 60 * 1000;

      if (shouldBackup) {
        dlog('Performing daily auto-backup...');
        await backupManager.createAutoBackup();
      }
    } catch (error) {
      console.error('Auto-backup check failed:', error);
    }
  }
}

export const autoBackupService = new AutoBackupService();
