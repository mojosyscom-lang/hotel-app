import { store } from "../storage.js";

function esc_(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

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

  const title = mode === "event" ? "Pre-booked Events" : "Pre-booked Nights";

  const rows = filtered.map(b=>`
    <tr>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.id || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.type || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.title || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.room_no || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.rate || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(roomsCount_(b))}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(roomNights_(b))}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(eventDays_(b))}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">₹${esc_(totalAmount_(b))}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.booker_name || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.contact_number || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.start_date || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.end_date || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.start_time || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.note || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.created_at || "")}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${esc_(b && b.updated_at || "")}</td>
    </tr>
  `).join("");

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
        <table style="width:100%; min-width:1600px; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">ID</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Type</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Company</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Room No</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Rate</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Rooms</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Nights</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Days</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Amount</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Booker</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Mobile</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Start Date</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">End Date</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Start Time</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Remark</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Created At</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border);">Updated At</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="17" style="padding:12px;">No data found.</td></tr>`}
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
