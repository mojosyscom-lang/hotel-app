export function rebuildStatsIndex(db){

  const stats = {};

  const bookings = Array.isArray(db.bookings) ? db.bookings : [];

  bookings.forEach(b=>{

    const type = String(b.type || "room");
    const s = String(b.start_date || "");
    const e = String(b.end_date || "");

    if(!s || !e) return;

    const start = new Date(s);
    const end = new Date(e);

    let cur = new Date(start);

    while(cur <= end){

      const key = cur.toISOString().slice(0,7);

      if(!stats[key]){
        stats[key] = {
          roomBookings:0,
          roomNights:0,
          roomRevenue:0,
          eventBookings:0,
          eventDays:0,
          eventRevenue:0
        };
      }

      if(type === "event"){

        stats[key].eventDays += 1;

      }else{

        stats[key].roomNights += 1;

      }

      cur.setDate(cur.getDate()+1);
    }

    const monthKey = s.slice(0,7);

    if(type === "event"){

      stats[monthKey].eventBookings += 1;
      stats[monthKey].eventRevenue += Number(b.total_amount || 0);

    }else{

      stats[monthKey].roomBookings += 1;
      stats[monthKey].roomRevenue += Number(b.total_amount || 0);

    }

  });

  db.stats = stats;

  return db;
}
