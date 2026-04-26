// ══════════════════════════════════════
// ReGenX v3 — Unified Premium Logic
// ══════════════════════════════════════

const STORAGE_KEY_PREFIX = "regenx-v3:";

// Simulated Localities for default plants (if no GPS)
const DEFAULT_LOCALITIES = [
  { name: "Sector Beta", lat: 28.4682, lng: 77.5031 },
  { name: "Delta Zone", lat: 28.4710, lng: 77.4950 }
];

const WASTE_TYPES = ['Food waste (wet)', 'Vegetable scraps', 'Mixed kitchen waste', 'Biodegradable packaging'];
const SHIFTS = ['Morning Shift (08:00 - 12:00)', 'Evening Shift (16:00 - 20:00)'];

// ── DB HELPER ──
const DB = {
  get: (key) => { try { const r = window.localStorage.getItem(STORAGE_KEY_PREFIX + key); return r ? JSON.parse(r) : null; } catch { return null; } },
  set: (key, val) => { try { window.localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(val)); return true; } catch { return false; } },
  list: (prefix) => {
    try {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k.startsWith(STORAGE_KEY_PREFIX + prefix)) keys.push(k.substring(STORAGE_KEY_PREFIX.length));
      }
      return keys;
    } catch { return []; }
  }
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function ts() { return Date.now(); }
function fmtDate(ms) { return new Date(ms).toLocaleDateString('en-IN', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); }
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; const dLat = (lat2-lat1)*Math.PI/180; const dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ── STATE ──
let SESSION = { role: null, name: '', org: '', uid: '', lat: null, lng: null };
let selectedRole = 'provider';
let currentView = '';
let rMap = null; // Rider map instance
let autoRefreshTimer = null;

// ── THEME ──
window.toggleTheme = function() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  window.localStorage.setItem('regenx-theme', next);
}
const savedTheme = window.localStorage.getItem('regenx-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// ── AUTH & REGISTRATION ──
window.switchAuthTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-view').forEach(v => v.classList.add('hidden'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('view-' + tab).classList.remove('hidden');
  
  if (tab === 'login') refreshLoginDropdown();
}

window.selectRole = function(r) {
  selectedRole = r;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('role-' + r).classList.add('selected');
  const l = document.getElementById('reg-org-label');
  const i = document.getElementById('reg-org');
  if(r==='provider') { l.textContent = 'Hostel/Hotel Name'; i.placeholder = 'e.g. Omega Hostel'; }
  if(r==='rider') { l.textContent = 'Vehicle ID'; i.placeholder = 'e.g. GN-Tempo-1'; }
  if(r==='plant') { l.textContent = 'Plant Facility Name'; i.placeholder = 'e.g. Plant Alpha'; }
}

let detectedPos = null;
let regMapInstance = null;
let regMarker = null;

