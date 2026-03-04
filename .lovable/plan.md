

# Add Default Hourly Rate to Desktop Settings

The `DesktopSettingsView` is missing the "Default Hourly Rate" input that exists in the mobile `SettingsDialog`. The `Settings` type already has `defaultHourlyRate: number`, but this component never displays or edits it.

## Changes — `src/components/DesktopSettingsView.tsx`

1. Add `defaultHourlyRate` state initialized from `settings.defaultHourlyRate`
2. Sync it in the `useEffect`
3. Include it in `handleSave` → `defaultHourlyRate: parseFloat(defaultHourlyRate) || 75`
4. Add a new Card in the grid (first position, before Notifications) with a "Default Hourly Rate" input field
5. Change grid to `grid-cols-2` layout — the new card fits naturally into the existing 2-column grid

