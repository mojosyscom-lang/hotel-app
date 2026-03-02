import { store } from "../storage.js";
import { getObjectUrl } from "../images_db.js";

function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

async function paintPreviewsReadOnly_(root){
  const logo = await getObjectUrl("company_logo");
  const bg = await getObjectUrl("company_bg");
  const qr = await getObjectUrl("company_qr");

  const setImg = (id, src)=>{
    const el = root.querySelector("#" + id);
    if(!el) return;
    if(src){
      el.src = src;
      el.style.display = "block";
    }else{
      el.removeAttribute("src");
      el.style.display = "none";
    }
  };

  setImg("pv_logo_ro", logo);
  setImg("pv_bg_ro", bg);
  setImg("pv_qr_ro", qr);
}

function row_(label, value){
  const v = String(value || "").trim();
  return `
    <div class="label">${esc_(label)}</div>
    <div style="font-weight:700; line-height:1.35;">${v ? esc_(v) : `<span class="small">—</span>`}</div>
  `;
}

export async function renderCompany(root){
  const db = store.get();
  const c = db.company || {};

  root.innerHTML = `
    <div class="card">
      <h2>Company Details</h2>
      <p class="small">This page is read-only. Edit in Settings → Company Settings.</p>

      ${row_("Company name", c.company_name)}
      ${row_("Contact name", c.contact_name)}

      <div class="row">
        <div>${row_("Phone", c.phone)}</div>
        <div>${row_("GSTIN", c.gstin)}</div>
      </div>

      <div class="label">Address</div>
      <div style="white-space:pre-wrap; font-weight:700; line-height:1.35;">
        ${String(c.address || "").trim() ? esc_(c.address) : `<span class="small">—</span>`}
      </div>

      <hr class="sep" />
      <h2 style="font-size:16px; margin-top:0;">Branding</h2>

      <div class="small">Logo</div>
      <img id="pv_logo_ro" style="display:none; width:100%; max-width:220px; margin-top:8px; border-radius:14px; border:1px solid var(--border);" />

      <div class="small" style="margin-top:14px;">Header background</div>
      <img id="pv_bg_ro" style="display:none; width:100%; margin-top:8px; border-radius:14px; border:1px solid var(--border);" />

      <hr class="sep" />
      <h2 style="font-size:16px; margin-top:0;">Bank QR</h2>
      <img id="pv_qr_ro" style="display:none; width:100%; max-width:260px; margin-top:8px; border-radius:14px; border:1px solid var(--border);" />

      <hr class="sep" />
      <h2 style="font-size:16px; margin-top:0;">Bank Details</h2>

      ${row_("Bank name", c.bank_name)}
      ${row_("Branch", c.bank_branch)}
      ${row_("Account number", c.bank_ac_number)}

      <div class="row">
        <div>${row_("UPI", c.bank_upi)}</div>
        <div>${row_("IFSC", c.bank_ifsc)}</div>
      </div>

      <div class="btnRow">
        <button class="btn" id="btn_open_company_settings">Open Company Settings</button>
      </div>
    </div>
  `;

  root.querySelector("#btn_open_company_settings").addEventListener("click", ()=>{
    // Trigger settings button click (opens sheet)
    const gear = document.getElementById("btn_settings");
    if(gear) gear.click();
  });

  await paintPreviewsReadOnly_(root);
}

export function onFabCompany(root){
  // No FAB action in read-only view
}
