import { store } from "../storage.js";

function n_(v){ return Number(v)||0; }

function barSvg_(items){
  // items: [{label, value}]
  const max = Math.max(1, ...items.map(x=>n_(x.value)));
  const W = 320, H = 140;
  const padL = 36, padR = 10, padT = 10, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const gap = 10;
  const bw = Math.floor((innerW - gap*(items.length-1)) / items.length);

  let x = padL;
  const bars = items.map(it=>{
    const v = n_(it.value);
    const h = Math.round((v/max) * innerH);
    const y = padT + (innerH - h);
    const colorVar = (it.label === "Leads") ? "var(--bar1)" : (it.label === "Follow") ? "var(--bar2)" : "var(--bar3)";
    const rect = `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="10" ry="10" fill="${colorVar}"></rect>`;
    const lbl = `<text x="${x + bw/2}" y="${H-10}" text-anchor="middle" font-size="11" fill="var(--muted)">${it.label}</text>`;
    const val = `<text x="${x + bw/2}" y="${y-6}" text-anchor="middle" font-size="11" fill="var(--muted)">${v}</text>`;
    x += bw + gap;
    return rect + val + lbl;
  }).join("");

  const axis = `<line x1="${padL}" y1="${padT+innerH}" x2="${W-padR}" y2="${padT+innerH}" stroke="var(--border)" />`;

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="160" aria-label="Counts chart">
      ${axis}
      ${bars}
    </svg>
  `;
}

export function renderDashboard(root){
  const db = store.get();

  const leads = Array.isArray(db.leads) ? db.leads.length : 0;
  const followups = Array.isArray(db.followups) ? db.followups.length : 0;
  const contracts = Array.isArray(db.contracts) ? db.contracts.length : 0;

  const termsLen = String((db.terms && db.terms.text) ? db.terms.text : "").trim().length;
  const termsDone = termsLen > 0 ? "Yes" : "No";

  const companyName = String((db.company && db.company.company_name) ? db.company.company_name : "").trim();
  const companyDone = companyName ? "Yes" : "No";

  const items = [
    { label:"Leads", value: leads },
    { label:"Follow", value: followups },
    { label:"Contracts", value: contracts }
  ];

  root.innerHTML = `
    <div class="card">
      <h2>Dashboard</h2>
      
    </div>

    <div class="card">
      <h2 style="font-size:16px; margin-top:0;">Counts</h2>
      <div class="row">
        <div class="card" style="margin:0;">
          <div class="small">Leads</div>
          <div style="font-size:26px; font-weight:900; margin-top:4px;">${leads}</div>
        </div>
        <div class="card" style="margin:0;">
          <div class="small">Follow-ups</div>
          <div style="font-size:26px; font-weight:900; margin-top:4px;">${followups}</div>
        </div>
      </div>

      <div class="row" style="margin-top:10px;">
        <div class="card" style="margin:0;">
          <div class="small">Contracts</div>
          <div style="font-size:26px; font-weight:900; margin-top:4px;">${contracts}</div>
        </div>
       <div class="card" style="margin:0;">
          <div class="small">Terms added?</div>
          <div style="font-size:22px; font-weight:900; margin-top:8px;">${termsDone}</div>
        </div>
      </div>

     
    </div>

    <div class="card">
      <h2 style="font-size:16px; margin-top:0;">Graph</h2>
      <p class="small" style="margin-bottom:10px;">Leads / Follow-ups / Contracts</p>
      ${barSvg_(items)}
    </div>
  `;
}
