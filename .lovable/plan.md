

# Payment Methods for Client Portal

## Overview

Upgrade the single payment link to support multiple payment options (Zelle, Cash App, Venmo, etc.) plus Stripe card payments, giving clients a clean selection when paying for billed work.

## Phase 1: Multiple Payment Links

### Settings Changes

**`src/types/index.ts`** — Replace single `paymentLink`/`paymentLabel` with an array:
```typescript
paymentMethods?: { label: string; url: string; icon?: string }[];
// Keep old fields for backward compatibility during migration
```

**`src/components/DesktopSettingsView.tsx`** and **`src/components/SettingsDialog.tsx`** — Replace single payment input with a dynamic list:
- "Add Payment Method" button
- Each row: Label input + URL input + delete button
- Pre-filled suggestions: Zelle, Cash App, Venmo

### Portal Data Pipeline

**`src/lib/clientPortalUtils.ts`**:
- Update `ClientCostSummary` to include `paymentMethods` array
- Update slim/inflate to encode the array
- Update `syncPortalToCloud` to pass methods through
- Update HTML portal generator

### Portal UI

**`src/components/ClientCostBreakdown.tsx`** — Show payment buttons for each method:
- Stack of branded buttons (green Zelle, blue Venmo, etc.)
- Each opens the respective payment URL

## Phase 2: Stripe Card Payments

This requires enabling the Stripe integration first. After enabling:
- Add a "Pay with Card" button in the portal
- Create an edge function to generate a Stripe Checkout session for the billed amount
- Redirect client to Stripe Checkout, then back to portal on success

## Recommended Approach

Start with Phase 1 (multiple payment links) since it works immediately with no external setup. Then enable Stripe for card payments as a follow-up.

## Files to Change (Phase 1)

1. `src/types/index.ts` — Add `paymentMethods` array type
2. `src/components/DesktopSettingsView.tsx` — Multi-method settings UI
3. `src/components/SettingsDialog.tsx` — Multi-method settings UI (mobile)
4. `src/lib/clientPortalUtils.ts` — Data pipeline + HTML generator
5. `src/components/ClientCostBreakdown.tsx` — Multiple payment buttons
6. All sync call sites — Pass new payment methods data

