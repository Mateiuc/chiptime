import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { autoBackupService } from "./services/autoBackupService";

// Import PWA Elements for Capacitor Camera to work in web/PWA
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Define the PWA elements before app renders
defineCustomElements(window);

// Initialize auto-backup service on app start
autoBackupService.initialize().catch(console.error);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
