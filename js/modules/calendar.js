import { store } from "../storage.js";

const SETTINGS_KEY = "hotelcrm_settings_v1";
const DEVICE_KEY = "hotelcrm_device_id_v1";

function getDeviceIdLite_(){
  let id = String(localStorage.getItem(DEVICE_KEY) || "").trim();
  if(!id){
    id = "dev_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
function getEffectiveDeviceId_(){
  try{
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return String(s.device_id || getDeviceIdLite_()).trim() || getDeviceIdLite_();
  }catch(e){
    return getDeviceIdLite_();
  }
}
function workerUrl_(){
  return String(window.__HOTELCRM_PUSH_WORKER_URL__ || "").trim();
}
async function postWorker_(path, payload){
  const base = workerUrl_();
  if(!base) throw new Error("Push Worker URL missing");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload || {})
  });
  const txt = await res.text();
  let j = null; try{ j = JSON.parse(txt); }catch(e){}
  if(!res.ok || (j && j.error)) throw new Error((j && j.error) ? j.error : `HTTP ${res.status}: ${txt}`);
  return j || { ok:true };
}

function isoLocal_(y,m,d,hh,mm){
  const dt = new Date(y, m, d, hh, mm, 0, 0);
  return dt.toISOString();
}

function parseHHMM_(hhmm){
  const [h,m] = String(hhmm||"").split(":").map(x=>parseInt(x,10));
  return { h: isFinite(h)?h:9, m: isFinite(m)?m:0 };
}

function buildBookingJobs_(bookingId, start_date, start_time){
  // start_date is "YYYY-MM-DD"
  const dt = parseIso_(start_date); // you already have parseIso_ in file
  if(!dt) return { job_ids:[], jobs:[] };

  const y = dt.getFullYear();
  const m = dt.getMonth();
  const d = dt.getDate();

  const prev = new Date(y, m, d);
  prev.setDate(prev.getDate() - 1);

  const t = parseHHMM_(start_time || "09:00");
  const oneHourBefore = new Date(y, m, d, t.h, t.m, 0, 0);
  oneHourBefore.setHours(oneHourBefore.getHours() - 1);

  const fires = [
    isoLocal_(prev.getFullYear(), prev.getMonth(), prev.getDate(), 9, 0),
    isoLocal_(prev.getFullYear(), prev.getMonth(), prev.getDate(), 14, 0),
    isoLocal_(prev.getFullYear(), prev.getMonth(), prev.getDate(), 19, 0),
    isoLocal_(y, m, d, 9, 0),
    oneHourBefore.toISOString()
  ];

  const seen = new Set();
  const cleaned = fires.filter(x=>{
    const k = String(x||"");
    if(!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

    const now = Date.now();
  const future = cleaned.filter(iso => {
    const t2 = Date.parse(iso);
    return isFinite(t2) && t2 > (now + 60000); // only > 1 minute in future
  });

  const jobs = future.map((fire_at, idx)=>({
    job_id: `BK:${bookingId}:${idx}`,
    fire_at,
    payload: {
      title: "Hotel CRM — Booking",
      body: `📅 ${String(start_date||"")} ${String(start_time||"")}`,
      url: `?n=calendar&day=${encodeURIComponent(start_date)}`
    }
  }));

  const job_ids = future.map((_, idx)=>`BK:${bookingId}:${idx}`);
  return { job_ids, jobs };
}

async function syncBookingReminderJobs_(bookingId, start_date, start_time){
  const device_id = getEffectiveDeviceId_();
  const oldIds = ["0","1","2","3","4"].map(i=>`BK:${bookingId}:${i}`);
  await postWorker_("/job/deleteMany", { job_ids: oldIds });

  const built = buildBookingJobs_(bookingId, start_date, start_time);
  if(built.jobs.length){
    await postWorker_("/job/upsertMany", { device_id, jobs: built.jobs });
  }
}


function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}


function toLocalDTValue_(iso){
  // ISO -> "YYYY-MM-DDTHH:mm" (local)
  if(!iso) return "";
  const d = new Date(iso);
  const pad = (n)=> String(n).padStart(2,"0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalDTValue_(val){
  // "YYYY-MM-DDTHH:mm" (local) -> ISO
  if(!val) return "";
  const d = new Date(val);
  return d.toISOString();
}

function bookingIsoFromParts_(start_date, start_time){
  // start_date: YYYY-MM-DD, start_time: HH:mm => ISO
  if(!start_date) return "";
  const t = String(start_time||"09:00").trim() || "09:00";
  const [hh, mm] = t.split(":").map(x=>parseInt(x,10));
  const dt = parseIso_(start_date);
  if(!dt) return "";
  const d2 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), isFinite(hh)?hh:9, isFinite(mm)?mm:0, 0, 0);
  return d2.toISOString();
}




function pad2_(n){ return String(n).padStart(2,"0"); }

function isoDate_(d){
  return `${d.getFullYear()}-${pad2_(d.getMonth()+1)}-${pad2_(d.getDate())}`;
}
function todayIso_(){
  return isoDate_(new Date());
}
function monthKey_(d){
  return `${d.getFullYear()}-${pad2_(d.getMonth()+1)}`;
}
function parseIso_(iso){
  const [y,m,d] = String(iso||"").split("-").map(x=>parseInt(x,10));
  if(!y||!m||!d) return null;
  return new Date(y, m-1, d);
}
function addDays_(iso, days){
  const dt = parseIso_(iso);
  if(!dt) return iso;
  dt.setDate(dt.getDate()+days);
  return isoDate_(dt);
}
function diffDaysInclusive_(startIso, endIso){
  const s = parseIso_(startIso);
  const e = parseIso_(endIso);
  if(!s || !e) return 0;
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / 86400000) + 1;
  return days > 0 ? days : 0;
}

