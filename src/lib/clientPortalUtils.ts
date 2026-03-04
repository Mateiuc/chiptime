import { Client, Vehicle, Task, TaskStatus, Part } from '@/types';

export const PORTAL_BASE_URL = 'https://chiptime.chipplc.one';
import { supabase } from '@/integrations/supabase/client';

export interface SessionCostDetail {
  description: string;
  date: Date;
  duration: number;
  laborCost: number;
  cloningCost: number;
  programmingCost: number;
  minHourAdj: number;
  parts: Part[];
  partsCost: number;
  status: TaskStatus;
  photoUrls: string[];
}

export interface VehicleCostSummary {
  vehicle: Vehicle;
  sessions: SessionCostDetail[];
  totalLabor: number;
  totalParts: number;
  totalCloning: number;
  totalProgramming: number;
  totalMinHourAdj: number;
  vehicleTotal: number;
}

export interface ClientCostSummary {
  client: Client;
  vehicles: VehicleCostSummary[];
  grandTotalLabor: number;
  grandTotalParts: number;
  grandTotalCloning: number;
  grandTotalProgramming: number;
  grandTotalMinHourAdj: number;
  grandTotal: number;
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
}

interface SlimVehicle {
  vin: string;
  mk?: string;
  md?: string;
  yr?: number;
  cl?: string;
  s: SlimSession[];
  tl: number;
  tp: number;
  vt: number;
  tcl?: number;
  tpr?: number;
  tmh?: number;
}

interface SlimPayload {
  n: string;
  v: SlimVehicle[];
  tl: number;
  tp: number;
  gt: number;
  tcl?: number;
  tpr?: number;
  tmh?: number;
}

export function generateAccessCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function calculateClientCosts(
  client: Client,
  vehicles: Vehicle[],
  tasks: Task[],
  defaultHourlyRate: number,
  defaultCloningRate?: number
): ClientCostSummary {
  const hourlyRate = client.hourlyRate || defaultHourlyRate;
  const cloningRate = client.cloningRate || defaultCloningRate || 0;
  const programmingRate = client.programmingRate || 0;
  const clientVehicles = vehicles.filter(v => v.clientId === client.id);
  
  let grandTotalLabor = 0;
  let grandTotalParts = 0;
  let grandTotalCloning = 0;
  let grandTotalProgramming = 0;
  let grandTotalMinHourAdj = 0;

  const vehicleSummaries: VehicleCostSummary[] = clientVehicles.map(vehicle => {
    const vehicleTasks = tasks.filter(t => t.vehicleId === vehicle.id);
    let totalLabor = 0;
    let totalParts = 0;
    let totalCloning = 0;
    let totalProgramming = 0;
    let totalMinHourAdj = 0;
    
    const sessions: SessionCostDetail[] = [];

    vehicleTasks.forEach(task => {
      task.sessions.forEach(session => {
        const duration = session.periods.reduce((sum, p) => sum + p.duration, 0);
        const baseLaborCost = (duration / 3600) * hourlyRate;
        const minHourAdj = (session.chargeMinimumHour && duration < 3600) ? ((3600 - duration) / 3600) * hourlyRate : 0;
        const sessionCloningCost = (session.isCloning && cloningRate > 0) ? cloningRate : 0;
        const sessionProgrammingCost = (session.isProgramming && programmingRate > 0) ? programmingRate : 0;
        const laborCost = baseLaborCost + minHourAdj + sessionCloningCost + sessionProgrammingCost;
        const partsCost = (session.parts || []).reduce((sum, p) => sum + p.price * p.quantity, 0);
        
        totalLabor += laborCost;
        totalParts += partsCost;
        totalCloning += sessionCloningCost;
        totalProgramming += sessionProgrammingCost;
        totalMinHourAdj += minHourAdj;

        sessions.push({
          description: session.description || 'Work session',
          date: session.completedAt
            || (session.periods.length > 0
                ? session.periods[session.periods.length - 1].endTime
                : session.createdAt),
          duration,
          laborCost,
          cloningCost: sessionCloningCost,
          programmingCost: sessionProgrammingCost,
          minHourAdj,
          parts: session.parts || [],
          partsCost,
          status: task.status,
          photoUrls: (session.photos || [])
            .filter(p => p.cloudUrl)
            .map(p => p.cloudUrl!),
        });
      });
    });

    grandTotalLabor += totalLabor;
    grandTotalParts += totalParts;
    grandTotalCloning += totalCloning;
    grandTotalProgramming += totalProgramming;
    grandTotalMinHourAdj += totalMinHourAdj;

    return {
      vehicle,
      sessions,
      totalLabor,
      totalParts,
      totalCloning,
      totalProgramming,
      totalMinHourAdj,
      vehicleTotal: totalLabor + totalParts,
    };
  });

  return {
    client,
    vehicles: vehicleSummaries.filter(v => v.sessions.length > 0),
    grandTotalLabor,
    grandTotalParts,
    grandTotalCloning,
    grandTotalProgramming,
    grandTotalMinHourAdj,
    grandTotal: grandTotalLabor + grandTotalParts,
  };
}

