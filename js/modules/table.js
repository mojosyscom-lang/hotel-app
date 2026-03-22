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
  const jspdfNs = window.jspdf;
  const jsPDF = jspdfNs && jspdfNs.jsPDF;
  if(!jsPDF){
    alert("PDF library not loaded. Please refresh once and try again.");
    return;
  }

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

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginLeft = 8;
  const marginRight = 8;
  const topMargin = 8;
  const bottomMargin = 8;

  let y = topMargin;

    function drawCompanyBlock_(){
    const boxY = y;
    const boxW = pageW - marginLeft - marginRight;

    const metaLines = [];
    if(contactName) metaLines.push(`Contact: ${contactName}`);
    if(phone) metaLines.push(`Phone: ${phone}`);
    if(address) metaLines.push(`Address: ${address}`);
    if(gstin) metaLines.push(`GSTIN: ${gstin}`);
    metaLines.push(`Generated: ${genDate}`);

    const logoX = marginLeft + 2;
    const logoY = boxY + 2;
    const logoW = 20;
    const logoH = 20;

    const textX = marginLeft + 25;
    const wrapW = pageW - textX - marginRight - 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    const companyLines = doc.splitTextToSize(companyName || "HOTEL REPORT", wrapW);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    let totalLineCount = companyLines.length;
    metaLines.forEach(line=>{
      const wrapped = doc.splitTextToSize(line, wrapW);
      totalLineCount += wrapped.length;
    });

    const contentH = 8 + (totalLineCount * 4);
    const boxH = Math.max(28, contentH);

    doc.setDrawColor(120);
    doc.setLineWidth(0.2);
    doc.rect(marginLeft, boxY, boxW, boxH);

    if(logoDataUrl){
      try{
        doc.addImage(logoDataUrl, "PNG", logoX, logoY, logoW, logoH, undefined, "FAST");
      }catch(e){
        try{
          doc.addImage(logoDataUrl, "JPEG", logoX, logoY, logoW, logoH, undefined, "FAST");
        }catch(err){
          console.warn("Logo add failed", err);
        }
      }
    }

    let textY = boxY + 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    companyLines.forEach((line, idx)=>{
      doc.text(String(line), textX, textY + (idx * 5));
    });

    textY += (companyLines.length * 5) + 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    metaLines.forEach(line=>{
      const wrapped = doc.splitTextToSize(line, wrapW);
      wrapped.forEach(w=>{
        doc.text(String(w), textX, textY);
        textY += 4;
      });
    });

    y += boxH + 4;
  }

  function drawTitleRow_(){
    doc.setFillColor(255, 239, 0);
    doc.rect(marginLeft, y, pageW - marginLeft - marginRight, 9, "F");
    doc.rect(marginLeft, y, pageW - marginLeft - marginRight, 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, pageW / 2, y + 6, { align: "center" });
    y += 9;
  }

  drawCompanyBlock_();
  drawTitleRow_();
  const baseCols = [
    { key:"bookingDate", label:"BOOKING DATE", width:20 },
    { key:"bookerName",  label:"BOOKER NAME", width:27 },
    { key:"mobile",      label:"MOBILE NUMBER", width:24 },
    { key:"guestName",   label:"GUEST NAME", width:27 },
    { key:"companyName", label:"COMPANY NAME", width:28 },
    { key:"checkIn",     label:"CHECK IN", width:18 },
    { key:"checkOut",    label:"CHECK OUT", width:18 },
    { key:"noOfRooms",   label:"NO OF ROOMS", width:16 },
    { key:"countVal",    label:countLabel, width:16 },
    { key:"tariff",      label:"TARIFF", width:16 },
    { key:"amount",      label:"TOTAL CONTRACT VALUE", width:26 },
    { key:"remark",      label:"REMARK", width:23 }
  ];

  const usableTableWidth = pageW - marginLeft - marginRight;
  const baseTotalWidth = baseCols.reduce((sum, c)=> sum + c.width, 0);
  const scale = usableTableWidth / baseTotalWidth;

  const cols = baseCols.map((c, idx)=>({
    ...c,
    width: idx === baseCols.length - 1
      ? +(usableTableWidth - baseCols.slice(0, -1).reduce((sum, x)=> sum + (x.width * scale), 0)).toFixed(2)
      : +(c.width * scale).toFixed(2)
  }));

   function drawHeader_(){
    let x = marginLeft;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);

    const prepared = cols.map(col => doc.splitTextToSize(col.label, col.width - 1.5));
    const maxLines = Math.max(1, ...prepared.map(lines => lines.length));
    const headerH = Math.max(10, maxLines * 3.4 + 2.5);

    prepared.forEach((lines, idx)=>{
      const col = cols[idx];

      doc.setFillColor(255, 239, 0);
      doc.rect(x, y, col.width, headerH, "F");
      doc.rect(x, y, col.width, headerH);

      const blockH = lines.length * 3.2;
      const startY = y + ((headerH - blockH) / 2) + 2.6;

      lines.slice(0, 3).forEach((line, lineIdx)=>{
        doc.text(String(line), x + col.width / 2, startY + (lineIdx * 3.2), { align:"center" });
      });

      x += col.width;
    });

    y += headerH;
  }

   function ensurePage_(needHeight){
    if(y + needHeight <= pageH - bottomMargin) return;
    doc.addPage("a4", "landscape");
    y = topMargin;
    drawCompanyBlock_();
    drawTitleRow_();
    drawHeader_();
  }

  drawHeader_();

  const rowsData = filtered.map(b=>{
    const bookingDate = fmtDate_(b && (b.created_at ? String(b.created_at).slice(0,10) : b.start_date) || "");
    const bookerName = String(b && b.booker_name || "").trim();
    const mobile = String(b && b.contact_number || "").trim();
    const guestName = String(b && b.booker_name || "").trim();
    const companyName = String(b && b.title || "").trim();
    const checkIn = fmtDate_(b && b.start_date || "");
    const checkOut = fmtDate_(b && b.end_date || "");
    const noOfRooms = String(roomsCount_(b));
    const countVal = String(mode === "event" ? eventDays_(b) : roomNightUnits_(b));
    const tariff = String(Number(b && b.rate) || 0);
    const amount = String(totalAmount_(b));
    const remark = String(b && b.note || "").trim();

    return {
      bookingDate,
      bookerName,
      mobile,
      guestName,
      companyName,
      checkIn,
      checkOut,
      noOfRooms,
      countVal,
      tariff,
      amount,
      remark
    };
  });

  function drawRow_(row, isTotals){
    const prepared = cols.map(col=>{
      const txt = String(row[col.key] || "");
      return doc.splitTextToSize(txt, col.width - 1.5);
    });

    const maxLines = Math.max(1, ...prepared.map(lines=>lines.length));
    const rowH = Math.max(7, maxLines * 3.6 + 1.6);

    ensurePage_(rowH);

    let x = marginLeft;

    if(isTotals){
      doc.setFillColor(255, 245, 157);
      doc.rect(marginLeft, y, pageW - marginLeft - marginRight, rowH, "F");
    }

    doc.setFont("helvetica", isTotals ? "bold" : "normal");
    doc.setFontSize(8);

    prepared.forEach((lines, idx)=>{
      const col = cols[idx];
      doc.rect(x, y, col.width, rowH);

      const startY = y + 3.8;
          const isLeftAlign = (col.key === "bookerName" || col.key === "guestName" || col.key === "companyName" || col.key === "remark");

      lines.slice(0, 4).forEach((line, lineIdx)=>{
        if(isLeftAlign){
          doc.text(String(line), x + 1.5, startY + (lineIdx * 3.2));
        }else{
          doc.text(String(line), x + col.width/2, startY + (lineIdx * 3.2), { align:"center" });
        }
      });

      x += col.width;
    });

    y += rowH;
  }

  if(!rowsData.length){
    ensurePage_(8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.rect(marginLeft, y, pageW - marginLeft - marginRight, 8);
    doc.text("No data found.", pageW / 2, y + 5, { align:"center" });
    y += 8;
  }else{
    rowsData.forEach(r=> drawRow_(r, false));

    const totalRooms = filtered.reduce((sum, b)=> sum + roomsCount_(b), 0);
    const totalRoomNights = filtered.reduce((sum, b)=> sum + roomNightUnits_(b), 0);
    const totalDays = filtered.reduce((sum, b)=> sum + eventDays_(b), 0);
    const totalAmount = filtered.reduce((sum, b)=> sum + totalAmount_(b), 0);

    drawRow_({
      bookingDate: "",
      bookerName: "",
      mobile: "",
      guestName: "",
      companyName: "",
      checkIn: "TOTAL",
      checkOut: "",
      noOfRooms: String(totalRooms),
      countVal: String(mode === "event" ? totalDays : totalRoomNights),
      tariff: "-",
      amount: String(totalAmount),
      remark: ""
    }, true);
  }

  const safeTitle = String(title || "booking-report")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "_");

  doc.save(`${safeTitle || "booking-report"}.pdf`);
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
  const title = `${baseMonthTitle} ${mode === "event" ? "EVENT" : "ROOM"} BOOKINGS (BY ARRIVAL DATE)`;

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
      <tr style="background:#ffffff; color:#111827;">
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(bookingDate)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(bookerName)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(mobile)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(guestName)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(companyName)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(checkIn)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(checkOut)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(noOfRooms)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(mode === "event" ? noOfDays : noOfRoomNights)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(tariff)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(amount)}</td>
        <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">${esc_(remark)}</td>
      </tr>
    `;
  }).join("");

  const totalsRow = filtered.length ? `
    <tr style="background:#fff59d; font-weight:700; color:#111827;">
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#fff59d;" colspan="7">TOTAL</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#fff59d;">${esc_(totalRooms)}</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#fff59d;">${esc_(mode === "event" ? totalDays : totalRoomNights)}</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#fff59d;">-</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#fff59d;">${esc_(totalAmount)}</td>
      <td style="padding:8px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#fff59d;"></td>
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
        <table style="width:100%; min-width:1400px; border-collapse:collapse; font-size:13px; background:#ffffff; color:#111827;">
          <thead>
            <tr>
              <th colspan="12" style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center; font-weight:800;">${esc_(title)}</th>
            </tr>
            <tr>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">BOOKING DATE</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">BOOKER NAME</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">MOBILE NUMBER</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">GUEST NAME</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">COMPANY NAME</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">CHECK IN</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">CHECK OUT</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">NO OF ROOMS</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">${mode === "event" ? "NO.DAY" : "NO.NIGHT"}</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">TARIFF</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">TOTAL CONTRACT VALUE</th>
              <th style="padding:8px; border:1px solid #777; background:#ffef00; color:#111827; text-align:center;">REMARK</th>
            </tr>
          </thead>
          <tbody>
                      ${rows || `<tr><td colspan="12" style="padding:12px; border:1px solid #b7b7b7; text-align:center; color:#111827; background:#ffffff;">No data found.</td></tr>`}
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
      pdfBtn.textContent = "Generating PDF...";

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
      }catch(e){
        console.error("PDF generation failed", e);
        alert("Could not generate PDF. Please try again.");
      }finally{
        pdfBtn.disabled = false;
        pdfBtn.style.opacity = "";
        pdfBtn.textContent = "Generate PDF";
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