function diffNights_(startIso, endIso){
  const s = parseIso_(startIso);
  const e = parseIso_(endIso);
  if(!s || !e) return 0;
  const ms = e.getTime() - s.getTime();
  const nights = Math.floor(ms / 86400000);
  return nights > 0 ? nights : 1; // same day = 1 night for your current booking style
}

function num0_(v){
  const n = Number(v);
  return isFinite(n) ? n : 0;
}


function inRange_(dayIso, startIso, endIso){
  // inclusive range
  return (dayIso >= startIso && dayIso <= endIso);
}

/* --------------------------------------------------
   Check if a room is already booked for date range
-------------------------------------------------- */
function roomConflict_(db, room, start_date, end_date, ignoreId){
  const list = Array.isArray(db.bookings) ? db.bookings : [];

  for(const b of list){

    if(ignoreId && String(b.id) === String(ignoreId)) continue;

    const existingRooms = String(b.room_no || "")
      .split(",")
      .map(x=>x.trim())
      .filter(Boolean);

    if(!existingRooms.includes(room)) continue;

    const s = String(b.start_date || "");
    const e = String(b.end_date || "");

    if(!s || !e) continue;

    // overlap check
    if(!(end_date < s || start_date > e)){
      return b;
    }
  }

  return null;
}

function ensureBookings_(db){
  if(!Array.isArray(db.bookings)) db.bookings = [];
  return db;
}

function listForDay_(db, dayIso){
  const arr = Array.isArray(db.bookings) ? db.bookings : [];
  return arr.filter(b=>{
    const s = String(b.start_date||"");
    const e = String(b.end_date||"");
    if(!s || !e) return false;
    return inRange_(dayIso, s, e);
  });
}

function countDotsForDay_(db, dayIso){
  const items = listForDay_(db, dayIso);
  let room = 0, event = 0;
  items.forEach(b=>{
    if(String(b.type||"") === "event") event++;
    else room++;
  });
  return { room, event, total: items.length };
}

let viewDate = new Date(); // month being viewed

// Bottom sheet elements created once
let sheetBackdrop, sheetEl;

function ensureSheet_(){
  if(sheetBackdrop && sheetEl) return;

  sheetBackdrop = document.createElement("div");
  sheetBackdrop.className = "sheetBackdrop";
  sheetBackdrop.id = "cal_sheet_backdrop";

  sheetEl = document.createElement("div");
  sheetEl.className = "sheet";
  sheetEl.id = "cal_sheet";

  document.body.appendChild(sheetBackdrop);
  document.body.appendChild(sheetEl);

  sheetBackdrop.addEventListener("click", closeSheet_);
}

function openSheet_(html){
  ensureSheet_();
  sheetEl.innerHTML = html;
  sheetBackdrop.classList.add("open");
  sheetEl.classList.add("open");
}
function closeSheet_(){
  if(!sheetBackdrop || !sheetEl) return;
  sheetBackdrop.classList.remove("open");
  sheetEl.classList.remove("open");
}

