const DB_NAME = "hotelcrm_files_v1";
const STORE = "files";

function openDB_(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE)){
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

async function tx_(mode){
  const db = await openDB_();
  const tx = db.transaction(STORE, mode);
  return { db, tx, store: tx.objectStore(STORE) };
}

export async function saveBlob(key, blob){
  const { db, tx, store } = await tx_("readwrite");
  await new Promise((resolve, reject)=>{
    const req = store.put(blob, key);
    req.onsuccess = ()=> resolve();
    req.onerror = ()=> reject(req.error);
  });
  db.close();
}

export async function getBlob(key){
  const { db, tx, store } = await tx_("readonly");
  const blob = await new Promise((resolve, reject)=>{
    const req = store.get(key);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror = ()=> reject(req.error);
  });
  db.close();
  return blob;
}

export async function deleteBlob(key){
  const { db, tx, store } = await tx_("readwrite");
  await new Promise((resolve, reject)=>{
    const req = store.delete(key);
    req.onsuccess = ()=> resolve();
    req.onerror = ()=> reject(req.error);
  });
  db.close();
}

const urlCache = new Map();

export async function getObjectUrl(key){
  // returns a stable objectURL until replaced/deleted
  if(urlCache.has(key)) return urlCache.get(key);

  const blob = await getBlob(key);
  if(!blob) return "";

  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export function revokeObjectUrl(key){
  const url = urlCache.get(key);
  if(url){
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}





function blobToBase64_(blob){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> {
      // result is like: "data:image/png;base64,AAAA..."
      resolve(String(r.result || ""));
    };
    r.onerror = ()=> reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function exportImagesBase64(keys){
  const out = {};
  for(const key of keys){
    const blob = await getBlob(key);
    if(!blob){
      out[key] = "";
      continue;
    }
    out[key] = await blobToBase64_(blob);
  }
  return out;
}



function base64ToBlob_(dataUrl){
  // data:image/png;base64,....
  const s = String(dataUrl || "");
  if(!s.startsWith("data:")) return null;

  const parts = s.split(",");
  if(parts.length < 2) return null;

  const meta = parts[0];      // "data:image/png;base64"
  const b64 = parts.slice(1).join(",");

  const mimeMatch = meta.match(/^data:(.*?);base64$/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";

  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for(let i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);

  return new Blob([bytes], { type: mime });
}

export async function importImagesBase64(images){
  // images: { company_logo: "data:...", company_bg: "data:...", company_qr: "data:..." }
  const map = images || {};
  const pairs = [
    ["company_logo", map.company_logo],
    ["company_bg", map.company_bg],
    ["company_qr", map.company_qr]
  ];

  for(const [key, dataUrl] of pairs){
    if(!dataUrl) continue;
    const blob = base64ToBlob_(dataUrl);
    if(!blob) continue;
    await saveBlob(key, blob);
  }
}