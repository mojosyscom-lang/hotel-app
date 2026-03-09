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

function getLeads_(){
  const db = store.get();
  return db.leads || [];
}

function hasPdf_(c){
  return !!String(c && c.attachment_pdf_data || "").trim();
}

function openPdf_(contract){
  const dataUrl = String(contract && contract.attachment_pdf_data || "").trim();
  if(!dataUrl){
    alert("No PDF saved for this contract.");
    return;
  }
  window.open(dataUrl, "_blank");
}

function contractCard_(c, lead){
  return `
    <div class="listItem" data-id="${esc_(c.id)}">
      <div class="listTop">
        <div>
          <div class="listTitle">${esc_(lead?.company_name || "(Lead missing)")}</div>
          <div class="listMeta">
            <div><b>Final rate:</b> ${esc_(c.final_rate || "-")}</div>
            <div><b>From:</b> ${esc_(fmtDate_(c.start_date))} <br><br><b>To:</b> ${esc_(fmtDate_(c.end_date))}</div>
            <div><b>Contract PDF:</b> ${hasPdf_(c) ? esc_(c.attachment_pdf_name || "Available") : "-"}</div>
          </div>
        </div>
        <div class="badge">${esc_(c.status || "DRAFT")}</div>
      </div>
      ${hasPdf_(c) ? `
        <div class="btnRow">
          <button class="btn" data-act="view-pdf">Show PDF</button>
        </div>
      ` : ``}
    </div>
  `;
}

function bindActions_(root){
  const db = store.get();
  const contracts = db.contracts || [];

  root.querySelectorAll(".listItem").forEach(row=>{
    const id = row.getAttribute("data-id");
    const btn = row.querySelector('button[data-act="view-pdf"]');
    if(!btn) return;

    btn.addEventListener("click", ()=>{
      const contract = contracts.find(x=>x.id===id);
      if(!contract) return alert("Contract not found.");
      openPdf_(contract);
    });
  });
}

export function renderContracts(root){
  const db = store.get();
  const leads = getLeads_();
  const contracts = (db.contracts || []).slice()
    .sort((a,b)=> (b.updated_at||"").localeCompare(a.updated_at||""));

  root.innerHTML = `
    <div class="card">
      <h2>Contracts</h2>
      <p class="small">Saved contracts linked to leads.</p>
      <hr class="sep" />
      <div id="c_list"></div>
    </div>
  `;

  const listEl = root.querySelector("#c_list");

  if(!contracts.length){
    listEl.innerHTML = `<div class="small">No contracts saved yet.</div>`;
    return;
  }

  listEl.innerHTML = contracts.map(c=>{
    const lead = leads.find(l=>l.id===c.lead_id);
    return contractCard_(c, lead);
  }).join("");

  bindActions_(root);
}

export function onFabContracts(){
  // read-only screen now
}
