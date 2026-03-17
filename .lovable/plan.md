

# Add "Add Key" and "All Keys Lost" Default Rates to Settings

## What
Add two new default rate fields — **"Default Add Key Rate"** and **"Default All Keys Lost Rate"** — to both the mobile settings dialog and the desktop settings view. These work identically to the existing "Default Cloning Rate" and "Default Programming Rate" fields: optional dollar amounts that can be applied per session.

## Changes

### 1. Update `Settings` type (`src/types/index.ts`)
Add two new optional fields:
- `defaultAddKeyRate?: number`
- `defaultAllKeysLostRate?: number`

### 2. Update mobile settings (`src/components/SettingsDialog.tsx`)
- Add state variables `addKeyRate` and `allKeysLostRate` (same pattern as `cloningRate`/`programmingRate`)
- Add `useEffect` sync from `settings` prop
- Add two input fields after the Programming Rate input, with labels "Default Add Key Rate ($)" and "Default All Keys Lost Rate ($)" and placeholder "Leave empty if not used"
- Include both in `handleSaveSettings`

### 3. Update desktop settings (`src/components/DesktopSettingsView.tsx`)
- Add state variables and `useEffect` sync
- Add two new Card blocks in the grid (same layout as Cloning/Programming cards)
- Include both in `handleSave`

### 4. Files changed
- `src/types/index.ts`
- `src/components/SettingsDialog.tsx`
- `src/components/DesktopSettingsView.tsx`