window.detectGPS = function() {
  const st = document.getElementById('gps-status');
  if(!navigator.geolocation) { st.textContent = "GPS not supported by browser."; return; }
  st.textContent = "Detecting high-accuracy location...";
  
  navigator.geolocation.getCurrentPosition(
    pos => {
      detectedPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      st.innerHTML = `<span style="color:var(--green)">✓ Found! Drag pin to refine your exact address.</span>`;
      
      const mapEl = document.getElementById('reg-map');
      mapEl.classList.add('show');
      
      if(!regMapInstance) {
        regMapInstance = L.map('reg-map').setView([detectedPos.lat, detectedPos.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(regMapInstance);
        
        const dragIco = L.divIcon({html:"<div style='width:18px;height:18px;background:var(--green);border-radius:50%;border:2px solid white;box-shadow:0 0 10px rgba(0,0,0,0.4);'></div>", className:''});
        regMarker = L.marker([detectedPos.lat, detectedPos.lng], {icon: dragIco, draggable: true}).addTo(regMapInstance);
        
        regMarker.on('dragend', function(e) {
          const mPos = regMarker.getLatLng();
          detectedPos = { lat: mPos.lat, lng: mPos.lng };
        });
      } else {
        regMapInstance.setView([detectedPos.lat, detectedPos.lng], 14);
        regMarker.setLatLng([detectedPos.lat, detectedPos.lng]);
      }
    },
    err => { st.innerHTML = `<span style="color:var(--red)">✗ Failed to detect. Check permissions.</span>`; },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

window.doRegister = async function() {
  const name = document.getElementById('reg-name').value.trim();
  const org = document.getElementById('reg-org').value.trim();
  if(!name || !org) return showToast("⚠ Please enter Name and Organisation.");
  if(!detectedPos) return showToast("⚠ Please detect GPS Location first.");
  
  const acc = { id: uid(), role: selectedRole, name, org, lat: detectedPos.lat, lng: detectedPos.lng };
  DB.set('acc:' + acc.id, acc);
  
  // If no plants exist, establish a mock plant nearby to ensure routing works
  const plants = DB.list('acc:').map(k => DB.get(k)).filter(a => a.role === 'plant');
  if (plants.length === 0 && selectedRole !== 'plant') {
    DB.set('acc:mock-plant-1', { id: 'mock-plant-1', role: 'plant', name: 'Established Plant', org: 'Beta Zone Plant', lat: detectedPos.lat + 0.05, lng: detectedPos.lng + 0.05 });
  }

  // Show Splash Screen
  const splash = document.getElementById('success-splash');
  if(splash) splash.classList.add('show');
  
  setTimeout(() => {
    if(splash) splash.classList.remove('show');
    executeLogin(acc);
  }, 2500);
}

async function refreshLoginDropdown() {
  const sel = document.getElementById('login-account');
  const accounts = DB.list('acc:').map(k => DB.get(k));
  if(accounts.length === 0) {
    sel.innerHTML = '<option value="">-- No accounts registered yet --</option>';
  } else {
    sel.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name} (${a.org}) - ${a.role.toUpperCase()}</option>`).join('');
  }
}

window.doLogin = async function() {
  const id = document.getElementById('login-account').value;
  if(!id) return showToast("⚠ Please select an account or register first.");
  const acc = DB.get('acc:' + id);
  if(!acc) return;
  executeLogin(acc);
}

function executeLogin(acc) {
  SESSION = acc;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').classList.add('active');
  
  document.getElementById('tb-name').textContent = acc.name;
  document.getElementById('tb-role').textContent = `${acc.role.toUpperCase()} · ${acc.org}`;
  document.getElementById('tb-avatar').textContent = acc.name.slice(0,2).toUpperCase();
  
  buildSidebar();
  autoRefreshTimer = setInterval(() => refreshCurrentView(), 15000);
}

window.doLogout = function() {
  clearInterval(autoRefreshTimer);
  SESSION = { role:null, name:'', org:'', uid:'', lat:null, lng:null };
  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('login-screen').style.display = 'flex';
  switchAuthTab('login');
}

// ── NAVIGATION ──
function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (SESSION.role === 'provider') {
    nav.innerHTML = `
      <button class="nav-item active" onclick="showView('v-pv-dash')" id="nav-v-pv-dash"><span class="nav-item-icon">📊</span> Overview</button>
      <button class="nav-item" onclick="showView('v-pv-req')" id="nav-v-pv-req"><span class="nav-item-icon">➕</span> Dispatch Request</button>
      <button class="nav-item" onclick="showView('v-pv-hist')" id="nav-v-pv-hist"><span class="nav-item-icon">📜</span> History</button>
    `;
    showView('v-pv-dash');
  }
  if (SESSION.role === 'rider') {
    nav.innerHTML = `
      <button class="nav-item active" onclick="showView('v-rd-dash')" id="nav-v-rd-dash"><span class="nav-item-icon">🗺️</span> Active Route</button>
      <button class="nav-item" onclick="showView('v-rd-jobs')" id="nav-v-rd-jobs"><span class="nav-item-icon">📋</span> Available Jobs <span class="nav-badge" id="rd-badge" style="display:none">0</span></button>
      <button class="nav-item" onclick="showView('v-rd-hist')" id="nav-v-rd-hist"><span class="nav-item-icon">✓</span> Completions</button>
    `;
    showView('v-rd-dash');
  }
  if (SESSION.role === 'plant') {
    nav.innerHTML = `
      <button class="nav-item active" onclick="showView('v-pl-dash')" id="nav-v-pl-dash"><span class="nav-item-icon">🏭</span> Operations</button>
      <button class="nav-item" onclick="showView('v-pl-in')" id="nav-v-pl-in"><span class="nav-item-icon">🚚</span> Incoming Flow</button>
      <button class="nav-item" onclick="showView('v-pl-out')" id="nav-v-pl-out"><span class="nav-item-icon">⚗️</span> Log Output</button>
    `;
    showView('v-pl-dash');
  }
}

window.showView = function(viewId) {
  currentView = viewId;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById('nav-' + viewId);
  if(btn) btn.classList.add('active');
  
  // Set Title
  if(btn) document.getElementById('tb-view-title').textContent = btn.innerText.replace(/[^a-zA-Z\s]/g, '').trim();
  
  refreshCurrentView(true);
}

// ── CORE DATA ENGINE ──
function getAllOrders() { return DB.list('ord:').map(k => DB.get('ord:'+k)).sort((a,b)=>b.ts-a.ts); }
function getOrder(id) { return DB.get('ord:'+id); }
function saveOrder(o) { DB.set('ord:'+o.id, o); }
function getAllLogs() { return DB.list('log:').map(k => DB.get('log:'+k)).sort((a,b)=>b.ts-a.ts); }

// Generic Order Card Component
function buildOrderCard(o, role) {
  const badges = {
    requested: '<span class="badge badge-blue">Requested</span>',
    assigned: '<span class="badge badge-amber">Assigned to Rider</span>',
    en_route: '<span class="badge badge-amber">En Route</span>',
    picked_up: '<span class="badge badge-green">Picked Up</span>',
    at_plant: '<span class="badge badge-green">Arrived at Plant</span>',
    completed: '<span class="badge" style="background:var(--green);color:white;">Completed</span>',
    rejected: '<span class="badge badge-red">Rejected</span>'
  };
  
  let acts = '';
  if (role === 'provider' && o.status === 'requested') {
    acts = `<button class="btn btn-ghost btn-sm" onclick="cancelOrder('${o.id}')">Cancel</button>`;
  }
  if (role === 'rider' && o.status === 'requested') {
    acts = `<button class="btn btn-primary btn-sm" onclick="riderAccept('${o.id}')">Accept Route</button>`;
  }
  if (role === 'rider' && o.status === 'assigned' && o.riderId === SESSION.id) {
    acts = `<button class="btn btn-amber btn-sm" onclick="riderUpdate('${o.id}','en_route')">Start Navigation →</button>`;
  }
  if (role === 'rider' && o.status === 'en_route' && o.riderId === SESSION.id) {
    acts = `<button class="btn btn-primary btn-sm" onclick="openPickupConfirm('${o.id}')">Confirm Collection ✓</button>`;
  }
  if (role === 'rider' && o.status === 'picked_up' && o.riderId === SESSION.id) {
    acts = `<button class="btn btn-amber btn-sm" onclick="riderUpdate('${o.id}','at_plant')">Arrived at Plant</button>`;
  }
  if (role === 'plant' && o.status === 'at_plant' && o.plantId === SESSION.id) {
    acts = `<button class="btn btn-primary btn-sm" onclick="openPlantConfirm('${o.id}')">Confirm Receipt ✓</button>`;
  }
  if (['provider', 'rider', 'plant'].includes(role) && o.status === 'completed') {
    acts += `<button class="btn btn-outline-danger btn-sm" onclick="deleteOrder('${o.id}')" style="margin-left:auto;">🗑 Delete Record</button>`;
  }

  return `
    <div class="order-card" data-status="${o.status}">
      <div class="oc-header">
        <div class="oc-title">${o.providerOrg} <span style="font-size:12px;color:var(--text-muted);font-family:monospace">#${o.id.slice(-6).toUpperCase()}</span></div>
        <div>${badges[o.status]}</div>
      </div>
      <div class="oc-meta">
        <div class="oc-meta-item">🗑 ${o.wasteType} (${o.kg}kg)</div>
        <div class="oc-meta-item">🕒 ${o.shift}</div>
        <div class="oc-meta-item">⚗️ Dest: ${o.plantName}</div>
      </div>
      ${o.actualKg ? `<div style="margin-bottom:8px;font-size:13px;color:var(--green);font-weight:600;">✓ Actual Collected: ${o.actualKg}kg (Quality: ${o.quality})</div>` : ''}
      ${acts ? `<div class="oc-actions">${acts}</div>` : ''}
    </div>
  `;
}

// ── REFRESH CONTROLLER ──
async function refreshCurrentView(fullRender = false) {
  const mc = document.getElementById('main-content');
  if (SESSION.role === 'provider') await renderProvider(mc, fullRender);
  if (SESSION.role === 'rider') await renderRider(mc, fullRender);
  if (SESSION.role === 'plant') await renderPlant(mc, fullRender);
}

// ════════ PROVIDER LOGIC ════════
async function renderProvider(mc, fullRender) {
  const orders = getAllOrders().filter(o => o.providerId === SESSION.id);
  const active = orders.filter(o => !['completed','rejected'].includes(o.status));
  const completed = orders.filter(o => o.status === 'completed');
  
  if (currentView === 'v-pv-dash') {
    if(fullRender) mc.innerHTML = `
      <div class="stats-grid" id="pv-stats"></div>
      <div class="two-col">
        <div><h3 class="heading" style="margin-bottom:16px;">Active Dispatches</h3><div id="pv-act"></div></div>
        <div>
          <div class="glass-card" style="background:var(--green-light); border-color:var(--green);">
            <div style="font-size:32px;margin-bottom:12px;">♻️</div>
            <h3 class="heading" style="color:var(--green-hover);margin-bottom:8px;">Ready to dispatch?</h3>
            <p style="font-size:14px;color:var(--green-hover);opacity:0.8;margin-bottom:20px;">Ensure you meet the 50kg minimum threshold for net-positive energy yield.</p>
            <button class="btn btn-primary" onclick="showView('v-pv-req')">Create Request →</button>
          </div>
          <h3 class="heading" style="margin-top:24px; margin-bottom:16px;">Regional Leaderboard</h3>
          <div class="glass-card" style="padding:16px;">
            <div class="between" style="padding:8px 0; border-bottom:1px solid var(--border);">
               <div style="font-weight:600;"><span style="color:var(--amber);">1.</span> Alpha Industries</div>
               <div class="badge badge-green">1,420 kg</div>
            </div>
            <div class="between" style="padding:8px 0; border-bottom:1px solid var(--border);">
               <div style="font-weight:600;"><span style="color:var(--amber);">2.</span> Beta Mess</div>
               <div class="badge badge-green">980 kg</div>
            </div>
            <div class="between" style="padding:8px 0;">
               <div style="font-weight:600;"><span style="color:var(--amber);">3.</span> ${SESSION.org} (You)</div>
               <div class="badge badge-green" id="pv-my-kg">0 kg</div>
            </div>
          </div>
        </div>
      </div>
    `;
    const totalKg = completed.reduce((s,o)=>s+(o.actualKg||o.kg),0);
    document.getElementById('pv-stats').innerHTML = `
      <div class="stat-card"><div class="stat-val">${orders.length}</div><div class="stat-lbl">Total Requests</div></div>
      <div class="stat-card"><div class="stat-val">${totalKg}</div><div class="stat-lbl">Kg Recycled</div></div>
      <div class="stat-card"><div class="stat-val">${Math.round(totalKg*0.62)}</div><div class="stat-lbl">CO₂ Offset (kg)</div></div>
    `;
    const pvMyKg = document.getElementById('pv-my-kg');
    if(pvMyKg) pvMyKg.textContent = totalKg + ' kg';
    document.getElementById('pv-act').innerHTML = active.length ? active.map(o=>buildOrderCard(o,'provider')).join('') : '<div class="empty-state"><div class="empty-sub">No active dispatches.</div></div>';
  }
  
  if (currentView === 'v-pv-req') {
    if(fullRender) mc.innerHTML = `
      <div style="max-width:600px; margin:0 auto;">
        <div class="glass-card">
          <h3 class="heading" style="margin-bottom:24px;">New Dispatch Request</h3>
          <div class="form-group">
            <label class="form-label">Waste Category</label>
            <select class="form-select" id="req-type">${WASTE_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Estimated Quantity (kg) <span style="color:var(--amber);">*Min 50kg Limit*</span></label>
            <input class="form-input" id="req-kg" type="number" min="50" placeholder="e.g. 120">
          </div>
          <div class="form-group">
            <label class="form-label">Collection Shift</label>
            <select class="form-select" id="req-shift">${SHIFTS.map(t=>`<option>${t}</option>`).join('')}</select>
          </div>
          <button class="btn btn-primary btn-full" onclick="submitPvRequest()">Locate Plant & Dispatch 🚀</button>
        </div>
      </div>
    `;
  }

  if (currentView === 'v-pv-hist') {
    if(fullRender) mc.innerHTML = `<h3 class="heading" style="margin-bottom:24px;">History</h3><div id="pv-hist-list"></div>`;
    document.getElementById('pv-hist-list').innerHTML = completed.length ? completed.map(o=>buildOrderCard(o,'provider')).join('') : '<div class="empty-state"><div class="empty-sub">No completed history.</div></div>';
  }
}

window.submitPvRequest = function() {
  const type = document.getElementById('req-type').value;
  const kg = parseInt(document.getElementById('req-kg').value);
  const shift = document.getElementById('req-shift').value;
  
  if (!kg || kg < 50) return showToast("⚠ Minimum 50 kg requirement not met to ensure net-positive energy yield.");
  
  // Find nearest plant (50km limit)
  const plants = DB.list('acc:').map(k=>DB.get(k)).filter(a=>a.role==='plant');
  let nearest = null; let minDist = 9999;
  for(let p of plants) {
    const d = distanceKm(SESSION.lat, SESSION.lng, p.lat, p.lng);
    if(d < minDist) { minDist = d; nearest = p; }
  }
  
  if (!nearest || minDist > 50) return showToast(`⚠ Out of Range! Nearest plant is >50km away.`);
  
  const o = {
    id: uid(), ts: ts(), providerId: SESSION.id, providerOrg: SESSION.org, providerLat: SESSION.lat, providerLng: SESSION.lng,
    wasteType: type, kg, shift, plantId: nearest.id, plantName: nearest.org, status: 'requested'
  };
  saveOrder(o);
  showToast(`✓ Dispatched! Routed to ${nearest.org} (${minDist.toFixed(1)}km away).`);
  showView('v-pv-dash');
}

window.cancelOrder = function(id) {
  const o = getOrder(id); if(!o) return;
  o.status = 'rejected'; saveOrder(o); showToast("Cancelled."); refreshCurrentView();
}

window.deleteOrder = function(id) {
  window.localStorage.removeItem(STORAGE_KEY_PREFIX + 'ord:' + id);
  showToast("✓ Record Deleted");
  refreshCurrentView(true);
}


// ════════ RIDER LOGIC ════════
async function renderRider(mc, fullRender) {
  const orders = getAllOrders();
  const myOrders = orders.filter(o => o.riderId === SESSION.id);
  const active = myOrders.find(o => !['completed','rejected'].includes(o.status));
  const pending = orders.filter(o => o.status === 'requested');
  const hist = myOrders.filter(o => o.status === 'completed');
  
  const b = document.getElementById('rd-badge');
  if(b) { b.style.display = pending.length ? 'inline-block' : 'none'; b.innerText = pending.length; }

  if (currentView === 'v-rd-dash') {
    if(fullRender) mc.innerHTML = `
      <div class="two-col">
        <div>
          <h3 class="heading" style="margin-bottom:16px;">Active Route</h3>
          <div id="rd-act"></div>
          ${active ? `<div class="glass-card" style="margin-top:24px;"><h4 style="margin-bottom:16px;">Route Progress</h4><div id="rd-tl" class="timeline"></div></div>` : ''}
        </div>
        <div>
          <h3 class="heading" style="margin-bottom:16px;">Optimal Path Map</h3>
          <div id="rider-map"></div>
          ${active ? `<div class="glass-card" style="margin-top:16px; background:var(--green-light); border-color:var(--green);">
            <div class="between">
              <div>
                <h4 style="color:var(--green-hover); margin-bottom:4px;">Optimal Path Active</h4>
                <p style="font-size:12px; color:var(--green-hover);">Route optimized for lowest emissions.</p>
              </div>
              <div style="text-align:right;">
                <div style="font-size:20px; font-weight:700; color:var(--green-hover);">~2.4 L</div>
                <div style="font-size:11px; color:var(--green-hover); text-transform:uppercase; font-weight:600;">Fuel Saved</div>
              </div>
            </div>
          </div>` : ''}
        </div>
      </div>
    `;
    
    document.getElementById('rd-act').innerHTML = active ? buildOrderCard(active, 'rider') : `<div class="empty-state"><div class="empty-icon">📍</div><div class="empty-title">No Active Task</div><div class="empty-sub">Check available jobs to begin a route.</div></div>`;
    
    if (active) {
      const steps = [
        {k:'assigned', l:'Route Assigned', d:true},
        {k:'en_route', l:'Driving to Provider', d:['en_route','picked_up','at_plant'].includes(active.status)},
        {k:'picked_up', l:'Waste Collected', d:['picked_up','at_plant'].includes(active.status)},
        {k:'at_plant', l:'Arrived at Plant', d:active.status==='at_plant'}
      ];
      document.getElementById('rd-tl').innerHTML = steps.map((s,i) => `
        <div class="tl-item ${s.d ? 'done':''}">
          <div class="tl-col"><div class="tl-dot"></div>${i<steps.length-1?'<div class="tl-line"></div>':''}</div>
          <div class="tl-content"><div class="tl-title">${s.l}</div></div>
        </div>
      `).join('');
    }
    
    // Map Logic
    setTimeout(() => {
      if(!document.getElementById('rider-map')) return;
      if(rMap) { rMap.remove(); rMap=null; }
      rMap = L.map('rider-map').setView([SESSION.lat, SESSION.lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(rMap);
      
      const rIco = L.divIcon({html:"<div style='width:16px;height:16px;background:var(--blue);border-radius:50%;border:2px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);'></div>", className:''});
      const rMarker = L.marker([SESSION.lat, SESSION.lng], {icon:rIco, draggable:true}).addTo(rMap).bindPopup("You (Rider) — <b>Drag me</b> to update exact GPS!").openPopup();
      
      rMarker.on('dragend', function(e) {
        const mPos = rMarker.getLatLng();
        SESSION.lat = mPos.lat; SESSION.lng = mPos.lng;
        DB.set('acc:'+SESSION.id, SESSION);
        refreshCurrentView(false); // Update polyline and distance silently
      });
      
      if(active) {
        const pIco = L.divIcon({html:"<div style='width:16px;height:16px;background:var(--amber);border-radius:50%;border:2px solid white;'></div>", className:''});
        L.marker([active.providerLat, active.providerLng], {icon:pIco}).addTo(rMap).bindPopup("Pickup: "+active.providerOrg);
        
        const plant = DB.get('acc:'+active.plantId);
        if (plant) {
           const pltIco = L.divIcon({html:"<div style='width:16px;height:16px;background:var(--green);border-radius:50%;border:2px solid white;'></div>", className:''});
           L.marker([plant.lat, plant.lng], {icon:pltIco}).addTo(rMap).bindPopup("Dropoff: "+plant.org);
           
           // Draw Polyline path
           const latlngs = [[SESSION.lat, SESSION.lng], [active.providerLat, active.providerLng], [plant.lat, plant.lng]];
           const polyline = L.polyline(latlngs, {color: 'var(--amber)', weight: 4, dashArray: '5,5'}).addTo(rMap);
           rMap.fitBounds(polyline.getBounds(), {padding:[40,40]});
        }
      }
    }, 100);
  }

  if (currentView === 'v-rd-jobs') {
    if(fullRender) mc.innerHTML = `<h3 class="heading" style="margin-bottom:24px;">Available Jobs</h3><div id="rd-jobs-list"></div>`;
    if(active) {
       document.getElementById('rd-jobs-list').innerHTML = `<div class="glass-card" style="border-color:var(--amber)"><h4 style="color:var(--amber)">Active Task blocks new jobs</h4><p class="muted">Finish your current route first.</p></div>`;
    } else {
       document.getElementById('rd-jobs-list').innerHTML = pending.length ? pending.map(o=>buildOrderCard(o,'rider')).join('') : '<div class="empty-state"><div class="empty-sub">No pending requests right now.</div></div>';
    }
  }

  if (currentView === 'v-rd-hist') {
    if(fullRender) mc.innerHTML = `<h3 class="heading" style="margin-bottom:24px;">Completions</h3><div id="rd-hist-list"></div>`;
    document.getElementById('rd-hist-list').innerHTML = hist.length ? hist.map(o=>buildOrderCard(o,'rider')).join('') : '<div class="empty-state">No completions yet.</div>';
  }
}

window.riderAccept = function(id) {
  const o = getOrder(id); if(!o) return;
  o.status = 'assigned'; o.riderId = SESSION.id; o.riderName = SESSION.name;
  saveOrder(o); showToast("✓ Route Accepted! Generating optimal path."); showView('v-rd-dash');
}
window.riderUpdate = function(id, st) {
  const o = getOrder(id); if(!o) return;
  o.status = st; saveOrder(o); refreshCurrentView();
}
window.openPickupConfirm = function(id) {
  const html = `
    <h3 class="modal-title">Confirm Collection</h3>
    <p class="modal-sub">Verify the load before continuing to plant.</p>
    <div class="form-group"><label class="form-label">Actual Weight Collected (kg)</label><input type="number" id="m-kg" class="form-input"></div>
    <div class="form-group"><label class="form-label">Quality Observation</label><select id="m-qual" class="form-select"><option>Good (Segregated)</option><option>Mixed (Contaminated)</option></select></div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="confirmPickup('${id}')">Confirm ✓</button></div>
  `;
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal').classList.add('open');
}
window.confirmPickup = function(id) {
  const kg = document.getElementById('m-kg').value;
  if(!kg) return showToast("⚠ Enter weight.");
  const o = getOrder(id); o.status = 'picked_up'; o.actualKg = kg; o.quality = document.getElementById('m-qual').value;
  saveOrder(o); closeModal(); refreshCurrentView();
}
window.closeModal = function() { document.getElementById('modal').classList.remove('open'); }

// ════════ PLANT LOGIC ════════
async function renderPlant(mc, fullRender) {
  const orders = getAllOrders().filter(o => o.plantId === SESSION.id);
  const incoming = orders.filter(o => o.status === 'at_plant');
  const completed = orders.filter(o => o.status === 'completed');
  const logs = getAllLogs().filter(l => l.plantId === SESSION.id);
  
  if (currentView === 'v-pl-dash') {
    if(fullRender) mc.innerHTML = `
      <div class="stats-grid" id="pl-stats"></div>
      <div class="two-col">
        <div><h3 class="heading" style="margin-bottom:16px;">Gate Arrivals</h3><div id="pl-inc"></div></div>
        <div><h3 class="heading" style="margin-bottom:16px;">Recent Output</h3><div id="pl-out-logs"></div></div>
      </div>
    `;
    const totKg = completed.reduce((s,o)=>s+parseFloat(o.actualKg||0),0);
    const totBio = logs.reduce((s,l)=>s+parseFloat(l.bio||0),0);
    
    document.getElementById('pl-stats').innerHTML = `
      <div class="stat-card"><div class="stat-val">${completed.length}</div><div class="stat-lbl">Processed Loads</div></div>
      <div class="stat-card"><div class="stat-val">${totKg}</div><div class="stat-lbl">Kg Received</div></div>
      <div class="stat-card"><div class="stat-val">${totBio.toFixed(1)}</div><div class="stat-lbl">Biogas (m³)</div></div>
    `;
    document.getElementById('pl-inc').innerHTML = incoming.length ? incoming.map(o=>buildOrderCard(o,'plant')).join('') : '<div class="empty-state">No trucks waiting at gate.</div>';
    
    document.getElementById('pl-out-logs').innerHTML = logs.length ? logs.slice(0,4).map(l => `
      <div class="glass-card" style="padding:16px; margin-bottom:12px;">
         <div class="between" style="margin-bottom:8px;"><span class="badge badge-blue">Log</span> <span class="muted" style="font-size:12px">${fmtDate(l.ts)}</span></div>
         <div style="font-size:14px;"><strong>Biogas:</strong> ${l.bio} m³ &nbsp;·&nbsp; <strong>Compost:</strong> ${l.comp} kg</div>
      </div>
    `).join('') : '<div class="empty-state">No outputs logged.</div>';
  }

  if (currentView === 'v-pl-in') {
    if(fullRender) mc.innerHTML = `<h3 class="heading" style="margin-bottom:24px;">Incoming Flow</h3><div id="pl-in-list"></div>`;
    document.getElementById('pl-in-list').innerHTML = incoming.length ? incoming.map(o=>buildOrderCard(o,'plant')).join('') : '<div class="empty-state">No incoming.</div>';
  }

  if (currentView === 'v-pl-out') {
    if(fullRender) mc.innerHTML = `
      <div style="max-width:600px; margin:0 auto;">
        <div class="glass-card">
          <h3 class="heading" style="margin-bottom:24px;">Log Daily Output</h3>
          <div class="form-group"><label class="form-label">Biogas Produced (m³)</label><input class="form-input" id="out-bio" type="number" step="0.1"></div>
          <div class="form-group"><label class="form-label">Compost Yield (kg)</label><input class="form-input" id="out-comp" type="number" step="0.1"></div>
          <div class="form-group"><label class="form-label">Digester Temp (°C)</label><input class="form-input" id="out-temp" type="number" step="0.1"></div>
          <button class="btn btn-primary btn-full" onclick="savePlantLog()">Save Record</button>
        </div>
      </div>
    `;
  }
}

window.openPlantConfirm = function(id) {
  const html = `
    <h3 class="modal-title">Intake Assessment</h3>
    <p class="modal-sub">Final confirmation before processing.</p>
    <div class="form-group"><label class="form-label">Segregation Score (0-100)</label><input type="number" id="p-score" class="form-input"></div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="confirmPlantReceipt('${id}')">Accept Load ✓</button></div>
  `;
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal').classList.add('open');
}

window.confirmPlantReceipt = function(id) {
  const o = getOrder(id); if(!o) return;
  o.status = 'completed'; o.segScore = document.getElementById('p-score').value || 0;
  saveOrder(o); closeModal(); refreshCurrentView(); showToast("✓ Intake Confirmed.");
}

window.savePlantLog = function() {
  const bio = document.getElementById('out-bio').value;
  const comp = document.getElementById('out-comp').value;
  if(!bio && !comp) return showToast("⚠ Enter output values.");
  
  DB.set('log:'+uid(), { id: uid(), ts: ts(), plantId: SESSION.id, bio, comp, temp: document.getElementById('out-temp').value });
  showToast("✓ Output logged!");
  showView('v-pl-dash');
}

// ── INIT ──
document.getElementById('login-screen').style.display = 'flex';
switchAuthTab('login');
