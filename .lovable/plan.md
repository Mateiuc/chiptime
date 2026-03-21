

# Move Diagnostic PDF Link to Vehicle Header

## What changes

Currently the "View Diagnostic Report" link is buried inside individual session blocks (line 277). Move it to the vehicle card header, right after the VIN line (after line 232), using the same emerald/green color styling.

## Technical approach

### `src/components/ClientCostBreakdown.tsx`

1. **Extract the diagnostic PDF URL at the vehicle level**: Before rendering the card, find the first session that has a `diagnosticPdfUrl` (since we already deduplicated it to only the first session per task).

2. **Add the link in the `CardHeader`** after the VIN paragraph (line 232): render a green link with the `FileText` icon, same emerald color, with a subtle hover effect.

3. **Remove the per-session diagnostic PDF block** (lines 276-288) so it no longer appears inside each session.

### Code sketch

In the vehicle card header, after the VIN:
```tsx
{v.vin && (
  <p className="text-xs text-muted-foreground font-mono mt-0.5">
    VIN: {v.vin}
  </p>
)}
{/* Diagnostic PDF link — extracted from first session */}
{diagnosticPdfUrl && (
  <a
    href={diagnosticPdfUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors mt-1"
  >
    <FileText className="h-3.5 w-3.5" />
    View Diagnostic Report
    <ExternalLink className="h-3 w-3" />
  </a>
)}
```

### File
- `src/components/ClientCostBreakdown.tsx`

