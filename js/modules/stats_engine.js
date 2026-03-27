export function rebuildStatsIndex(db){

  const stats = {};
  const bookingsArr = Array.isArray(db.bookings) ? db.bookings : [];

  function monthKeyFromIso_(iso){
    return String(iso || "").slice(0, 7);
  }

  // 1. Exact match from table.js
  function roomsCount_(b){
    const direct = Number(b && b.rooms_count);
    if(isFinite(direct) && direct > 0) return direct;

    return String(b && b.room_no || "")
      .split(",")
      .map(x=>x.trim())
      .filter(Boolean)
      .length;
  }

  // 2. Exact match from table.js
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

  // 3. Exact match from table.js
  function roomNightUnits_(b){
    return roomsCount_(b) * roomNights_(b);
  }

  // 4. Exact match from table.js
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

  // 5. Exact match from table.js
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

  // Processing Loop
  bookingsArr.forEach(b=>{
    const s = String(b && b.start_date || "");
    
    // We only require a start date to group it into a month (matching table.js behavior)
    if(!s) return; 

    const isEvent = String(b && b.type || "") === "event";
    const monthKey = monthKeyFromIso_(s);

    if(!stats[monthKey]){
      stats[monthKey] = {
        roomBookings: 0,
        roomNights: 0,
        roomRevenue: 0,
        eventBookings: 0,
        eventDays: 0,
        eventRevenue: 0
      };
    }

    if(isEvent){
      stats[monthKey].eventBookings += 1;
      stats[monthKey].eventDays += eventDays_(b);
      stats[monthKey].eventRevenue += totalAmount_(b);
    } else {
      stats[monthKey].roomBookings += roomsCount_(b);
      // 🔥 Now we use roomNightUnits_ to perfectly mirror the NO.NIGHT column in table.js
      stats[monthKey].roomNights += roomNightUnits_(b);
      stats[monthKey].roomRevenue += totalAmount_(b);
    }
  });

  db.stats = stats;
  return db;
}
