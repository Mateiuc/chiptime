

## Fix: Client Portal Not Responsive on PC

### Root Cause

The entire app is wrapped in a "mobile phone frame" container (`App.tsx` lines 16-17):

```text
<div className="mobile-preview-container">
  <div className="mobile-phone-frame">
    ... all routes including ClientPortal ...
  </div>
</div>
```

This frame is hardcoded to max 390px wide and 844px tall (defined in `src/index.css`). Because the Client Portal renders inside this tiny container, Tailwind's responsive breakpoints (`md:`, `lg:`) never activate -- the portal always thinks it's on a phone-sized screen.

### Solution

Render the Client Portal routes **outside** the phone frame, so they use the full browser window. The main app (Index page) keeps the phone frame as before.

### Changes

**File: `src/App.tsx`**

- Move the `/client/:clientId` and `/client-view` routes outside the `mobile-phone-frame` wrapper
- The main route (`/`) stays inside the phone frame -- no change to the main app
- Structure will become:

```text
<BrowserRouter>
  <Routes>
    {/* Portal routes - full screen, no phone frame */}
    <Route path="/client/:clientId" element={<ClientPortal />} />
    <Route path="/client-view" element={<ClientPortal />} />

    {/* Main app routes - inside phone frame */}
    <Route path="/*" element={
      <div className="mobile-preview-container">
        <div className="mobile-phone-frame">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    } />
  </Routes>
</BrowserRouter>
```

### What this fixes

- On PC/tablet: the Client Portal will use the full screen width, so `md:` and `lg:` Tailwind classes will activate (wider content, side-by-side header, 2-column vehicle grid, etc.)
- On phone: the portal naturally fills the screen as before -- no change
- The main app (Index page) keeps the phone frame exactly as it is today

### Files to modify

| File | Change |
|------|--------|
| `src/App.tsx` | Move portal routes outside the phone frame wrapper |

