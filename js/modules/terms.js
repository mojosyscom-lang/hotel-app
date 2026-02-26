import { store } from "../storage.js";

function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function renderEditor_(root){
  const db = store.get();
  const text = String(db.terms?.text || "");

  root.innerHTML = `
    <div class="card">
      <h2>Terms & Conditions</h2>
      <p class="small">These terms can be used in contracts later.</p>

      <div class="label">Default Terms Text</div>
      <textarea class="textarea" id="t_text" placeholder="Type your default terms...">${esc_(text)}</textarea>

      <div class="btnRow">
        <button class="btn" id="t_reset">Clear</button>
        <button class="btn primary" id="t_save">Save</button>
      </div>
    </div>
  `;

  root.querySelector("#t_reset").addEventListener("click", ()=>{
    const ok = confirm("Clear terms text?");
    if(!ok) return;
    root.querySelector("#t_text").value = "";
  });

  root.querySelector("#t_save").addEventListener("click", ()=>{
    const db2 = store.get();
    db2.terms = { text: root.querySelector("#t_text").value.trim(), updated_at: store.nowISO() };
    store.set(db2);
    alert("Terms saved.");
  });
}

export function renderTerms(root){
  renderEditor_(root);
}

export function onFabTerms(root){
  // Same screen (already editor)
  const ta = root.querySelector("#t_text");
  if(ta) ta.focus();
}