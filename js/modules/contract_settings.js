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
  const pad = (n)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function fromDateInput_(val){
  if(!val) return "";
  const d = new Date(val + "T12:00:00");
  return d.toISOString();
}

function getLeads_(){
  const db = store.get();
  return db.leads || [];
}

function hasPdf_(c){
  return !!String(c && c.attachment_pdf_data || "").trim();
}

function fileToDataUrl_(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(String(reader.result || ""));
    reader.onerror = ()=> reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function safeFilePart_(s){
  return String(s || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function buildContractPdfName_(lead, status, startDateIso){
  const companyPart = safeFilePart_(lead && lead.company_name ? lead.company_name : "Lead");
  const statusPart = safeFilePart_(status || "DRAFT");
  const datePart = String(startDateIso || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `Contract_${companyPart}_${statusPart}_${datePart}.pdf`;
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
      <div class="btnRow">
        <button class="btn" data-act="edit">Edit</button>
        <button class="btn danger" data-act="delete">Delete</button>
      </div>
    </div>
  `;
}

function renderList_(root, onBack){
  const db = store.get();
  const leads = getLeads_();
  const contracts = (db.contracts || []).slice()
    .sort((a,b)=> (b.updated_at||"").localeCompare(a.updated_at||""));

  root.innerHTML = `
    <div class="card">
      <h2>Contract Settings</h2>
      <p class="small">Create, edit and manage saved contracts. Optional PDF is stored locally and included in backup.</p>

      <div class="btnRow" style="margin-top:12px;">
        <button class="btn" id="btn_back_menu">Back</button>
        <button class="btn primary" id="cs_new">New Contract</button>
      </div>

      <hr class="sep" />
      <div id="c_list"></div>
    </div>
  `;

  root.querySelector("#btn_back_menu").addEventListener("click", ()=>{
    if(typeof onBack === "function") onBack();
  });

  root.querySelector("#cs_new").addEventListener("click", ()=>{
    renderForm_(root, onBack, null);
  });

  const listEl = root.querySelector("#c_list");

  if(!contracts.length){
    listEl.innerHTML = `<div class="small">No contracts yet. Tap "New Contract" to create one.</div>`;
    return;
  }

  listEl.innerHTML = contracts.map(c=>{
    const lead = leads.find(l=>l.id===c.lead_id);
    return contractCard_(c, lead);
  }).join("");

  bindActions_(root, onBack);
}

function renderForm_(root, onBack, id){
  const db = store.get();
  const leads = getLeads_();
  const existing = id ? (db.contracts||[]).find(x=>x.id===id) : null;

  if(!leads.length){
    root.innerHTML = `
      <div class="card">
        <h2>Contract Settings</h2>
        <p>You need at least 1 Lead before creating contracts.</p>
        <div class="small">Go to Leads → tap ＋ → create a lead.</div>

        <div class="btnRow" style="margin-top:12px;">
          <button class="btn" id="btn_back_menu">Back</button>
        </div>
      </div>
    `;

    root.querySelector("#btn_back_menu").addEventListener("click", ()=>{
      if(typeof onBack === "function") onBack();
    });

    return;
  }

  const c = existing || {
    id: store.uid(),
    lead_id: leads[0].id,
    final_rate: "",
    start_date: "",
    end_date: "",
    attachment_pdf_name: "",
    attachment_pdf_type: "",
    attachment_pdf_data: "",
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

      <div class="label">Upload Contract PDF (optional)</div>
      <input class="input" type="file" id="c_pdf" accept="application/pdf" />

      <div class="small" style="margin-top:6px;">
        <b>Saved PDF:</b> ${hasPdf_(c) ? esc_(c.attachment_pdf_name || "Available") : "-"}
      </div>

      ${hasPdf_(c) ? `
        <label class="small" style="display:block; margin-top:8px;">
          <input type="checkbox" id="c_remove_pdf" />
          Remove saved PDF
        </label>
      ` : ``}

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

  root.querySelector("#c_cancel").addEventListener("click", ()=>{
    renderList_(root, onBack);
  });

  root.querySelector("#c_save").addEventListener("click", async ()=>{
    const lead_id = root.querySelector("#c_lead").value;
    const final_rate = root.querySelector("#c_rate").value.trim();
    const start_date = fromDateInput_(root.querySelector("#c_start").value);
    const end_date = fromDateInput_(root.querySelector("#c_end").value);
    const notes = root.querySelector("#c_notes").value.trim();
    const status = root.querySelector("#c_status").value;

    if(!final_rate){
      alert("Please enter final rate.");
      return;
    }

    let attachment_pdf_name = String(c.attachment_pdf_name || "");
    let attachment_pdf_type = String(c.attachment_pdf_type || "");
    let attachment_pdf_data = String(c.attachment_pdf_data || "");

    const removePdfEl = root.querySelector("#c_remove_pdf");
    if(removePdfEl && removePdfEl.checked){
      attachment_pdf_name = "";
      attachment_pdf_type = "";
      attachment_pdf_data = "";
    }

    const pdfFile = root.querySelector("#c_pdf").files && root.querySelector("#c_pdf").files[0]
      ? root.querySelector("#c_pdf").files[0]
      : null;

      if(pdfFile){
      const fileType = String(pdfFile.type || "").toLowerCase();
      const fileName = String(pdfFile.name || "");
      const isPdf = (fileType === "application/pdf") || /\.pdf$/i.test(fileName);

      if(!isPdf){
        alert("Please upload a PDF file only.");
        return;
      }

      const pdfData = await fileToDataUrl_(pdfFile);
      attachment_pdf_name = pdfFile.name || "contract.pdf";
      attachment_pdf_type = fileType || "application/pdf";
      attachment_pdf_data = pdfData;
    }

      const db2 = store.get();
    const leadObj = leads.find(l => l.id === lead_id) || null;

    if(pdfFile){
      attachment_pdf_name = buildContractPdfName_(leadObj, status, start_date);
    }

    const updated = {
      ...c,
      lead_id,
      final_rate,
      start_date,
      end_date,
      attachment_pdf_name,
      attachment_pdf_type,
      attachment_pdf_data,
      notes,
      status,
      updated_at: store.nowISO()
    };

    if(existing){
      db2.contracts = (db2.contracts||[]).map(x=> x.id===id ? updated : x);
    }else{
      db2.contracts = db2.contracts || [];
      db2.contracts.push(updated);
    }

    await store.set(db2);
    renderList_(root, onBack);
  });
}

function bindActions_(root, onBack){
  root.querySelectorAll(".listItem").forEach(row=>{
    const id = row.getAttribute("data-id");
    row.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const act = btn.getAttribute("data-act");
        if(act === "edit") return renderForm_(root, onBack, id);

        if(act === "delete"){
          const ok = confirm("Delete this contract?");
          if(!ok) return;

          const db = store.get();
          db.contracts = (db.contracts||[]).filter(x=>x.id!==id);
          await store.set(db);
          renderList_(root, onBack);
        }
      });
    });
  });
}

export async function renderContractSettings(root, onBack){
  renderList_(root, onBack);
}
