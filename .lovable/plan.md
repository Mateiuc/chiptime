# Offline voice scheduling (mobile, Android Chrome)

Fully on-device. No edge function, no Lovable AI, no STT/LLM, no network. Uses browser Web Speech API + `chrono-node` + `fuse.js`.

## Dependencies
- `chrono-node` — natural-language date/time
- `fuse.js` — fuzzy matching

Both small, browser-safe, no native deps.

## New file — `src/components/VoiceScheduleButton.tsx`
Header: `// Developed by Chip`. All voice logic lives here.

**Props**
```ts
{
  context: {
    clients: { id: string; name: string }[];
    vehicles: { id: string; clientId: string; make?: string; model?: string; year?: number; color?: string }[];
    workers: { id: string; firstName: string }[];
  };
  onParsed: (draft: {
    clientId: string | null;
    vehicleId: string | null;
    assignedTo: string | null;
    date: string | null;          // "YYYY-MM-DD" local
    time: string | null;          // "HH:mm" 24h local
    requestedWork: string;
  }, transcript: string) => void;
}
```

**UI** — round mic icon `Button`. While listening: fixed-position inline div overlay with "Listening…", live interim transcript, and a Stop button. No new shadcn component.

**Recording** — `window.SpeechRecognition || window.webkitSpeechRecognition`:
- `lang = "en-US"`, `interimResults = true`, `continuous = true`.
- Stop on the explicit Stop button OR after ~1.5s silence (timer reset on every `onresult`; auto-stop on expiry).
- No `MediaRecorder`, no audio blob, no upload.
- API undefined → hide button + toast `"Voice input needs Chrome."`.
- Mic denial / `no-speech` → toast + close overlay.
- Minimal local `interface` declared inside the file (no extra `@types`).

**Parsing pipeline** — synchronous, on final transcript, in this exact order, each step recording the matched span:

1. **Date + time** — `chrono.parse(transcript, new Date())[0]`. Build `date` / `time` from local components (`getFullYear`, `getMonth()+1`, `getDate`, `getHours`, `getMinutes`, zero-padded). Never `toISOString()`. Only set `time` if `match.start.isCertain('hour')`; date-only phrases like "next Monday" → `time = null`. No match → both `null`. Remember `match.text`.
2. **Client** — Fuse over `context.clients` keyed on `name`, `threshold: 0.4`. Top hit → `clientId` + matched name. Else `null`.
3. **Vehicle** — only if a client matched: Fuse over that client's vehicles keyed on `make`/`model`/`color` (and stringified `year` if included), `threshold: 0.4`. Top hit → `vehicleId` + matched token. Else `null`.
4. **Worker** — Fuse over `context.workers` keyed on `firstName`, `threshold: 0.4`. Top hit → `assignedTo` (worker id) + matched name. Else `null`.
5. **Requested work** — start from raw transcript, strip only the spans matched in 1–4 (case-insensitive), collapse leftover commas/whitespace and dangling fillers (`for`, `on`, `at`). Empty → fall back to full raw transcript.

Call `onParsed(draft, transcript)`. Notes field is never auto-filled.

## Edit — `src/components/ScheduleView.tsx`
- Import `useIsMobile` and `VoiceScheduleButton`.
- Render mic next to existing **+ Add** button, mobile-only (`useIsMobile` guard or `md:hidden` wrapper). Desktop unchanged.
- Build `context` from existing `clients`, `vehicles`, and `useWorkers().allWorkers()` — ids + identifying fields only.
- Add `voiceDraft` and `voiceTranscript` state.
- In `onParsed(draft, transcript)`: map draft → synthetic `initial` for `ScheduleEntryDialog` in "new" mode (`date`/`time` strings go directly into the existing `dateStr`/`timeStr` inputs; `clientId`/`vehicleId`/`assignedTo`/`requestedWork` pass straight through). Nulls leave dropdowns empty / worker on "Anyone". Pass `aiTranscript={transcript}`. Open dialog.

Since the existing dialog rebuilds its state from `initial?.scheduledAt` (a Date), the synthetic initial will pass a real `Date` constructed from `${date}T${time||'09:00'}:00` so the existing pre-fill path is reused unchanged. If only `date` is set without time, `timeStr` will still come out empty per the existing logic (we'll wire it so the synthetic Date is built only when both exist; date-only goes through a separate field on initial). Simplest reliable approach: extend the pre-fill by accepting `initial.scheduledAt` + a separate `__noTime` flag isn't worth it — instead, pass `scheduledAt` only when time is known, and when only date is known set `scheduledAt` to noon then clear `timeStr` after mount via the new path. Final implementation will build the synthetic initial so the existing `useEffect` in the dialog renders the correct date and leaves time blank for date-only phrases.

## Edit — `src/components/ScheduleEntryDialog.tsx`
- Add optional prop `aiTranscript?: string`.
- When present, render an amber banner at the very top of the scrollable form body:
  > **Voice draft — review before saving**
  
  with the raw transcript inside a `Collapsible` labeled "Show what I heard ▾". Cosmetic only — no other logic changes. Pre-fill keeps using the existing `initial` flow.

## Constraints (unchanged)
- Desktop: untouched.
- Types, storage, sync: unchanged. Output is a normal `ScheduleEntry` on Save.
- No voice editing of existing entries, no voice in other tabs, no auto-save without confirmation.
- Modular: all voice logic in `VoiceScheduleButton.tsx`; `ScheduleView` only wires it; dialog only gets the cosmetic banner.
