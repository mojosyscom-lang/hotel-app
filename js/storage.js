const KEY = "hotelcrm_v1";
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
  return { leads:[], followups:[], contracts:[], bookings:[], terms:{ text:"" }, company:{} };
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

  let dbData = null;

  try{
    dbData = await readIDB_();
  }catch(e){
    console.warn("IDB read failed",e);
  }

  if(dbData){
    memCache = normalizeDB_(dbData);
    return memCache;
  }

  const local = loadLocal_();

  if(local){
    memCache = normalizeDB_(local);

    try{
      await writeIDB_(memCache);
      console.log("✅ Migrated LocalStorage → IndexedDB");
    }catch(e){
      console.warn("IDB migration failed",e);
    }

    return memCache;
  }

  memCache = defaultDB_();
  await writeIDB_(memCache);

  return memCache;
}

function normalizeDB_(db){
  return {
    leads: Array.isArray(db.leads) ? db.leads : [],
    followups: Array.isArray(db.followups) ? db.followups : [],
    contracts: Array.isArray(db.contracts) ? db.contracts : [],
    bookings: Array.isArray(db.bookings) ? db.bookings : [],
    terms: (db.terms && typeof db.terms === "object") ? db.terms : { text:"" },
    company: (db.company && typeof db.company === "object") ? db.company : {}
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
      await writeIDB_(memCache);
    }catch(e){
      console.warn("IDB write failed, fallback to LocalStorage",e);
      localStorage.setItem(KEY, JSON.stringify(memCache));
    }
  },

  uid: uid_,
  nowISO: nowISO_

};
