/*───────────────────────────────────────────────────────────────
  assets.js  –  CRUD grid (PC 00-40) with Add/Edit inside specs modal
───────────────────────────────────────────────────────────────*/
console.log('▶ assets.js loaded');
const API_BASE = '../api/computer-assets';

/* helpers */
const $ = (q, c = document) => c.querySelector(q);
const posFor = n => {
  n = +n;
  if (n === 0) return { row: 1, col: 9 };                // instructor
  const row = Math.ceil(n / 8) + 1,
        idx = (n - 1) % 8;
  return { row, col: idx < 4 ? 9 - idx : 8 - idx };      // mirrored 4-gap-4
};
const friendly = (s, t) =>
  s === 'Defective' ? 'Defective'
                    : (Date.now() - Date.parse(t)) / 3.15576e10 >= 5
                      ? 'Needs Replacement'
                      : 'Working';
const iconFor = s =>
  s === 'Defective'         ? '../icons/defective.png'
  : s === 'Needs Replacement'? '../icons/warning.png'
  : '../icons/working.png';

/* DOM refs */
const roomSel   = $('#room-select');
const grid      = $('#pc-grid');
const userSpan  = $('.username');
const signout   = $('#signout-btn');

/* specs modal */
const specM     = $('#specModal');
const specPc    = $('#specPc');
const specTbl   = $('#specTable');
const btnPrev   = $('#prevSpec');
const btnNext   = $('#nextSpec');
const btnAdd    = $('#specAdd');
const btnEdit   = $('#specEdit');
$('#specClose').onclick = () => specM.classList.add('hidden');

/* edit modal */
const editM   = $('#editModal');
const editF   = $('#editForm');
const editH   = $('#editTitle');
$('#editCancel').onclick = () => editM.classList.add('hidden');

/* auth check */
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) location.href = 'login.html';
userSpan.textContent = user.name;

/* state */
let selCard = null, historyRows = [], cursor = 0;

/* grid loader */
/* ─── grid loader (dedups by PCNumber) ───────────────────── */
async function loadGrid() {
  if (!roomSel.value) return;
  grid.textContent = 'Loading…';

  /* 1. grab rows from the API */
  const rows = await fetch(`${API_BASE}?room=${roomSel.value}`).then(r => r.json());

  /* 2. keep only the *latest* row per PCNumber */
  const latestByPc = {};
  rows.forEach(r => {
    const key = r.PCNumber;
    if (!latestByPc[key] ||
        new Date(r.InstalledAt) > new Date(latestByPc[key].InstalledAt)) {
      latestByPc[key] = r;
    }
  });
  const pcs = Object.values(latestByPc)          // ← 1 row per PC
                     .filter(r => +r.PCNumber <= 40)
                     .sort((a, b) => a.PCNumber - b.PCNumber);

  /* 3. rebuild the grid */
  grid.innerHTML = '';
  selCard = null;

  pcs.forEach(r => {
    const stat = friendly(r.Status, r.InstalledAt);
    const card = document.createElement('div');
    card.className  = 'pc-card';
    card.dataset.id = r.AssetID;
    card.dataset.pc = r.PCNumber;
    card.innerHTML  =
      `<img src="${iconFor(stat)}" class="pc-icon">
       <span class="pc-number">${r.PCNumber}</span>`;

    const { row, col } = posFor(r.PCNumber);
    card.style.gridRow    = row;
    card.style.gridColumn = col;

    card.onclick = () => { select(card); openHistory(r.PCNumber); };
    grid.appendChild(card);
  });
}

function select(c) { if (selCard) selCard.classList.remove('selected'); selCard = c; c.classList.add('selected'); }

/* specs / history modal */
async function openHistory(pc) {
  historyRows = await fetch(`${API_BASE}?room=${roomSel.value}&pc=${pc}&history=1`).then(r => r.json());
  cursor = 0; renderHistory(); specM.classList.remove('hidden');
}
function renderHistory() {
  const r = historyRows[cursor];
  specPc.textContent = r.PCNumber;
  specTbl.innerHTML = `
    <tr><td><strong>Status</strong></td><td>${friendly(r.Status, r.InstalledAt)}</td></tr>
    <tr><td>Installed</td><td>${r.InstalledAt}</td></tr>
    ${r.RetiredAt ? `<tr><td>Retired</td><td>${r.RetiredAt}</td></tr>` : ''}
    <tr><td>Make / Model</td><td>${r.MakeModel}</td></tr>
    <tr><td>Serial #</td><td>${r.SerialNumber}</td></tr>
    <tr><td>CPU</td><td>${r.CPU || '-'}</td></tr>
    <tr><td>GPU</td><td>${r.GPU || '-'}</td></tr>
    <tr><td>RAM (GB)</td><td>${r.RAM_GB || '-'}</td></tr>
    <tr><td>Storage (GB)</td><td>${r.Storage_GB || '-'}</td></tr>`;
  btnPrev.disabled = cursor >= historyRows.length - 1;
  btnNext.disabled = cursor === 0;
}
btnPrev.onclick = () => { if (cursor < historyRows.length - 1) { cursor++; renderHistory(); } };
btnNext.onclick = () => { if (cursor > 0) { cursor--; renderHistory(); } };

/* open edit modal */
function openEdit(mode) {
  editM.dataset.mode = mode;
  editH.textContent = mode === 'create' ? 'Add PC' : 'Edit PC';
  editF.reset(); $('#efRoom').value = roomSel.value;

  if (mode === 'update') {
    const r = historyRows[0];
    $('#efPC').value        = r.PCNumber;
    $('#efInstalled').value = r.InstalledAt.slice(0, 10);
    $('#efMake').value      = r.MakeModel;
    $('#efSerial').value    = r.SerialNumber;
    $('#efCPU').value       = r.CPU        || '';
    $('#efGPU').value       = r.GPU        || '';
    $('#efRAM').value       = r.RAM_GB     || '';
    $('#efStorage').value   = r.Storage_GB || '';
  }
  $('#efPC').readOnly = false;
  editM.classList.remove('hidden');
}
btnAdd.onclick  = () => openEdit('create');
btnEdit.onclick = () => openEdit('update');

/* submit add / edit */
editF.onsubmit = async e => {
  e.preventDefault();
  const data   = Object.fromEntries(new FormData(editF));
  const mode   = editM.dataset.mode;
  const url    = mode === 'update' ? `${API_BASE}/${selCard.dataset.id}` : API_BASE;
  const method = mode === 'update' ? 'PUT' : 'POST';
  await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  editM.classList.add('hidden'); specM.classList.add('hidden'); await loadGrid();
};

/* sign-out */
signout.onclick = () => { sessionStorage.removeItem('user'); location.href = 'login.html'; };

/* bootstrap */
roomSel.onchange = loadGrid;
(async () => {
  const rooms = await fetch('../api/rooms').then(r => r.json());
  rooms.forEach(r => {
    const o=document.createElement('option'); o.value=o.textContent=r.RoomID; roomSel.appendChild(o);
  });
  if (rooms[0]) { roomSel.value = rooms[0].RoomID; await loadGrid(); }
})();
