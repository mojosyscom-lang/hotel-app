import { store } from "../storage.js";

const SETTINGS_KEY = "hotelcrm_settings_v1";
const DEVICE_KEY = "hotelcrm_device_id_v1";

function getDeviceIdLite_(){
  let id = String(localStorage.getItem(DEVICE_KEY) || "").trim();
  if(!id){
    id = "dev_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function getEffectiveDeviceId_(){
  try{
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return String(s.device_id || getDeviceIdLite_()).trim() || getDeviceIdLite_();
  }catch(e){
    return getDeviceIdLite_();
  }
}

function workerUrl_(){
  return String(window.__HOTELCRM_PUSH_WORKER_URL__ || "").trim();
}

async function postWorker_(path, payload){
  const base = workerUrl_();
  if(!base) throw new Error("Push Worker URL missing");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload || {})
  });
  const txt = await res.text();
  let j = null; try{ j = JSON.parse(txt); }catch(e){}
  if(!res.ok || (j && j.error)) throw new Error((j && j.error) ? j.error : `HTTP ${res.status}: ${txt}`);
  return j || { ok:true };
}

function isoAtLocalTime_(dateObj, hh, mm){
  // dateObj assumed local date; set local hh:mm then return ISO
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hh, mm, 0, 0);
  return d.toISOString();
}

function addMinutes_(iso, mins){
  const t = Date.parse(iso);
  if(!isFinite(t)) return iso;
  return new Date(t + mins*60000).toISOString();
}