// Slim down a ClientCostSummary to minimal wire format
function slimDown(data: ClientCostSummary): SlimPayload {
  return {
    n: data.client.name,
    v: data.vehicles.map(vs => ({
      vin: vs.vehicle.vin,
      mk: vs.vehicle.make || undefined,
      md: vs.vehicle.model || undefined,
      yr: vs.vehicle.year || undefined,
      cl: vs.vehicle.color || undefined,
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
      })),
      tl: Math.round(vs.totalLabor * 100) / 100,
      tp: Math.round(vs.totalParts * 100) / 100,
      vt: Math.round(vs.vehicleTotal * 100) / 100,
      tcl: vs.totalCloning > 0 ? Math.round(vs.totalCloning * 100) / 100 : undefined,
      tpr: vs.totalProgramming > 0 ? Math.round(vs.totalProgramming * 100) / 100 : undefined,
      tmh: vs.totalMinHourAdj > 0 ? Math.round(vs.totalMinHourAdj * 100) / 100 : undefined,
    })),
    tl: Math.round(data.grandTotalLabor * 100) / 100,
    tp: Math.round(data.grandTotalParts * 100) / 100,
    gt: Math.round(data.grandTotal * 100) / 100,
    tcl: data.grandTotalCloning > 0 ? Math.round(data.grandTotalCloning * 100) / 100 : undefined,
    tpr: data.grandTotalProgramming > 0 ? Math.round(data.grandTotalProgramming * 100) / 100 : undefined,
    tmh: data.grandTotalMinHourAdj > 0 ? Math.round(data.grandTotalMinHourAdj * 100) / 100 : undefined,
  };
}

