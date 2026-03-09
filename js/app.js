import { store } from "./storage.js";
import { renderHeader, applyBranding } from "./components/header.js";
import { exportImagesBase64 } from "./images_db.js";
import { renderDashboard } from "./modules/dashboard.js";
import { renderLeads, onFabLeads, openLeadById } from "./modules/leads.js";
import { renderFollowups, onFabFollowups, openFollowupById } from "./modules/followups.js";
import { renderContracts, onFabContracts } from "./modules/contracts.js";
import { renderTerms, onFabTerms, renderTermsSettings } from "./modules/terms.js";
import { renderCompany, onFabCompany } from "./modules/company.js";
import { renderCalendar, onFabCalendar, openCalendarDay } from "./modules/calendar.js";
import { renderCompanySettings } from "./modules/company_settings.js";

const app = document.getElementById("app");
/* 
const subtitle = document.getElementById("app_subtitle");

*/
// subtitle is inside header component, so it may not exist at initial parse

const navBtns = Array.from(document.querySelectorAll(".navBtn"));
const fab = document.getElementById("fab_add");


// Manage popup elements (inserted once)
const manageBackdrop = document.createElement("div");
manageBackdrop.className = "manageBackdrop";
manageBackdrop.id = "manage_backdrop";

const managePop = document.createElement("div");
managePop.className = "managePop";
managePop.id = "manage_pop";

managePop.innerHTML = `
  <div class="stack">
    <div class="manageItem" data-go="company">
      <button class="manageBtn" type="button" aria-label="Company">🏢</button>
      <div class="manageLbl">Company</div>
    </div>
    <div class="manageItem" data-go="terms">
      <button class="manageBtn" type="button" aria-label="Terms">📜</button>
      <div class="manageLbl">Terms</div>
    </div>
    <div class="manageItem" data-go="contracts">
      <button class="manageBtn" type="button" aria-label="Contracts">📄</button>
      <div class="manageLbl">Contracts</div>
    </div>
  </div>
`;

document.body.appendChild(manageBackdrop);
document.body.appendChild(managePop);

function closeManage_(){
  manageBackdrop.classList.remove("open");
  managePop.classList.remove("open");
  document.body.classList.remove("manageOpen");
}
function toggleManage_(){
  const open = managePop.classList.contains("open");
  if(open) closeManage_();
  else{
    manageBackdrop.classList.add("open");
    managePop.classList.add("open");
    document.body.classList.add("manageOpen");
  }
}

manageBackdrop.addEventListener("click", closeManage_);

managePop.addEventListener("click", (e)=>{
  const t = e.target;
  const item = t && t.closest ? t.closest(".manageItem") : null;
  if(!item) return;
  const go = String(item.getAttribute("data-go") || "");
  if(!go) return;
  closeManage_();
  route = go;
  render_();
});



// front page route
let route = "dashboard";

function isSettingsSubpage_(){
  const body = document.getElementById("settings_sheet_body");
  if(!body) return false;

  // If back button inside sheet exists, it means a subpage is open
  return !!body.querySelector("#btn_back_menu");
}

function isDashboardTableOpen_(){
  return !!document.getElementById("dash_table_back");
}

function isCalendarSheetOpen_(){
  const bd = document.getElementById("cal_sheet_backdrop");
  const sh = document.getElementById("cal_sheet");
  return !!(bd && sh && bd.classList.contains("open") && sh.classList.contains("open"));
}


function normalizeRoute_(r){
  const x = String(r || "").trim().toLowerCase();
  return ["dashboard","leads","followups","calendar","contracts","terms","company"].includes(x)
    ? x
    : "dashboard";
}

const SETTINGS_KEY = "hotelcrm_settings_v1";

// App Version
const BUILD_VERSION = "1.0.0"; // ✅ this is the version of the JS bundle you are running
let LATEST_VERSION = "0.0.0";  // ✅ loaded from version.json
let UPDATE_INSTALLING = false;

const DEVICE_KEY = "hotelcrm_device_id_v1";

// --- PWA INSTALL SUPPORT ---
let deferredInstallPrompt = null;
let canInstallPwa = false;

window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  canInstallPwa = true;
});

window.addEventListener("appinstalled", ()=>{
  console.log("📱 Hotel CRM installed");
  deferredInstallPrompt = null;
  canInstallPwa = false;

  // hide install popup if visible
  const p = document.getElementById("pwa_install_popup");
  if(p) p.remove();
});

// --- PUSH (Cloudflare Worker + Web Push) ---
const PUSH_WORKER_URL = "https://divine-leaf-9062.rebule1.workers.dev";
// expose for modules (no import cycles)
window.__HOTELCRM_PUSH_WORKER_URL__ = PUSH_WORKER_URL;
const VAPID_PUBLIC_KEY = "BM2DoeITan2taeymrRIxKa30inwQ3973ia2cT6GxaGszqpMUMzVasDDwiy_Xv8OdQmE2XYdtVP5JoKBg3mQZw8w";



