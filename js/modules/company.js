import { store } from "../storage.js";
import { saveBlob, getObjectUrl, deleteBlob, revokeObjectUrl } from "../images_db.js";
import { applyBranding } from "../components/header.js";

function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

async function paintPreviews_(root){
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

  setImg("pv_logo", logo);
  setImg("pv_bg", bg);
  setImg("pv_qr", qr);
}

async function onPickImage_(root, key){
  const inp = root.querySelector(`#${key}_file`);
  if(!inp || !inp.files || !inp.files[0]) return;

  const file = inp.files[0];
  const blob = file.slice(0, file.size, file.type);

  revokeObjectUrl(key); // safety
  await saveBlob(key, blob);
  await paintPreviews_(root);
  await applyBranding();
  inp.value = "";
}

async function onRemoveImage_(root, key){
  const ok = confirm("Remove this image?");
  if(!ok) return;
  revokeObjectUrl(key);
  await deleteBlob(key);
  await paintPreviews_(root);
  await applyBranding();
}

export async function renderCompany(root){
  const db = store.get();
  const c = db.company || {};

  root.innerHTML = `
    <div class="card">
      <h2>Company Profile</h2>
      <p class="small">One-person offline app: images stored locally on your phone (IndexedDB).</p>

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
      <h2 style="font-size:16px; margin-top:0;">Header Branding</h2>

      <div class="label">Logo (stored locally)</div>
      <input class="input" type="file" id="company_logo_file" accept="image/*" />
      <div class="btnRow">
        <button class="btn" id="btn_logo_save">Save Logo</button>
        <button class="btn danger" id="btn_logo_remove">Remove</button>
      </div>
      <img id="pv_logo" style="display:none; width:100%; max-width:220px; margin-top:10px; border-radius:14px; border:1px solid var(--border);" />

      <div class="label" style="margin-top:14px;">Header background (stored locally)</div>
      <input class="input" type="file" id="company_bg_file" accept="image/*" />
      <div class="btnRow">
        <button class="btn" id="btn_bg_save">Save Background</button>
        <button class="btn danger" id="btn_bg_remove">Remove</button>
      </div>
      <img id="pv_bg" style="display:none; width:100%; margin-top:10px; border-radius:14px; border:1px solid var(--border);" />

      <hr class="sep" />
      <h2 style="font-size:16px; margin-top:0;">Bank QR (stored locally)</h2>
      <input class="input" type="file" id="company_qr_file" accept="image/*" />
      <div class="btnRow">
        <button class="btn" id="btn_qr_save">Save QR</button>
        <button class="btn danger" id="btn_qr_remove">Remove</button>
      </div>
      <img id="pv_qr" style="display:none; width:100%; max-width:260px; margin-top:10px; border-radius:14px; border:1px solid var(--border);" />

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
        <button class="btn primary" id="c_save">Save Profile</button>
      </div>
    </div>
  `;

  // Save text profile
  root.querySelector("#c_save").addEventListener("click", async ()=>{
    const company = {
      company_name: root.querySelector("#c_name").value.trim(),
      contact_name: root.querySelector("#c_contact").value.trim(),
      phone: root.querySelector("#c_phone").value.trim(),
      address: root.querySelector("#c_address").value.trim(),
      gstin: root.querySelector("#c_gstin").value.trim(),

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
    await applyBranding();
    alert("Company profile saved.");
  });

  // Image buttons
  root.querySelector("#btn_logo_save").addEventListener("click", ()=> onPickImage_(root, "company_logo"));
  root.querySelector("#btn_bg_save").addEventListener("click", ()=> onPickImage_(root, "company_bg"));
  root.querySelector("#btn_qr_save").addEventListener("click", ()=> onPickImage_(root, "company_qr"));

  root.querySelector("#btn_logo_remove").addEventListener("click", ()=> onRemoveImage_(root, "company_logo"));
  root.querySelector("#btn_bg_remove").addEventListener("click", ()=> onRemoveImage_(root, "company_bg"));
  root.querySelector("#btn_qr_remove").addEventListener("click", ()=> onRemoveImage_(root, "company_qr"));

  await paintPreviews_(root);
}

export function onFabCompany(root){
  const el = root.querySelector("#c_name");
  if(el) el.focus();
}