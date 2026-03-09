export function rebuildStatsIndex(db){

  const stats = {};
  const bookingsArr = Array.isArray(db.bookings) ? db.bookings : [];

  function monthKeyFromIso_(iso){
    return String(iso || "").slice(0,7);
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

    const start = new Date(s+"T00:00:00");
    const end = new Date(e+"T00:00:00");
    if(!isFinite(start) || !isFinite(end)) return 0;

    const nights = Math.floor((end-start)/86400000);
    return nights>0 ? nights : 1;
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

  bookingsArr.forEach(b=>{

    const s = String(b && b.start_date || "");
    const e = String(b && b.end_date || "");
    if(!s || !e) return;

    const start = new Date(s+"T00:00:00");
    const end = new Date(e+"T00:00:00");
    if(!isFinite(start) || !isFinite(end)) return;

    const isEvent = String(b && b.type || "") === "event";

    let cur = new Date(start);

    while(cur <= end){

      const monthKey = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;

      if(!stats[monthKey]){
        stats[monthKey] = {
          roomBookings:0,
          roomNights:0,
          roomRevenue:0,
          eventBookings:0,
          eventDays:0,
          eventRevenue:0
        };
      }

      const monthStart = new Date(monthKey+"-01T00:00:00");
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth()+1);
      monthEnd.setDate(0);

      const monthStartIso = monthKey+"-01";
      const monthEndIso = monthKey+"-"+String(monthEnd.getDate()).padStart(2,"0");

      const overlapStart = s > monthStartIso ? s : monthStartIso;
      const overlapEnd = e < monthEndIso ? e : monthEndIso;

      if(overlapStart <= overlapEnd){

        if(isEvent){

          stats[monthKey].eventBookings += 1;

          const ovStart = new Date(overlapStart+"T00:00:00");
          const ovEnd = new Date(overlapEnd+"T00:00:00");

          const overlapDays = Math.floor((ovEnd-ovStart)/86400000)+1;
          const totalDays = Math.floor((end-start)/86400000)+1;

          stats[monthKey].eventDays += overlapDays;

          if(totalDays>0){
            stats[monthKey].eventRevenue += Math.round((eventAmount_(b)*overlapDays)/totalDays);
          }

        }else{

          stats[monthKey].roomBookings += roomsCount_(b);

          const ovStart = new Date(overlapStart+"T00:00:00");
          const ovEnd = new Date(overlapEnd+"T00:00:00");

          const overlapNights = Math.floor((ovEnd-ovStart)/86400000);
          const totalNights = Math.floor((end-start)/86400000);

          const safeOverlap = overlapNights>0 ? overlapNights : 1;
          const safeTotal = totalNights>0 ? totalNights : 1;

          stats[monthKey].roomNights += safeOverlap * roomsCount_(b);

          stats[monthKey].roomRevenue += Math.round((totalAmount_(b)*safeOverlap)/safeTotal);
        }

      }

      cur.setMonth(cur.getMonth()+1);
      cur.setDate(1);
    }

  });

  db.stats = stats;
  return db;
}
