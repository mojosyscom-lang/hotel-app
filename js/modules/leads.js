import { store } from "../storage.js";

function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function leadCard_(l){
  const phones = [l.phone1, l.phone2].filter(Boolean).join(" / ");
  return `
    <div class="listItem" data-id="${esc_(l.id)}">
      <div class="listTop">
        <div>
          <div class="listTitle">${esc_(l.company_name || "(No company name)")}</div>
          <div class="listMeta">
            <div><b>Contact:</b> ${esc_(l.contact_name || "-")}</div>
            <div><b>Phone:</b> ${esc_(phones || "-")}</div>
            <div><b>Proposed:</b> ${esc_(l.proposed_rates || "-")}</div>
          </div>
        </div>
        <div class="badge">${esc_(l.status || "NEW")}</div>
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
  const leads = db.leads.slice().sort((a,b)=> (b.updated_at||"").localeCompare(a.updated_at||""));

  root.innerHTML = `
    <div class="card">
      <h2>Leads</h2>
      <p>Create leads for hotels & follow up later.</p>
      <hr class="sep" />
      <div class="label">Search</div>
      <input class="input" id="lead_search" placeholder="Search by company, contact, phone..." />
      <div id="lead_list"></div>
    </div>
  `;

  const listEl = root.querySelector("#lead_list");
  const searchEl = root.querySelector("#lead_search");

  function paint_(q){
    const qq = String(q||"").trim().toLowerCase();
    const filtered = !qq ? leads : leads.filter(l=>{
      const blob = `${l.company_name||""} ${l.contact_name||""} ${l.phone1||""} ${l.phone2||""}`.toLowerCase();
      return blob.includes(qq);
    });

    if(!filtered.length){
      listEl.innerHTML = `<div class="small">No leads yet. Tap ＋ to add.</div>`;
      return;
    }
    listEl.innerHTML = filtered.map(leadCard_).join("");
    bindRowActions_(root);
  }

  searchEl.addEventListener("input", ()=> paint_(searchEl.value));
  paint_("");
}

function renderForm_(root, leadId){
  const db = store.get();
  const existing = leadId ? db.leads.find(x=>x.id===leadId) : null;

  const l = existing || {
    id: store.uid(),
    company_name: "",
    contact_name: "",
    address: "",
    phone1: "",
    phone2: "",
    proposed_rates: "",
    status: "NEW",
    created_at: store.nowISO(),
    updated_at: store.nowISO()
  };

  root.innerHTML = `
    <div class="card">
      <h2>${existing ? "Edit Lead" : "New Lead"}</h2>
      <p class="small">Fill basic info. You can add more fields later.</p>

      <div class="label">Company name</div>
      <input class="input" id="l_company" value="${esc_(l.company_name)}" placeholder="Hotel / Company name" />

      <div class="label">Contact person name</div>
      <input class="input" id="l_contact" value="${esc_(l.contact_name)}" placeholder="Manager name" />

      <div class="label">Address</div>
      <textarea class="textarea" id="l_address" placeholder="Full address">${esc_(l.address)}</textarea>

      <div class="row">
        <div>
          <div class="label">Phone number 1</div>
          <input class="input" id="l_phone1" value="${esc_(l.phone1)}" placeholder="10-digit mobile" inputmode="tel" />
        </div>
        <div>
          <div class="label">Phone number 2</div>
          <input class="input" id="l_phone2" value="${esc_(l.phone2)}" placeholder="Optional" inputmode="tel" />
        </div>
      </div>

      <div class="label">Proposed rates</div>
      <input class="input" id="l_rates" value="${esc_(l.proposed_rates)}" placeholder="Example: ₹1200/room/night" />

      <div class="label">Status</div>
      <select class="select" id="l_status">
        ${["NEW","IN TALK","WAITING","CLOSED","LOST"].map(s=>`<option value="${s}" ${l.status===s?"selected":""}>${s}</option>`).join("")}
      </select>

      <div class="btnRow">
        <button class="btn" id="l_cancel">Cancel</button>
        <button class="btn primary" id="l_save">${existing ? "Save" : "Create"}</button>
      </div>
    </div>
  `;

  root.querySelector("#l_cancel").addEventListener("click", ()=> renderList_(root));
  root.querySelector("#l_save").addEventListener("click", ()=>{
    const company_name = root.querySelector("#l_company").value.trim();
    const contact_name = root.querySelector("#l_contact").value.trim();
    const address = root.querySelector("#l_address").value.trim();
    const phone1 = root.querySelector("#l_phone1").value.trim();
    const phone2 = root.querySelector("#l_phone2").value.trim();
    const proposed_rates = root.querySelector("#l_rates").value.trim();
    const status = root.querySelector("#l_status").value;

    const db2 = store.get();
    const updated = {
      ...l,
      company_name, contact_name, address, phone1, phone2, proposed_rates, status,
      updated_at: store.nowISO()
    };

    if(existing){
      db2.leads = db2.leads.map(x=> x.id===leadId ? updated : x);
    }else{
      db2.leads.push(updated);
    }
    store.set(db2);
    renderList_(root);
  });
}

function bindRowActions_(root){
  root.querySelectorAll(".listItem").forEach(row=>{
    row.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = row.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        if(act === "edit") return renderForm_(root, id);
        if(act === "delete"){
          const ok = confirm("Delete this lead?");
          if(!ok) return;
          const db = store.get();
          db.leads = db.leads.filter(x=>x.id!==id);
          store.set(db);
          renderList_(root);
        }
      });
    });
  });
}

export function renderLeads(root){
  renderList_(root);
}

export function onFabLeads(root){
  renderForm_(root, null);
}