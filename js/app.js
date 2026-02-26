import { store } from "./storage.js";
import { renderHeader, applyBranding } from "./components/header.js";

import { exportImagesBase64 } from "./images_db.js";

import { renderLeads, onFabLeads } from "./modules/leads.js";
import { renderFollowups, onFabFollowups } from "./modules/followups.js";
import { renderContracts, onFabContracts } from "./modules/contracts.js";
import { renderTerms, onFabTerms } from "./modules/terms.js";
import { renderCompany, onFabCompany } from "./modules/company.js";

const app = document.getElementById("app");
/* 
const subtitle = document.getElementById("app_subtitle");

*/
// subtitle is inside header component, so it may not exist at initial parse

const navBtns = Array.from(document.querySelectorAll(".navBtn"));
const fab = document.getElementById("fab_add");

let route = "leads";

const SETTINGS_KEY = "hotelcrm_settings_v1";

// App Version
const BUILD_VERSION = "1.0.0"; // ✅ this is the version of the JS bundle you are running
let LATEST_VERSION = "0.0.0";  // ✅ loaded from version.json

const DEVICE_KEY = "hotelcrm_device_id_v1";

function getDeviceId_(){
  let id = String(localStorage.getItem(DEVICE_KEY) || "").trim();
  if(!id){
    // Generate a stable ID for this device/browser
    id = "dev_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
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
  const link = document.getElementById("theme_css");
  if(!link) return;

  const file = theme === "blue" ? "theme-blue.css" : "theme-green.css";
  link.setAttribute("href", `./css/themes/${file}`);
}

async function backupOncePerDayOnOpen_(){
  const s = loadSettings_();
  const endpoint = String(s.backup_endpoint || "").trim();
 // Token will be inside endpoint URL as ?token=YOURTOKEN (recommended for Apps Script)
if(!endpoint) return; // not configured

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth()+1).padStart(2,"0");
  const d = String(today.getDate()).padStart(2,"0");
  const dayKey = `${y}-${m}-${d}`;

  const last = String(localStorage.getItem("hotelcrm_last_backup_day") || "");
  if(last === dayKey) return;

 const images = await exportImagesBase64(["company_logo","company_bg","company_qr"]);

const s2 = loadSettings_();
const deviceId = String(s2.device_id || getDeviceId_()).trim() || "default";

const payload = {
  app: "hotelcrm",
  ts: new Date().toISOString(),
  device_id: deviceId,
  data: store.get(),
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
  setActiveNav_(route);

  if(route === "leads"){ setSubtitle_("Leads"); renderLeads(app); fab.style.display = ""; }
  else if(route === "followups"){ setSubtitle_("Follow-ups"); renderFollowups(app); fab.style.display = ""; }
  else if(route === "contracts"){ setSubtitle_("Contracts"); renderContracts(app); fab.style.display = ""; }
  else if(route === "terms"){ setSubtitle_("Terms & Conditions"); renderTerms(app); fab.style.display = ""; }
  else if(route === "company"){ setSubtitle_("Company Profile"); renderCompany(app); fab.style.display = ""; }
  else{
    setSubtitle_(""); 
    app.innerHTML = `<div class="card"><h2>Not found</h2><p>Unknown route.</p></div>`;
  }
}

navBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    route = btn.dataset.route;
    render_();
  });
});

fab.addEventListener("click", ()=>{
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
    terms: (fixed.terms && typeof fixed.terms === "object")
      ? fixed.terms
      : { text: String(fixed.terms || "") },
    company: (fixed.company && typeof fixed.company === "object")
      ? fixed.company
      : {}
  };
}

