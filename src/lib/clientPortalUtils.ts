import { Client, Vehicle, Task, TaskStatus, Part, SessionJob, PaymentMethod, Settings } from '@/types';
import { applyLaborDiscount } from '@/lib/discount';
import { computeSessionLaborDetails, computeSessionParts } from '@/lib/billing';
import { remainingClientDeposit, remainingVehicleDeposit } from '@/lib/deposit';

export const PORTAL_BASE_URL =
  (import.meta.env.VITE_PORTAL_BASE_URL as string | undefined) ||
  'https://chiptime.chipplc.one';
import { supabase } from '@/integrations/supabase/client';

export interface SessionCostDetail {
  description: string;
  date: Date;
  duration: number;
  laborCost: number;
  laborDiscount: number;
  cloningCost: number;
  programmingCost: number;
  addKeyCost: number;
  allKeysLostCost: number;
  minHourAdj: number;
  parts: Part[];
  partsCost: number;
  /** Fixed-price jobs — displayed as service line items ("Name — desc: $x"). */
  jobs?: SessionJob[];
  status: TaskStatus;
  photoUrls: string[];
  diagnosticPdfUrl?: string;
  periods: { start: Date; end: Date }[];
  imported?: boolean; // synthetic row representing an XLS-imported task total
}

export interface VehicleCostSummary {
  vehicle: Vehicle;
  sessions: SessionCostDetail[];
  totalLabor: number;
  totalParts: number;
  totalCloning: number;
  totalProgramming: number;
  totalAddKey: number;
  totalAllKeysLost: number;
  totalMinHourAdj: number;
  totalDiscount: number;
  discountType?: 'fixed' | 'percent';
  discountValue?: number;
  vehicleTotal: number;
}

export interface ClientCostSummary {
  client: Client;
  vehicles: VehicleCostSummary[];
  grandTotalLabor: number;
  grandTotalParts: number;
  grandTotalCloning: number;
  grandTotalProgramming: number;
  grandTotalAddKey: number;
  grandTotalAllKeysLost: number;
  grandTotalMinHourAdj: number;
  grandTotalDiscount: number;
  grandTotal: number;
  paymentLink?: string;
  paymentLabel?: string;
  paymentMethods?: PaymentMethod[];
  portalLogoUrl?: string;
  portalBgColor?: string;
  portalBusinessName?: string;
  portalBgImageUrl?: string;
}

// Slim wire format types for compact encoding
interface SlimPart {
  n: string;
  q: number;
  pr: number;
}

interface SlimSession {
  d: string;
  dt: number;
  dur: number;
  lc: number;
  pc: number;
  st: string;
  p: SlimPart[];
  ph?: string[];
  clc?: number;
  prc?: number;
  mha?: number;
  akc?: number;
  aklc?: number;
  dpdf?: string;
  pds?: [number, number][];
  ld?: number; // labor discount applied to this session
  imp?: 1; // imported (XLS) — flag for the portal badge
}

interface SlimVehicle {
  vin: string;
  mk?: string;
  md?: string;
  yr?: number;
  cl?: string;
  pa?: number;
  s: SlimSession[];
  tl: number;
  tp: number;
  vt: number;
  tcl?: number;
  tpr?: number;
  tmh?: number;
  tak?: number;
  takl?: number;
  td?: number; // total discount on this vehicle
  dt?: 'fixed' | 'percent';
  dv?: number;
}

interface SlimPayload {
  n: string;
  cd?: number; // client-level deposit
  v: SlimVehicle[];
  tl: number;
  tp: number;
  gt: number;
  tcl?: number;
  tpr?: number;
  tmh?: number;
  tak?: number;
  takl?: number;
  gtd?: number; // grand total discount
  pl?: string;
  plbl?: string;
  pms?: { l: string; u: string; i?: string }[];
  logo?: string;
  bgc?: string;
  biz?: string;
  bgi?: string;  // background image
}

