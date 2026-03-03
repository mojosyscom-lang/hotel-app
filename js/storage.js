const KEY = "hotelcrm_v1";

function nowISO_(){ return new Date().toISOString(); }

function uid_(){
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function loadDB_(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return { leads:[], followups:[], contracts:[], bookings:[], terms:{ text:"" }, company:{} };
    const db = JSON.parse(raw);
   return {
      leads: Array.isArray(db.leads) ? db.leads : [],
      followups: Array.isArray(db.followups) ? db.followups : [],
      contracts: Array.isArray(db.contracts) ? db.contracts : [],
      bookings: Array.isArray(db.bookings) ? db.bookings : [],
      terms: (db.terms && typeof db.terms === "object") ? db.terms : { text:"" },
      company: (db.company && typeof db.company === "object") ? db.company : {}
    };
  }catch(e){
    console.warn("DB load failed, resetting", e);
    return { leads:[], followups:[], contracts:[], bookings:[], terms:{ text:"" }, company:{} };
  }
}

function saveDB_(db){
  localStorage.setItem(KEY, JSON.stringify(db));
}

export const store = {
  get(){
    return loadDB_();
  },
  set(db){
    saveDB_(db);
  },
  uid: uid_,
  nowISO: nowISO_

};
