import { store } from "../storage.js";
import { getObjectUrl } from "../images_db.js";

export function renderHeader(){
  const host = document.getElementById("app_header");
  if(!host) return;

  console.log("✅ renderHeader() called, injecting header into #app_header");

  host.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <img class="brandLogo" id="brand_logo" alt="Logo" style="display:none;" />
        <div class="brandText">
          <div class="brandTitle" id="brand_title">Hotel CRM</div>
          <div class="brandSub" id="app_subtitle">Leads</div>
        </div>
      </div>
      <button class="iconBtn" id="btn_settings" title="Settings" aria-label="Settings">⚙️</button>
      
    </div>
  `;
}

async function applyFavicons_(){
  const db = store.get();
  const c = db.company || {};

  const localLogo = await getObjectUrl("company_logo");
  const urlLogo = String(c.logo_url || "").trim();
  const src = localLogo || urlLogo || "./favicon.ico";

  const fav = document.getElementById("app_favicon");
  const shortFav = document.getElementById("app_shortcut_icon");
  const appleFav = document.getElementById("app_apple_touch_icon");

  if(fav) fav.setAttribute("href", src);
  if(shortFav) shortFav.setAttribute("href", src);
  if(appleFav) appleFav.setAttribute("href", src);
}


export async function applyBranding(){
  const db = store.get();
  const c = db.company || {};

  // Title
  const titleEl = document.getElementById("brand_title");
  if(titleEl){
    const name = String(c.company_name || "").trim();
    titleEl.textContent = name ? name : "Hotel CRM";
  }

  // Logo (prefer IndexedDB, fallback to URL)
  const logoEl = document.getElementById("brand_logo");
  if(logoEl){
    const localLogo = await getObjectUrl("company_logo");
    const urlLogo = String(c.logo_url || "").trim();
    const src = localLogo || urlLogo;

    if(src){
      logoEl.src = src;
      logoEl.style.display = "block";
    }else{
      logoEl.removeAttribute("src");
      logoEl.style.display = "none";
    }
  }

   // Header background (prefer IndexedDB, fallback to URL)
  const topbar = document.querySelector(".topbar");
  if(topbar){
    const localBg = await getObjectUrl("company_bg");
    const urlBg = String(c.background_url || "").trim();
    const bg = localBg || urlBg;

    if(bg){
      const overlay1 = getComputedStyle(document.documentElement)
        .getPropertyValue("--header-overlay-1").trim() || "rgba(11,58,42,.78)";

      const overlay2 = getComputedStyle(document.documentElement)
        .getPropertyValue("--header-overlay-2").trim() || "rgba(15,90,64,.78)";

      topbar.style.backgroundImage =
        `linear-gradient(90deg, ${overlay1} 0%, ${overlay2} 100%), url('${bg}')`;

      topbar.style.backgroundSize = "cover";
      topbar.style.backgroundPosition = "center";
    }else{
      // No background image → still show a clean gradient header
      topbar.style.backgroundImage = "";
      topbar.style.backgroundSize = "";
      topbar.style.backgroundPosition = "";
    }
  }

  await applyFavicons_();
}




