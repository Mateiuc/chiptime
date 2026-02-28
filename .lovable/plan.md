

# Add "Collapse All / Expand All" Toggle to Edit Task Dialog

## Change — `src/components/EditTaskDialog.tsx`

### Between the header and the session list (~line 728-729)
Add a small toolbar row with a toggle button:
- "Collapse All" when any sessions are expanded → clears `expandedSessions` set
- "Expand All" when all sessions are collapsed → fills set with all session IDs
- Use `ChevronsDownUp` / `ChevronsUpDown` icons from lucide-react
- Compact: right-aligned text button, subtle styling

### Implementation
- Determine state: `const allCollapsed = expandedSessions.size === 0`
- On click: if `allCollapsed`, set all session IDs; else clear the set
- Button text: `allCollapsed ? "Expand All" : "Collapse All"`

### Files changed
- `src/components/EditTaskDialog.tsx` — add toolbar row + toggle logic

