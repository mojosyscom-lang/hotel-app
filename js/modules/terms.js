import { store } from "../storage.js";

function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function getTermsText_(){
  const db = store.get();
  return String((db.terms && db.terms.text) ? db.terms.text : "");
}

function renderEditor_(root, onBack){
  const db = store.get();
  const text = String(db.terms?.text || "");

  root.innerHTML = `
    <div class="card">
      <h2>Terms Settings</h2>
      <p class="small">These terms can be used in contracts later.</p>

      <div class="label">Default Terms Text</div>
      <textarea class="textarea" id="t_text" placeholder="Type your default terms..." style="min-height:260px; white-space:pre-wrap;">${esc_(text)}</textarea>

      <div class="btnRow">
        <button class="btn" id="t_back" type="button">Back</button>
        <button class="btn" id="t_reset" type="button">Clear</button>
        <button class="btn primary" id="t_save" type="button">Save</button>
      </div>
    </div>
  `;

  root.querySelector("#t_back").addEventListener("click", ()=>{
    if(typeof onBack === "function") onBack();
  });

  root.querySelector("#t_reset").addEventListener("click", ()=>{
    const ok = confirm("Clear terms text?");
    if(!ok) return;
    root.querySelector("#t_text").value = "";
  });

  root.querySelector("#t_save").addEventListener("click", ()=>{
    const db2 = store.get();
    const oldTerms = (db2.terms && typeof db2.terms === "object") ? db2.terms : {};
    const nowIso = store.nowISO();

    db2.terms = {
      ...oldTerms,
      text: root.querySelector("#t_text").value.trim(),
      created_at: oldTerms.created_at || nowIso,
      updated_at: nowIso
    };

    store.set(db2);
    alert("Terms saved.");
  });
}

export function renderTerms(root){
  const text = getTermsText_().trim();

  root.innerHTML = `
    <div class="card">
      <h2>Terms & Conditions</h2>
      ${
        text
          ? `<div style="white-space:pre-wrap; line-height:1.6;">${esc_(text)}</div>`
          : `<div class="small">No terms added yet.</div>`
      }
    </div>
  `;
}

export function renderTermsSettings(root, onBack){
  renderEditor_(root, onBack);
}

export function onFabTerms(root){
  // Read-only screen now, so no FAB action
  return;
}
