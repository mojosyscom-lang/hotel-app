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

function dataUrlToBlob_(dataUrl){
  const parts = String(dataUrl || "").split(",");
  if(parts.length < 2) throw new Error("Invalid PDF data");

  const meta = parts[0];
  const b64 = parts[1];
  const mimeMatch = meta.match(/data:(.*?);base64/i);
  const mime = mimeMatch ? mimeMatch[1] : "application/pdf";

  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);

  for(let i=0;i<len;i++){
    bytes[i] = bin.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

function ensurePdfViewer_(){
  let back = document.getElementById("pdf_viewer_backdrop");
  let panel = document.getElementById("pdf_viewer_panel");

  if(back && panel) return { back, panel };

  back = document.createElement("div");
  back.id = "pdf_viewer_backdrop";
  back.style.cssText = `
    position:fixed;
    inset:0;
    z-index:100000;
    background:rgba(0,0,0,.50);
    display:none;
  `;

  panel = document.createElement("div");
  panel.id = "pdf_viewer_panel";
  panel.style.cssText = `
    position:fixed;
    inset:0;
    z-index:100001;
    background:var(--card, #fff);
    display:none;
    flex-direction:column;
  `;

  panel.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:calc(env(safe-area-inset-top) + 10px) 12px 10px 12px;
      border-bottom:1px solid var(--border, rgba(0,0,0,.1));
      background:var(--card, #fff);
      flex:0 0 auto;
    ">
      <div id="pdf_viewer_title" style="
        font-weight:800;
        font-size:15px;
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      ">PDF Preview</div>
      <button id="pdf_viewer_close" class="btn" type="button">Close</button>
    </div>

    <iframe
      id="pdf_viewer_frame"
      title="PDF Viewer"
      style="
        width:100%;
        height:100%;
        border:0;
        background:#fff;
        flex:1 1 auto;
      "
    ></iframe>
  `;

  document.body.appendChild(back);
  document.body.appendChild(panel);

  function closePdfViewer_(){
    const frame = document.getElementById("pdf_viewer_frame");
    const oldUrl = frame && frame.dataset.objectUrl ? frame.dataset.objectUrl : "";
    if(oldUrl){
      try{ URL.revokeObjectURL(oldUrl); }catch(e){}
    }
    if(frame){
      frame.removeAttribute("src");
      delete frame.dataset.objectUrl;
    }
    back.style.display = "none";
    panel.style.display = "none";
  }

  back.addEventListener("click", closePdfViewer_);
  panel.querySelector("#pdf_viewer_close").addEventListener("click", closePdfViewer_);

  return { back, panel };
}

function openPdf_(contract){
  const dataUrl = String(contract && contract.attachment_pdf_data || "").trim();
  if(!dataUrl){
    alert("No PDF saved for this contract.");
    return;
  }

  try{
    const { back, panel } = ensurePdfViewer_();
    const blob = dataUrlToBlob_(dataUrl);
    const url = URL.createObjectURL(blob);

    const titleEl = document.getElementById("pdf_viewer_title");
    const frame = document.getElementById("pdf_viewer_frame");

    if(titleEl){
      titleEl.textContent = String(contract.attachment_pdf_name || "Contract PDF");
    }

    if(frame){
      const oldUrl = frame.dataset.objectUrl || "";
      if(oldUrl){
        try{ URL.revokeObjectURL(oldUrl); }catch(e){}
      }
      frame.dataset.objectUrl = url;
      frame.src = url;
    }

    back.style.display = "block";
    panel.style.display = "flex";
  }catch(e){
    console.error("PDF open failed", e);
    alert("Could not open PDF.");
  }
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
