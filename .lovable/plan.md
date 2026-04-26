# Fix: Google Sign-In Popup Disappears Immediately

## Root Cause
This project uses `vite-plugin-pwa`, which registers a service worker that caches navigation requests. The Lovable Cloud OAuth flow redirects through `/~oauth/initiate` and `/~oauth/callback`, but the service worker is intercepting these routes — returning the cached `index.html` shell instead of letting the request hit the OAuth proxy. As a result, the popup opens, gets the cached app shell back instead of the OAuth response, and closes immediately with no session set.

The Lovable docs explicitly require excluding `/~oauth` from the service worker's `navigateFallbackDenylist` for OAuth to work in PWA projects.

## Change — `vite.config.ts` (~line 47)
Add `navigateFallbackDenylist: [/^\/~oauth/]` to the `workbox` config so OAuth redirects always hit the network instead of the cached shell.

```ts
workbox: {
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
  navigateFallbackDenylist: [/^\/~oauth/],   // ← add this
  runtimeCaching: [ /* unchanged */ ],
},
```

## Notes
- No app code changes required — `Auth.tsx` and `src/integrations/lovable/index.ts` are already correct.
- After this change, users may need to do one hard refresh so the new service worker takes over from the old one.
- The existing managed Lovable Cloud Google credentials are used automatically; nothing to configure in Google Cloud Console.

## Files
- `vite.config.ts` — 1 line added
