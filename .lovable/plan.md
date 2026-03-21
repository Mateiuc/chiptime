

# Generate Complete App Structure Document (PDF)

## What to build

A detailed, printable PDF listing every named element in the app: pages, routes, views, dialogs, components, actions/buttons, settings fields, data types, services, hooks, and utilities -- all organized by category with hierarchical nesting.

## Content structure

### 1. Routes & Pages
- `/` -- Index (Mobile App, phone frame)
- `/chip` -- DesktopDashboard
- `/client-view` -- ClientPortal
- `/*` -- NotFound

### 2. Desktop Dashboard Views (5 modes)
- Tree View (hierarchical client/vehicle/task)
- Settings View (DesktopSettingsView)
- Reports View (DesktopReportsView)
- Invoices View (DesktopInvoiceView)
- Clients View (DesktopClientsView)

### 3. Mobile Settings Dialog Views (5 modes)
- Menu, Settings, Billed, Paid, Backup

### 4. All Dialogs
- AddClientDialog, AddVehicleDialog, CompleteWorkDialog, SettingsDialog, ManageClientsDialog, EditTaskDialog, EditVehicleDialog, ShareBillDialog, VinScanner

### 5. All Actions (buttons/operations) per context
- Task actions: Start, Pause, Stop, Resume, Mark Billed, Mark Paid, Delete, Edit, Print Bill, Share Bill, Take Photo, View Photos, Upload Diagnostic PDF
- Client actions: Edit, Delete, Print PDF Report, Portal PIN, Share Link, Portal Preview, Move Vehicle, Import Previous Work
- Vehicle actions: Edit, Delete, Move to Client

### 6. Settings Fields (all named)
- Default Hourly Rate, Default Cloning Rate, Default Programming Rate, Default Add Key Rate, Default All Keys Lost Rate
- OCR Provider (Gemini/Grok/OCR.space/Tesseract), Google API Key, Grok API Key, OCR Space API Key
- Notifications toggle, Payment Link, Payment Label
- Backup & Restore, Cloud Sync (Google Drive)

### 7. Data Model (types)
- Client, Vehicle, Task, WorkSession, WorkPeriod, Part, SessionPhoto
- TaskStatus enum values
- Settings, BackupSettings, CloudSyncSettings

### 8. Services & Hooks
- appSyncService, autoBackupService, cloudSyncService, contactsService, googleDriveService, photoStorageService
- useStorage (useClients, useVehicles, useTasks, useSettings), useCloudSync, useNotifications, useBackupSettings

### 9. Utilities
- VIN Decoder, PDF Utils, XLS Importer, XML Converter, Photo Migration, Storage Migration, Capacitor Storage, IndexedDB

## Implementation

Single Python/ReportLab script generating a multi-page PDF at `/mnt/documents/ChipTime_Full_Structure.pdf` with section headers, bullet lists, and sub-items. Optimized for letter-size printing.

