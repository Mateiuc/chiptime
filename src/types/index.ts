export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  companyName?: string;
  itin?: string;
  notes?: string;
  hourlyRate?: number;
  cloningRate?: number;
  programmingRate?: number;
  addKeyRate?: number;
  allKeysLostRate?: number;
  accessCode?: string;
  prepaidAmount?: number;
  portalId?: string;
  createdAt: Date;
  // Per-client portal branding (overrides Settings defaults)
  portalLogoUrl?: string;
  portalBgColor?: string;
  portalBusinessName?: string;
  portalBgImageUrl?: string;   // background image for portal body
}

export interface Vehicle {
  id: string;
  clientId: string;
  vin: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  diagnosticPdfUrl?: string;
  diagnosticPdfPath?: string; // Storage path in private bucket (re-sign on demand)
  prepaidAmount?: number;
  // Per-vehicle labor discount — applied to each task's labor for this vehicle.
  // Parts and deposit are not affected. Locked (billed) tasks are not re-discounted.
  discountType?: 'fixed' | 'percent';
  discountValue?: number; // dollars if 'fixed', 0-100 if 'percent'
}

export interface Part {
  name: string;
  quantity: number;
  price: number;
  description?: string;
  providedByClient?: boolean; // true = client brought the part, excluded from revenue
  createdBy?: string; // user_id of the worker who added this line item
}

export interface SessionJob {
  id: string;
  name: string;
  description?: string;
  price: number;
  createdBy?: string;
}

export interface SessionPhoto {
  id: string;
  filePath?: string;      // Path to photo file in filesystem
  base64?: string;        // Deprecated: only used for migration from old format
  cloudPath?: string;     // Storage path in private bucket (canonical reference)
  cloudUrl?: string;      // Last-known signed URL (short-lived; refresh via sign-photo-urls)
  capturedAt: Date;
  sessionNumber: number;
}

export interface WorkPeriod {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // seconds
  chargeMinimumHour?: boolean; // charge this period as minimum 1 hour if under 60min
  createdBy?: string; // user_id of the worker who ran this timer interval
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
  isProgramming?: boolean; // Apply programming rate to this session
  isAddKey?: boolean; // Apply add key rate to this session
  isAllKeysLost?: boolean; // Apply all keys lost rate to this session
  extraCharge?: number; // Manual $ amount added to services bucket, not time-based
  createdBy?: string; // user_id of the worker who started this session
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
  
  importedSalary?: number; // Exact dollar amount from XLS "rel. Salary" column — locks task total
  paidAt?: Date;           // Timestamp when task was marked as paid
  /**
   * Ledger entry written when status flips to 'paid'. Records how much of
   * the task's total was paid out of the vehicle deposit and the client
   * deposit. Original `vehicle.prepaidAmount` / `client.prepaidAmount` are
   * NEVER mutated — remaining deposit is derived (see `lib/deposit.ts`).
   * Cleared when the task is un-marked paid.
   */
  depositApplied?: { vehicle: number; client: number; at: Date };
  diagnosticPdfUrl?: string; // Last-known signed URL (may expire)
  diagnosticPdfPath?: string; // Storage path in private bucket (canonical)
  createdBy?: string; // user_id of the worker who created this task
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

/**
 * A scheduled / pending job in the workshop pipeline.
 * Workers add these to plan upcoming work. When ready, hitting "Start"
 * converts the entry into a real Task and begins the timer.
 */
export interface ScheduleEntry {
  id: string;
  clientId: string;       // existing client (required)
  vehicleId: string;      // existing vehicle (required)
  requestedWork: string;  // what the client asked for
  scheduledAt?: Date;     // optional date/time; undefined = unscheduled
  assignedTo?: string;    // user_id of worker pinned to this job, or undefined = anyone
  notes?: string;
  status: 'scheduled' | 'started' | 'cancelled';
  startedTaskId?: string; // set when converted to a Task
  createdAt: Date;
  createdBy?: string;
}


export interface PaymentMethod {
  label: string;
  url: string;
  icon?: string; // emoji or identifier
  type?: 'link' | 'card'; // link = opens URL, card = Stripe/Square card form
}

export interface Settings {
  defaultHourlyRate: number;
  defaultCloningRate?: number;
  defaultProgrammingRate?: number;
  defaultAddKeyRate?: number;
  defaultAllKeysLostRate?: number;
  googleApiKey?: string;
  grokApiKey?: string;
  ocrSpaceApiKey?: string;
  ocrProvider?: 'gemini' | 'grok' | 'ocrspace' | 'tesseract';
  backup?: BackupSettings;
  cloudSync?: CloudSyncSettings;
  notificationsEnabled?: boolean;
  paymentLink?: string; // @deprecated - use paymentMethods instead
  paymentLabel?: string; // @deprecated - use paymentMethods instead
  paymentMethods?: PaymentMethod[];
  // Client portal branding
  portalLogoUrl?: string;       // URL or base64 of shop logo
  portalBgColor?: string;       // hex color for portal header gradient
  portalBusinessName?: string;  // shown in portal header instead of "Service Portal"
  portalBgImageUrl?: string;    // background image for portal body
}