// Inflate slim payload back to ClientCostSummary
export function inflateSlimPayload(slim: SlimPayload): ClientCostSummary {
  return {
    client: { id: '', name: slim.n, createdAt: new Date() } as Client,
    vehicles: slim.v.map(sv => ({
      vehicle: {
        id: '',
        clientId: '',
        vin: sv.vin,
        make: sv.mk,
        model: sv.md,
        year: sv.yr,
        color: sv.cl,
      } as Vehicle,
      sessions: sv.s.map(ss => ({
        description: ss.d,
        date: new Date(ss.dt * 1000),
        duration: ss.dur,
        laborCost: ss.lc,
        cloningCost: ss.clc || 0,
        programmingCost: ss.prc || 0,
        minHourAdj: ss.mha || 0,
        parts: ss.p.map(p => ({ name: p.n, quantity: p.q, price: p.pr })),
        partsCost: ss.pc,
        status: ss.st as TaskStatus,
        photoUrls: ss.ph || [],
      })),
      totalLabor: sv.tl,
      totalParts: sv.tp,
      totalCloning: sv.tcl || 0,
      totalProgramming: sv.tpr || 0,
      totalMinHourAdj: sv.tmh || 0,
      vehicleTotal: sv.vt,
    })),
    grandTotalLabor: slim.tl,
    grandTotalParts: slim.tp,
    grandTotalCloning: slim.tcl || 0,
    grandTotalProgramming: slim.tpr || 0,
    grandTotalMinHourAdj: slim.tmh || 0,
    grandTotal: slim.gt,
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

// Encode client data using slim format
export async function encodeClientData(data: ClientCostSummary, accessCode: string): Promise<string> {
  const slim = slimDown(data);
  const payload = JSON.stringify({ s: slim, c: accessCode });
  return compressToBase64(payload);
}

// Decode client data - handles both slim and legacy formats
export async function decodeClientData(encoded: string): Promise<{ data: ClientCostSummary; accessCode: string }> {
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

  // Slim format uses { s: SlimPayload, c: accessCode }
  if (parsed.s && parsed.c !== undefined) {
    return { data: inflateSlimPayload(parsed.s), accessCode: parsed.c };
  }

  // Legacy format uses { data: ClientCostSummary, accessCode }
  return { data: parsed.data, accessCode: parsed.accessCode };
}

// Generate a self-contained HTML file for sharing large datasets
export function generatePortalHtmlFile(data: ClientCostSummary, accessCode: string): Blob {
  const slim = slimDown(data);
  const jsonData = JSON.stringify({ s: slim, c: accessCode });

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
var D=${jsonData};
var pin='';
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
function verifyPin(){
if(pin===D.c){
document.getElementById('pin-screen').classList.add('hidden');
renderContent();
}else{
document.getElementById('pin-error').textContent='Incorrect code. Please try again.';
document.getElementById('pin-error').classList.remove('hidden');
var pi=document.getElementById('pin-inputs');
for(var i=0;i<4;i++)pi.children[i].value='';
pi.children[0].focus();
pin='';
document.getElementById('pin-btn').disabled=true;
}
}
function fmt(n){return'$'+n.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')}
function fmtDur(s){var h=Math.floor(s/3600);var m=Math.floor((s%3600)/60);return h+'h '+m+'m'}
function fmtDate(ts){var d=new Date(ts*1000);return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
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
var baseLab=ss.lc-(ss.mha||0)-(ss.clc||0)-(ss.prc||0);
h+='<div class="meta"><span>⏱ '+fmtDur(ss.dur)+'</span><span><b>💰 Labor: '+fmt(baseLab)+'</b></span></div>';
if(ss.mha&&ss.mha>0)h+='<div class="extra-line">🚩 Min 1 Hour: <b>'+fmt(ss.mha)+'</b></div>';
if(ss.clc&&ss.clc>0)h+='<div class="extra-line">📋 Cloning: <b>'+fmt(ss.clc)+'</b></div>';
if(ss.prc&&ss.prc>0)h+='<div class="extra-line">💻 Programming: <b>'+fmt(ss.prc)+'</b></div>';
if(ss.ph&&ss.ph.length>0){
h+='<div style="display:flex;gap:8px;overflow-x:auto;padding:8px 0">';
ss.ph.forEach(function(url){h+='<img src="'+esc(url)+'" style="width:80px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0" loading="lazy">'});
h+='</div>';
}
if(ss.p.length>0){
h+='<div class="parts"><div class="parts-title">🔧 Parts</div><table><tr><th>Part</th><th class="text-center">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr>';
ss.p.forEach(function(p){h+='<tr><td>'+esc(p.n)+'</td><td class="text-center">'+p.q+'</td><td class="text-right">'+fmt(p.pr)+'</td><td class="text-right"><b>'+fmt(p.pr*p.q)+'</b></td></tr>'});
h+='</table><div style="text-align:right;font-size:11px;font-weight:600;margin-top:4px;padding-right:8px">Parts Total: '+fmt(ss.pc)+'</div></div>';
}
h+='<div style="text-align:right;font-size:12px;font-weight:700;border-top:1px solid #334155;padding-top:4px;margin-top:8px">Session Total: '+fmt(ss.lc+ss.pc)+'</div></div>';
});
var vBaseLab=v.tl-(v.tmh||0)-(v.tcl||0)-(v.tpr||0);
h+='<div class="subtotal"><div class="row"><span>Vehicle Labor:</span><span><b>'+fmt(vBaseLab)+'</b></span></div>';
if(v.tmh&&v.tmh>0)h+='<div class="row"><span>Min 1 Hour:</span><span><b>'+fmt(v.tmh)+'</b></span></div>';
if(v.tcl&&v.tcl>0)h+='<div class="row"><span>Cloning:</span><span><b>'+fmt(v.tcl)+'</b></span></div>';
if(v.tpr&&v.tpr>0)h+='<div class="row"><span>Programming:</span><span><b>'+fmt(v.tpr)+'</b></span></div>';
h+='<div class="row"><span>Vehicle Parts:</span><span><b>'+fmt(v.tp)+'</b></span></div><div class="row total"><span>Vehicle Total:</span><span>'+fmt(v.vt)+'</span></div></div></div>';
});
if(s.v.length>0){
var gBaseLab=s.tl-(s.tmh||0)-(s.tcl||0)-(s.tpr||0);
h+='<div class="grand"><div class="row"><span>Total Labor:</span><span><b>'+fmt(gBaseLab)+'</b></span></div>';
if(s.tmh&&s.tmh>0)h+='<div class="row"><span>Min 1 Hour:</span><span><b>'+fmt(s.tmh)+'</b></span></div>';
if(s.tcl&&s.tcl>0)h+='<div class="row"><span>Cloning:</span><span><b>'+fmt(s.tcl)+'</b></span></div>';
if(s.tpr&&s.tpr>0)h+='<div class="row"><span>Programming:</span><span><b>'+fmt(s.tpr)+'</b></span></div>';
h+='<div class="row"><span>Total Parts:</span><span><b>'+fmt(s.tp)+'</b></span></div><div class="row total"><span>GRAND TOTAL:</span><span>'+fmt(s.gt)+'</span></div></div>';
}
el.innerHTML=h;
}
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
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
  defaultHourlyRate: number
): Promise<string> {
  const summary = calculateClientCosts(client, vehicles, tasks, defaultHourlyRate);
  const slim = slimDown(summary);

  const { data, error } = await supabase.functions.invoke('sync-portal', {
    body: {
      clientLocalId: client.id,
      clientName: client.name,
      accessCode: client.accessCode || null,
      data: slim,
    },
  });

  if (error) throw error;
  return data.id;
}

/**
 * Fetch portal data from the cloud by portal ID
 */
export async function fetchPortalFromCloud(portalId: string): Promise<{
  data: ClientCostSummary;
  accessCode: string | null;
  clientName: string;
}> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const resp = await fetch(
    `https://${projectId}.supabase.co/functions/v1/get-portal?id=${encodeURIComponent(portalId)}`,
    {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to fetch portal');
  }

  const result = await resp.json();
  return {
    data: inflateSlimPayload(result.data),
    accessCode: result.accessCode,
    clientName: result.clientName,
  };
}
