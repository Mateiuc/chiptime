export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  hourlyRate?: number;
  cloningRate?: number;
  accessCode?: string;
  portalId?: string;
  createdAt: Date;
}

export interface Vehicle {
  id: string;
  clientId: string;
  vin: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
}

export interface Part {
  name: string;
  quantity: number;
  price: number;
  description?: string;
}

export interface SessionPhoto {
  id: string;
  filePath?: string;      // Path to photo file in filesystem
  base64?: string;        // Deprecated: only used for migration from old format
  cloudUrl?: string;      // Public URL of photo in cloud storage
  capturedAt: Date;
  sessionNumber: number;
}

export interface WorkPeriod {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // seconds
}

export interface WorkSession {
  id: string;
  createdAt: Date;
  completedAt?: Date;
  description?: string;
  periods: WorkPeriod[];
  parts: Part[];
  photos?: SessionPhoto[];
  chargeMinimumHour?: boolean; // Bill minimum 1 hour for this session
  isCloning?: boolean; // Apply cloning rate to this session
}

export type TaskStatus = 'pending' | 'in-progress' | 'paused' | 'completed' | 'billed' | 'paid';

export interface Task {
  id: string;
  clientId: string;
  vehicleId: string;
  customerName: string;
  carVin: string;
  status: TaskStatus;
  totalTime: number; // seconds
  needsFollowUp: boolean;
  sessions: WorkSession[];
  createdAt: Date;
  startTime?: Date;
  activeSessionId?: string; // Track which session is currently being worked on
  chargeMinimumHour?: boolean; // @deprecated - use session.chargeMinimumHour instead
}

export interface BackupSettings {
  lastBackupDate?: string;
  autoBackupEnabled?: boolean;
  lastBackupStatus?: 'success' | 'failed';
}

export interface CloudSyncSettings {
  enabled: boolean;
  provider: 'google-drive' | 'none';
  syncIntervalMinutes: number; // 5, 15, 30, 60
  lastSyncDate?: string;
  lastSyncStatus?: 'success' | 'failed' | 'syncing';
  autoSyncOnChange: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
  userEmail?: string;
}

export interface Settings {
  defaultHourlyRate: number;
  defaultCloningRate?: number;
  googleApiKey?: string;
  grokApiKey?: string;
  ocrSpaceApiKey?: string;
  ocrProvider?: 'gemini' | 'grok' | 'ocrspace' | 'tesseract';
  backup?: BackupSettings;
  cloudSync?: CloudSyncSettings;
  notificationsEnabled?: boolean; // default true - controls popup notifications
}