function monthName_(m){
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return names[m] || "";
}
function setBtnBusy_(btn, busy){
  if(!btn) return;
  if(busy){
    btn.classList.add("processing");
    btn.disabled = true;
  }else{
    btn.classList.remove("processing");
    btn.disabled = false;
  }
}
function uid_(){
  return "bk_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function renderMonth_(root){
  const db = store.get();
  ensureBookings_(db);

  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();

  const first = new Date(y, m, 1);
  const startDow = first.getDay(); // 0=Sun
  const daysInMonth = new Date(y, m+1, 0).getDate();

  // Start grid from previous month days to fill first week
  const gridStart = new Date(y, m, 1 - startDow);

  const title = `${monthName_(m)} ${y}`;
  const today = todayIso_();

  let cells = "";
  for(let i=0;i<42;i++){
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate()+i);
    const iso = isoDate_(d);

    const inThisMonth = (d.getMonth() === m);
    const dots = countDotsForDay_(db, iso);

    const muted = inThisMonth ? "" : " muted";
    const isToday = (iso === today) ? " calToday" : "";

    const dotHtml = `
      <div class="calBadges">
        ${dots.room ? `<span class="dot room" title="Room"></span>` : ``}
        ${dots.event ? `<span class="dot event" title="Event"></span>` : ``}
        ${dots.total ? `<span class="badgeCount">${dots.total}</span>` : ``}
      </div>
    `;

    cells += `
      <button class="calDay${muted}${isToday}" data-day="${iso}" type="button" aria-label="${iso}">
        <div class="calNum">
          <span>${d.getDate()}</span>
        </div>
        ${dotHtml}
      </button>
    `;
  }

  root.innerHTML = `
    <div class="card">
      <div class="calHead">
        <button class="calNavBtn" id="cal_prev" type="button">◀</button>
        <div class="calTitle">${title}</div>
        <button class="calNavBtn" id="cal_next" type="button">▶</button>
      </div>

      <div class="calGrid" style="margin-top:12px;">
        <div class="calDow">Sun</div><div class="calDow">Mon</div><div class="calDow">Tue</div><div class="calDow">Wed</div><div class="calDow">Thu</div><div class="calDow">Fri</div><div class="calDow">Sat</div>
      </div>

      <div class="calGrid" id="cal_cells">
        ${cells}
      </div>

      <p class="small" style="margin-top:10px;">Tap a date to view/add bookings. Blue=Room, Orange=Event.</p>
    </div>
  `;

  root.querySelector("#cal_prev").addEventListener("click", ()=>{
    viewDate = new Date(y, m-1, 1);
    renderMonth_(root);
  });
  root.querySelector("#cal_next").addEventListener("click", ()=>{
    viewDate = new Date(y, m+1, 1);
    renderMonth_(root);
  });

  root.querySelector("#cal_cells").addEventListener("click", (e)=>{
    const t = e.target;
    const btn = t && t.closest ? t.closest(".calDay") : null;
    if(!btn) return;
    const dayIso = btn.getAttribute("data-day");
    if(!dayIso) return;
    openDaySheet_(root, dayIso);
  });
}

