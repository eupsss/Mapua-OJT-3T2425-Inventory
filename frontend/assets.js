// assets.js
console.log('▶ assets.js loaded');

const API_BASE   = '/api/computer-assets';
const HISTORY_EP = API_BASE + '/history';
const ROOMS_API  = '/api/rooms';

const usernameElm = document.querySelector('.username');
const signoutBtn  = document.getElementById('signout-btn');
const roomSel     = document.getElementById('room-select');
const grid        = document.getElementById('pc-grid');

const specM   = document.getElementById('specModal');
const specPc  = document.getElementById('specPc');
const specTbl = document.getElementById('specTable');
const btnPrev = document.getElementById('prevSpec');
const btnNext = document.getElementById('nextSpec');
const btnAdd  = document.getElementById('specAdd');
const btnEdit = document.getElementById('specEdit');
const btnClose= document.getElementById('specClose');

const editM     = document.getElementById('editModal');
const editForm  = document.getElementById('editForm');
const editTitle = document.getElementById('editTitle');
const editCancel= document.getElementById('editCancel');

let selCard     = null;
let historyRows = [];
let cursor      = 0;
let currentCfg  = 1;

// — AUTH & SIGNOUT —

// — AUTH & SIGNOUT —
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) location.href = 'login.html';

// get first name
const firstName = user.name.trim().split(' ')[0];

// set greeting + name
usernameElm.textContent       = user.name;   // e.g. "Hi, Mark"
document.querySelector('.user-name').textContent = `Hi, ${firstName}!`; // sidebar name

signoutBtn.onclick = () => {
  sessionStorage.removeItem('user');
  location.href = 'login.html';
};

if (!user) location.href = 'login.html';

signoutBtn.onclick = () => {
  sessionStorage.removeItem('user');
  location.href = 'login.html';
};

// — Sidebar avatar & name —

document.querySelectorAll('.avatar').forEach(el => {
  const initials = user.name
    .split(' ')
    .map(n => n[0]?.toUpperCase()||'')
    .join('').slice(0,2);
  el.textContent = initials;
});

// — HELPERS — 
// always return a { row, col } so your grid placements never break
function positionFor(n, cfg = 1) {
  const num = +n;
  if (num === 0) return { row: 1, col: 9 };
  const r = Math.ceil(num / 8) + 1;
  const i = (num - 1) % 8;
  if (cfg === 1) return { row: r, col: i < 4 ? 9 - i : 8 - i };
  if (cfg === 2) return { row: r, col: i < 5 ? 9 - i : 8 - i };
  // fallback layout
  const idx = num - 1;
  return { row: Math.floor(idx / 10) + 2, col: (idx % 10) + 1 };
}

function friendly(st, date) {
  if (st === 'Defective') return 'Defective';
  const age = (Date.now() - Date.parse(date)) / 3.15576e10;
  return age >= 5 ? 'Needs Replacement' : 'Working';
}

function iconFor(stat) {
  return stat === 'Defective'         ? '../icons/defective.png'
       : stat === 'Needs Replacement' ? '../icons/warning.png'
       :                                '../icons/working.png';
}

function selectCard(card) {
  if (selCard) selCard.classList.remove('selected');
  selCard = card;
  card.classList.add('selected');
}

// — GRID CLICK → show history modal —
grid.addEventListener('click', e => {
  const card = e.target.closest('.pc-card');
  if (!card) return;
  selectCard(card);
  openHistory(card.dataset.pc);
});

// — fetch & render history —
async function openHistory(pcNum) {
  try {
    const resp = await fetch(
      `${API_BASE}?room=${roomSel.value}&pc=${pcNum}&history=1`
    );
    if (!resp.ok) throw new Error();
    historyRows = (await resp.json())
      .sort((a,b)=>new Date(b.InstalledAt) - new Date(a.InstalledAt));
    cursor = 0;
    renderHistory();
    specM.classList.remove('hidden');
  } catch {
    alert('Unable to load specs/history.');
  }
}

function renderHistory() {
  specPc.textContent = selCard?.dataset.pc || '—';
  if (!historyRows.length) {
    specTbl.innerHTML = `
      <tr>
        <td colspan="2" style="text-align:center;padding:1rem;">
          <em>No history yet for this PC.</em>
        </td>
      </tr>`;
    btnPrev.disabled = btnNext.disabled = true;
    return;
  }
  const r = historyRows[cursor];
  specTbl.innerHTML = `
    <tr><td><b>Status</b></td><td>${friendly(r.Status, r.InstalledAt)}</td></tr>
    <tr><td>Installed</td><td>${r.InstalledAt}</td></tr>
    ${r.RetiredAt ? `<tr><td>Retired</td><td>${r.RetiredAt}</td></tr>` : ''}
    <tr><td>Make/Model</td><td>${r.MakeModel}</td></tr>
    <tr><td>Serial #</td><td>${r.SerialNumber}</td></tr>
    <tr><td>CPU</td><td>${r.CPU || '-'}</td></tr>
    <tr><td>GPU</td><td>${r.GPU || '-'}</td></tr>
    <tr><td>RAM (GB)</td><td>${r.RAM_GB || '-'}</td></tr>
    <tr><td>Storage (GB)</td><td>${r.Storage_GB || '-'}</td></tr>`;
  btnPrev.disabled = cursor >= historyRows.length - 1;
  btnNext.disabled = cursor <= 0;
}