export function generateAccessCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function calculateClientCosts(
  client: Client,
  vehicles: Vehicle[],
  tasks: Task[],
  defaultHourlyRate: number,
  defaultCloningRate?: number,
  defaultProgrammingRate?: number,
  defaultAddKeyRate?: number,
  defaultAllKeysLostRate?: number
): ClientCostSummary {
  // Build a Settings shape so computeSessionLaborDetails resolves rates
  // through the same fallback chain as every other billing surface.
  const settingsForBilling: Settings = {
    defaultHourlyRate,
    defaultCloningRate,
    defaultProgrammingRate,
    defaultAddKeyRate,
    defaultAllKeysLostRate,
  };
  const clientVehicles = vehicles.filter(v => v.clientId === client.id);
  // Surface deposits as REMAINING amounts (original minus what's been
  // consumed by paid tasks via the ledger in `lib/deposit.ts`). This way
  // every downstream consumer — bill PDFs, client portal payload, the
  // cost breakdown — automatically shows the depleted figure.
  const remClientDeposit = remainingClientDeposit(client, tasks);
  const clientForSummary = (client.prepaidAmount || 0) !== remClientDeposit
    ? { ...client, prepaidAmount: remClientDeposit }
    : client;
  
  let grandTotalLabor = 0;
  let grandTotalParts = 0;
  let grandTotalCloning = 0;
  let grandTotalProgramming = 0;
  let grandTotalAddKey = 0;
  let grandTotalAllKeysLost = 0;
  let grandTotalMinHourAdj = 0;
  let grandTotalDiscount = 0;

  const vehicleSummaries: VehicleCostSummary[] = clientVehicles.map(vehicle => {
    const vehicleTasks = tasks.filter(t => t.vehicleId === vehicle.id);
    let totalLabor = 0;
    let totalParts = 0;
    let totalCloning = 0;
    let totalProgramming = 0;
    let totalAddKey = 0;
    let totalAllKeysLost = 0;
    let totalMinHourAdj = 0;
    let totalDiscount = 0;
    let unbilledLabor = 0; // labor eligible for the per-vehicle discount
    
    const sessions: SessionCostDetail[] = [];

    vehicleTasks.forEach(task => {
      // Phase 2: imported tasks short-circuit. They contribute their
      // importedSalary as a single synthetic session row with no parts and
      // no services. The vehicle-level discount still applies (added into
      // unbilledLabor pool below). Adding parts to an imported task does
      // not change its total.
      if (task.importedSalary != null && task.importedSalary > 0) {
        const v = task.importedSalary;
        unbilledLabor += v;
        totalLabor += v;
        const lastSession = task.sessions && task.sessions.length > 0
          ? task.sessions[task.sessions.length - 1]
          : null;
        const date = lastSession?.completedAt
          || (lastSession && lastSession.periods.length > 0
              ? lastSession.periods[lastSession.periods.length - 1].endTime
              : (lastSession?.createdAt || task.createdAt));
        sessions.push({
          description: lastSession?.description || 'Imported task',
          date,
          duration: (task.sessions || []).reduce((s, ss) => s + ss.periods.reduce((p, pp) => p + pp.duration, 0), 0),
          laborCost: v,
          laborDiscount: 0,
          cloningCost: 0,
          programmingCost: 0,
          addKeyCost: 0,
          allKeysLostCost: 0,
          minHourAdj: 0,
          parts: [],
          partsCost: 0,
          status: task.status,
          photoUrls: [],
          diagnosticPdfUrl: task.diagnosticPdfPath || task.diagnosticPdfUrl,
          periods: [],
          imported: true,
        });
        return;
      }

      let diagnosticShown = false;
      task.sessions.forEach((session) => {
        const duration = session.periods.reduce((sum, p) => sum + p.duration, 0);
        const d = computeSessionLaborDetails(session, client, settingsForBilling);
        const minHourAdj = d.minHourAdj;
        const sessionCloningCost = d.cloning;
        const sessionProgrammingCost = d.programming;
        const sessionAddKeyCost = d.addKey;
        const sessionAllKeysLostCost = d.allKeysLost;
        // Do NOT ceil per-session — must accumulate raw totals into
        // unbilledLabor so the discount base matches computeVehicleTotal
        // (which sums un-ceiled per-task totals before applying the discount).
        // Per-session display value is still derived from d.total directly.
        const laborCost = d.total;
        const sessionPartsCost = computeSessionParts(session);

        const sessionDiscount = 0;
        unbilledLabor += laborCost;

        totalLabor += laborCost;
        totalParts += sessionPartsCost;
        totalCloning += sessionCloningCost;
        totalProgramming += sessionProgrammingCost;
        totalAddKey += sessionAddKeyCost;
        totalAllKeysLost += sessionAllKeysLostCost;
        totalMinHourAdj += minHourAdj;

        // Only attach diagnostic PDF to the first session of each task
        const showDiagnostic = !diagnosticShown && !!task.diagnosticPdfUrl;
        if (showDiagnostic) diagnosticShown = true;

        sessions.push({
          description: session.description || 'Work session',
          date: session.completedAt
            || (session.periods.length > 0
                ? session.periods[session.periods.length - 1].endTime
                : session.createdAt),
          duration,
          laborCost,
          laborDiscount: sessionDiscount,
          cloningCost: sessionCloningCost,
          programmingCost: sessionProgrammingCost,
          addKeyCost: sessionAddKeyCost,
          allKeysLostCost: sessionAllKeysLostCost,
          minHourAdj,
          parts: session.parts || [],
          partsCost: sessionPartsCost,
          status: task.status,
        photoUrls: (session.photos || [])
            .map(p => {
              if (p.cloudPath) return p.cloudPath;
              // Derive a storage path from a legacy public/signed cloud URL,
              // e.g. .../session-photos/<taskId>/<photoId>.jpg
              if (p.cloudUrl) {
                const m = p.cloudUrl.match(/\/session-photos\/([^?#]+)/);
                if (m) {
                  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
                }
                return p.cloudUrl;
              }
              return undefined;
            })
            .filter((u): u is string => !!u),
          diagnosticPdfUrl: showDiagnostic ? (task.diagnosticPdfPath || task.diagnosticPdfUrl) : undefined,
          periods: session.periods.map(p => ({ start: new Date(p.startTime), end: new Date(p.endTime) })),
        });
      });
    });

    // Compute the per-vehicle discount once, against total un-billed labor.
    const { discount: vehicleDiscount } = applyLaborDiscount(unbilledLabor, vehicle);
    totalDiscount = vehicleDiscount;

    grandTotalLabor += totalLabor;
    grandTotalParts += totalParts;
    grandTotalCloning += totalCloning;
    grandTotalProgramming += totalProgramming;
    grandTotalAddKey += totalAddKey;
    grandTotalAllKeysLost += totalAllKeysLost;
    grandTotalMinHourAdj += totalMinHourAdj;
    grandTotalDiscount += totalDiscount;

    const remVehicleDeposit = remainingVehicleDeposit(vehicle, vehicleTasks);
    const vehicleForSummary = (vehicle.prepaidAmount || 0) !== remVehicleDeposit
      ? { ...vehicle, prepaidAmount: remVehicleDeposit }
      : vehicle;
    return {
      vehicle: vehicleForSummary,
      sessions,
      totalLabor,
      totalParts,
      totalCloning,
      totalProgramming,
      totalAddKey,
      totalAllKeysLost,
      totalMinHourAdj,
      totalDiscount,
      discountType: vehicle.discountType,
      discountValue: vehicle.discountValue,
      vehicleTotal: Math.max(0, totalLabor - totalDiscount) + totalParts,
    };
  });

  return {
    client: clientForSummary,
    vehicles: vehicleSummaries.filter(v => v.sessions.length > 0),
    grandTotalLabor,
    grandTotalParts,
    grandTotalCloning,
    grandTotalProgramming,
    grandTotalAddKey,
    grandTotalAllKeysLost,
    grandTotalMinHourAdj,
    grandTotalDiscount,
    grandTotal: Math.max(0, grandTotalLabor - grandTotalDiscount) + grandTotalParts,
  };
}

// Slim down a ClientCostSummary to minimal wire format
function slimDown(data: ClientCostSummary): SlimPayload {
  return {
    n: data.client.name,
    cd: data.client.prepaidAmount && data.client.prepaidAmount > 0 ? Math.round(data.client.prepaidAmount * 100) / 100 : undefined,
    v: data.vehicles.map(vs => ({
      vin: vs.vehicle.vin,
      mk: vs.vehicle.make || undefined,
      md: vs.vehicle.model || undefined,
      yr: vs.vehicle.year || undefined,
      cl: vs.vehicle.color || undefined,
      pa: vs.vehicle.prepaidAmount && vs.vehicle.prepaidAmount > 0 ? Math.round(vs.vehicle.prepaidAmount * 100) / 100 : undefined,
      s: vs.sessions.map(s => ({
        d: s.description,
        dt: Math.floor(new Date(s.date).getTime() / 1000),
        dur: s.duration,
        lc: Math.round(s.laborCost * 100) / 100,
        pc: Math.round(s.partsCost * 100) / 100,
        st: s.status,
        p: s.parts.map(p => ({ n: p.name, q: p.quantity, pr: p.price })),
        ph: s.photoUrls.length > 0 ? s.photoUrls : undefined,
        clc: s.cloningCost > 0 ? Math.round(s.cloningCost * 100) / 100 : undefined,
        prc: s.programmingCost > 0 ? Math.round(s.programmingCost * 100) / 100 : undefined,
        mha: s.minHourAdj > 0 ? Math.round(s.minHourAdj * 100) / 100 : undefined,
        akc: s.addKeyCost > 0 ? Math.round(s.addKeyCost * 100) / 100 : undefined,
        aklc: s.allKeysLostCost > 0 ? Math.round(s.allKeysLostCost * 100) / 100 : undefined,
        dpdf: s.diagnosticPdfUrl || undefined,
        pds: s.periods.length > 0 ? s.periods.map(p => [Math.floor(new Date(p.start).getTime() / 1000), Math.floor(new Date(p.end).getTime() / 1000)] as [number, number]) : undefined,
        ld: s.laborDiscount > 0 ? Math.round(s.laborDiscount * 100) / 100 : undefined,
        imp: s.imported ? 1 : undefined,
      })),
      tl: Math.round(vs.totalLabor * 100) / 100,
      tp: Math.round(vs.totalParts * 100) / 100,
      vt: Math.round(vs.vehicleTotal * 100) / 100,
      tcl: vs.totalCloning > 0 ? Math.round(vs.totalCloning * 100) / 100 : undefined,
      tpr: vs.totalProgramming > 0 ? Math.round(vs.totalProgramming * 100) / 100 : undefined,
      tmh: vs.totalMinHourAdj > 0 ? Math.round(vs.totalMinHourAdj * 100) / 100 : undefined,
      tak: vs.totalAddKey > 0 ? Math.round(vs.totalAddKey * 100) / 100 : undefined,
      takl: vs.totalAllKeysLost > 0 ? Math.round(vs.totalAllKeysLost * 100) / 100 : undefined,
      td: vs.totalDiscount > 0 ? Math.round(vs.totalDiscount * 100) / 100 : undefined,
      dt: vs.discountType,
      dv: vs.discountValue,
    })),
    tl: Math.round(data.grandTotalLabor * 100) / 100,
    tp: Math.round(data.grandTotalParts * 100) / 100,
    gt: Math.round(data.grandTotal * 100) / 100,
    tcl: data.grandTotalCloning > 0 ? Math.round(data.grandTotalCloning * 100) / 100 : undefined,
    tpr: data.grandTotalProgramming > 0 ? Math.round(data.grandTotalProgramming * 100) / 100 : undefined,
    tmh: data.grandTotalMinHourAdj > 0 ? Math.round(data.grandTotalMinHourAdj * 100) / 100 : undefined,
    tak: data.grandTotalAddKey > 0 ? Math.round(data.grandTotalAddKey * 100) / 100 : undefined,
    takl: data.grandTotalAllKeysLost > 0 ? Math.round(data.grandTotalAllKeysLost * 100) / 100 : undefined,
    gtd: data.grandTotalDiscount > 0 ? Math.round(data.grandTotalDiscount * 100) / 100 : undefined,
    pl: data.paymentLink || undefined,
    plbl: data.paymentLabel || undefined,
    pms: data.paymentMethods && data.paymentMethods.length > 0
      ? data.paymentMethods.map(m => ({ l: m.label, u: m.url, i: m.icon || undefined }))
      : undefined,
    logo: data.portalLogoUrl || undefined,
    bgc: data.portalBgColor || undefined,
    biz: data.portalBusinessName || undefined,
    bgi: data.portalBgImageUrl || undefined,
  };
}

// Inflate slim payload back to ClientCostSummary
export function inflateSlimPayload(slim: SlimPayload): ClientCostSummary {
  return {
    client: { id: '', name: slim.n, prepaidAmount: slim.cd || 0, createdAt: new Date() } as Client,
    vehicles: slim.v.map(sv => ({
      vehicle: {
        id: '',
        clientId: '',
        vin: sv.vin,
        make: sv.mk,
        model: sv.md,
        year: sv.yr,
        color: sv.cl,
        prepaidAmount: sv.pa || 0,
        discountType: sv.dt,
        discountValue: sv.dv,
      } as Vehicle,
      sessions: sv.s.map(ss => ({
        description: ss.d,
        date: new Date(ss.dt * 1000),
        duration: ss.dur,
        laborCost: ss.lc,
        laborDiscount: ss.ld || 0,
        cloningCost: ss.clc || 0,
        programmingCost: ss.prc || 0,
        addKeyCost: ss.akc || 0,
        allKeysLostCost: ss.aklc || 0,
        minHourAdj: ss.mha || 0,
        parts: ss.p.map(p => ({ name: p.n, quantity: p.q, price: p.pr })),
        partsCost: ss.pc,
        status: ss.st as TaskStatus,
        photoUrls: ss.ph || [],
        diagnosticPdfUrl: ss.dpdf || undefined,
        periods: (ss.pds || []).map(([s, e]) => ({ start: new Date(s * 1000), end: new Date(e * 1000) })),
        imported: ss.imp ? true : undefined,
      })),
      totalLabor: sv.tl,
      totalParts: sv.tp,
      totalCloning: sv.tcl || 0,
      totalProgramming: sv.tpr || 0,
      totalAddKey: sv.tak || 0,
      totalAllKeysLost: sv.takl || 0,
      totalMinHourAdj: sv.tmh || 0,
      totalDiscount: sv.td || 0,
      discountType: sv.dt,
      discountValue: sv.dv,
      vehicleTotal: sv.vt,
    })),
    grandTotalLabor: slim.tl,
    grandTotalParts: slim.tp,
    grandTotalCloning: slim.tcl || 0,
    grandTotalProgramming: slim.tpr || 0,
    grandTotalAddKey: slim.tak || 0,
    grandTotalAllKeysLost: slim.takl || 0,
    grandTotalMinHourAdj: slim.tmh || 0,
    grandTotalDiscount: slim.gtd || 0,
    grandTotal: slim.gt,
    paymentLink: slim.pl || undefined,
    paymentLabel: slim.plbl || undefined,
    paymentMethods: slim.pms ? slim.pms.map(m => ({ label: m.l, url: m.u, icon: m.i })) : undefined,
    portalLogoUrl: slim.logo || undefined,
    portalBgColor: slim.bgc || undefined,
    portalBusinessName: slim.biz || undefined,
    portalBgImageUrl: slim.bgi || undefined,
  };
}

// Compress helper
async function compressToBase64(payload: string): Promise<string> {
  const blob = new Blob([payload]);
  const cs = new CompressionStream('gzip');
  const compressedStream = blob.stream().pipeThrough(cs);
  const compressedBlob = await new Response(compressedStream).blob();
  const buffer = await compressedBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

// Encode client data using slim format.
// SECURITY: We intentionally do NOT embed the access code in the hash payload.
// Anyone with the URL can decode the hash, so a hash-only PIN provides no real
// protection. PIN-gated access must use the cloud portal route (?id=...) where
// the code is checked server-side.
export async function encodeClientData(data: ClientCostSummary, _accessCode?: string): Promise<string> {
  const slim = slimDown(data);
  const payload = JSON.stringify({ s: slim });
  return compressToBase64(payload);
}

// Decode client data - handles both slim and legacy formats
export async function decodeClientData(encoded: string): Promise<{ data: ClientCostSummary; accessCode?: string }> {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes]);
  const ds = new DecompressionStream('gzip');
  const decompressedStream = blob.stream().pipeThrough(ds);
  const text = await new Response(decompressedStream).text();
  const parsed = JSON.parse(text);

  // Slim format
  if (parsed.s) {
    return { data: inflateSlimPayload(parsed.s) };
  }

  // Legacy format uses { data: ClientCostSummary, accessCode }
  return { data: parsed.data };
}

// Generate a self-contained HTML file for sharing large datasets.
// SECURITY: The access code is NEVER embedded in the file. The slim payload
// is encrypted with AES-GCM using a key derived from the access code via
// PBKDF2 (200k iters, SHA-256). The recipient must enter the correct PIN to
// decrypt — wrong PINs fail decryption and reveal nothing.
export async function generatePortalHtmlFile(data: ClientCostSummary, accessCode: string): Promise<Blob> {
  const slim = slimDown(data);
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iters = 200_000;

  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(accessCode), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(slim))
  );
  const b64 = (u8: Uint8Array) => {
    let bin = '';
    u8.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  };
  const payload = {
    v: 2,
    salt: b64(salt),
    iv: b64(iv),
    it: iters,
    ct: b64(new Uint8Array(ctBuf)),
  };
  const jsonData = JSON.stringify(payload)
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/<!--/g, '<\\!--');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Client Portal - ${data.client.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.header{background:#1e293b;border-bottom:1px solid #334155;padding:12px 16px;display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:10}
.header h1{font-size:14px;font-weight:700;color:#a78bfa}
.container{padding:16px;max-width:600px;margin:0 auto}
.pin-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:16px;text-align:center}
.pin-screen h2{font-size:18px;font-weight:700}
.pin-screen p{font-size:12px;color:#94a3b8}
.pin-input{display:flex;gap:8px}
.pin-input input{width:48px;height:48px;text-align:center;font-size:20px;font-weight:700;border:2px solid #334155;border-radius:8px;background:#1e293b;color:#e2e8f0;outline:none}
.pin-input input:focus{border-color:#a78bfa}
.btn{background:#7c3aed;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;width:100%;max-width:240px}
.btn:hover{background:#6d28d9}
.btn:disabled{opacity:0.5;cursor:not-allowed}
.error{color:#f87171;font-size:12px;font-weight:500}
.greeting{text-align:center;padding:8px 0}
.greeting h2{font-size:20px;font-weight:700}
.greeting p{font-size:12px;color:#94a3b8;margin-top:4px}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:12px}
.card-header{background:rgba(124,58,237,0.1);padding:12px 16px}
.card-header h3{font-size:14px;font-weight:700;color:#e2e8f0}
.card-header .vin{font-size:10px;color:#94a3b8;font-family:monospace;margin-top:2px}
.session{border-bottom:1px solid #334155;padding:16px}
.session:last-child{border-bottom:none}
.session-header{display:flex;justify-content:space-between;align-items:flex-start}
.session-title{font-size:13px;font-weight:600}
.session-desc{font-size:11px;color:#94a3b8;font-style:italic;margin-top:2px}
.badge{font-size:9px;padding:2px 8px;border-radius:12px;font-weight:600;background:rgba(124,58,237,0.2);color:#c4b5fd}
.meta{display:flex;gap:16px;font-size:11px;color:#94a3b8;margin-top:8px}
.meta b{color:#e2e8f0}
.extra-line{font-size:11px;color:#94a3b8;margin-top:2px;padding-left:2px}
.extra-line b{color:#e2e8f0}
.parts{margin-top:8px}
.parts-title{font-size:11px;font-weight:600;margin-bottom:4px}
table{width:100%;font-size:11px;border-collapse:collapse}
th{text-align:left;padding:4px 8px;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500}
td{padding:4px 8px}
.text-right{text-align:right}
.text-center{text-align:center}
.subtotal{background:rgba(30,41,59,0.8);padding:12px 16px;font-size:12px}
.subtotal .row{display:flex;justify-content:space-between;margin-bottom:2px}
.subtotal .row.total{font-weight:700;font-size:14px;border-top:1px solid #334155;padding-top:4px;margin-top:4px}
.grand{background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.3);border-radius:12px;padding:16px;margin-top:8px}
.grand .row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px}
.grand .row.total{font-size:18px;font-weight:700;color:#a78bfa;border-top:1px solid rgba(124,58,237,0.3);padding-top:8px;margin-top:8px}
.hidden{display:none}
</style>
</head>
<body>
<div class="header"><h1>🔧 Client Portal</h1></div>
<div class="container">
<div id="pin-screen" class="pin-screen">
<div style="font-size:40px">🔒</div>
<h2>Enter Access Code</h2>
<p>Enter the 4-digit code provided by your mechanic</p>
<div class="pin-input" id="pin-inputs"></div>
<p id="pin-error" class="error hidden"></p>
<button class="btn" id="pin-btn" disabled onclick="verifyPin()">View My Costs</button>
</div>
<div id="content" class="hidden"></div>
</div>
<script>
var E=${jsonData};
var D=null;
var pin='';
function b64d(s){var b=atob(s);var u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
async function tryDecrypt(p){
var enc=new TextEncoder();
var bk=await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveKey']);
var k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(E.salt),iterations:E.it,hash:'SHA-256'},bk,{name:'AES-GCM',length:256},false,['decrypt']);
var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(E.iv)},k,b64d(E.ct));
return JSON.parse(new TextDecoder().decode(pt));
}
function init(){
var pi=document.getElementById('pin-inputs');
for(var i=0;i<4;i++){
var inp=document.createElement('input');
inp.type='tel';inp.maxLength=1;inp.dataset.idx=i;
inp.addEventListener('input',function(e){
var v=e.target.value.replace(/\\D/g,'');
e.target.value=v;
var idx=parseInt(e.target.dataset.idx);
if(v&&idx<3)pi.children[idx+1].focus();
updatePin();
});
inp.addEventListener('keydown',function(e){
if(e.key==='Backspace'&&!e.target.value){
var idx=parseInt(e.target.dataset.idx);
if(idx>0)pi.children[idx-1].focus();
}
});
pi.appendChild(inp);
}
pi.children[0].focus();
}
function updatePin(){
var pi=document.getElementById('pin-inputs');
pin='';
for(var i=0;i<4;i++)pin+=pi.children[i].value;
document.getElementById('pin-btn').disabled=pin.length<4;
}
function pinFail(){
document.getElementById('pin-error').textContent='Incorrect code. Please try again.';
document.getElementById('pin-error').classList.remove('hidden');
var pi=document.getElementById('pin-inputs');
for(var i=0;i<4;i++)pi.children[i].value='';
pi.children[0].focus();
pin='';
document.getElementById('pin-btn').disabled=true;
}
function verifyPin(){
document.getElementById('pin-btn').disabled=true;
// Guard against malformed encrypted payloads — would otherwise hang the screen.
if(!E||!E.salt||!E.iv||!E.ct){pinFail();return}
try{
tryDecrypt(pin).then(function(s){
D={s:s};
document.getElementById('pin-screen').classList.add('hidden');
renderContent();
}).catch(function(){pinFail()});
}catch(_e){pinFail()}
}
function fmt(n){return'$'+n.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')}
function fmtDur(s){var tm=Math.round(s/60);var h=Math.floor(tm/60);var m=tm%60;return h+'h '+m+'m'}
function fmtDate(ts){var d=new Date(ts*1000);return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function fmtTime(ts){var d=new Date(ts*1000);return d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true})}
function renderContent(){
var s=D.s;var el=document.getElementById('content');
el.classList.remove('hidden');
var h='<div class="greeting"><h2>Hello, '+esc(s.n)+'</h2><p>Your cost breakdown</p></div>';
s.v.forEach(function(v){
var name=[v.yr,v.mk,v.md].filter(Boolean).join(' ')||'Vehicle';
h+='<div class="card"><div class="card-header"><h3>🚗 '+esc(name)+'</h3>';
if(v.vin)h+='<div class="vin">VIN: '+esc(v.vin)+'</div>';
h+='</div>';
v.s.forEach(function(ss,i){
h+='<div class="session"><div class="session-header"><div><div class="session-title">Session '+(i+1)+' — '+fmtDate(ss.dt)+'</div><div class="session-desc">"'+esc(ss.d)+'"</div></div><span class="badge">'+esc(ss.st)+'</span></div>';
var baseLab=(ss.lc+(ss.ld||0))-(ss.clc||0)-(ss.prc||0)-(ss.akc||0)-(ss.aklc||0);
h+='<div class="meta"><span>⏱ '+fmtDur(ss.dur)+'</span><span><b>💰 Labor: '+fmt(baseLab)+'</b></span></div>';
if(ss.pds&&ss.pds.length>0){ss.pds.forEach(function(pd){h+='<div class="extra-line">🕐 <span style="color:#22c55e;font-weight:600">'+fmtTime(pd[0])+'</span> → <span style="color:#ef4444;font-weight:600">'+fmtTime(pd[1])+'</span></div>'})}
if(ss.clc&&ss.clc>0)h+='<div class="extra-line">📋 Cloning: <b>'+fmt(ss.clc)+'</b></div>';
if(ss.prc&&ss.prc>0)h+='<div class="extra-line">💻 Programming: <b>'+fmt(ss.prc)+'</b></div>';
if(ss.akc&&ss.akc>0)h+='<div class="extra-line">🔑 Add Key: <b>'+fmt(ss.akc)+'</b></div>';
if(ss.aklc&&ss.aklc>0)h+='<div class="extra-line">🗝️ All Keys Lost: <b>'+fmt(ss.aklc)+'</b></div>';
if(ss.ld&&ss.ld>0)h+='<div class="extra-line" style="color:#22c55e">🏷️ Discount: <b>-'+fmt(ss.ld)+'</b></div>';
if(ss.ph&&ss.ph.length>0){
h+='<div style="display:flex;gap:8px;overflow-x:auto;padding:8px 0">';
var safePhotos=ss.ph.map(function(u){return safeUrl(u,false)}).filter(function(u){return !!u});ss.ph.forEach(function(url,pi){var safe=safeUrl(url,false);if(!safe){h+='<div style="width:80px;height:60px;background:#1e293b;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#475569;font-size:10px">no img</div>';return}h+='<img src="'+esc(safe)+'" data-photos=\\''+esc(JSON.stringify(safePhotos))+'\\' data-idx="'+pi+'" class="lb-thumb" style="width:80px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0;cursor:pointer" loading="lazy">'});
h+='</div>';
}
if(ss.dpdf){var sd=safeUrl(ss.dpdf,false);if(sd)h+='<a href="'+esc(sd)+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#34d399;font-weight:600;margin-top:4px;text-decoration:none">📄 View Diagnostic Report ↗</a>'}
if(ss.p.length>0){
h+='<div class="parts"><div class="parts-title">🔧 Parts</div><table><tr><th>Part</th><th class="text-center">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr>';
ss.p.forEach(function(p){h+='<tr><td>'+esc(p.n)+'</td><td class="text-center">'+p.q+'</td><td class="text-right">'+fmt(p.pr)+'</td><td class="text-right"><b>'+fmt(p.pr*p.q)+'</b></td></tr>'});
h+='</table><div style="text-align:right;font-size:11px;font-weight:600;margin-top:4px;padding-right:8px">Parts Total: '+fmt(ss.pc)+'</div></div>';
}
h+='<div style="text-align:right;font-size:12px;font-weight:700;border-top:1px solid #334155;padding-top:4px;margin-top:8px">Session Total: '+fmt(ss.lc+ss.pc)+'</div></div>';
});
var vBaseLab=(v.tl+(v.td||0))-(v.tcl||0)-(v.tpr||0)-(v.tak||0)-(v.takl||0);
h+='<div class="subtotal"><div class="row"><span>Vehicle Labor:</span><span><b>'+fmt(vBaseLab)+'</b></span></div>';
if(v.tcl&&v.tcl>0)h+='<div class="row"><span>Cloning:</span><span><b>'+fmt(v.tcl)+'</b></span></div>';
if(v.tpr&&v.tpr>0)h+='<div class="row"><span>Programming:</span><span><b>'+fmt(v.tpr)+'</b></span></div>';
if(v.tak&&v.tak>0)h+='<div class="row"><span>Add Key:</span><span><b>'+fmt(v.tak)+'</b></span></div>';
if(v.takl&&v.takl>0)h+='<div class="row"><span>All Keys Lost:</span><span><b>'+fmt(v.takl)+'</b></span></div>';
if(v.td&&v.td>0)h+='<div class="row" style="color:#22c55e"><span>Discount'+(v.dt==="percent"?" ("+v.dv+"%)":"")+':</span><span><b>-'+fmt(v.td)+'</b></span></div>';
h+='<div class="row"><span>Vehicle Parts:</span><span><b>'+fmt(v.tp)+'</b></span></div><div class="row total"><span>Vehicle Total:</span><span>'+fmt(v.vt)+'</span></div>';
if(v.pa&&v.pa>0){h+='<div class="row" style="color:#ef4444"><span>Deposit:</span><span><b>-'+fmt(v.pa)+'</b></span></div><div class="row total" style="color:#f97316"><span>Balance Due:</span><span>'+fmt(Math.max(0,v.vt-v.pa))+'</span></div>';}
h+='</div></div>';
});
if(s.v.length>0){
var gBaseLab=(s.tl+(s.gtd||0))-(s.tcl||0)-(s.tpr||0)-(s.tak||0)-(s.takl||0);
h+='<div class="grand"><div class="row"><span>Total Labor:</span><span><b>'+fmt(gBaseLab)+'</b></span></div>';
if(s.tcl&&s.tcl>0)h+='<div class="row"><span>Cloning:</span><span><b>'+fmt(s.tcl)+'</b></span></div>';
if(s.tpr&&s.tpr>0)h+='<div class="row"><span>Programming:</span><span><b>'+fmt(s.tpr)+'</b></span></div>';
if(s.tak&&s.tak>0)h+='<div class="row"><span>Add Key:</span><span><b>'+fmt(s.tak)+'</b></span></div>';
if(s.takl&&s.takl>0)h+='<div class="row"><span>All Keys Lost:</span><span><b>'+fmt(s.takl)+'</b></span></div>';
if(s.gtd&&s.gtd>0)h+='<div class="row" style="color:#22c55e"><span>Total Discount:</span><span><b>-'+fmt(s.gtd)+'</b></span></div>';
h+='<div class="row"><span>Total Parts:</span><span><b>'+fmt(s.tp)+'</b></span></div><div class="row total"><span>GRAND TOTAL:</span><span>'+fmt(s.gt)+'</span></div>';
var totalDep=(s.cd||0);s.v.forEach(function(vv){totalDep+=(vv.pa||0)});
if(totalDep>0){h+='<div class="row" style="color:#ef4444"><span>Total Deposits:</span><span><b>-'+fmt(totalDep)+'</b></span></div><div class="row total" style="color:#f97316"><span>BALANCE DUE:</span><span>'+fmt(Math.max(0,s.gt-totalDep))+'</span></div>';}
h+='</div>';
if(s.pms&&s.pms.length>0){h+='<div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:16px">';s.pms.forEach(function(pm){var pu=safeUrl(pm.u,true);if(!pu)return;h+='<a href="'+esc(pu)+'" target="_blank" rel="noopener" class="btn" style="display:inline-block;text-decoration:none;background:#059669;max-width:300px">'+(pm.i?esc(pm.i)+' ':'💵 ')+'Pay via '+esc(pm.l)+'</a>'});h+='</div>'}else if(s.pl){var spl=safeUrl(s.pl,true);if(spl)h+='<div style="text-align:center;margin-top:16px"><a href="'+esc(spl)+'" target="_blank" rel="noopener" class="btn" style="display:inline-block;text-decoration:none;background:#059669;max-width:300px">💵 Pay Now'+(s.plbl?' via '+esc(s.plbl):'')+'</a></div>'}
}
el.innerHTML=h;
// Wire up thumbnail clicks via delegation — no inline onclick handlers,
// so user-supplied URLs never reach an attribute that gets re-parsed.
var thumbs=el.querySelectorAll('img.lb-thumb');
for(var ti=0;ti<thumbs.length;ti++){
(function(t){t.addEventListener('click',function(){
try{var arr=JSON.parse(t.getAttribute('data-photos')||'[]');var idx=parseInt(t.getAttribute('data-idx')||'0',10);openLB(arr,isNaN(idx)?0:idx)}catch(_){/* ignore */}
})})(thumbs[ti]);
}
}
function openLB(urls,idx){
var ov=document.createElement('div');
ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:100;display:flex;align-items:center;justify-content:center';
var ci=idx;
function clear(){while(ov.firstChild)ov.removeChild(ov.firstChild)}
function render(){
clear();
var counter=document.createElement('div');
counter.style.cssText='position:absolute;top:12px;left:12px;color:rgba(255,255,255,0.7);font-size:14px';
counter.textContent=(ci+1)+'/'+urls.length;
ov.appendChild(counter);
var close=document.createElement('div');
close.style.cssText='position:absolute;top:12px;right:12px;cursor:pointer;color:rgba(255,255,255,0.7);font-size:24px';
close.textContent='\\u2715';
close.onclick=function(){ov.remove()};
ov.appendChild(close);
if(urls.length>1){
var prev=document.createElement('div');
prev.style.cssText='position:absolute;left:8px;cursor:pointer;color:rgba(255,255,255,0.7);font-size:32px';
prev.textContent='\\u2039';
prev.onclick=function(){ci=(ci-1+urls.length)%urls.length;render()};
ov.appendChild(prev);
}
var img=document.createElement('img');
img.style.cssText='max-width:90%;max-height:85vh;object-fit:contain;border-radius:8px';
img.setAttribute('src',safeUrl(urls[ci],false)||'');
ov.appendChild(img);
if(urls.length>1){
var next=document.createElement('div');
next.style.cssText='position:absolute;right:8px;cursor:pointer;color:rgba(255,255,255,0.7);font-size:32px';
next.textContent='\\u203a';
next.onclick=function(){ci=(ci+1)%urls.length;render()};
ov.appendChild(next);
}
}
render();
ov.onclick=function(e){if(e.target===ov)ov.remove()};
document.body.appendChild(ov);
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function safeUrl(u,allowExternal){if(typeof u!=='string'||!u)return '';try{var p=new URL(u);if(p.protocol!=='https:')return '';if(!allowExternal){if(!/\\.supabase\\.co$/.test(p.hostname))return ''}return p.href}catch(_e){return ''}}
init();
</script>
</body>
</html>`;

  return new Blob([html], { type: 'text/html' });
}

// ============= Cloud Portal Functions =============

/**
 * Sync a client's cost data to the cloud portal
 * Returns the portal ID (short URL ID)
 */
export async function syncPortalToCloud(
  client: Client,
  vehicles: Vehicle[],
  tasks: Task[],
  defaultHourlyRate: number,
  defaultCloningRate?: number,
  defaultProgrammingRate?: number,
  defaultAddKeyRate?: number,
  defaultAllKeysLostRate?: number,
  paymentLink?: string,
  paymentLabel?: string,
  paymentMethods?: PaymentMethod[],
  portalLogoUrl?: string,
  portalBgColor?: string,
  portalBusinessName?: string,
  portalBgImageUrl?: string,
  opts?: { regenerate?: boolean },
): Promise<{ portalId: string; accessCode: string }> {
  // IMPORTANT: do NOT generate a new PIN here on every sync. The stored PIN
  // is authoritative — the edge function preserves it across syncs and only
  // replaces it when `regenerate: true` is sent. We only pre-generate a code
  // locally when the caller explicitly asks to regenerate (so we can echo it
  // in the toast) or when no PIN exists yet (first-time create).
  const regenerate = opts?.regenerate === true;
  const accessCode = regenerate
    ? generateAccessCode()
    : (client.accessCode || undefined);

  const summary = calculateClientCosts(client, vehicles, tasks, defaultHourlyRate, defaultCloningRate, defaultProgrammingRate, defaultAddKeyRate, defaultAllKeysLostRate);
  summary.paymentLink = paymentLink;
  summary.paymentLabel = paymentLabel;
  summary.paymentMethods = paymentMethods;
  summary.portalLogoUrl = portalLogoUrl;
  summary.portalBgColor = portalBgColor;
  summary.portalBusinessName = portalBusinessName;
  summary.portalBgImageUrl = portalBgImageUrl;
  const slim = slimDown(summary);

  const { data, error } = await supabase.functions.invoke('sync-portal', {
    body: {
      clientLocalId: client.id,
      clientName: client.name,
      accessCode,
      regenerate,
      data: slim,
    },
  });

  if (error) throw error;
  // Server returns the effective (authoritative) PIN — always prefer it so
  // devices that lost the code (e.g. via app-sync stripping) get healed.
  return { portalId: data.id, accessCode: data.access_code || accessCode || '' };
}

/**
 * Regenerate a client's portal PIN. Convenience wrapper that calls
 * syncPortalToCloud with { regenerate: true }.
 */
export async function regeneratePortalPin(
  client: Client,
  vehicles: Vehicle[],
  tasks: Task[],
  defaultHourlyRate: number,
  defaultCloningRate?: number,
  defaultProgrammingRate?: number,
  defaultAddKeyRate?: number,
  defaultAllKeysLostRate?: number,
  paymentLink?: string,
  paymentLabel?: string,
  paymentMethods?: PaymentMethod[],
  portalLogoUrl?: string,
  portalBgColor?: string,
  portalBusinessName?: string,
  portalBgImageUrl?: string,
): Promise<{ portalId: string; accessCode: string }> {
  return syncPortalToCloud(
    client, vehicles, tasks,
    defaultHourlyRate, defaultCloningRate, defaultProgrammingRate,
    defaultAddKeyRate, defaultAllKeysLostRate,
    paymentLink, paymentLabel, paymentMethods,
    portalLogoUrl, portalBgColor, portalBusinessName, portalBgImageUrl,
    { regenerate: true },
  );
}

/**
 * Check if a cloud portal requires an access code.
 * Returns metadata without exposing any data.
 */
export async function checkPortalAccess(portalId: string, preview?: boolean): Promise<{
  requiresCode: boolean;
  clientName?: string;
  data?: ClientCostSummary;
  locked?: boolean;
  lockedUntil?: string | null;
}> {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
  let url = `${supabaseUrl}/functions/v1/get-portal?id=${encodeURIComponent(portalId)}`;
  if (preview) url += '&preview=1';
  const resp = await fetch(url, {
    headers: {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to fetch portal');
  }

  const result = await resp.json();

  if (result.requiresCode) {
    return {
      requiresCode: true,
      clientName: result.clientName,
      locked: !!result.locked,
      lockedUntil: result.lockedUntil ?? null,
    };
  }

  // No code required — data is included
  return {
    requiresCode: false,
    clientName: result.clientName,
    data: inflateSlimPayload(result.data),
  };
}

/**
 * Fetch portal data with access code (server-side PIN validation).
 */
export async function fetchPortalWithCode(portalId: string, code: string): Promise<{
  data: ClientCostSummary;
  clientName: string;
}> {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
  const resp = await fetch(
    `${supabaseUrl}/functions/v1/get-portal?id=${encodeURIComponent(portalId)}&code=${encodeURIComponent(code)}`,
    {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );

  if (!resp.ok) {
    const err: any = await resp.json().catch(() => ({ error: 'Request failed' }));
    const e: any = new Error(err.error || 'Invalid access code');
    e.status = resp.status;
    e.locked = !!err.locked;
    e.lockedUntil = err.lockedUntil ?? null;
    e.attemptsRemaining = typeof err.attemptsRemaining === 'number' ? err.attemptsRemaining : null;
    throw e;
  }

  const result = await resp.json();
  return {
    data: inflateSlimPayload(result.data),
    clientName: result.clientName,
  };
}

