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
    const colorVar =
      (it.label === "Leads") ? "var(--bar1)" :
      (it.label === "Follow") ? "var(--bar2)" :
      (it.label === "Contracts") ? "var(--bar3)" :
      (it.label === "Room") ? "var(--cal-room)" :
      (it.label === "Event") ? "var(--cal-event)" :
      "var(--bar3)";
    
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

  const bookingsArr = Array.isArray(db.bookings) ? db.bookings : [];
  const roomCount = bookingsArr.filter(b => String(b && b.type || "room") !== "event").length;
  const eventCount = bookingsArr.filter(b => String(b && b.type || "") === "event").length;

    // Today + current month
  const pad2 = (n)=> String(n).padStart(2,"0");
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`;
  const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth()+1)}`; // "YYYY-MM"

  // Helpers inline (no new exported functions)
  const inRange = (day, s, e)=> (day && s && e && day >= s && day <= e);
  const isRoom = (b)=> String(b && b.type || "room") !== "event";
  const isEvent = (b)=> String(b && b.type || "") === "event";
  const rateNum = (b)=> Number(b && b.rate) || 0;

  // Today counts (active bookings that cover today)
  const todayRoomCount = bookingsArr.filter(b=>{
    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    return isRoom(b) && inRange(todayIso, s, e);
  }).length;

  const todayEventCount = bookingsArr.filter(b=>{
    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    return isEvent(b) && inRange(todayIso, s, e);
  }).length;

  // Monthly revenue (sum of rate for bookings whose start_date is in current month)
  // (If you later want "every day in range", tell me — we’ll change logic)
  const roomRevenueMonth = bookingsArr.reduce((sum,b)=>{
    const s = String(b && b.start_date || "");
    if(!isRoom(b)) return sum;
    if(!s || s.slice(0,7) !== monthPrefix) return sum;
    return sum + rateNum(b);
  }, 0);

  const eventRevenueMonth = bookingsArr.reduce((sum,b)=>{
    const s = String(b && b.start_date || "");
    if(!isEvent(b)) return sum;
    if(!s || s.slice(0,7) !== monthPrefix) return sum;
    return sum + rateNum(b);
  }, 0);

  const termsLen = String((db.terms && db.terms.text) ? db.terms.text : "").trim().length;
  const termsDone = termsLen > 0 ? "Yes" : "No";

  const companyName = String((db.company && db.company.company_name) ? db.company.company_name : "").trim();
  const companyDone = companyName ? "Yes" : "No";

    const items = [
    { label:"Leads", value: leads },
    { label:"Follow", value: followups },
    { label:"Contracts", value: contracts },
    { label:"Room", value: roomCount },
    { label:"Event", value: eventCount }
  ];

  root.innerHTML = `
    <div class="card">
      <h2>Dashboard</h2>
      
    </div>

    <div class="card">
           <h2 style="font-size:16px; margin-top:0;">Counts</h2>

      <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:stretch;">
        <!-- Small stat card style: auto-fit based on screen width -->
        <div class="card" style="margin:0; flex:1 1 140px; min-width:140px; padding:12px;">
          <div class="small">Leads</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px;">${leads}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 140px; min-width:140px; padding:12px;">
          <div class="small">Follow-ups</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px;">${followups}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 140px; min-width:140px; padding:12px;">
          <div class="small">Contracts</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px;">${contracts}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 140px; min-width:140px; padding:12px;">
          <div class="small">Bookings (Room)</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-room);">${roomCount}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 140px; min-width:140px; padding:12px;">
          <div class="small">Bookings (Event)</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-event);">${eventCount}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 140px; min-width:140px; padding:12px;">
          <div class="small">Terms added?</div>
          <div style="font-size:20px; font-weight:900; margin-top:6px;">${termsDone}</div>
        </div>

        <!-- ✅ NEW 4 cards -->
        <div class="card" style="margin:0; flex:1 1 140px; min-width:140px; padding:12px;">
          <div class="small">Today Room</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-room);">${todayRoomCount}</div>
          <div class="small" style="margin-top:6px;">${todayIso}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 140px; min-width:140px; padding:12px;">
          <div class="small">Today Event</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-event);">${todayEventCount}</div>
          <div class="small" style="margin-top:6px;">${todayIso}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 160px; min-width:160px; padding:12px;">
          <div class="small">Room Revenue (Month)</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-room);">₹${roomRevenueMonth}</div>
          <div class="small" style="margin-top:6px;">${monthPrefix}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 160px; min-width:160px; padding:12px;">
          <div class="small">Event Revenue (Month)</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-event);">₹${eventRevenueMonth}</div>
          <div class="small" style="margin-top:6px;">${monthPrefix}</div>
        </div>
      </div>
     
    </div>

    <div class="card">
      <h2 style="font-size:16px; margin-top:0;">Graph</h2>
            <p class="small" style="margin-bottom:10px;">Leads / Follow-ups / Contracts / Room / Event</p>
      ${barSvg_(items)}
    </div>
  `;
}