// small stable hash (FNV-1a 32-bit)
function hash32_(str){
  let h = 0x811c9dc5;
  const s = String(str || "");
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = (h + ((h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24))) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

function stableDeviceId_(){
  // “stable per phone+browser profile”
  const parts = [
    navigator.userAgent || "",
    navigator.platform || "",
    navigator.language || "",
    String((Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || ""),
    String(screen && screen.width || ""),
    String(screen && screen.height || ""),
    String(window.devicePixelRatio || "")
  ];
  const raw = "hotelcrm|stable|v1|" + parts.join("|");
  return "fp_" + hash32_(raw);
}

function getDeviceId_(){
  // ✅ If old random ID exists, keep it (preserves existing backups)
  let id = String(localStorage.getItem(DEVICE_KEY) || "").trim();
  if(id) return id;

  // ✅ After reinstall (empty storage) we get stable id
  id = stableDeviceId_();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

// helper if you want to send both
function getStableDeviceId_(){
  return stableDeviceId_();
}



function urlBase64ToUint8Array_(base64String){
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensurePushEnabled_(){
  if(!("serviceWorker" in navigator)) throw new Error("Service Worker not supported");
  if(!("PushManager" in window)) throw new Error("Push not supported");

  const perm = Notification.permission;
  if(perm !== "granted"){
    const res = await Notification.requestPermission();
    if(res !== "granted") throw new Error("Notification permission not granted");
  }

  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if(!sub){
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array_(VAPID_PUBLIC_KEY)
    });
  }

  const s = loadSettings_();
  const deviceId = String(s.device_id || getDeviceId_()).trim() || "default";

  await fetch(`${PUSH_WORKER_URL}/subscribe`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({
      device_id: deviceId,
      subscription: sub
    })
  });

  return { ok:true, deviceId };
}

async function sendTestPush_(){
  const s = loadSettings_();
  const deviceId = String(s.device_id || getDeviceId_()).trim() || "default";

  await fetch(`${PUSH_WORKER_URL}/test`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ device_id: deviceId })
  });
}





// Default backup endpoint (auto-filled if not saved yet)
const DEFAULT_BACKUP_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyiLA0xYQ3i8C_nZcU0KLkTFFsz9GVdzQAf-4gZBE3s7bQTDZ7uneFOx2E2e_G832b8LQ/exec?token=hotel-app-superadmin-vishal";
function loadSettings_(){
  try{
    const obj = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
if(!obj.backup_endpoint){
  obj.backup_endpoint = DEFAULT_BACKUP_ENDPOINT;
}
return obj;
  }catch(e){
    return {};
  }
}
function saveSettings_(s){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s || {}));
}

function applyTheme_(){
  const s = loadSettings_();

  const theme = String(s.theme || "green").trim().toLowerCase();
  const design = String(s.design || "executive").trim().toLowerCase(); // executive | dark

  // Theme (accent)
  const themeLink = document.getElementById("theme_css");
  if(themeLink){
    const file = theme === "blue" ? "theme-blue.css" : "theme-green.css";
    themeLink.setAttribute("href", `./css/themes/${file}`);
  }

  // Design (layout)
  const designLink = document.getElementById("design_css");
  if(designLink){
    const dfile = (design === "dark") ? "design-dark.css" : "design-executive.css";
    designLink.setAttribute("href", `./css/designs/${dfile}`);
  }

  // Update iPhone safe-area / browser top bar color from CSS variable
  const meta = document.getElementById("meta_theme_color");
  if(meta){
    // wait a tick so CSS applies, then read variable
    setTimeout(()=>{
  const v = getComputedStyle(document.documentElement).getPropertyValue("--meta-theme").trim();
  meta.setAttribute("content", v || "#0b3a2a");
}, 80);
  }
}

// backup issues solved

function isDbEmpty_(db){
  const d = db || {};
  const leads0 = !Array.isArray(d.leads) || d.leads.length === 0;
  const follow0 = !Array.isArray(d.followups) || d.followups.length === 0;
  const cont0 = !Array.isArray(d.contracts) || d.contracts.length === 0;
  const book0 = !Array.isArray(d.bookings) || d.bookings.length === 0;

  const termsText = (d.terms && typeof d.terms === "object") ? String(d.terms.text || "") : String(d.terms || "");
  const terms0 = termsText.trim().length === 0;

  const comp = (d.company && typeof d.company === "object") ? d.company : {};
  const compKeys = Object.keys(comp || {});
  const comp0 = compKeys.length === 0;

  return (leads0 && follow0 && cont0 && book0 && terms0 && comp0);
}





async function backupOncePerDayOnOpen_(){
  const s = loadSettings_();
  const endpoint = String(s.backup_endpoint || "").trim();
 // Token will be inside endpoint URL as ?token=YOURTOKEN (recommended for Apps Script)
if(!endpoint) return; // not configured

  // ✅ Safety: never auto-backup an empty fresh install (prevents overwriting Drive backup)
  const db0 = store.get();
  if(isDbEmpty_(db0)){
    console.log("ℹ️ Auto-backup skipped: local DB is empty (restore first).");
    return;
  }

	

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth()+1).padStart(2,"0");
  const d = String(today.getDate()).padStart(2,"0");
  const dayKey = `${y}-${m}-${d}`;

  const last = String(localStorage.getItem("hotelcrm_last_backup_day") || "");
  if(last === dayKey) return;

 const images = await exportImagesBase64(["company_logo","company_bg","company_qr"]);

