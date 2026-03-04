

# Add "Cloning" Price — Per-Client and Global Default

## Summary

Add a new `cloningRate` price field:
- **Per client**: next to their hourly rate (in AddClientDialog and ManageClientsDialog edit form)
- **Global default**: in Settings (mobile SettingsDialog and DesktopSettingsView)
- **Per session flag**: a second flag icon button (like the existing min-1hr Flag) in session headers in EditTaskDialog and TaskInlineEditor, to mark a session as "Cloning"
- **Billing**: when a session is flagged as cloning, add the cloning rate to that session's cost

## Changes

### 1. Types (`src/types/index.ts`)
- Add `cloningRate?: number` to `Client` interface
- Add `isCloning?: boolean` to `WorkSession` interface
- Add `defaultCloningRate?: number` to `Settings` interface

### 2. AddClientDialog (`src/components/AddClientDialog.tsx`)
- Add `cloningRate` input field below the hourly rate field

### 3. ManageClientsDialog (`src/components/ManageClientsDialog.tsx`)
- Add `cloningRate` to the edit form data and display
- Show cloning rate in client info display
- Include in PDF generation

### 4. Settings — Mobile (`src/components/SettingsDialog.tsx`)
- Add "Default Cloning Rate ($)" input below the hourly rate input
- Save/load `defaultCloningRate` in `handleSaveSettings`

### 5. Settings — Desktop (`src/components/DesktopSettingsView.tsx`)
- Add "Default Cloning Rate" input card
- Save/load `defaultCloningRate`

### 6. EditTaskDialog (`src/components/EditTaskDialog.tsx`)
- Add a second icon button (e.g. `Copy` icon from lucide) next to the existing Flag, in both mobile and desktop session headers
- Clicking toggles `session.isCloning`
- Styled same as Flag: filled/colored when active, faded when inactive

### 7. TaskInlineEditor (`src/components/TaskInlineEditor.tsx`)
- Same second icon button per session header

### 8. Billing calculations (all files that compute labor cost)
- When `session.isCloning` is true, add the cloning rate (from client or default) to that session's cost
- Files: `TaskCard.tsx`, `SettingsDialog.tsx`, `DesktopClientsView.tsx`, `ManageClientsDialog.tsx`, `clientPortalUtils.ts`, `DesktopDashboard.tsx`

### Session header layout:
```text
Session 1  [date]  [summary]  [🚩min1hr] [📋cloning] [🗑delete]
```

