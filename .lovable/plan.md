## Add session start/stop date+time to each session row (desktop)

In `src/pages/DesktopDashboard.tsx`, within the sessions list (around line 1689, the header row inside each `Session N` block), append a small muted time range next to the duration. This shows for sessions in every task status (Active, Completed, Billed, Paid) since the same renderer is used for all of them.

### Display
- Format: `Mar 30, 10:23 AM → 11:18 AM` when start/stop are the same day, or `Mar 30, 10:23 AM → Mar 31, 1:05 AM` when they differ.
- Uses minute-precision per project rule (HH:MM AM/PM, no seconds).
- If `session.endTime` is missing (still running), show `Mar 30, 10:23 AM → …`.
- Rendered as `<span className="text-[11px] text-muted-foreground font-mono">` so it sits inline after the duration without disrupting the existing badges/description.

### Technical
- Add a small inline helper `formatSessionRange(start, end)` near the render (or in `src/lib/formatTime.ts`) using `Intl.DateTimeFormat` with `month: 'short', day: 'numeric'` and `hour: 'numeric', minute: '2-digit', hour12: true`.
- Insert the new span in the flex row right after the `formatDuration(sDur)` span (line ~1691), before the description.
- No data-model, billing, or mobile changes.