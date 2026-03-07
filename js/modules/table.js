import { store } from "../storage.js";

function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function monthKeyFromIso_(iso){
  return String(iso || "").slice(0, 7);
}

function fmtDate_(iso){
  const s = String(iso || "").trim();
  if(!s) return "";
  const parts = s.split("-");
  if(parts.length !== 3) return s;
  return `${parts[2]}.${parts[1]}.${String(parts[0]).slice(-2)}`;
}

function monthTitleFromKey_(monthKey){
  const s = String(monthKey || "").trim();
  if(!s) return "BOOKING";
  const [y, m] = s.split("-");
  const names = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
  const idx = Number(m) - 1;
  const mm = names[idx] || String(m || "").toUpperCase();
  return `${mm}-${y} BOOKING`;
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

function eventDays_(b){
  const direct = Number(b && b.days_count);
  if(isFinite(direct) && direct > 0) return direct;

  const s = String(b && b.start_date || "");
  const e = String(b && b.end_date || "");
  if(!s || !e) return 0;

  const start = new Date(s + "T00:00:00");
  const end = new Date(e + "T00:00:00");
  if(!isFinite(start) || !isFinite(end)) return 0;

  const days = Math.floor((end - start) / 86400000) + 1;
  return days > 0 ? days : 0;
}

function totalAmount_(b){
  const direct = Number(b && b.total_amount);
  if(isFinite(direct) && direct >= 0) return direct;

  const type = String(b && b.type || "room");
  const rate = Number(b && b.rate) || 0;

  if(type === "event"){
    return rate * eventDays_(b);
  }
  return rate * roomNights_(b) * roomsCount_(b);
}

function searchText_(b){
  return [
    b && b.id,
    b && b.type,
    b && b.title,
    b && b.room_no,
    b && b.rate,
    b && b.rooms_count,
    b && b.nights_count,
    b && b.days_count,
    b && b.total_amount,
    b && b.booker_name,
    b && b.contact_number,
    b && b.start_date,
    b && b.end_date,
    b && b.start_time,
    b && b.note,
    b && b.created_at,
    b && b.updated_at
  ].map(v=>String(v || "").toLowerCase()).join(" ");
}

export function renderBookingTablePage(root, opts){
  const mode = String((opts && opts.mode) || "room").trim(); // room | event
  const monthKeyDefault = String((opts && opts.monthKey) || "").trim();
  const searchDefault = String((opts && opts.search) || "").trim();

  const db = store.get();
  const bookingsArr = Array.isArray(db.bookings) ? db.bookings : [];

  const isRoom = (b)=> String(b && b.type || "room") !== "event";
  const isEvent = (b)=> String(b && b.type || "") === "event";

  const source = bookingsArr.filter(b => mode === "event" ? isEvent(b) : isRoom(b));

    if(!root) return;

  const monthKey = monthKeyDefault;
  const search = searchDefault.toLowerCase();

  const filtered = source.filter(b=>{
    const okMonth = !monthKey || monthKeyFromIso_(b && b.start_date) === monthKey;
    const okSearch = !search || searchText_(b).includes(search);
    return okMonth && okSearch;
  });

    const baseMonthTitle = monthTitleFromKey_(monthKey || monthKeyFromIso_(new Date().toISOString().slice(0,10))).replace(" BOOKING", "");
  const title = `${baseMonthTitle} ${mode === "event" ? "EVENT" : "ROOM"} BOOKING`;

  const totalRooms = filtered.reduce((sum, b)=> sum + roomsCount_(b), 0);
  const totalNights = filtered.reduce((sum, b)=> sum + roomNights_(b), 0);
  const totalDays = filtered.reduce((sum, b)=> sum + eventDays_(b), 0);
  const totalAmount = filtered.reduce((sum, b)=> sum + totalAmount_(b), 0);

  const rows = filtered.map(b=>{
    const bookingDate = fmtDate_(b && (b.created_at ? String(b.created_at).slice(0,10) : b.start_date) || "");
    const bookerName = String(b && b.booker_name || "").trim();
    const mobile = String(b && b.contact_number || "").trim();
    const guestName = String(b && b.booker_name || "").trim();
    const companyName = String(b && b.title || "").trim();
    const checkIn = fmtDate_(b && b.start_date || "");
    const checkOut = fmtDate_(b && b.end_date || "");
    const noOfRooms = roomsCount_(b);
    const noOfNights = roomNights_(b);
    const noOfDays = eventDays_(b);
    const tariff = Number(b && b.rate) || 0;
    const amount = totalAmount_(b);
    const remark = String(b && b.note || "").trim();

    return `
      <tr>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(bookingDate)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(bookerName)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(mobile)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(guestName)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(companyName)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(checkIn)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(checkOut)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(noOfRooms)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(mode === "event" ? noOfDays : noOfNights)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(tariff)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(amount)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(remark)}</td>
      </tr>
    `;
  }).join("");

  const totalsRow = filtered.length ? `
    <tr style="background:#fff59d; font-weight:700;">
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;" colspan="7">TOTAL</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(totalRooms)}</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(mode === "event" ? totalDays : totalNights)}</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">-</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(totalAmount)}</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;"></td>
    </tr>
  ` : "";

   root.innerHTML = `
    <div class="card">
      <div style="display:flex; gap:10px; justify-content:space-between; align-items:center; flex-wrap:wrap;">
        <h2 style="font-size:16px; margin:0;">${title}</h2>
        <button class="btn" id="dash_table_back" type="button">Back</button>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <div style="min-width:170px;">
          <div class="small" style="margin-bottom:6px;">Month</div>
          <input class="input" id="dash_filter_month" type="month" value="${esc_(monthKey)}" />
        </div>

        <div style="flex:1 1 220px; min-width:220px;">
          <div class="small" style="margin-bottom:6px;">Search</div>
          <input class="input" id="dash_filter_search" value="${esc_(searchDefault)}" placeholder="Search company, room, mobile, remark..." />
        </div>
      </div>

      <div class="small" style="margin-top:10px;">Showing ${filtered.length} row(s)</div>

            <div style="overflow:auto; margin-top:12px;">
        <table style="width:100%; min-width:1400px; border-collapse:collapse; font-size:13px; background:#fff;">
          <thead>
            <tr>
              <th colspan="12" style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center; font-weight:800;">${esc_(title)}</th>
            </tr>
            <tr>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">BOOKING DATE</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">BOOKER NAME</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">MOBILE NUMBER</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">GUEST NAME</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">COMPANY NAME</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">CHECK IN</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">CHECK OUT</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">NO OF ROOMS</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">${mode === "event" ? "NO.DAY" : "NO.NIGHT"}</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">TARIFF</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">AMOUNT</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; text-align:center;">REMARK</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="12" style="padding:12px; border:1px solid #b7b7b7; text-align:center;">No data found.</td></tr>`}
            ${totalsRow}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const backBtn = root.querySelector("#dash_table_back");
  const monthEl = root.querySelector("#dash_filter_month");
  const searchEl = root.querySelector("#dash_filter_search");

  if(backBtn){
    backBtn.addEventListener("click", ()=>{
      if(typeof opts?.onBack === "function"){
        opts.onBack();
      }
    });
  }

  if(monthEl){
    monthEl.addEventListener("change", ()=>{
      renderBookingTablePage(root, {
        mode,
        monthKey: monthEl.value,
        search: searchEl ? searchEl.value : "",
        onBack: opts?.onBack
      });
    });
  }

  if(searchEl){
    searchEl.addEventListener("input", ()=>{
      renderBookingTablePage(root, {
        mode,
        monthKey: monthEl ? monthEl.value : "",
        search: searchEl.value,
        onBack: opts?.onBack
      });
    });
  }
}