// — history modal buttons —
btnPrev.onclick  = () => { if (cursor < historyRows.length - 1) { cursor++; renderHistory(); } };
btnNext.onclick  = () => { if (cursor > 0)               { cursor--; renderHistory(); } };
btnAdd.onclick   = () => openEdit('create');
btnEdit.onclick  = () => openEdit('update');
btnClose.onclick = () => specM.classList.add('hidden');

// — open Add/Edit form —
function openEdit(mode) {
  editM.dataset.mode = mode;
  editForm.reset();
  document.getElementById('efRoom').value = roomSel.value;

  if (mode === 'create') {
    editTitle.textContent = 'Add Record';
    document.getElementById('efPC').readOnly = true;
    document.getElementById('efPC').value    = selCard.dataset.pc;
  } else {
    editTitle.textContent = 'Edit PC';
    const r = historyRows[0];
    document.getElementById('efPC').readOnly     = true;
    document.getElementById('efPC').value        = r.PCNumber;
    document.getElementById('efInstalled').value = r.InstalledAt.slice(0,10);
    document.getElementById('efMake').value      = r.MakeModel;
    document.getElementById('efSerial').value    = r.SerialNumber;
    document.getElementById('efCPU').value       = r.CPU || '';
    document.getElementById('efGPU').value       = r.GPU || '';
    document.getElementById('efRAM').value       = r.RAM_GB || '';
    document.getElementById('efStorage').value   = r.Storage_GB || '';
  }

  editM.classList.remove('hidden');
}
editCancel.onclick = () => editM.classList.add('hidden');

// — submit Add/Edit —
editForm.onsubmit = async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(editForm));
  const mode = editM.dataset.mode;
  const url  = mode === 'create'
    ? HISTORY_EP
    : `${API_BASE}/${selCard.dataset.id}`;
  const opts = {
    method : mode === 'create' ? 'POST' : 'PUT',
    headers: { 'Content-Type':'application/json' },
    body   : JSON.stringify(data)
  };
  try {
    await fetch(url, opts);
    editM.classList.add('hidden');
    specM.classList.add('hidden');
    await loadGrid();
  } catch {
    console.error('save failed');
  }
};

// — build grid cards —
function makeCard(r) {
  const card = document.createElement('div');
  card.className   = 'pc-card';
  card.dataset.id  = r.AssetID;
  card.dataset.pc  = r.PCNumber;
  card.innerHTML   = `
    <img src="${iconFor(friendly(r.Status, r.InstalledAt))}"
         class="pc-icon" alt="${r.Status}">
    <span class="pc-number">${r.PCNumber}</span>`;
  const pos = positionFor(r.PCNumber, currentCfg);
  card.style.gridRow    = pos.row;
  card.style.gridColumn = pos.col;
  grid.appendChild(card);
}

function makeEmptyCard(pc) {
  const card = document.createElement('div');
  card.className  = 'pc-card empty';
  card.dataset.pc = pc;
  card.innerHTML  = `
    <img src="../icons/working.png" class="pc-icon" alt="Empty">
    <span class="pc-number">${pc}</span>`;
  const pos = positionFor(pc, currentCfg);
  card.style.gridRow    = pos.row;
  card.style.gridColumn = pos.col;
  grid.appendChild(card);
}

// — load rooms & grid —
async function loadRooms() {
  try {
    const rooms = await fetch(ROOMS_API).then(r => r.json());
    roomSel.innerHTML = '<option value="">– Choose a room –</option>';
    rooms.forEach(rm => {
      const o = document.createElement('option');
      o.value          = rm.RoomID;
      o.textContent    = rm.RoomID;
      o.dataset.config = rm.Room_Config || 1;
      o.dataset.pcnum  = rm.PC_NUM      || 40;
      roomSel.appendChild(o);
    });
  } catch (err) {
    console.error('loadRooms error', err);
  }
}

async function loadGrid() {
  if (!roomSel.value) return;
  grid.innerHTML = '';
  const opt       = roomSel.selectedOptions[0];
  currentCfg      = +opt.dataset.config || 1;
  const slotCount = (+opt.dataset.pcnum - 1) || 40;
  grid.classList.toggle('config-2', currentCfg === 2);

  let rows = [];
  try {
    rows = await fetch(`${API_BASE}?room=${roomSel.value}`)
              .then(r => r.json());
  } catch (err) {
    console.error('fetch assets error', err);
  }

  const latest = {};
  rows.forEach(r => {
    const key = r.PCNumber;
    if (!latest[key] ||
        new Date(r.InstalledAt) > new Date(latest[key].InstalledAt)) {
      latest[key] = r;
    }
  });

  for (let i = 0; i <= slotCount; i++) {
    const pc = String(i).padStart(2, '0');
    latest[pc] ? makeCard(latest[pc]) : makeEmptyCard(pc);
  }
}

// — kick things off —
roomSel.onchange = loadGrid;
(async function(){
  await loadRooms();
  if (roomSel.options.length > 1) {
    roomSel.selectedIndex = 1;
    await loadGrid();
  }
})();
