import { store } from "../storage.js";

function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function fmtDate_(iso){
  if(!iso) return "-";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

function toDateInput_(iso){
  if(!iso) return "";
  const d = new Date(iso);
  const pad=(n)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function fromDateInput_(val){
  if(!val) return "";
  // store as ISO at noon local to avoid timezone shifts
  const d = new Date(val + "T12:00:00");
  return d.toISOString();
}

function getLeads_(){
  const db = store.get();
  return db.leads || [];
}

function contractCard_(c, lead){
  return `
    <div class="listItem" data-id="${esc_(c.id)}">
      <div class="listTop">
        <div>
          <div class="listTitle">${esc_(lead?.company_name || "(Lead missing)")}</div>
          <div class="listMeta">
            <div><b>Final rate:</b> ${esc_(c.final_rate || "-")}</div>
            <div><b>From:</b> ${esc_(fmtDate_(c.start_date))} <b>To:</b> ${esc_(fmtDate_(c.end_date))}</div>
            <div><b>Attachment URL:</b> ${esc_(c.attachment_url || "-")}</div>
          </div>
        </div>
        <div class="badge">${esc_(c.status || "DRAFT")}</div>
      </div>
      <div class="btnRow">
        <button class="btn" data-act="edit">Edit</button>
        <button class="btn danger" data-act="delete">Delete</button>
      </div>
    </div>
  `;
}

function renderList_(root){
  const db = store.get();
  const leads = getLeads_();
  const contracts = (db.contracts || []).slice()
    .sort((a,b)=> (b.updated_at||"").localeCompare(a.updated_at||""));

  root.innerHTML = `
    <div class="card">
      <h2>Contracts</h2>
      <p class="small">Final rates & contract details linked to leads. Tap ＋ to add.</p>
      <hr class="sep" />
      <div id="c_list"></div>
    </div>
  `;

  const listEl = root.querySelector("#c_list");

  if(!contracts.length){
    listEl.innerHTML = `<div class="small">No contracts yet. Tap ＋ to create.</div>`;
    return;
  }

  listEl.innerHTML = contracts.map(c=>{
    const lead = leads.find(l=>l.id===c.lead_id);
    return contractCard_(c, lead);
  }).join("");

  bindActions_(root);
}

function renderForm_(root, id){
  const db = store.get();
  const leads = getLeads_();
  const existing = id ? (db.contracts||[]).find(x=>x.id===id) : null;

  if(!leads.length){
    root.innerHTML = `
      <div class="card">
        <h2>Contracts</h2>
        <p>You need at least 1 Lead before creating contracts.</p>
        <div class="small">Go to Leads → tap ＋ → create a lead.</div>
      </div>
    `;
    return;
  }

  const c = existing || {
    id: store.uid(),
    lead_id: leads[0].id,
    final_rate: "",
    start_date: "",
    end_date: "",
    attachment_url: "",
    notes: "",
    status: "DRAFT",
    created_at: store.nowISO(),
    updated_at: store.nowISO()
  };

  const company = db.company || {};
  const termsText = String(db.terms?.text || "");

  root.innerHTML = `
    <div class="card">
      <h2>${existing ? "Edit Contract" : "New Contract"}</h2>

      <div class="label">Lead</div>
      <select class="select" id="c_lead">
        ${leads.map(l=>`<option value="${esc_(l.id)}" ${l.id===c.lead_id?"selected":""}>${esc_(l.company_name || "(No name)")}</option>`).join("")}
      </select>

      <div class="label">Final rate</div>
      <input class="input" id="c_rate" value="${esc_(c.final_rate)}" placeholder="Example: ₹1200/room/night" />

      <div class="row">
        <div>
          <div class="label">Start date</div>
          <input class="input" type="date" id="c_start" value="${esc_(toDateInput_(c.start_date))}" />
        </div>
        <div>
          <div class="label">End date</div>
          <input class="input" type="date" id="c_end" value="${esc_(toDateInput_(c.end_date))}" />
        </div>
      </div>

      <div class="label">Attachment URL (optional)</div>
      <input class="input" id="c_attach" value="${esc_(c.attachment_url)}" placeholder="https://..." />

      <div class="label">Notes</div>
      <textarea class="textarea" id="c_notes" placeholder="Extra notes...">${esc_(c.notes)}</textarea>

      <div class="label">Status</div>
      <select class="select" id="c_status">
        ${["DRAFT","SENT","SIGNED","CANCELLED"].map(s=>`<option value="${s}" ${c.status===s?"selected":""}>${s}</option>`).join("")}
      </select>

      <hr class="sep" />
      <div class="small"><b>Company Preview:</b> ${esc_(company.company_name || "-")} • ${esc_(company.phone || "-")}</div>
      <div class="small"><b>Terms Preview:</b> ${esc_(termsText ? (termsText.slice(0,120) + (termsText.length>120?"…":"")) : "-")}</div>

      <div class="btnRow">
        <button class="btn" id="c_cancel">Cancel</button>
        <button class="btn primary" id="c_save">${existing ? "Save" : "Create"}</button>
      </div>
    </div>
  `;

  root.querySelector("#c_cancel").addEventListener("click", ()=> renderList_(root));

  root.querySelector("#c_save").addEventListener("click", ()=>{
    const lead_id = root.querySelector("#c_lead").value;
    const final_rate = root.querySelector("#c_rate").value.trim();
    const start_date = fromDateInput_(root.querySelector("#c_start").value);
    const end_date = fromDateInput_(root.querySelector("#c_end").value);
    const attachment_url = root.querySelector("#c_attach").value.trim();
    const notes = root.querySelector("#c_notes").value.trim();
    const status = root.querySelector("#c_status").value;

    if(!final_rate){
      alert("Please enter final rate.");
      return;
    }

    const db2 = store.get();
    const updated = { ...c, lead_id, final_rate, start_date, end_date, attachment_url, notes, status, updated_at: store.nowISO() };

    if(existing){
      db2.contracts = (db2.contracts||[]).map(x=> x.id===id ? updated : x);
    }else{
      db2.contracts = db2.contracts || [];
      db2.contracts.push(updated);
    }

    store.set(db2);
    renderList_(root);
  });
}

function bindActions_(root){
  root.querySelectorAll(".listItem").forEach(row=>{
    const id = row.getAttribute("data-id");
    row.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const act = btn.getAttribute("data-act");
        if(act === "edit") return renderForm_(root, id);
        if(act === "delete"){
          const ok = confirm("Delete this contract?");
          if(!ok) return;
          const db = store.get();
          db.contracts = (db.contracts||[]).filter(x=>x.id!==id);
          store.set(db);
          renderList_(root);
        }
      });
    });
  });
}

export function renderContracts(root){
  renderList_(root);
}

export function onFabContracts(root){
  renderForm_(root, null);
}