const s2 = loadSettings_();
const legacyId = String(s2.device_id || getDeviceId_()).trim() || "default";
const stableId = String(getStableDeviceId_()).trim() || legacyId;

const payload = {
  app: "hotelcrm",
  ts: new Date().toISOString(),
  device_id: legacyId,              // keep existing behavior
device_id_stable: stableId,       // NEW (for reinstall restore)
device_id_legacy: legacyId,       // NEW (explicit)
  data: JSON.parse(JSON.stringify(store.get())),
  settings: s2,
  images: {
    company_logo: images.company_logo || "",
    company_bg: images.company_bg || "",
    company_qr: images.company_qr || ""
  }
};

  try{
    await fetch(endpoint, {
  method: "POST",
  mode: "no-cors",
  headers: {
    "Content-Type": "text/plain;charset=utf-8"
  },
  body: JSON.stringify(payload)
});

// In no-cors mode we can't read status, but if it doesn't throw, it was sent.
localStorage.setItem("hotelcrm_last_backup_day", dayKey);
localStorage.setItem("hotelcrm_last_backup_at", new Date().toISOString());
console.log("✅ Backup sent (no-cors)");
  }catch(err){
    console.warn("⚠️ Backup error", err);
  }
}

function setSubtitle_(t){
  const el = document.getElementById("app_subtitle");
  if(el) el.textContent = t;
}

function setActiveNav_(r){
  navBtns.forEach(b => b.classList.toggle("active", b.dataset.route === r));
}

function render_(){
  route = normalizeRoute_(route);
  setActiveNav_(route);

  // Keep browser history in sync with main app route
  if(window.location.hash !== "#" + route){
    if(!window.location.hash){
      history.replaceState({ route }, "", "#" + route);
    }else{
      history.pushState({ route }, "", "#" + route);
    }
  }

   if(route === "dashboard"){
    setSubtitle_("Dashboard");
    renderDashboard(app);
    fab.style.display = "none";
  }
  else if(route === "leads"){
    setSubtitle_("Leads");
    renderLeads(app);
    fab.style.display = "";
  }
  else if(route === "followups"){
    setSubtitle_("Follow-ups");
    renderFollowups(app);
    fab.style.display = "";
  }
  else if(route === "calendar"){ 
	  setSubtitle_("Calendar");
	  renderCalendar(app);
	  fab.style.display = ""; 
  }
  else if(route === "manage"){
    setSubtitle_("");
    fab.style.display = "none";
    // Open popup and stay on previous screen by jumping back:
    toggleManage_();
    route = "dashboard";
    setActiveNav_(route);
    return;
  }


	  
  else if(route === "contracts"){
    setSubtitle_("Contracts");
    renderContracts(app);
    fab.style.display = "";
  }
  else if(route === "terms"){
    setSubtitle_("Terms & Conditions");
    renderTerms(app);
    fab.style.display = "none";
  }
  else if(route === "company"){
    setSubtitle_("Company Details");
    renderCompany(app);
    fab.style.display = "none";
  }
  else{
    setSubtitle_("");
    app.innerHTML = `<div class="card"><h2>Not found</h2><p>Unknown route.</p></div>`;
    fab.style.display = "none";
  }
}

navBtns.forEach(btn=>{
  btn.addEventListener("click", (e)=>{
    const r = String(btn.dataset.route || "");
    if(r === "manage"){
      e.preventDefault();
      toggleManage_();
      return;
    }
    closeManage_();
    route = r;
    render_();
  });
});

fab.addEventListener("click", ()=>{
  if(route === "calendar") return onFabCalendar(app, render_);
  if(route === "leads") return onFabLeads(app, render_);
  if(route === "followups") return onFabFollowups(app, render_);
  if(route === "contracts") return onFabContracts(app, render_);
  if(route === "terms") return onFabTerms(app, render_);
  if(route === "company") return onFabCompany(app, render_);
});



function normalizeDb_(db){
  // accept older formats and ensure required keys exist
  const out = (db && typeof db === "object") ? db : {};

  // If someone backed up { data: { data: {...} } } by mistake
  const maybeNested = out.data && out.data.leads !== undefined ? out.data : null;
  const fixed = maybeNested ? maybeNested : out;

  return {
    leads: Array.isArray(fixed.leads) ? fixed.leads : [],
    followups: Array.isArray(fixed.followups) ? fixed.followups : [],
    contracts: Array.isArray(fixed.contracts) ? fixed.contracts : [],
    bookings: Array.isArray(fixed.bookings) ? fixed.bookings : [],
    terms: (fixed.terms && typeof fixed.terms === "object")
      ? fixed.terms
      : { text: String(fixed.terms || "") },
    company: (fixed.company && typeof fixed.company === "object")
      ? fixed.company
      : {}
  };
}

async function forceSaveDb_(db){
  // make sure the EXACT LocalStorage key is updated
  const clean = normalizeDb_(db);

  try{
    await store.set(clean);
  }catch(e){
    // fallback if store.set ever fails
    localStorage.setItem("hotelcrm_v1", JSON.stringify(clean));
  }

  return clean;
}