function buildFollowupJobs_(followupId, whenIso){
  const t = Date.parse(whenIso);
  if(!isFinite(t)) return { job_ids:[], jobs:[] };

  const when = new Date(t);
  const day = new Date(when.getFullYear(), when.getMonth(), when.getDate());

  // 1 day before (local)
  const prev = new Date(day);
  prev.setDate(prev.getDate() - 1);

  const fireList = [
    isoAtLocalTime_(prev, 9, 0),
    isoAtLocalTime_(prev, 14, 0),
    isoAtLocalTime_(prev, 19, 0),
    isoAtLocalTime_(day, 9, 0),
    addMinutes_(whenIso, -60) // 1 hour before exact follow-up time
  ];

  // Dedup + keep future-ish order (worker will ignore if already past)
  const seen = new Set();
  const cleaned = fireList.filter(x=>{
    const k = String(x||"");
    if(!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const job_ids = cleaned.map((fire_at, idx)=> `FU:${followupId}:${idx}`);

  const jobs = cleaned.map((fire_at, idx)=> ({
    job_id: `FU:${followupId}:${idx}`,
    fire_at,
    payload: {
      title: "Hotel CRM — Follow-up",
      body: "⏰ Follow-up reminder",
           url: `?n=followup&id=${encodeURIComponent(followupId)}`
    }
  }));

  return { job_ids, jobs };
}

async function syncFollowupReminderJobs_(followupId, whenIso){
  const device_id = getEffectiveDeviceId_();

  // delete old
  const oldIds = ["0","1","2","3","4"].map(i=>`FU:${followupId}:${i}`);
  await postWorker_("/job/deleteMany", { job_ids: oldIds });

  // upsert new
  const built = buildFollowupJobs_(followupId, whenIso);
  if(built.jobs.length){
    await postWorker_("/job/upsertMany", { device_id, jobs: built.jobs });
  }
}





function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function toLocalDTValue_(iso){
  // ISO -> "YYYY-MM-DDTHH:mm" (local)
  if(!iso) return "";
  const d = new Date(iso);
  const pad = (n)=> String(n).padStart(2,"0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalDTValue_(val){
  // "YYYY-MM-DDTHH:mm" (local) -> ISO
  if(!val) return "";
  const d = new Date(val);
  return d.toISOString();
}

function fmtWhen_(iso){
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

function getLeads_(){
  const db = store.get();
  return db.leads || [];
}

function followupCard_(f, lead){
  const status = f.status || "PENDING";
  const badge = status === "DONE" ? "DONE" : "PENDING";
  const title = lead?.company_name || "(Lead missing)";
  return `
    <div class="listItem" data-id="${esc_(f.id)}">
      <div class="listTop">
        <div>
          <div class="listTitle">${esc_(title)}</div>
          <div class="listMeta">
            <div><b>When:</b> ${esc_(fmtWhen_(f.when_at))}</div>
            <div><b>Note:</b> ${esc_(f.note || "-")}</div>
          </div>
        </div>
        <div class="badge">${esc_(badge)}</div>
      </div>
      <div class="btnRow">
        <button class="btn" data-act="toggle">${status==="DONE" ? "Mark Pending" : "Mark Done"}</button>
        <button class="btn" data-act="edit">Edit</button>
        <button class="btn danger" data-act="delete">Delete</button>
      </div>
    </div>
  `;
}

function renderList_(root){
  const db = store.get();
  const leads = getLeads_();
  const items = (db.followups || []).slice()
    .sort((a,b)=> (a.when_at||"").localeCompare(b.when_at||""));

  root.innerHTML = `
    <div class="card">
      <h2>Follow-ups</h2>
      <p class="small">Reminders linked to leads (offline). Tap ＋ to add.</p>
      <hr class="sep" />
      <div class="label">Filter</div>
      <select class="select" id="f_filter">
        <option value="ALL">All</option>
        <option value="PENDING" selected>Pending</option>
        <option value="DONE">Done</option>
      </select>
      <div id="f_list"></div>
    </div>
  `;

  const listEl = root.querySelector("#f_list");
  const filterEl = root.querySelector("#f_filter");

  function paint_(){
    const fil = filterEl.value;
    const filtered = items.filter(x => fil==="ALL" ? true : (String(x.status||"PENDING") === fil));

    if(!filtered.length){
      listEl.innerHTML = `<div class="small">No follow-ups. Tap ＋ to add a reminder.</div>`;
      return;
    }
    listEl.innerHTML = filtered.map(f=>{
      const lead = leads.find(l=>l.id===f.lead_id);
      return followupCard_(f, lead);
    }).join("");

    bindActions_(root);
  }

  filterEl.addEventListener("change", paint_);
  paint_();
}

function renderForm_(root, id){
  const db = store.get();
  const leads = getLeads_();
  const existing = id ? (db.followups || []).find(x=>x.id===id) : null;

  if(!leads.length){
    root.innerHTML = `
      <div class="card">
        <h2>Follow-ups</h2>
        <p>You need at least 1 Lead before creating follow-ups.</p>
        <div class="btnRow">
          <button class="btn primary" id="go_leads">Go to Leads</button>
        </div>
      </div>
    `;
    root.querySelector("#go_leads").addEventListener("click", ()=>{
      alert("Tap Leads in bottom menu, then add a lead using ＋.");
    });
    return;
  }

  const f = existing || {
    id: store.uid(),
    lead_id: leads[0].id,
    when_at: "",
    note: "",
    status: "PENDING",
    created_at: store.nowISO(),
    updated_at: store.nowISO()
  };

  root.innerHTML = `
    <div class="card">
      <h2>${existing ? "Edit Follow-up" : "New Follow-up"}</h2>

      <div class="label">Lead</div>
      <select class="select" id="f_lead">
        ${leads.map(l=>`<option value="${esc_(l.id)}" ${l.id===f.lead_id?"selected":""}>${esc_(l.company_name || "(No name)")}</option>`).join("")}
      </select>

      <div class="label">Reminder date/time</div>
      <input class="input" type="datetime-local" id="f_when" value="${esc_(toLocalDTValue_(f.when_at))}" />

      <div class="label">Note</div>
      <textarea class="textarea" id="f_note" placeholder="What to follow up about?">${esc_(f.note)}</textarea>

      <div class="label">Status</div>
      <select class="select" id="f_status">
        <option value="PENDING" ${f.status==="PENDING"?"selected":""}>PENDING</option>
        <option value="DONE" ${f.status==="DONE"?"selected":""}>DONE</option>
      </select>

      <div class="btnRow">
        <button class="btn" id="f_cancel">Cancel</button>
        <button class="btn primary" id="f_save">${existing ? "Save" : "Create"}</button>
      </div>
    </div>
  `;

  root.querySelector("#f_cancel").addEventListener("click", ()=> renderList_(root));
    root.querySelector("#f_save").addEventListener("click", async ()=>{
    const lead_id = root.querySelector("#f_lead").value;
    const when_at = fromLocalDTValue_(root.querySelector("#f_when").value);
    const note = root.querySelector("#f_note").value.trim();
    const status = root.querySelector("#f_status").value;

    if(!when_at){
      alert("Please select reminder date/time.");
      return;
    }

    const db2 = store.get();
    const updated = { ...f, lead_id, when_at, note, status, updated_at: store.nowISO() };

    if(existing){
      db2.followups = (db2.followups||[]).map(x=> x.id===id ? updated : x);
    }else{
      db2.followups = db2.followups || [];
      db2.followups.push(updated);
    }
    store.set(db2);
    
       // 🔔 Schedule reminders for this follow-up
    try{
      await syncFollowupReminderJobs_(updated.id, updated.when_at);
    }catch(e){
      console.warn("Follow-up reminder schedule failed", e);
    }
    renderList_(root);
  });
}

function bindActions_(root){
  root.querySelectorAll(".listItem").forEach(row=>{
    const id = row.getAttribute("data-id");
    row.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const act = btn.getAttribute("data-act");
        if(act === "edit") return renderForm_(root, id);
        if(act === "delete"){
          const ok = confirm("Delete this follow-up?");
          if(!ok) return;
          const db = store.get();
                    db.followups = (db.followups||[]).filter(x=>x.id!==id);
          store.set(db);

          // 🔔 delete scheduled reminder jobs
          try{
            const oldIds = ["0","1","2","3","4"].map(i=>`FU:${id}:${i}`);
            await postWorker_("/job/deleteMany", { job_ids: oldIds });
          }catch(e){
            console.warn("Follow-up jobs delete failed", e);
          }

          renderList_(root);
        }
        if(act === "toggle"){
          const db = store.get();
          db.followups = (db.followups||[]).map(x=>{
            if(x.id!==id) return x;
            const st = (x.status||"PENDING") === "DONE" ? "PENDING" : "DONE";
            return { ...x, status: st, updated_at: store.nowISO() };
          });
          store.set(db);
          renderList_(root);
        }
      });
    });
  });
}

export function renderFollowups(root){
  renderList_(root);
}

export function onFabFollowups(root){
  renderForm_(root, null);

}

export function openFollowupById(root, id){
  renderForm_(root, id);
}


