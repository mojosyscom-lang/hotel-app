import { renderLeads, onFabLeads } from "./modules/leads.js";
import { renderFollowups, onFabFollowups } from "./modules/followups.js";
import { renderContracts, onFabContracts } from "./modules/contracts.js";
import { renderTerms, onFabTerms } from "./modules/terms.js";
import { renderCompany, onFabCompany } from "./modules/company.js";

const app = document.getElementById("app");
const subtitle = document.getElementById("app_subtitle");
const navBtns = Array.from(document.querySelectorAll(".navBtn"));
const fab = document.getElementById("fab_add");

let route = "leads";

function setSubtitle_(t){ subtitle.textContent = t; }

function setActiveNav_(r){
  navBtns.forEach(b => b.classList.toggle("active", b.dataset.route === r));
}

function render_(){
  setActiveNav_(route);

  if(route === "leads"){ setSubtitle_("Leads"); renderLeads(app); fab.style.display = ""; }
  else if(route === "followups"){ setSubtitle_("Follow-ups"); renderFollowups(app); fab.style.display = ""; }
  else if(route === "contracts"){ setSubtitle_("Contracts"); renderContracts(app); fab.style.display = ""; }
  else if(route === "terms"){ setSubtitle_("Terms & Conditions"); renderTerms(app); fab.style.display = ""; }
  else if(route === "company"){ setSubtitle_("Company Profile"); renderCompany(app); fab.style.display = ""; }
  else{
    setSubtitle_(""); 
    app.innerHTML = `<div class="card"><h2>Not found</h2><p>Unknown route.</p></div>`;
  }
}

navBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    route = btn.dataset.route;
    render_();
  });
});

fab.addEventListener("click", ()=>{
  if(route === "leads") return onFabLeads(app, render_);
  if(route === "followups") return onFabFollowups(app, render_);
  if(route === "contracts") return onFabContracts(app, render_);
  if(route === "terms") return onFabTerms(app, render_);
  if(route === "company") return onFabCompany(app, render_);
});

document.getElementById("btn_settings").addEventListener("click", ()=>{
  app.innerHTML = `
    <div class="card">
      <h2>Settings</h2>
      <p class="small">Offline mode (LocalStorage). Sync can be added later.</p>
      <hr class="sep" />
      <button class="btn danger" id="btn_reset_db">Reset all data</button>
    </div>
  `;
  document.getElementById("btn_reset_db").addEventListener("click", ()=>{
    const ok = confirm("Delete all local data? This cannot be undone.");
    if(!ok) return;
    localStorage.removeItem("hotelcrm_v1");
    route = "leads";
    render_();
  });
});

render_();