function fmtLocalDT_(iso){
  if(!iso) return "-";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  let hh = d.getHours();
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12; if(hh===0) hh = 12;
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${dd}-${mm}-${yy} ${String(hh).padStart(2,"0")}:${mi} ${ampm}`;
}



function jsonp_(url){
  return new Promise((resolve, reject)=>{
    const cb = "hotelcrm_cb_" + Math.random().toString(16).slice(2);
    const src = url + (url.includes("?") ? "&" : "?") + "callback=" + encodeURIComponent(cb);

    let done = false;
    window[cb] = (data)=>{
      done = true;
      try{ delete window[cb]; }catch(e){ window[cb] = undefined; }
      script.remove();
      resolve(data);
    };

    const script = document.createElement("script");
    script.src = src;
    script.async = true;

    script.onerror = ()=>{
      if(done) return;
      try{ delete window[cb]; }catch(e){ window[cb] = undefined; }
      script.remove();
      reject(new Error("JSONP load failed"));
    };

    document.head.appendChild(script);

    setTimeout(()=>{
      if(done) return;
      try{ delete window[cb]; }catch(e){ window[cb] = undefined; }
      script.remove();
      reject(new Error("JSONP timeout"));
    }, 15000);
  });
}




async function restoreFromBackup_(){
  const s = loadSettings_();
  const endpoint = String(s.backup_endpoint || "").trim();
  if(!endpoint){
    alert("Backup Endpoint URL is empty.");
    return;
  }

  // We will call the same endpoint but with ?action=get
  // Keep token in URL already.
 const s2 = loadSettings_();
const legacyId = String(s2.device_id || getDeviceId_()).trim() || "default";
const stableId = String(getStableDeviceId_()).trim() || legacyId;

// ✅ helper to build URL for any id
function buildGetUrl_(id){
  return endpoint.includes("?")
    ? (endpoint + `&action=get&device_id=${encodeURIComponent(id)}`)
    : (endpoint + `?action=get&device_id=${encodeURIComponent(id)}`);
}

let payload = null;

// ✅ Try STABLE first
try{
  payload = await jsonp_(buildGetUrl_(stableId));
}catch(err){
  console.warn("Restore JSONP error (stable)", err);
}

// ✅ If stable missing, try LEGACY
if(!payload || payload.error){
  try{
    payload = await jsonp_(buildGetUrl_(legacyId));
  }catch(err2){
    console.warn("Restore JSONP error (legacy)", err2);
    alert("Restore failed (could not load backup). Check console.");
    return;
  }
}

// ✅ Still error? stop.
if(!payload || payload.error){
  alert("Restore error: " + (payload && payload.error ? payload.error : "Unknown"));
  return;
}

 const dataRaw = payload.data || {};
const images = payload.images || {};
const settingsRaw = payload.settings || {};

// Confirm overwrite
const ok = confirm("This will overwrite your current local data with the backup. Continue?");
if(!ok) return;

// ✅ Save core data (forced + normalized)
const { rebuildStatsIndex } = await import("./modules/stats_engine.js");

const dbFixed = rebuildStatsIndex(dataRaw);

const saved = await forceSaveDb_(dbFixed);

// ✅ Restore settings (merge, don't lose endpoint/theme)
try{
  const cur = loadSettings_();
  const incoming = (settingsRaw && typeof settingsRaw === "object") ? settingsRaw : {};
  const merged = {
    ...cur,
    ...incoming
  };

  // Ensure endpoint is never blank
  if(!merged.backup_endpoint) merged.backup_endpoint = cur.backup_endpoint || "";

  saveSettings_(merged);
  applyTheme_();
}catch(e){
  console.warn("Settings restore skipped/failed", e);
}
	
console.log("✅ Restored counts:", {
  leads: saved.leads.length,
  followups: saved.followups.length,
  contracts: saved.contracts.length,
  bookings: (saved.bookings || []).length,
  terms_len: String(saved.terms && saved.terms.text || "").length
});

  // Restore images into IndexedDB (if present)
  try{
    const { importImagesBase64 } = await import("./images_db.js");
    await importImagesBase64(images);
  }catch(e){
    console.warn("Image restore skipped/failed", e);
  }

  // Update last backup label based on backup timestamp
 if(payload.ts){
  const iso = String(payload.ts);
  localStorage.setItem("hotelcrm_last_backup_at", iso);

  // also set day marker to prevent immediate auto-backup
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  localStorage.setItem("hotelcrm_last_backup_day", `${y}-${m}-${dd}`);
}

  // Refresh branding + UI
  await applyBranding();
  route = "leads";
  render_();

  alert("Restore complete.");
}




function openSheet_(){
  const bd = document.getElementById("settings_sheet");
  if(!bd) return;
  bd.style.display = "flex";

  // ✅ match Calendar sheet behavior (uses .open)
  bd.classList.add("open");
  const inner = bd.querySelector(".sheet");
  if(inner) inner.classList.add("open");
}

function closeSheet_(){
  const bd = document.getElementById("settings_sheet");
  if(!bd) return;

  bd.classList.remove("open");
  const inner = bd.querySelector(".sheet");
  if(inner) inner.classList.remove("open");

  // small delay so close animation can run
  setTimeout(()=>{ bd.style.display = "none"; }, 120);
}

function renderSettingsMenu_(){
  const body = document.getElementById("settings_sheet_body");
  if(!body) return;

  const s = loadSettings_();
  const lastIso = localStorage.getItem("hotelcrm_last_backup_at") || "";
const notif = (typeof Notification !== "undefined") ? Notification.permission : "unsupported";

	
  body.innerHTML = `
${canInstallPwa ? `
<div class="menuItem" data-menu="install">
  <div class="menuLeft">
    <div class="menuTitle">Install App</div>
    <div class="menuSub">Install Hotel CRM on this device. Backup now before you install.</div>
  </div>
  <div class="menuArrow">›</div>
</div>
` : ``}
  
   ${notif !== "granted" ? `
   <div class="menuItem" data-menu="notifications">
      <div class="menuLeft">
        <div class="menuTitle">Enable Notifications</div>
        <div class="menuSub">Turn on reminders on this device</div>
      </div>
      <div class="menuArrow">›</div>
    </div>
    ` : `
    <div class="menuItem" data-menu="notifications">
      <div class="menuLeft">
        <div class="menuTitle">Notifications</div>
        <div class="menuSub">Enabled ✅ (send test)</div>
      </div>
      <div class="menuArrow">›</div>
    </div>
    `}


   
    <div class="menuItem" data-menu="appearance">
      <div class="menuLeft">
        <div class="menuTitle">Appearance</div>
        <div class="menuSub">Design + Theme</div>
      </div>
      <div class="menuArrow">›</div>
    </div>

    <div class="menuItem" data-menu="backup">
      <div class="menuLeft">
        <div class="menuTitle">Backup & Restore</div>
        <div class="menuSub">Last backup: ${fmtLocalDT_(lastIso)}</div>
      </div>
      <div class="menuArrow">›</div>
    </div>

    <div class="menuItem" data-menu="company">
      <div class="menuLeft">
        <div class="menuTitle">Company Settings</div>
        <div class="menuSub">Edit profile + Logo/Background/QR</div>
      </div>
      <div class="menuArrow">›</div>
    </div>

	 <div class="menuItem" data-menu="terms">
      <div class="menuLeft">
        <div class="menuTitle">Terms Settings</div>
        <div class="menuSub">Edit Terms & Conditions</div>
      </div>
      <div class="menuArrow">›</div>
    </div>

    <div class="menuItem" data-menu="about">
      <div class="menuLeft">
        <div class="menuTitle">About</div>
        <div class="menuSub">Latest Version: ${LATEST_VERSION}</div>
      </div>
      <div class="menuArrow">›</div>
    </div>
  `;
}

function renderAppearanceSettings_(){
  const body = document.getElementById("settings_sheet_body");
  if(!body) return;

  const s = loadSettings_();

  body.innerHTML = `
    <div class="card">
      <h2>Appearance</h2>

      <div class="label">Design Mode</div>
      <select class="select" id="set_design">
        <option value="executive" ${String(s.design||"executive")==="executive"?"selected":""}>Executive (Light)</option>
        <option value="dark" ${String(s.design||"") === "dark"?"selected":""}>Dark Neo (Luxury)</option>
      </select>

      <div class="label">Theme</div>
      <select class="select" id="set_theme">
        <option value="green" ${String(s.theme||"green")==="green"?"selected":""}>Green</option>
        <option value="blue" ${String(s.theme||"") === "blue"?"selected":""}>Blue</option>
      </select>

      <div class="btnRow">
        <button class="btn" id="btn_back_menu">Back</button>
        <button class="btn primary" id="btn_save_appearance">Save</button>
      </div>
    </div>
  `;

  document.getElementById("btn_back_menu").addEventListener("click", renderSettingsMenu_);

  document.getElementById("btn_save_appearance").addEventListener("click", ()=>{
    const s2 = loadSettings_();
    s2.design = document.getElementById("set_design").value;
    s2.theme = document.getElementById("set_theme").value;
    saveSettings_(s2);
    applyTheme_();
    applyBranding(); // refresh header overlay immediately
    alert("Saved.");
  });
}

function renderBackupSettings_(){
  const body = document.getElementById("settings_sheet_body");
  if(!body) return;

  const s = loadSettings_();
  const lastIso = localStorage.getItem("hotelcrm_last_backup_at") || "";

  body.innerHTML = `
    <div class="card">
      <h2>Backup & Restore</h2>
      <div class="small"><b>Last backup:</b> ${fmtLocalDT_(lastIso)}</div>

      <div class="label">Device Backup ID</div>
      <input class="input" id="set_device_id" value="${(s.device_id || getDeviceId_())}" />

      <div class="label">Backup Endpoint URL</div>
      <input class="input" id="set_backup_endpoint" value="${(s.backup_endpoint||"")}" />

      <div class="btnRow">
        <button class="btn" id="btn_back_menu">Back</button>
        <button class="btn" id="btn_save_backup">Save</button>
      </div>

      <hr class="sep" />

      <div class="btnRow">
        <button class="btn primary" id="btn_backup_now">Backup Now</button>
        <button class="btn" id="btn_restore_now">Restore Now</button>
      </div>

      <hr class="sep" />
      <button class="btn danger" id="btn_reset_db">Reset all data</button>
    </div>
  `;

  document.getElementById("btn_back_menu").addEventListener("click", renderSettingsMenu_);

  document.getElementById("btn_save_backup").addEventListener("click", ()=>{
    const s2 = loadSettings_();
    s2.device_id = document.getElementById("set_device_id").value.trim();
    s2.backup_endpoint = document.getElementById("set_backup_endpoint").value.trim();
    saveSettings_(s2);
    alert("Saved.");
  });

  document.getElementById("btn_backup_now").addEventListener("click", async ()=>{
    localStorage.removeItem("hotelcrm_last_backup_day");
    await backupOncePerDayOnOpen_();
    alert("Backup attempted. Check console if needed.");
  });

  document.getElementById("btn_restore_now").addEventListener("click", async ()=>{
    await restoreFromBackup_();
  });

  document.getElementById("btn_reset_db").addEventListener("click", ()=>{
    const ok = confirm("Delete all local data? This cannot be undone.");
    if(!ok) return;
    localStorage.removeItem("hotelcrm_v1");
localStorage.removeItem("hotelcrm_snapshot_v1");
localStorage.removeItem("hotelcrm_last_backup_day");
localStorage.removeItem("hotelcrm_last_backup_at");

try{
  indexedDB.deleteDatabase("hotelcrm_db");
}catch(e){
  console.warn("IDB reset failed",e);
}
    route = "leads";
    render_();
    alert("Reset complete.");
  });
}



function renderNotificationsSettings_(){
  const body = document.getElementById("settings_sheet_body");
  if(!body) return;

  const perm = (typeof Notification !== "undefined") ? Notification.permission : "unsupported";
  const s = loadSettings_();
  const deviceId = String(s.device_id || getDeviceId_()).trim() || "default";

  body.innerHTML = `
    <div class="card">
      <h2>Notifications</h2>
      <div class="small"><b>Status:</b> ${perm}</div>
      <div class="small"><b>Device ID:</b> ${deviceId}</div>

      <div class="btnRow" style="margin-top:12px;">
        <button class="btn" id="btn_back_menu">Back</button>
        <button class="btn primary" id="btn_enable_push">Enable</button>
        <button class="btn" id="btn_test_push">Send Test</button>
      </div>

      <p class="small" style="margin-top:10px;">
        Enable registers this device for reminders. Test sends a sample push.
      </p>
    </div>
  `;

  document.getElementById("btn_back_menu").addEventListener("click", renderSettingsMenu_);

  document.getElementById("btn_enable_push").addEventListener("click", async ()=>{
    try{
      await ensurePushEnabled_();
      alert("Notifications enabled ✅");
      renderSettingsMenu_();
    }catch(e){
      alert("Enable failed: " + String(e && e.message ? e.message : e));
    }
  });

  document.getElementById("btn_test_push").addEventListener("click", async ()=>{
    try{
      await sendTestPush_();
      alert("Test push requested ✅ (check your device)");
    }catch(e){
      alert("Test push failed: " + String(e && e.message ? e.message : e));
    }
  });
}



function renderAbout_(){
  const body = document.getElementById("settings_sheet_body");
  if(!body) return;

  body.innerHTML = `
    <div class="card">
      <h2>About</h2>
      <p class="small">Hotel CRM — Offline-first</p>
      <div class="small" hidden/><b>Build:</b> ${BUILD_VERSION}</div>
      <div class="small"><b>Latest:</b> ${LATEST_VERSION}</div>

      <div class="btnRow">
        <button class="btn" id="btn_back_menu">Back</button>
      </div>
    </div>
  `;

  document.getElementById("btn_back_menu").addEventListener("click", renderSettingsMenu_);
}

document.addEventListener("click", async (e)=>{
  const t = e.target;

  // Open sheet
  if(t && t.id === "btn_settings"){
    await loadLatestVersion_();
    await checkForUpdate_();
    openSheet_();
    renderSettingsMenu_();
    return;
  }

  // Close sheet (X)
  if(t && t.id === "btn_sheet_close"){
    closeSheet_();
    return;
  }

  // Close when tapping backdrop
  if(t && t.id === "settings_sheet"){
    closeSheet_();
    return;
  }

  // Menu navigation inside sheet
  const item = t && t.closest ? t.closest(".menuItem") : null;
  if(item && item.dataset && item.dataset.menu){
    const key = item.dataset.menu;
	  if(key === "install"){
  if(!deferredInstallPrompt){
    alert("Install not available on this device/browser.");
    return;
  }

  try{
    deferredInstallPrompt.prompt();

    const res = await deferredInstallPrompt.userChoice;

    if(res && res.outcome === "accepted"){
      console.log("✅ PWA installed");
    }

    deferredInstallPrompt = null;
    canInstallPwa = false;

    renderSettingsMenu_();

  }catch(e){
    console.warn("Install failed", e);
  }

  return;
}
	if(key === "notifications") return renderNotificationsSettings_();  
    if(key === "appearance") return renderAppearanceSettings_();
    if(key === "backup") return renderBackupSettings_();
    if(key === "about") return renderAbout_();
    if(key === "company"){
  const body = document.getElementById("settings_sheet_body");
  if(!body) return;
  await renderCompanySettings(body, renderSettingsMenu_);
  return;
}

	   if(key === "terms"){
      const body = document.getElementById("settings_sheet_body");
      if(!body) return;
      await renderTermsSettings(body, renderSettingsMenu_);
      return;
    }
	  
  }
});



// app version checks

async function loadLatestVersion_(){
  try{
    const res = await fetch(`./version.json?ts=${Date.now()}`, { cache: "no-store" });
    if(!res.ok) return LATEST_VERSION;
    const j = await res.json();
    const v = String(j.version || "").trim();
    if(v) LATEST_VERSION = v;
	  // If we are now on the latest, clear dismissed marker and hide banner
if(LATEST_VERSION === BUILD_VERSION){
  localStorage.removeItem("hotelcrm_dismissed_update");
  const bar = document.getElementById("update_bar");
  if(bar) bar.remove();
}
  }catch(e){
    // ignore
  }
  return LATEST_VERSION;
}



async function checkForUpdate_(){
  try{
  const latest = String(LATEST_VERSION || "").trim();
    if(!latest) return;

// If latest equals current, no banner
if(latest === BUILD_VERSION) return;

// If user already dismissed this exact latest version, don't show again
const dismissed = String(localStorage.getItem("hotelcrm_dismissed_update") || "");
if(dismissed === latest) return;
	  if(UPDATE_INSTALLING) return;

    // show banner
    let bar = document.getElementById("update_bar");
    if(!bar){
      bar = document.createElement("div");
      bar.id = "update_bar";
     bar.style.cssText = `
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;

  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  border-radius: 10px;

  /* ✅ mobile-safe sizing */
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;

  /* ✅ stack content so button never gets pushed out */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;

    padding: 18px 16px;
  opacity: 1;
  transition: opacity 220ms ease, transform 220ms ease;
`;
                   bar.innerHTML = `
  <div id="update_idle_view" style="display:flex; flex-direction:column; gap:12px;">
    <div style="display:flex; align-items:center; gap:12px;">
      <div id="update_idle_dot" style="
        width:14px; height:14px; border-radius:50%;
        background: var(--accent, #0b7a5c);
        flex:0 0 auto;
      "></div>

      <div style="min-width:0;">
        <div class="small" style="font-size:14px;"><b>New Version available</b> (v${latest})</div>
        <div class="small" id="update_status_text" style="margin-top:4px; opacity:0.8;">Ready to install update</div>
      </div>
    </div>

    <button class="btn primary" id="btn_reload_update" type="button" style="width:100%;">Update</button>
  </div>

  <div id="update_install_view" style="display:none; text-align:center; padding:10px 4px 2px;">
    <div id="update_spinner_big" style="
      width:42px; height:42px; margin:0 auto 14px auto; border-radius:50%;
      border:4px solid rgba(0,0,0,0.12);
      border-top-color: var(--accent, #0b7a5c);
      animation:none;
    "></div>

    <div style="font-size:16px; font-weight:700;">Installing update…</div>
    <div id="update_install_text" class="small" style="margin-top:8px; opacity:0.8;">Preparing update…</div>

    <div style="height:8px; border-radius:999px; background:rgba(0,0,0,0.08); overflow:hidden; margin-top:14px;">
      <div id="update_progress_bar" style="
        width:0%;
        height:100%;
        border-radius:999px;
        background: linear-gradient(90deg, #16a34a, #22c55e);
        transition: width 500ms ease;
      "></div>
    </div>
  </div>
`;
      document.body.prepend(bar);

          if(!document.getElementById("hotelcrm_update_anim_style")){
        const st = document.createElement("style");
        st.id = "hotelcrm_update_anim_style";
        st.textContent = `
          @keyframes hotelcrmSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          #update_bar.installing #update_spinner_big {
            animation: hotelcrmSpin 0.9s linear infinite;
          }
        `;
        document.head.appendChild(st);
      }

		

		const laterBtn = bar.querySelector("#btn_dismiss_update");
if(laterBtn){
  laterBtn.addEventListener("click", ()=>{
    // dismiss only for this exact version
    localStorage.setItem("hotelcrm_dismissed_update", latest);
    bar.remove();
  });
}


	
 bar.querySelector("#btn_reload_update").addEventListener("click", async ()=>{
  if(UPDATE_INSTALLING) return;
  UPDATE_INSTALLING = true;

  localStorage.setItem("hotelcrm_dismissed_update", latest);

  const idleView = bar.querySelector("#update_idle_view");
  const installView = bar.querySelector("#update_install_view");
  const installText = bar.querySelector("#update_install_text");
  const progEl = bar.querySelector("#update_progress_bar");

  function setStage_(text, pct){
    if(installText) installText.textContent = text;
    if(progEl) progEl.style.width = pct + "%";
  }

  if(idleView) idleView.style.display = "none";
  if(installView) installView.style.display = "block";

  bar.classList.add("updating");
  bar.classList.add("installing");

  try{
    sessionStorage.removeItem("hotelcrm_update_refresh_count");

    setStage_("Preparing update…", 10);
    await new Promise(resolve => setTimeout(resolve, 700));

    setStage_("Clearing old cached files…", 32);
    if("caches" in window){
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    await new Promise(resolve => setTimeout(resolve, 700));

    setStage_("Refreshing app engine…", 58);
    if("serviceWorker" in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.unregister()));
    }
    await new Promise(resolve => setTimeout(resolve, 900));

    setStage_("Installing latest version…", 84);
    await new Promise(resolve => setTimeout(resolve, 1000));

    setStage_("Finishing update…", 100);
    await new Promise(resolve => setTimeout(resolve, 550));

    bar.style.opacity = "0";
    bar.style.transform = "translate(-50%, -48%)";
    await new Promise(resolve => setTimeout(resolve, 220));
  }catch(e){
    console.warn("Hard refresh cleanup failed", e);
  }

  const u = new URL(window.location.href);
  u.searchParams.set("r", Date.now().toString());
  u.searchParams.set("update", latest);
  u.searchParams.set("hard", "1");

  window.location.replace(u.toString());
});
    }
  }catch(e){
    // ignore update errors
  }
}


window.addEventListener("popstate", (e)=>{

  // 1️⃣ Calendar edit/day sheet
  if(isCalendarSheetOpen_()){
    const closeBtn =
      document.getElementById("cal_close2") ||
      document.getElementById("cal_close");
    if(closeBtn){
      closeBtn.click();
    }
    history.pushState({ route }, "", "#" + route);
    return;
  }

  // 2️⃣ Dashboard table view
  if(isDashboardTableOpen_()){
    const backBtn = document.getElementById("dash_table_back");
    if(backBtn) backBtn.click();
    history.pushState({ route }, "", "#" + route);
    return;
  }

  // 3️⃣ Settings subpage → go back to settings main
  if(isSettingsSubpage_()){
    const btn = document.getElementById("btn_back_menu");
    if(btn) btn.click();
    history.pushState({ route }, "", "#" + route);
    return;
  }

  // 4️⃣ Settings sheet open
  const sheet = document.getElementById("settings_sheet");
  if(sheet && sheet.classList.contains("open")){
    closeSheet_();
    history.pushState({ route }, "", "#" + route);
    return;
  }

  // 5️⃣ Manage popup
  if(document.body.classList.contains("manageOpen")){
    closeManage_();
    history.pushState({ route }, "", "#" + route);
    return;
  }

  // 6️⃣ Route change
  if(e.state && e.state.route){
    route = normalizeRoute_(e.state.route);
  }else{
    const hashRoute = window.location.hash
      ? window.location.hash.replace("#", "")
      : "dashboard";
    route = normalizeRoute_(hashRoute);
  }

  render_();
});



async function init_(){
	  await store.init();

  // ✅ PWA Service Worker
  try{
    if("serviceWorker" in navigator){
      const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });

      // If a new SW is waiting, activate it immediately
      if(reg.waiting){
        reg.waiting.postMessage({ type:"SKIP_WAITING" });
      }

      reg.addEventListener("updatefound", ()=>{
        const nw = reg.installing;
        if(!nw) return;
        nw.addEventListener("statechange", ()=>{
          if(nw.state === "installed" && navigator.serviceWorker.controller){
            console.log("✅ New version installed (SW). Refresh to update.");
          }
        });
      });
    }
  }catch(e){
    console.warn("SW register failed", e);
  }





	
   applyTheme_();
  await loadLatestVersion_();
  await checkForUpdate_();

  try{
    const u = new URL(window.location.href);
    const hard = String(u.searchParams.get("hard") || "");
    const count = Number(sessionStorage.getItem("hotelcrm_update_refresh_count") || "0");

    if(hard === "1" && count < 1){
      sessionStorage.setItem("hotelcrm_update_refresh_count", String(count + 1));

      setTimeout(()=>{
        try{
          const u2 = new URL(window.location.href);
          u2.searchParams.set("r", Date.now().toString());
          window.location.replace(u2.toString());
        }catch(e){
          console.warn("Post-update reload failed", e);
        }
      }, 2500);
    }
  }catch(e){
    console.warn("Post-update refresh logic failed", e);
  }

	
  // Always render header first
  console.log("✅ init_() running, now calling renderHeader()");
  renderHeader();

  // Then apply branding (logo/background)
  try{
    await applyBranding();
  }catch(e){
    console.warn("Branding failed", e);
  }

  // Then backup (optional)
  try{
    await backupOncePerDayOnOpen_();
  }catch(e){
    console.warn("Backup failed", e);
  }

   // Finally render route UI
  route = normalizeRoute_(window.location.hash ? window.location.hash.replace("#","") : route);
  render_();

  // Deep link handling (from push notification click)
  try{
    const u = new URL(window.location.href);
    const n = String(u.searchParams.get("n") || "");
    const id = String(u.searchParams.get("id") || "");
    const day = String(u.searchParams.get("day") || "");

    if(n === "leads" && id){
      route = "leads";
      render_();
      openLeadById(app, id);
    }else if(n === "followup" && id){
      route = "followups";
      render_();
      openFollowupById(app, id);
    }else if(n === "calendar" && day){
      route = "calendar";
      render_();
      openCalendarDay(app, day);
    }else if(n === "dashboard"){
      route = "dashboard";
      render_();
    }
  }catch(e){
    console.warn("Deep link parse failed", e);
  }




	

	  // ✅ Background update checks (no refresh needed)
  setInterval(async ()=>{
    await loadLatestVersion_();
    await checkForUpdate_();
  }, 30000); // every 30s

  document.addEventListener("visibilitychange", async ()=>{
    if(document.visibilityState === "visible"){
      await loadLatestVersion_();
      await checkForUpdate_();
    }
  });



	
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init_);
} else {
  init_();

}






































