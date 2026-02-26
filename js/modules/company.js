import { store } from "../storage.js";

function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function getCompany_(){
  const db = store.get();
  return db.company || {};
}

function renderCompanyForm_(root){
  const c = getCompany_();

  root.innerHTML = `
    <div class="card">
      <h2>Company Profile</h2>
      <p class="small">Your company details (used in contracts/invoices later).</p>

      <div class="label">Company name</div>
      <input class="input" id="c_name" value="${esc_(c.company_name || "")}" placeholder="Your company name" />

      <div class="label">Contact name</div>
      <input class="input" id="c_contact" value="${esc_(c.contact_name || "")}" placeholder="Owner / Manager name" />

      <div class="row">
        <div>
          <div class="label">Phone number</div>
          <input class="input" id="c_phone" value="${esc_(c.phone || "")}" placeholder="Mobile" inputmode="tel" />
        </div>
        <div>
          <div class="label">GSTIN</div>
          <input class="input" id="c_gstin" value="${esc_(c.gstin || "")}" placeholder="GSTIN" />
        </div>
      </div>

      <div class="label">Address</div>
      <textarea class="textarea" id="c_address" placeholder="Full address">${esc_(c.address || "")}</textarea>

      <hr class="sep" />
      <h2 style="font-size:16px; margin-top:0;">Brand Assets (URLs)</h2>

      <div class="label">Logo URL</div>
      <input class="input" id="c_logo" value="${esc_(c.logo_url || "")}" placeholder="https://..." />

      <div class="label">Background URL</div>
      <input class="input" id="c_bg" value="${esc_(c.background_url || "")}" placeholder="https://..." />

      <div class="label">Bank QR Code URL</div>
      <input class="input" id="c_qr" value="${esc_(c.bank_qr_url || "")}" placeholder="https://..." />

      <hr class="sep" />
      <h2 style="font-size:16px; margin-top:0;">Bank Details</h2>

      <div class="label">Bank name</div>
      <input class="input" id="b_name" value="${esc_(c.bank_name || "")}" placeholder="Bank name" />

      <div class="label">Branch</div>
      <input class="input" id="b_branch" value="${esc_(c.bank_branch || "")}" placeholder="Branch" />

      <div class="label">Account number (full)</div>
      <input class="input" id="b_ac" value="${esc_(c.bank_ac_number || "")}" placeholder="Account number" inputmode="numeric" />

      <div class="row">
        <div>
          <div class="label">UPI</div>
          <input class="input" id="b_upi" value="${esc_(c.bank_upi || "")}" placeholder="name@upi" />
        </div>
        <div>
          <div class="label">IFSC</div>
          <input class="input" id="b_ifsc" value="${esc_(c.bank_ifsc || "")}" placeholder="IFSC code" />
        </div>
      </div>

      <div class="btnRow">
        <button class="btn" id="c_cancel">Cancel</button>
        <button class="btn primary" id="c_save">Save</button>
      </div>
    </div>
  `;

  root.querySelector("#c_cancel").addEventListener("click", ()=> {
    // just re-render to show latest saved values
    renderCompanyForm_(root);
  });

  root.querySelector("#c_save").addEventListener("click", ()=>{
    const company = {
      company_name: root.querySelector("#c_name").value.trim(),
      contact_name: root.querySelector("#c_contact").value.trim(),
      phone: root.querySelector("#c_phone").value.trim(),
      address: root.querySelector("#c_address").value.trim(),
      gstin: root.querySelector("#c_gstin").value.trim(),

      logo_url: root.querySelector("#c_logo").value.trim(),
      background_url: root.querySelector("#c_bg").value.trim(),
      bank_qr_url: root.querySelector("#c_qr").value.trim(),

      bank_name: root.querySelector("#b_name").value.trim(),
      bank_branch: root.querySelector("#b_branch").value.trim(),
      bank_ac_number: root.querySelector("#b_ac").value.trim(),
      bank_upi: root.querySelector("#b_upi").value.trim(),
      bank_ifsc: root.querySelector("#b_ifsc").value.trim(),

      updated_at: store.nowISO()
    };

    const db2 = store.get();
    db2.company = company;
    store.set(db2);
    alert("Company profile saved.");
  });
}

export function renderCompany(root){
  renderCompanyForm_(root);
}

export function onFabCompany(root){
  // focus first input
  const el = root.querySelector("#c_name");
  if(el) el.focus();
}