function openDaySheet_(root, dayIso){
  const db = store.get();
  ensureBookings_(db);

  const list = listForDay_(db, dayIso);

   const rows = list.map(b=>{
    const type = String(b.type||"room");
    const dotClass = type === "event" ? "event" : "room";

    const title = esc_(b.title || ""); // company name (your new meaning)
    const note = esc_(b.note || "");
    const range = `${esc_(b.start_date)} → ${esc_(b.end_date)}`;

       const roomNo = String(b.room_no || "").trim();
    const rate = String(b.rate || "").trim();
    const totalAmount = String(b.total_amount || "").trim();
    const nightsCount = String(b.nights_count || "").trim();
    const daysCount = String(b.days_count || "").trim();
    const roomsCount = String(b.rooms_count || "").trim();
    const booker = String(b.booker_name || "").trim();
    const phone = String(b.contact_number || "").trim();

       // Better labels
    const roomPretty = roomNo
      ? roomNo.split(",").map(x=>x.trim()).filter(Boolean).join(", ")
      : "";

          const typeLabel = (type === "event")
      ? (`Event${rate ? " • Tariff: ₹" + esc_(rate) : ""}${daysCount ? " • Days: " + esc_(daysCount) : ""}${totalAmount ? " • Amount: ₹" + esc_(totalAmount) : ""}`)
      : (`Room${roomPretty ? " • " + esc_(roomPretty) : ""}${rate ? " • Rate: ₹" + esc_(rate) : ""}${roomsCount ? " • Rooms: " + esc_(roomsCount) : ""}${nightsCount ? " • Nights: " + esc_(nightsCount) : ""}${totalAmount ? " • Amount: ₹" + esc_(totalAmount) : ""}`);

    const who = (booker || phone)
      ? `${booker ? esc_(booker) : "-"}${phone ? " • " + esc_(phone) : ""}`
      : "";

    const time = String(b.start_time || "").trim();
    const arrive = (time ? `${esc_(dayIso)} ${esc_(time)}` : `${esc_(dayIso)}`);

    return `
      <div class="listItem">
        <div class="listTop">
          <div>
            <div class="listTitle">
              <span class="dot ${dotClass}" style="vertical-align:middle; margin-right:8px;"></span>
              ${title || "(No company name)"}
            </div>
            <div class="listMeta">
                            <div><b>${typeLabel}</b></div>
              ${who ? `<div><b>Booker:</b> ${who}</div>` : ``}
              <div><b>Arrive:</b> ${arrive}</div>
              <div>${range}</div>
              ${note ? `<div>${note}</div>` : ``}
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn" data-act="edit" data-id="${esc_(b.id)}" type="button">Edit</button>
            <button class="btn danger" data-act="del" data-id="${esc_(b.id)}" type="button">Del</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  openSheet_(`
    <div class="sheetTop">
      <div class="sheetTitle">Bookings — ${esc_(dayIso)}</div>
      <button class="sheetClose" id="cal_close" type="button">Close</button>
    </div>

    <div style="margin-top:12px;">
      ${rows || `<div class="small">No bookings for this day.</div>`}
    </div>

    <div class="btnRow" style="margin-top:12px;">
      <button class="btn primary" id="cal_add" type="button">Add Booking</button>
    </div>
  `);

  document.getElementById("cal_close").addEventListener("click", closeSheet_);
  document.getElementById("cal_add").addEventListener("click", ()=> openEditSheet_(root, dayIso, null));

  sheetEl.addEventListener("click", (e)=>{
    const t = e.target;
    if(!(t && t.getAttribute)) return;
    const act = t.getAttribute("data-act");
    const id = t.getAttribute("data-id");
    if(!act || !id) return;

    if(act === "edit"){
      const db2 = store.get();
      const found = (db2.bookings||[]).find(x=>String(x.id)===String(id));
      openEditSheet_(root, dayIso, found || null);
    }else if(act === "del"){
      const ok = confirm("Delete this booking?");
      if(!ok) return;
      const db2 = store.get();
      db2.bookings = (db2.bookings||[]).filter(x=>String(x.id)!==String(id));
      store.set(db2);
      openDaySheet_(root, dayIso);
      renderMonth_(root);
    }
  }, { once:false });
}

function openEditSheet_(root, dayIso, booking){
  const isEdit = !!(booking && booking.id);
  let submitBusy = false;
   const b = booking || {
    id: "",
    type: "room",
    title: "",          // will now be "Company name"
    room_no: "",
     rate: "",
    booker_name: "",
    contact_number: "",
    note: "",
    start_date: dayIso,
    end_date: dayIso,
    start_time: "09:00"
  };

  openSheet_(`
    <div class="sheetTop" style="position:sticky; top:0; z-index:5; background:#fff;">
      <div class="sheetTitle">${isEdit ? "Edit" : "Add"} Booking</div>
      <button class="sheetClose" id="cal_close2" type="button">Close</button>
    </div>

    <div id="bk_scroll" style="max-height:calc(80vh - 64px); overflow:auto; -webkit-overflow-scrolling:touch; padding-bottom:16px;">
      <div class="label">Type</div>
      <select class="select" id="bk_type">
      <option value="room" ${String(b.type)==="room"?"selected":""}>Room</option>
      <option value="event" ${String(b.type)==="event"?"selected":""}>Event</option>
    </select>

    <div class="label">Company name</div>
    <input class="input" id="bk_title" value="${esc_(b.title||"")}" placeholder="Hotel / Company name" />

            <div class="label">Check In Date/time</div>
      <input class="input" id="bk_start_dt" type="datetime-local" value="${esc_(toLocalDTValue_(bookingIsoFromParts_(b.start_date||dayIso, b.start_time||"09:00")))}" />

    <div class="label">Check Out Date</div>
    <input class="input" id="bk_end" type="date" value="${esc_(b.end_date||dayIso)}" />

           <div class="label" id="bk_room_label">Rooms + Tariff</div>
    <div style="display:flex; gap:10px; align-items:center; margin-top:10px; flex-wrap:wrap;">
      <input class="input" id="bk_rooms_count" value="${esc_(b.rooms_count || (String(b.room_no||"").split(",").map(x=>x.trim()).filter(Boolean).length || ""))}" placeholder="No. of Rooms" inputmode="numeric" type="number" min="1" style="width:140px;" />
      <input class="input" id="bk_rate" value="${esc_(b.rate||"")}" placeholder="Rate / Room" inputmode="numeric" type="number" style="width:140px;" />
    </div>

    <div id="bk_room_extras" style="margin-top:10px;">
      <div class="small" style="margin-bottom:6px;">Room numbers (optional)</div>
      <div id="bk_room_inputs" style="display:flex; gap:10px; flex:1;">
        <input class="input" id="bk_room_one" value="" placeholder="Enter room no. and tap Add" inputmode="tel" type="tel" style="flex:1;" />
        <button class="btn" id="bk_room_add" type="button" style="white-space:nowrap;">Add</button>
      </div>
      <input type="hidden" id="bk_room_no" value="${esc_(b.room_no||"")}" />
      <div id="bk_room_chips" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;"></div>
      <div class="small" id="bk_room_status" style="margin-top:6px;"></div>
    </div>
    <div class="small" id="bk_amount_info" style="margin-top:8px; color:#444;"></div>

    <div class="label">Booker name / Guest Name</div>
    <input class="input" id="bk_booker" value="${esc_(b.booker_name||"")}" placeholder="Person name" />

    <div class="label">Contact number</div>
    <input class="input" id="bk_phone" value="${esc_(b.contact_number||"")}" placeholder="10-digit mobile" inputmode="tel" maxlength="10" />

  

    <div class="label">Remark</div>
    <textarea class="textarea" id="bk_note" placeholder="Optional notes">${esc_(b.note||"")}</textarea>

    <div class="btnRow">
      <button class="btn primary" id="bk_save" type="button">${isEdit ? "Save Changes" : "Add Booking"}</button>
      ${isEdit ? `<button class="btn danger" id="bk_delete" type="button">Delete</button>` : ``}
    </div>

    <p class="small" style="margin-top:10px;">Multi-day booking will appear on every day in the date range.</p>
    </div>
  `);

  document.getElementById("cal_close2").addEventListener("click", closeSheet_);

  const startDtEl = document.getElementById("bk_start_dt");
  const endEl = document.getElementById("bk_end");

const typeEl = document.getElementById("bk_type");
const roomWrap = document.getElementById("bk_room_wrap");
const roomEl = document.getElementById("bk_room_no"); // hidden comma-string
const roomOneEl = document.getElementById("bk_room_one"); // visible (tel keypad)
const roomAddEl = document.getElementById("bk_room_add");
const chipsEl = document.getElementById("bk_room_chips");
const roomsCountEl = document.getElementById("bk_rooms_count");
const rateEl = document.getElementById("bk_rate");
const phoneEl = document.getElementById("bk_phone");
const roomStatusEl = document.getElementById("bk_room_status");
const amountInfoEl = document.getElementById("bk_amount_info");

/* -------------------------
   Room type toggle
------------------------- */
function syncRoomUi_(){
  const t = String(typeEl?.value || "room");
  const rLabel = document.getElementById("bk_room_label");
  const rInputs = document.getElementById("bk_room_inputs");
  const rExtras = document.getElementById("bk_room_extras");

  if(t === "room"){
    if(rLabel) rLabel.innerText = "Rooms + Rate/room";
    if(rInputs) rInputs.style.display = "flex";
    if(rExtras) rExtras.style.display = "block";
  }else{
    if(rLabel) rLabel.innerText = "Event Rate";
    if(rInputs) rInputs.style.display = "none";
    if(rExtras) rExtras.style.display = "none";
    if(roomEl) roomEl.value = "";
  }
}

function syncAmountUi_(){
  if(!amountInfoEl) return;

  const type = String(typeEl?.value || "room");
  const startIso = fromLocalDTValue_(String(startDtEl?.value || ""));
  const start_date = startIso ? toLocalDTValue_(startIso).slice(0,10) : "";
  const end_date = String(endEl?.value || "").trim();
  const rate = num0_(rateEl?.value || 0);

  if(!start_date || !end_date){
    amountInfoEl.innerHTML = `<span style="color:#888;">Select start and end date to calculate amount.</span>`;
    return;
  }

  if(type === "event"){
    const days = diffDaysInclusive_(start_date, end_date);
    const total = rate * days;
    amountInfoEl.innerHTML = `
      <b>Event Days:</b> ${days} &nbsp; | &nbsp;
      <b>Total Amount:</b> ₹${total}
    `;
    return;
  }

  const rooms = String(roomEl?.value || "")
    .split(",")
    .map(x=>x.trim())
    .filter(Boolean);

  const roomsCount = num0_(roomsCountEl?.value || 0) || rooms.length;
  const nights = diffNights_(start_date, end_date);
  const total = rate * nights * roomsCount;

  if(!roomsCount){
    amountInfoEl.innerHTML = `
      <b>Nights:</b> ${nights} &nbsp; | &nbsp;
      <b>Rooms:</b> 0 &nbsp; | &nbsp;
      <b>Total Amount:</b> ₹0
    `;
    return;
  }

  amountInfoEl.innerHTML = `
    <b>Nights:</b> ${nights} &nbsp; | &nbsp;
    <b>Rooms:</b> ${roomsCount} &nbsp; | &nbsp;
    <b>Total Amount:</b> ₹${total}
  `;
}

  
  function syncRoomAvailabilityUi_(){
  if(!roomStatusEl) return;

  const t = String(typeEl?.value || "room");
if(t !== "room"){
  roomStatusEl.innerHTML = "";
  return;
}

  const startIso = fromLocalDTValue_(String(startDtEl?.value || ""));
  const start_date = startIso ? toLocalDTValue_(startIso).slice(0,10) : ""; // YYYY-MM-DD

  const end_date = String(endEl?.value || "").trim();
  const rawRooms = String(roomEl?.value || "");

  if(!start_date || !end_date){
    roomStatusEl.innerHTML = "Select start/end date to check availability.";
    return;
  }

  const rooms = rawRooms
    .split(",")
    .map(x=>x.trim())
    .filter(Boolean);

   if(!rooms.length){
    roomStatusEl.innerHTML = `<span style="color:#888;">Room numbers are optional. Add them only if you want availability check.</span>`;
    return;
  }

  const dbCheck = store.get();
  ensureBookings_(dbCheck);

  const ignoreId = (isEdit ? b.id : null);

      // Collect all known rooms from existing bookings (room_no values)
  const allRoomsSet = new Set();
  (dbCheck.bookings || []).forEach(bb=>{
    String(bb.room_no || "")
      .split(",")
      .map(x=>x.trim())
      .filter(Boolean)
      .forEach(rn=> allRoomsSet.add(rn));
  });
  const allRooms = Array.from(allRoomsSet).sort((a,b)=> Number(a)-Number(b));


    

  let hasConflict = false;

  const lines = rooms.map(r=>{
    const conflict = roomConflict_(dbCheck, r, start_date, end_date, ignoreId);
    if(conflict){
      hasConflict = true;
      return `<div>Room <b>${esc_(r)}</b> <span style="color:#d93025;">❌ Booked</span> (${esc_(conflict.start_date)} → ${esc_(conflict.end_date)})</div>`;
    }
    return `<div>Room <b>${esc_(r)}</b> <span style="color:#188038;">✅ Available</span></div>`;
  });

  // Suggestions: rooms we know, that are NOT booked in selected range and not already typed
  let sugHtml = "";
  if(hasConflict && allRooms.length){
    const typedSet = new Set(rooms);

    const available = allRooms.filter(rn=>{
      if(typedSet.has(rn)) return false;
      const c = roomConflict_(dbCheck, rn, start_date, end_date, ignoreId);
      return !c;
    });

    const top = available.slice(0, 6); // show up to 6 suggestions
    if(top.length){
      sugHtml = `
        <div style="margin-top:8px;">
          <div style="color:#666; margin-bottom:6px;">Suggested available rooms:</div>
          <div id="bk_room_sugs" style="display:flex; flex-wrap:wrap; gap:6px;">
            ${top.map(rn=>`<button type="button" class="btn" data-sug-room="${esc_(rn)}" style="padding:6px 10px;">${esc_(rn)}</button>`).join("")}
          </div>
        </div>
      `;
    }
  }

  roomStatusEl.innerHTML = lines.join("") + sugHtml;
}

if(typeEl){
  typeEl.addEventListener("change", ()=>{
    syncRoomUi_();
    syncRoomAvailabilityUi_();
    syncAmountUi_();
  });
}

syncRoomUi_();
  syncRoomAvailabilityUi_();
  syncAmountUi_();

/* -------------------------
   Room numbers (phone keypad)
   - user types ONE room (digits only) then presses Add
   - we store comma-string in hidden #bk_room_no (so your conflict logic stays same)
------------------------- */

function getRoomsList_(){
  const raw = String(roomEl?.value || "");
  return raw.split(",").map(x=>x.trim()).filter(Boolean);
}
function setRoomsList_(arr){
  const cleaned = (arr||[]).map(x=>String(x||"").trim()).filter(Boolean);
  // unique
  const seen = new Set();
  const uniq = cleaned.filter(x=> (seen.has(x)?false:(seen.add(x),true)));
  if(roomEl) roomEl.value = uniq.join(",");
  paintChips_();
  syncRoomAvailabilityUi_();
  syncAmountUi_();
}
function paintChips_(){
  if(!chipsEl) return;
  const rooms = getRoomsList_();
  if(!rooms.length){
    chipsEl.innerHTML = `<span class="small" style="color:#888;">No rooms added yet.</span>`;
    return;
  }
  chipsEl.innerHTML = rooms.map(rn=>`
    <button type="button" class="btn" data-chip-room="${esc_(rn)}" style="padding:6px 10px;">
      ${esc_(rn)} ✕
    </button>
  `).join("");
}

function addRoom_(rn){
  rn = String(rn||"").replace(/\D/g,""); // digits only
  if(!rn) return;
  const rooms = getRoomsList_();
  if(!rooms.includes(rn)) rooms.push(rn);
  setRoomsList_(rooms);
  if(roomOneEl) roomOneEl.value = "";
}

function removeRoom_(rn){
  rn = String(rn||"").trim();
  const rooms = getRoomsList_().filter(x=>x !== rn);
  setRoomsList_(rooms);
}

if(roomOneEl){
  roomOneEl.addEventListener("input", ()=>{
    // digits only, like phone keypad
    roomOneEl.value = String(roomOneEl.value||"").replace(/\D/g,"").slice(0,6);
  });
}

if(roomAddEl){
  roomAddEl.addEventListener("click", ()=>{
    addRoom_(String(roomOneEl?.value||""));
  });
}

if(chipsEl){
  chipsEl.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest ? e.target.closest("[data-chip-room]") : null;
    if(!btn) return;
    const rn = String(btn.getAttribute("data-chip-room")||"").trim();
    if(rn) removeRoom_(rn);
  });
}

// initial paint (edit mode will already have b.room_no in hidden input)
paintChips_();
syncRoomAvailabilityUi_();

// Click suggestion → add room
if(roomStatusEl){
  roomStatusEl.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest ? e.target.closest("[data-sug-room]") : null;
    if(!btn) return;
    const rn = String(btn.getAttribute("data-sug-room") || "").trim();
    if(!rn) return;
    addRoom_(rn);
  });
}

/* -------------------------
   Phone number input
------------------------- */
if(phoneEl){
  phoneEl.addEventListener("input", ()=>{
    const digits = String(phoneEl.value || "")
      .replace(/\D/g,"")
      .slice(0,10);

    phoneEl.value = digits;
  });
}


 if(roomsCountEl){
  roomsCountEl.addEventListener("input", ()=>{
    roomsCountEl.value = String(roomsCountEl.value || "").replace(/\D/g,"").slice(0,3);
    syncAmountUi_();
  });
}

if(rateEl){
  rateEl.addEventListener("input", ()=>{
    syncAmountUi_();
  });
}
  

function clampRange_(){
  const iso = fromLocalDTValue_(String(startDtEl?.value || ""));
  const d = iso ? toLocalDTValue_(iso).slice(0,10) : ""; // YYYY-MM-DD
  const e = String(endEl?.value || "");
  if(d && e && e < d){
    endEl.value = d;
  }
  syncRoomAvailabilityUi_();
  syncAmountUi_();
}
if(startDtEl) startDtEl.addEventListener("change", clampRange_);
if(endEl) endEl.addEventListener("change", clampRange_);

      document.getElementById("bk_save").addEventListener("click", async ()=>{
    if(submitBusy) return;
    submitBusy = true;

    const saveBtn = document.getElementById("bk_save");
    const delBtn = document.getElementById("bk_delete");
    if(saveBtn){
      saveBtn.disabled = true;
      saveBtn.style.opacity = "0.6";
      saveBtn.style.pointerEvents = "none";
    }
    if(delBtn){
      delBtn.disabled = true;
      delBtn.style.opacity = "0.6";
      delBtn.style.pointerEvents = "none";
    }

    try{
      clampRange_();

      const type = document.getElementById("bk_type").value;
    const title = document.getElementById("bk_title").value.trim(); // Company name
        const room_no = String(roomEl?.value || "").trim();
    const booker_name = String((document.getElementById("bk_booker")?.value||"")).trim();
    const contact_number = String((document.getElementById("bk_phone")?.value||"")).replace(/\D/g,"").slice(0,10);
    const note = document.getElementById("bk_note").value.trim();
        const startIso = fromLocalDTValue_(String(startDtEl?.value || ""));
    const start_date = startIso ? toLocalDTValue_(startIso).slice(0,10) : "";
    const start_time = startIso ? toLocalDTValue_(startIso).slice(11,16) : "09:00";

    const end_date = String(endEl.value||"").trim();

        const rate = String(rateEl?.value || "").trim();

        const roomsCount = String(type) === "room"
      ? (num0_(roomsCountEl?.value || 0) || String(room_no).split(",").map(x=>x.trim()).filter(Boolean).length)
      : 0;

    const nightsCount = String(type) === "room"
      ? diffNights_(start_date, end_date)
      : 0;

    const daysCount = String(type) === "event"
      ? diffDaysInclusive_(start_date, end_date)
      : 0;

    const totalAmount = String(type) === "event"
      ? (num0_(rate) * daysCount)
      : (num0_(rate) * nightsCount * roomsCount);

       if(!start_date || !end_date){
      alert("Please select start date/time and end date.");
      return;
    }
    if(end_date < start_date){
      alert("End date cannot be before start date.");
      return;
    }
          if(!title){
      alert("Please enter company name.");
      return;
    }
       if(String(type)==="room" && !roomsCount){
      alert("Please enter number of rooms.");
      return;
    }

      if(type === "room" && room_no){

  const dbCheck = store.get();
  ensureBookings_(dbCheck);

  const rooms = room_no
    .split(",")
    .map(x=>x.trim())
    .filter(Boolean);

  for(const r of rooms){

    const conflict = roomConflict_(
      dbCheck,
      r,
      start_date,
      end_date,
      isEdit ? b.id : null
    );

    if(conflict){
      alert(
        `Room ${r} is already booked from ${conflict.start_date} to ${conflict.end_date}.`
      );
      return;
    }

  }
}

      
    if(contact_number.length !== 10){
      alert("Contact number must be exactly 10 digits.");
      return;
    }

    const db = store.get();
    ensureBookings_(db);

    if(isEdit){
      const idx = (db.bookings||[]).findIndex(x=>String(x.id)===String(b.id));
      if(idx >= 0){
               db.bookings[idx] = {
          ...db.bookings[idx],
          type, title, room_no, rate, booker_name, contact_number,
          note, start_date, end_date, start_time,
          rooms_count: roomsCount,
          nights_count: nightsCount,
          days_count: daysCount,
          total_amount: totalAmount,
          updated_at: store.nowISO()
        };
      }
    }else{
           db.bookings.push({
        id: uid_(),
        type,
        title,
        room_no,
        rate,
        booker_name,
        contact_number,
        note,
        start_date,
        end_date,
        start_time,
        rooms_count: roomsCount,
        nights_count: nightsCount,
        days_count: daysCount,
        total_amount: totalAmount,
        created_at: store.nowISO(),
        updated_at: store.nowISO()
      });
    }

        store.set(db);

    // 🔔 schedule booking reminders (based on start_date + start_time)
    try{
      const bookingId = isEdit ? String(b.id) : String(db.bookings[db.bookings.length-1].id);
      await syncBookingReminderJobs_(bookingId, start_date, start_time);
    }catch(e){
      console.warn("Booking reminder schedule failed", e);
    }

        closeSheet_();
    renderMonth_(root);
    }finally{
      submitBusy = false;
      if(saveBtn){
        saveBtn.disabled = false;
        saveBtn.style.opacity = "";
        saveBtn.style.pointerEvents = "";
      }
      if(delBtn){
        delBtn.disabled = false;
        delBtn.style.opacity = "";
        delBtn.style.pointerEvents = "";
      }
    }
  });

  if(isEdit){
             document.getElementById("bk_delete").addEventListener("click", async ()=>{
      if(submitBusy) return;
      const ok = confirm("Delete this booking?");
      if(!ok) return;

      submitBusy = true;

      const saveBtn = document.getElementById("bk_save");
      const delBtn = document.getElementById("bk_delete");
      if(saveBtn){
        saveBtn.disabled = true;
        saveBtn.style.opacity = "0.6";
        saveBtn.style.pointerEvents = "none";
      }
      if(delBtn){
        delBtn.disabled = true;
        delBtn.style.opacity = "0.6";
        delBtn.style.pointerEvents = "none";
      }

      try{
      const db = store.get();
          db.bookings = (db.bookings||[]).filter(x=>String(x.id)!==String(b.id));
      store.set(db);

      // 🔔 delete scheduled reminder jobs
      try{
        const oldIds = ["0","1","2","3","4"].map(i=>`BK:${String(b.id)}:${i}`);
        await postWorker_("/job/deleteMany", { job_ids: oldIds });
      }catch(e){
        console.warn("Booking jobs delete failed", e);
      }

          closeSheet_();
      renderMonth_(root);
      }finally{
        submitBusy = false;
        if(saveBtn){
          saveBtn.disabled = false;
          saveBtn.style.opacity = "";
          saveBtn.style.pointerEvents = "";
        }
        if(delBtn){
          delBtn.disabled = false;
          delBtn.style.opacity = "";
          delBtn.style.pointerEvents = "";
        }
      }
    });
  }
}

export function renderCalendar(root){
  renderMonth_(root);
}

export function onFabCalendar(root, rerender){
  // FAB on calendar opens "Add booking" for today
  openEditSheet_(root, todayIso_(), null);
}


export function openCalendarDay(root, dayIso){
  openDaySheet_(root, String(dayIso||"").trim());
}
