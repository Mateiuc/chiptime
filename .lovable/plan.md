The mic button exists in code, but it is hidden behind the mobile-width check and is not appearing in the current mobile-framed preview.

Plan:
1. Update the mobile Schedule header so the offline voice mic button is always rendered in the mobile Schedule component, directly next to the Add button.
2. Keep it out of the desktop Schedule page because desktop uses `DesktopScheduleView`, not this mobile `ScheduleView`.
3. Keep the existing Chrome-only behavior: if speech recognition is unavailable, the mic button remains visible and shows the existing warning when tapped.
4. Do not change sizes/layout beyond adding the mic button in the circled header area.