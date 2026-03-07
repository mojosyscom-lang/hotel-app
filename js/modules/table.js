import { store } from "../storage.js";
import { getObjectUrl } from "../images_db.js";

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


function roomNightUnits_(b){
  return roomsCount_(b) * roomNights_(b);
}

async function blobToDataUrl_(blob){
  return await new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getCompanyLogoDataUrl_(){
  try{
    const url = await getObjectUrl("company_logo");
    if(!url) return "";
    const res = await fetch(url);
    const blob = await res.blob();
    return await blobToDataUrl_(blob);
  }catch(e){
    console.warn("Logo load failed", e);
    return "";
  }
}

async function openBookingPdf_({ mode, monthKey, search, filtered, totalsRowHtml, rowsHtml, title }){
  const db = store.get();
  const company = db.company || {};

  const logoDataUrl = await getCompanyLogoDataUrl_();

  const companyName = String(company.company_name || "").trim();
  const contactName = String(company.contact_name || "").trim();
  const phone = String(company.phone || "").trim();
  const address = String(company.address || "").trim();
  const gstin = String(company.gstin || "").trim();

  const now = new Date();
  const genDate = `${String(now.getDate()).padStart(2,"0")}.${String(now.getMonth()+1).padStart(2,"0")}.${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  const countLabel = mode === "event" ? "NO.DAY" : "NO.NIGHT";

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc_(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    html, body { margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; color:#111; }
    body { padding: 0; }
    .wrap { width: 100%; }
    table.report { width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px; }
    table.report th, table.report td { border:1px solid #777; padding:6px 5px; text-align:center; vertical-align:middle; word-wrap:break-word; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    .tophead { background:#ffef00; font-weight:800; }
    .titleRow th { background:#ffef00; font-size:15px; padding:8px; }
    .metaCell { padding:0 !important; }
    .metaWrap { display:flex; align-items:center; gap:12px; padding:10px; text-align:left; min-height:84px; }
    .logoBox { width:74px; min-width:74px; height:74px; display:flex; align-items:center; justify-content:center; border:1px solid #bbb; background:#fff; overflow:hidden; }
    .logoBox img { max-width:100%; max-height:100%; object-fit:contain; display:block; }
    .companyBlock { flex:1; }
    .companyName { font-size:18px; font-weight:800; line-height:1.2; margin-bottom:4px; }
    .metaLine { font-size:11px; line-height:1.35; }
    .subTitle { font-size:11px; font-weight:600; }
    .totals { background:#fff59d; font-weight:800; }
    .empty { padding:12px; text-align:center; }
    .right { text-align:right; }
    .left { text-align:left; }
    .small { font-size:10px; }
    @media print {
      .no-print { display:none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <table class="report">
      <thead>
        <tr>
          <th colspan="12" class="metaCell">
            <div class="metaWrap">
              <div class="logoBox">
                ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" />` : ``}
              </div>
              <div class="companyBlock">
                <div class="companyName">${esc_(companyName || "HOTEL REPORT")}</div>
                ${contactName ? `<div class="metaLine"><b>Contact:</b> ${esc_(contactName)}</div>` : ``}
                ${phone ? `<div class="metaLine"><b>Phone:</b> ${esc_(phone)}</div>` : ``}
                ${address ? `<div class="metaLine"><b>Address:</b> ${esc_(address)}</div>` : ``}
                ${gstin ? `<div class="metaLine"><b>GSTIN:</b> ${esc_(gstin)}</div>` : ``}
                <div class="metaLine"><b>Generated:</b> ${esc_(genDate)}</div>
              </div>
            </div>
          </th>
        </tr>
        <tr class="titleRow">
          <th colspan="12">${esc_(title)}</th>
        </tr>
        <tr>
          <th class="tophead">BOOKING DATE</th>
          <th class="tophead">BOOKER NAME</th>
          <th class="tophead">MOBILE NUMBER</th>
          <th class="tophead">GUEST NAME</th>
          <th class="tophead">COMPANY NAME</th>
          <th class="tophead">CHECK IN</th>
          <th class="tophead">CHECK OUT</th>
          <th class="tophead">NO OF ROOMS</th>
          <th class="tophead">${esc_(countLabel)}</th>
          <th class="tophead">TARIFF</th>
          <th class="tophead">AMOUNT</th>
          <th class="tophead">REMARK</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="12" class="empty">No data found.</td></tr>`}
        ${totalsRowHtml}
      </tbody>
    </table>
  </div>
  <script>
    window.onload = function(){
      setTimeout(function(){
        window.print();
      }, 250);
    };
  </script>
</body>
</html>
  `;

  const w = window.open("", "_blank");
  if(!w){
    alert("Popup blocked. Please allow popups and try again.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
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
  const totalRoomNights = filtered.reduce((sum, b)=> sum + roomNightUnits_(b), 0);
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
    const noOfRoomNights = roomNightUnits_(b);
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
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(mode === "event" ? noOfDays : noOfRoomNights)}</td>
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
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(mode === "event" ? totalDays : totalRoomNights)}</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">-</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;">${esc_(totalAmount)}</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center;"></td>
    </tr>
  ` : "";
  
   root.innerHTML = `
    <div class="card">
            <div style="display:flex; gap:10px; justify-content:space-between; align-items:center; flex-wrap:wrap;">
        <h2 style="font-size:16px; margin:0;">${title}</h2>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn" id="dash_table_pdf" type="button">Generate PDF</button>
          <button class="btn" id="dash_table_back" type="button">Back</button>
        </div>
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
  const pdfBtn = root.querySelector("#dash_table_pdf");
  const monthEl = root.querySelector("#dash_filter_month");
  const searchEl = root.querySelector("#dash_filter_search");

  if(backBtn){
    backBtn.addEventListener("click", ()=>{
      if(typeof opts?.onBack === "function"){
        opts.onBack();
      }
    });
  }

    if(pdfBtn){
    pdfBtn.addEventListener("click", async ()=>{
      pdfBtn.disabled = true;
      pdfBtn.style.opacity = "0.6";
      try{
        await openBookingPdf_({
          mode,
          monthKey,
          search,
          filtered,
          totalsRowHtml: totalsRow,
          rowsHtml: rows,
          title
        });
      }finally{
        pdfBtn.disabled = false;
        pdfBtn.style.opacity = "";
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
