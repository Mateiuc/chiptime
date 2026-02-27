

# Desktop: Fix Mobile-Style Dialogs and Simplify Settings

## Changes

### 1. `src/components/DesktopSettingsView.tsx` — Strip to essentials only
- Remove General card (hourly rate), OCR Provider card, Data Management card (export/import XML)
- Keep only: Popup Notifications toggle + Backup & Restore (BackupView with cloud sync)
- Remove unused imports/state: `hourlyRate`, `googleApiKey`, `grokApiKey`, `ocrSpaceApiKey`, `ocrProvider`, `fileInputRef`, `indexedDB`, `exportToXML`, `downloadXML`, `parseXMLFile`, `validateXMLData`, `RadioGroup`, `RadioGroupItem`, `Download`, `Upload`
- Simplify `handleSave` to only save `notificationsEnabled`, preserving all other settings

### 2. `src/pages/DesktopDashboard.tsx` — Hide client sidebar when not on tasks view
- Wrap the `<aside>` (lines 479-518) with `{desktopView === 'tasks' && (...)}`
- Clients and Settings views then use the full width

### 3. `src/components/EditTaskDialog.tsx` — Desktop-friendly layout
- The dialog currently uses fullscreen mobile styling: `w-full h-full m-0 p-0 rounded-none max-w-none max-h-none`
- Detect desktop via `useIsMobile()` hook
- On desktop: use `max-w-4xl max-h-[85vh]` with proper padding and rounded corners instead of fullscreen
- On desktop: use a multi-column layout for periods (start/end side by side with more space)
- Footer buttons: display text normally (not stacked "Delete\nCar") on desktop

### Files changed
- `src/components/DesktopSettingsView.tsx` — strip to notifications + cloud sync only
- `src/pages/DesktopDashboard.tsx` — hide sidebar on non-tasks views
- `src/components/EditTaskDialog.tsx` — responsive dialog sizing for desktop