function forceSaveDb_(db){
  // make sure the EXACT LocalStorage key is updated
  const clean = normalizeDb_(db);

  try{
    store.set(clean);
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
const deviceId = String(s2.device_id || getDeviceId_()).trim() || "default";

const url = endpoint.includes("?")
  ? (endpoint + `&action=get&device_id=${encodeURIComponent(deviceId)}`)
  : (endpoint + `?action=get&device_id=${encodeURIComponent(deviceId)}`);

 let payload;
try{
  payload = await jsonp_(url);
}catch(err){
  console.warn("Restore JSONP error", err);
  alert("Restore failed (could not load backup). Check console.");
  return;
}

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
const saved = forceSaveDb_(dataRaw);

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




document.addEventListener("click", async (e)=>{
  const t = e.target;
  if(!(t && t.id === "btn_settings")) return;

  const s = loadSettings_();
	await loadLatestVersion_();

  app.innerHTML = `
    <div class="card">
      <h2>Settings</h2>
<p class="small">Offline-first. Themes + optional daily backup.</p>
<div class="small"><b>App version:</b> <span id="app_version_label">-</span></div>

      <div class="label">Theme</div>
      <select class="select" id="set_theme">
        <option value="green" ${String(s.theme||"green")==="green"?"selected":""}>Green</option>
        <option value="blue" ${String(s.theme||"") === "blue"?"selected":""}>Blue</option>
      </select>

      <hr class="sep" />
      <h2 style="font-size:16px; margin-top:0;">Daily Backup (Google Drive JSON)</h2>
      <p class="small">Runs once per day when you open the app (needs a free Apps Script endpoint).</p>

	<div class="small"><b>Last backup:</b> <span id="last_backup_label">-</span></div>

	<div class="label">Device Backup ID</div>
<input class="input" id="set_device_id" value="${(s.device_id || getDeviceId_())}" placeholder=" mayank-android / mayank" />
<div class="small">Use a unique name.</div>

      <div class="label">Backup Endpoint URL</div>
      <input class="input" id="set_backup_endpoint" value="${(s.backup_endpoint||"")}" placeholder="https://script.google.com/macros/s/.../exec" />

     
      <div class="btnRow">
  <button class="btn" id="btn_save_settings">Save Settings</button>
  <button class="btn primary" id="btn_backup_now">Backup Now</button>
  <button class="btn" id="btn_restore_now">Restore Now</button>
</div>

      <hr class="sep" />
      <button class="btn danger" id="btn_reset_db">Reset all data</button>
    </div>
  `;

const lastIso = localStorage.getItem("hotelcrm_last_backup_at") || "";
const lastEl = document.getElementById("last_backup_label");
if(lastEl) lastEl.textContent = fmtLocalDT_(lastIso);

const vEl = document.getElementById("app_version_label");
if(vEl) vEl.textContent = `${BUILD_VERSION} (latest: ${LATEST_VERSION})`;



  document.getElementById("btn_save_settings").addEventListener("click", ()=>{
    const s2 = loadSettings_();
    s2.theme = document.getElementById("set_theme").value;
	  s2.device_id = document.getElementById("set_device_id").value.trim();
    s2.backup_endpoint = document.getElementById("set_backup_endpoint").value.trim();
    
    saveSettings_(s2);
    applyTheme_();
    alert("Settings saved.");
  });

  document.getElementById("btn_backup_now").addEventListener("click", async ()=>{
    // Force backup now by clearing last-day marker
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
  localStorage.removeItem("hotelcrm_last_backup_day");
  route = "leads";
  render_();
});





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

    // show banner
    let bar = document.getElementById("update_bar");
    if(!bar){
      bar = document.createElement("div");
      bar.id = "update_bar";
      bar.style.cssText = `
        position: sticky; top: 0; z-index: 9999;
        background: var(--card);
        border-bottom: 1px solid var(--border);
        padding: 10px 12px;
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
      `;
      bar.innerHTML = `
        <div class="small"><b>Update available</b> (v${latest}). Tap Reload.</div>
        <button class="btn" id="btn_reload_update">Reload</button>
      `;
      document.body.prepend(bar);

      bar.querySelector("#btn_reload_update").addEventListener("click", ()=>{
        // one tap update for your friend
        localStorage.setItem("hotelcrm_dismissed_update", latest);

// Force reload with cache-bust query so iPhone actually loads new files
const u = new URL(window.location.href);
u.searchParams.set("r", Date.now().toString());
window.location.replace(u.toString());
      });
    }
  }catch(e){
    // ignore update errors
  }
}
async function init_(){
  applyTheme_();
	await loadLatestVersion_();
await checkForUpdate_();
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
  render_();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init_);
} else {
  init_();

}





