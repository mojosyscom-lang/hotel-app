import { store } from "../storage.js";



function monthKeyFromIso_(iso){
  return String(iso || "").slice(0, 7);
}

function roomsCount_(b){
  const direct = Number(b && b.rooms_count);
  if(isFinite(direct) && direct > 0) return direct;

  return String(b && b.room_no || "")
    .split(",")
    .map(x=>x.trim())
    .filter(Boolean)
    .length;
}

function roomNights_(b){
  const direct = Number(b && b.nights_count);
  if(isFinite(direct) && direct > 0) return direct;

  const s = String(b && b.start_date || "");
  const e = String(b && b.end_date || "");
  if(!s || !e) return 0;

  const start = new Date(s + "T00:00:00");
  const end = new Date(e + "T00:00:00");
  if(!isFinite(start) || !isFinite(end)) return 0;

  const nights = Math.floor((end - start) / 86400000);
  return nights > 0 ? nights : 1;
}

function totalAmount_(b){
  const direct = Number(b && b.total_amount);
  if(isFinite(direct) && direct >= 0) return direct;

  const rate = Number(b && b.rate) || 0;
  return rate * roomNights_(b) * roomsCount_(b);
}

function eventAmount_(b){
  const direct = Number(b && b.total_amount);
  if(isFinite(direct) && direct >= 0) return direct;

  const rate = Number(b && b.rate) || 0;
  const days = Number(b && b.days_count) || 0;
  return rate * days;
}

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
    
    // Today + current month
    const pad2 = (n)=> String(n).padStart(2,"0");
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`;
  const currentMonthKey = `${now.getFullYear()}-${pad2(now.getMonth()+1)}`;
  const stats = db.stats && db.stats[currentMonthKey] ? db.stats[currentMonthKey] : null;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthPrefix = monthNames[now.getMonth()];
  const totalRooms = Number(db.company && db.company.total_rooms) || 0;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthStartIso = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-01`;
  const monthEndIso = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(daysInMonth)}`;

    const roomCount = stats ? stats.roomBookings : bookingsArr.reduce((sum,b)=>{
    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    if(String(b && b.type || "room") === "event") return sum;
    if(!s || !e) return sum;

    const overlapStart = s > monthStartIso ? s : monthStartIso;
    const overlapEnd = e < monthEndIso ? e : monthEndIso;
    if(overlapStart > overlapEnd) return sum;

    return sum + roomsCount_(b);
 }, 0);
  const eventCount = stats ? stats.eventBookings : bookingsArr.reduce((sum,b)=>{
    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    if(String(b && b.type || "") !== "event") return sum;
    if(!s || !e) return sum;

    const overlapStart = s > monthStartIso ? s : monthStartIso;
    const overlapEnd = e < monthEndIso ? e : monthEndIso;
    if(overlapStart > overlapEnd) return sum;

    return sum + 1;
  }, 0);


  // Helpers inline (no new exported functions)
  const inRange = (day, s, e)=> (day && s && e && day >= s && day <= e);
  const isRoom = (b)=> String(b && b.type || "room") !== "event";
  const isEvent = (b)=> String(b && b.type || "") === "event";
  const rateNum = (b)=> Number(b && b.rate) || 0;

    // Today counts (active bookings that cover today)
  const todayRoomCount = bookingsArr.reduce((sum,b)=>{
    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    if(!(isRoom(b) && inRange(todayIso, s, e))) return sum;
    return sum + roomsCount_(b);
  }, 0);

  const todayEventCount = bookingsArr.filter(b=>{
    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    return isEvent(b) && inRange(todayIso, s, e);
  }).length;

  // Pre-booked = today + future
     const preBookedNights = stats ? stats.roomNights : bookingsArr.reduce((sum,b)=>{
    if(!isRoom(b)) return sum;

    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    if(!s || !e) return sum;

    const overlapStart = s > monthStartIso ? s : monthStartIso;
    const overlapEnd = e < monthEndIso ? e : monthEndIso;
    if(overlapStart > overlapEnd) return sum;

    const start = new Date(overlapStart + "T00:00:00");
    const end = new Date(overlapEnd + "T00:00:00");
    if(!isFinite(start) || !isFinite(end)) return sum;

    const overlapNights = Math.floor((end - start) / 86400000);
    const safeNights = overlapNights > 0 ? overlapNights : 1;

    return sum + (safeNights * roomsCount_(b));
  }, 0);

  const preBookedEvents = stats ? stats.eventDays : bookingsArr.reduce((sum,b)=>{
    if(!isEvent(b)) return sum;

    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    if(!s || !e) return sum;

    const overlapStart = s > monthStartIso ? s : monthStartIso;
    const overlapEnd = e < monthEndIso ? e : monthEndIso;
    if(overlapStart > overlapEnd) return sum;

    const start = new Date(overlapStart + "T00:00:00");
    const end = new Date(overlapEnd + "T00:00:00");
    if(!isFinite(start) || !isFinite(end)) return sum;

    const overlapDays = Math.floor((end - start) / 86400000) + 1;
    const safeDays = overlapDays > 0 ? overlapDays : 1;

    return sum + safeDays;
  }, 0);

  // Monthly revenue directly from stored total_amount
   const roomRevenueMonth = stats ? stats.roomRevenue : bookingsArr.reduce((sum,b)=>{
    if(!isRoom(b)) return sum;

    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    if(!s || !e) return sum;

    const overlapStart = s > monthStartIso ? s : monthStartIso;
    const overlapEnd = e < monthEndIso ? e : monthEndIso;
    if(overlapStart > overlapEnd) return sum;

    const start = new Date(s + "T00:00:00");
    const end = new Date(e + "T00:00:00");
    const ovStart = new Date(overlapStart + "T00:00:00");
    const ovEnd = new Date(overlapEnd + "T00:00:00");
    if(!isFinite(start) || !isFinite(end) || !isFinite(ovStart) || !isFinite(ovEnd)) return sum;

    const totalNights = Math.floor((end - start) / 86400000);
    const overlapNights = Math.floor((ovEnd - ovStart) / 86400000);

    const safeTotalNights = totalNights > 0 ? totalNights : 1;
    const safeOverlapNights = overlapNights > 0 ? overlapNights : 1;

    return sum + Math.round((totalAmount_(b) * safeOverlapNights) / safeTotalNights);
  }, 0);

    const eventRevenueMonth = stats ? stats.eventRevenue : bookingsArr.reduce((sum,b)=>{
    if(!isEvent(b)) return sum;

    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    if(!s || !e) return sum;

    const overlapStart = s > monthStartIso ? s : monthStartIso;
    const overlapEnd = e < monthEndIso ? e : monthEndIso;
    if(overlapStart > overlapEnd) return sum;

    const start = new Date(s + "T00:00:00");
    const end = new Date(e + "T00:00:00");
    const ovStart = new Date(overlapStart + "T00:00:00");
    const ovEnd = new Date(overlapEnd + "T00:00:00");
    if(!isFinite(start) || !isFinite(end) || !isFinite(ovStart) || !isFinite(ovEnd)) return sum;

    const totalDays = Math.floor((end - start) / 86400000) + 1;
    const overlapDays = Math.floor((ovEnd - ovStart) / 86400000) + 1;
    if(totalDays <= 0 || overlapDays <= 0) return sum;

    return sum + Math.round((eventAmount_(b) * overlapDays) / totalDays);
  }, 0);


  /*  // this below might be culprit 
  const totalRooms = Number(db.company && db.company.total_rooms) || 0;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthStartIso = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-01`;
  const monthEndIso = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(daysInMonth)}`;

  */

  const bookedRoomNightsMonth = bookingsArr.reduce((sum,b)=>{
    if(!isRoom(b)) return sum;

    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    if(!s || !e) return sum;

    const overlapStart = s > monthStartIso ? s : monthStartIso;
    const overlapEnd = e < monthEndIso ? e : monthEndIso;
    if(overlapStart > overlapEnd) return sum;

    const start = new Date(overlapStart + "T00:00:00");
    const end = new Date(overlapEnd + "T00:00:00");
    if(!isFinite(start) || !isFinite(end)) return sum;

    const overlapNights = Math.floor((end - start) / 86400000);
    const safeNights = overlapNights > 0 ? overlapNights : 1;

    return sum + (safeNights * roomsCount_(b));
  }, 0);

  const totalAvailableRoomNights = totalRooms * daysInMonth;
  const occupancyPct = totalAvailableRoomNights > 0
    ? Math.round((bookedRoomNightsMonth / totalAvailableRoomNights) * 100)
    : 0;

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
           <h2 style="font-size:16px; margin-top:0;">Dashboard Counts</h2>

      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:stretch;">
        <!-- Small stat card style: auto-fit based on screen width -->
        <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Leads</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px;">${leads}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Follow-ups</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px;">${followups}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Contracts</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px;">${contracts}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Rooms Booked (${monthPrefix})</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-room);">${roomCount}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Events Booked (${monthPrefix})</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-event);">${eventCount}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Terms added?</div>
          <div style="font-size:20px; font-weight:900; margin-top:6px;">${termsDone}</div>
        </div>

               <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Rooms Booked Today</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-room);">${todayRoomCount}</div>
          <div class="small" style="font-size:8px; margin-top:6px;" hidden>${todayIso}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Today Events</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-event);">${todayEventCount}</div>
          <div class="small" style="font-size:8px; margin-top:6px;" hidden>${todayIso}</div>
        </div>

        <button class="card" id="dash_pre_room_btn" type="button" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px; text-align:left; cursor:pointer;">
          <div class="small">Nights Booked (${monthPrefix})</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-room);">${preBookedNights}</div>
          <div class="small" style="margin-top:6px;" hidden/>Tap to view</div>
        </button>

        <button class="card" id="dash_pre_event_btn" type="button" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px; text-align:left; cursor:pointer;">
          <div class="small">Event Days (${monthPrefix})</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-event);">${preBookedEvents}</div>
          <div class="small" style="margin-top:6px;" hidden/>Tap to view</div>
        </button>

        <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Room Amount (${monthPrefix})</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-room);">₹${roomRevenueMonth}</div>
          <div class="small" style="font-size:8px; margin-top:6px;" hidden>${monthPrefix}</div>
        </div>

        <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Event Amount (${monthPrefix})</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-event);">₹${eventRevenueMonth}</div>
          <div class="small" style="font-size:8px; margin-top:6px;" hidden>${monthPrefix}</div>
        </div>

                <div class="card" style="margin:0; flex:1 1 100px; min-width:100px; padding:10px;">
          <div class="small">Occupancy (${monthPrefix})</div>
          <div style="font-size:22px; font-weight:900; margin-top:4px; color: var(--cal-room);">${occupancyPct}%</div>
          <div class="small" style="margin-top:6px;">${bookedRoomNightsMonth}/${totalAvailableRoomNights || 0} room nights</div>
        </div>
      </div>
     
    </div>

       <div class="card">
      <h2 style="font-size:16px; margin-top:0;">Graph</h2>
      <p class="small" style="margin-bottom:10px;">Leads / Follow-ups / Contracts / Room / Event</p>
      ${barSvg_(items)}
    </div>

    
  `;



    const preRoomBtn = root.querySelector("#dash_pre_room_btn");
  const preEventBtn = root.querySelector("#dash_pre_event_btn");

   if(preRoomBtn){
    preRoomBtn.addEventListener("click", async ()=>{
      const mod = await import("./table.js");
      mod.renderBookingTablePage(root, {
        mode: "room",
        monthKey: currentMonthKey,
        search: "",
        onBack: ()=> renderDashboard(root)
      });
    });
  }

   if(preEventBtn){
    preEventBtn.addEventListener("click", async ()=>{
      const mod = await import("./table.js");
      mod.renderBookingTablePage(root, {
        mode: "event",
        monthKey: currentMonthKey,
        search: "",
        onBack: ()=> renderDashboard(root)
      });
    });
  }
}
