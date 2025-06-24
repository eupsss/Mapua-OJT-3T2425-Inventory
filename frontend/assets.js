// assets.js – grid + modal (Working / Needs-Replacement / Defective)
console.log('▶ assets.js loaded');

const API_BASE = '../api';   // <- point at your Express API root

// 1️⃣ login guard
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied – please log in.');
  location.href = 'login.html';
}

// 2️⃣ helpers
const $ = (q, c = document) => c.querySelector(q);
const posFor = pc => {
  const n = +pc;
  if (n === 0) return { row: 1, col: 9 };
  const r   = Math.ceil(n / 8) + 1;
  const idx = (n - 1) % 8;
  return { row: r, col: idx < 4 ? 9 - idx : 8 - idx };
};

// 3️⃣ DOM refs
let roomSel, grid;
const specModal = $('#specModal');
const specPc    = $('#specPc');
const specTbl   = $('#specTable');
const btnPrev   = $('#prevSpec');
const btnNext   = $('#nextSpec');
$('#specClose').onclick = () => specModal.classList.add('hidden');

// 4️⃣ modal state
let historyRows = [], cursorIdx = 0;

// ─── status helpers ──────────────────────────────────────────────
function friendlyStatus(rawStatus, installedAt) {
  if (rawStatus === 'Defective') return 'Defective';
  const age = (Date.now() - Date.parse(installedAt)) / 3.15576e10;
  return age >= 5 ? 'Needs Replacement' : 'Working';
}

function statusIcon(label) {
  if (label === 'Defective')         return '../icons/defective.png';
  if (label === 'Needs Replacement') return '../icons/warning.png';
  return '../icons/working.png';
}

// ─── modal render ────────────────────────────────────────────────
function renderModal() {
  const spec  = historyRows[cursorIdx];
  const label = friendlyStatus(spec.Status, spec.InstalledAt);

  specTbl.innerHTML = `
    <tr><td><strong>Status</strong></td><td>${label}</td></tr>
    <tr><td>Installed</td><td>${spec.InstalledAt}</td></tr>
    ${spec.RetiredAt ? `<tr><td>Retired</td><td>${spec.RetiredAt}</td></tr>` : ''}
    <tr><td>Make / Model</td><td>${spec.MakeModel}</td></tr>
    <tr><td>Serial No.</td><td>${spec.SerialNumber}</td></tr>
    <tr><td>CPU</td><td>${spec.CPU}</td></tr>
    <tr><td>GPU</td><td>${spec.GPU}</td></tr>
    <tr><td>RAM (GB)</td><td>${spec.RAM_GB}</td></tr>
    <tr><td>Storage (GB)</td><td>${spec.Storage_GB}</td></tr>
    <tr><td>Monitor</td><td>${spec.MonitorModel} (${spec.MonitorSerial})</td></tr>
    <tr><td>UPS</td><td>${spec.UPSModel} (${spec.UPSSerial})</td></tr>
  `;

  btnPrev.disabled = cursorIdx >= historyRows.length - 1;
  btnNext.disabled = cursorIdx === 0;
}

btnPrev.onclick = () => {
  if (cursorIdx < historyRows.length - 1) {
    cursorIdx++;
    renderModal();
  }
};
btnNext.onclick = () => {
  if (cursorIdx > 0) {
    cursorIdx--;
    renderModal();
  }
};

// ─── modal opener ───────────────────────────────────────────────
function openModal(pcNum) {
  fetch(`${API_BASE}/assets?room=${roomSel.value}&history=1&pc=${pcNum}`)
    .then(r => r.json())
    .then(rows => {
      historyRows = rows;      // newest → oldest
      cursorIdx   = 0;
      specPc.textContent = pcNum;
      renderModal();
      specModal.classList.remove('hidden');
    })
    .catch(err => {
      console.error(err);
      alert('No history for this PC');
    });
}

// ─── grid builder ───────────────────────────────────────────────
function buildGrid(pcs) {
  grid.innerHTML = '';
  pcs
    .filter(p => +p.PCNumber <= 40)                  // hide instructor 41+
    .sort((a, b) => a.PCNumber - b.PCNumber)
    .forEach(p => {
      const label = friendlyStatus(p.Status, p.InstalledAt);
      const icon  = statusIcon(label);

      const card = document.createElement('div');
      card.className       = 'pc-card';
      card.dataset.status  = label;
      card.innerHTML       = `<img src="${icon}" class="pc-icon"><span class="pc-number">${p.PCNumber}</span>`;
      const pos            = posFor(p.PCNumber);
      card.style.gridRow   = pos.row;
      card.style.gridColumn= pos.col;
      card.onclick         = () => openModal(p.PCNumber);
      grid.appendChild(card);
    });
}

// ─── init on DOMContentLoaded ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // sign-out
  $('#signout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('user');
    location.href = 'login.html';
  });

  $('.username').textContent = user.name;
  roomSel = $('#room-select');
  grid    = $('#pc-grid');

  // load rooms dropdown
  fetch(`${API_BASE}/rooms`)
    .then(r => r.json())
    .then(rooms => {
      rooms.forEach(rm => {
        const o = document.createElement('option');
        o.value = o.textContent = rm.RoomID;
        roomSel.appendChild(o);
      });
      if (rooms[0]) {
        roomSel.value = rooms[0].RoomID;
        loadGrid();
      }
    });

  roomSel.onchange = loadGrid;

  function loadGrid() {
    grid.innerHTML = 'Loading…';
    fetch(`${API_BASE}/assets?room=${roomSel.value}`)
      .then(r => r.json())
      .then(buildGrid)
      .catch(err => {
        console.error(err);
        grid.innerHTML = 'Error';
      });
  }
});
