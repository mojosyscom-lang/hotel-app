import { store } from "../storage.js";

function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
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
function inRange_(dayIso, startIso, endIso){
  // inclusive range
  return (dayIso >= startIso && dayIso <= endIso);
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
    const title = esc_(b.title || "");
    const note = esc_(b.note || "");
    const range = `${esc_(b.start_date)} → ${esc_(b.end_date)}`;

    return `
      <div class="listItem">
        <div class="listTop">
          <div>
            <div class="listTitle"><span class="dot ${dotClass}" style="vertical-align:middle; margin-right:8px;"></span>${title || "(No title)"}</div>
            <div class="listMeta">${range}${note ? `<br>${note}` : ""}</div>
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
  const b = booking || {
    id: "",
    type: "room",
    title: "",
    note: "",
    start_date: dayIso,
    end_date: dayIso
  };

  openSheet_(`
    <div class="sheetTop">
      <div class="sheetTitle">${isEdit ? "Edit" : "Add"} Booking</div>
      <button class="sheetClose" id="cal_close2" type="button">Close</button>
    </div>

    <div class="label">Type</div>
    <select class="select" id="bk_type">
      <option value="room" ${String(b.type)==="room"?"selected":""}>Room</option>
      <option value="event" ${String(b.type)==="event"?"selected":""}>Event</option>
    </select>

    <div class="label">Title</div>
    <input class="input" id="bk_title" value="${esc_(b.title||"")}" placeholder="Eg: Room 101 / Wedding / Conference" />

    <div class="label">Start date</div>
    <input class="input" id="bk_start" type="date" value="${esc_(b.start_date||dayIso)}" />

    <div class="label">End date</div>
    <input class="input" id="bk_end" type="date" value="${esc_(b.end_date||dayIso)}" />

    <div class="label">Notes</div>
    <textarea class="textarea" id="bk_note" placeholder="Optional notes">${esc_(b.note||"")}</textarea>

    <div class="btnRow">
      <button class="btn primary" id="bk_save" type="button">${isEdit ? "Save Changes" : "Add Booking"}</button>
      ${isEdit ? `<button class="btn danger" id="bk_delete" type="button">Delete</button>` : ``}
    </div>

    <p class="small" style="margin-top:10px;">Multi-day booking will appear on every day in the date range.</p>
  `);

  document.getElementById("cal_close2").addEventListener("click", closeSheet_);

  const startEl = document.getElementById("bk_start");
  const endEl = document.getElementById("bk_end");

  function clampRange_(){
    const s = String(startEl.value||"");
    const e = String(endEl.value||"");
    if(s && e && e < s){
      endEl.value = s;
    }
  }
  startEl.addEventListener("change", clampRange_);
  endEl.addEventListener("change", clampRange_);

  document.getElementById("bk_save").addEventListener("click", ()=>{
    clampRange_();

    const type = document.getElementById("bk_type").value;
    const title = document.getElementById("bk_title").value.trim();
    const note = document.getElementById("bk_note").value.trim();
    const start_date = String(startEl.value||"").trim();
    const end_date = String(endEl.value||"").trim();

    if(!start_date || !end_date){
      alert("Please select start and end date.");
      return;
    }
    if(end_date < start_date){
      alert("End date cannot be before start date.");
      return;
    }

    const db = store.get();
    ensureBookings_(db);

    if(isEdit){
      const idx = (db.bookings||[]).findIndex(x=>String(x.id)===String(b.id));
      if(idx >= 0){
        db.bookings[idx] = {
          ...db.bookings[idx],
          type, title, note, start_date, end_date,
          updated_at: store.nowISO()
        };
      }
    }else{
      db.bookings.push({
        id: uid_(),
        type,
        title,
        note,
        start_date,
        end_date,
        created_at: store.nowISO(),
        updated_at: store.nowISO()
      });
    }

    store.set(db);
    closeSheet_();
    renderMonth_(root);
  });

  if(isEdit){
    document.getElementById("bk_delete").addEventListener("click", ()=>{
      const ok = confirm("Delete this booking?");
      if(!ok) return;
      const db = store.get();
      db.bookings = (db.bookings||[]).filter(x=>String(x.id)!==String(b.id));
      store.set(db);
      closeSheet_();
      renderMonth_(root);
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
