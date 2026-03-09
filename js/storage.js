const KEY = "hotelcrm_v1";
const SNAP_KEY = "hotelcrm_snapshot_v1";
const DB_NAME = "hotelcrm_db";
const STORE = "main";
const DB_VERSION = 1;

let memCache = null;
let dbPromise = null;

function nowISO_(){ return new Date().toISOString(); }

function uid_(){
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function defaultDB_(){
  return {
  leads:[],
  followups:[],
  contracts:[],
  bookings:[],
  stats:{},
  terms:{ text:"" },
  company:{}
};
}

function openDB_(){
  if(dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains(STORE)){
        db.createObjectStore(STORE);
      }
    };

    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });

  return dbPromise;
}

async function readIDB_(){
  const db = await openDB_();

  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,"readonly");
    const st = tx.objectStore(STORE);
    const r = st.get(KEY);

    r.onsuccess = ()=>{
      resolve(r.result || null);
    };

    r.onerror = ()=> reject(r.error);
  });
}

async function writeIDB_(data){
  const db = await openDB_();

  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,"readwrite");
    const st = tx.objectStore(STORE);

    st.put(data, KEY);

    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}

function loadLocal_(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){
    console.warn("LocalStorage load failed",e);
    return null;
  }
}

async function initCache_(){

  if(memCache) return memCache;
  // Try ultra-fast snapshot load first
try{
  const snap = localStorage.getItem(SNAP_KEY);
  if(snap){
    memCache = normalizeDB_(JSON.parse(snap));
  }
}catch(e){}

  let dbData = null;

  try{
    dbData = await readIDB_();
  }catch(e){
    console.warn("IDB read failed",e);
  }

    if(dbData){
    memCache = normalizeDB_(dbData);
    try{
      localStorage.setItem(SNAP_KEY, JSON.stringify(memCache));
    }catch(e){}
    return memCache;
  }

  const local = loadLocal_();

    if(local){
    memCache = normalizeDB_(local);

    try{
      localStorage.setItem(SNAP_KEY, JSON.stringify(memCache));
    }catch(e){}

    try{
      await writeIDB_(memCache);
      console.log("✅ Migrated LocalStorage → IndexedDB");
    }catch(e){
      console.warn("IDB migration failed",e);
    }

    return memCache;
  }

   memCache = defaultDB_();

  try{
    localStorage.setItem(SNAP_KEY, JSON.stringify(memCache));
  }catch(e){}

  try{
    await writeIDB_(memCache);
  }catch(e){
    console.warn("Initial IDB write failed", e);
    try{
      localStorage.setItem(KEY, JSON.stringify(memCache));
    }catch(err){}
  }

  return memCache;
}

function normalizeDB_(db){

  const safe = (db && typeof db === "object") ? db : {};

  return {
    leads: Array.isArray(safe.leads) ? safe.leads : [],
    followups: Array.isArray(safe.followups) ? safe.followups : [],
    contracts: Array.isArray(safe.contracts) ? safe.contracts : [],
    bookings: Array.isArray(safe.bookings) ? safe.bookings : [],

    terms: (safe.terms && typeof safe.terms === "object")
      ? { text: String(safe.terms.text || "") }
      : { text: "" },

    company: (safe.company && typeof safe.company === "object")
  ? safe.company
  : {},

stats: (safe.stats && typeof safe.stats === "object")
  ? safe.stats
  : {}
  };
}

export const store = {

  get(){
    if(!memCache){
      console.warn("Store accessed before init, loading sync fallback");
      memCache = loadLocal_() || defaultDB_();
    }
    return memCache;
  },

  async init(){
    await initCache_();
  },

  async set(db){
    memCache = normalizeDB_(db);
    try{
  localStorage.setItem(SNAP_KEY, JSON.stringify(memCache));
}catch(e){}

    try{
      await writeIDB_(memCache);
    }catch(e){
      console.warn("IDB write failed, fallback to LocalStorage",e);
      localStorage.setItem(KEY, JSON.stringify(memCache));
    }
  },

  uid: uid_,
  nowISO: nowISO_

};


