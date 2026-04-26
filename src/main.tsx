import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { autoBackupService } from "./services/autoBackupService";

// Import PWA Elements for Capacitor Camera to work in web/PWA
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Define the PWA elements before app renders
defineCustomElements(window);

const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com"));

const isInIframe = (() => {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
})();

const clearServiceWorkersAndCaches = async () => {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
};

// Keep Lovable preview/iframe OAuth routes off stale PWA caches.
if (typeof window !== "undefined" && (isPreviewHost || isInIframe)) {
  (async () => {
    try {
      await clearServiceWorkersAndCaches();
    } catch (e) {
      console.warn("[sw-reset] failed", e);
    }
  })();
}

// Initialize auto-backup service on app start
autoBackupService.initialize().catch(console.error);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
