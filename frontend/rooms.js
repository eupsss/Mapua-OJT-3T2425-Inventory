/* ====================================================================
   rooms.js - Mapúa Inventory  (merged defect + fix flows)
   Added: datetime‑local picker in “Log Fix” modal (defaults to NOW)
   ==================================================================== */

/* ───── 0. Login guard ───────────────────────────────────────────── */
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied – please sign in.');
  location.href = 'login.html';
}

/*************************************************
 * 1)  Convenience helpers
 *************************************************/
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const todayISO         = () => new Date().toISOString().split('T')[0];
const nowDateTimeLocal = () => new Date().toISOString().slice(0,16); // YYYY‑MM‑DDTHH:mm
const API_BASE = '../api/';

/*************************************************
 * 2)  Module‑scope state
 *************************************************/
let pending      = null;   /* for reporting a defect  */
let currentCard  = null;   /* for logging a fix       */
let userRoster   = [];     /* all users (fixers)      */

/*************************************************
 * 3)  DOM refs (wired up after DOMContentLoaded)
 *************************************************/
let roomSelect, pcGrid,
    defectModal, defectForm, btnDefectCancel,
    fixModal,    fixForm,    fixDateTime, fixerInput, fixerList, btnFixCancel;

/*************************************************
 * 4)  Fetch helpers
 *************************************************/
async function fetchJSON(url, opts = {}) {
  const res      = await fetch(url, opts);
  const payload  = await res.json().catch(() => ({}));   // still try
  if (!res.ok)  throw new Error(payload.error || res.statusText);
  return payload;
}

/* update‑status.php – mark PC as Defective / Working */
async function updateStatus(roomID, pcNumber, status, issues) {
  const payload = { roomID, pcNumber, status, issues, userID: user.id };
  const j = await fetchJSON(API_BASE + 'update-status.php', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(payload)
  });
  if (!j.success) throw new Error(j.error || 'API error');
}

/*************************************************
 * 5)  UI helpers
 *************************************************/
function positionFor(pc) {
  const n = Number(pc);
  if (n === 0) return { row: 1, col: 9 };
  const logicalRow = Math.ceil(n / 8);
  const row        = logicalRow + 1;          /* skip header */
  const idx        = (n - 1) % 8;
  return { row, col: idx < 4 ? 9 - idx : 8 - idx };
}

function setCardVisual(card, status) {
  card.dataset.status = status;
  card.classList.toggle('selected', status === 'Defective');
  const icon = $('img', card);
  if (icon) icon.src = `../icons/${status === 'Available' ? 'Available' : 'defective'}.png`;
  const label = $('span.pc-number', card);
  if (label) label.style.color = status === 'Available' ? '#238636' : 'var(--color-primary)';
}

/*************************************************
 * 6)  Build a single PC card
 *************************************************/
function makeCard(roomID, { PCNumber, Status }) {
  const num = Number(PCNumber);
  if (isNaN(num) || num > 40) return;        /* ignore instructor PCs */
  const initStatus = (Status || '').toLowerCase() === 'defective' ? 'Defective' : 'Available';

  const card = document.createElement('div');
  card.className   = 'pc-card';
  card.dataset.pc  = PCNumber;

  /* inner content */
  card.innerHTML = `
    <img class="pc-icon" src="../icons/${initStatus === 'Available' ? 'Available' : 'defective'}.png" alt="${initStatus}">
    <span class="pc-number">${PCNumber}</span>
  `;

  setCardVisual(card, initStatus);

  const { row, col } = positionFor(PCNumber);
  card.style.gridRow    = row;
  card.style.gridColumn = col;

  card.addEventListener('click', () => {
    if (card.dataset.status === 'Available') {
      pending = { card, roomID, pcNumber: PCNumber };
      defectModal.classList.remove('hidden');
    } else {
      currentCard            = card;
      fixModal.dataset.room  = roomID;
      fixModal.dataset.pc    = PCNumber;
      fixDateTime.value      = nowDateTimeLocal();
      fixerInput.value       = '';
      fixModal.classList.remove('hidden');
      fixerInput.focus();
    }
  });

  pcGrid.appendChild(card);
}

/*************************************************
 * 7)  Load users for Fix modal datalist
 *************************************************/
async function loadUsers() {
  try {
    userRoster = await fetchJSON('../api/users.php');
    fixerList.innerHTML = userRoster.map(u => `<option value="${u.fullName}" data-id="${u.userId}">`).join('');
  } catch (err) {
    console.error(err);
    alert('Unable to load user list – fix logging disabled.');
  }
}

/*************************************************
 * 8)  Rooms + PCs
 *************************************************/
async function loadRooms() {
  try {
    const rooms = await fetchJSON(API_BASE + 'rooms.php');
    rooms.forEach(r => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = r.RoomID;
      roomSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('rooms.php failed', err);
  }
}

async function loadPCs(roomID) {
  pcGrid.innerHTML = '';
  if (!roomID) return;
  try {
    const pcs = await fetchJSON(`${API_BASE}pcs.php?room=${encodeURIComponent(roomID)}`);
    pcs.forEach(pc => makeCard(roomID, pc));
  } catch (err) {
    console.error('pcs.php failed', err);
  }
}

/*************************************************
 * 9)  Modal handlers – Defect
 *************************************************/
function wireDefectModal() {
  btnDefectCancel.addEventListener('click', () => {
    defectModal.classList.add('hidden');
    defectForm.reset();
    pending = null;
  });

  defectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pending) return;

    const issues = $$('input[name="issues"]:checked', defectForm).map(cb => cb.value);
    const { card, roomID, pcNumber } = pending;

    defectModal.classList.add('hidden');
    defectForm.reset();
    pending = null;

    setCardVisual(card, 'Defective');

try {
  await updateStatus(roomID, pcNumber, 'Defective', issues);
} catch (err) {
  console.error('update-status:', err.message);
  alert('Failed to report defect:\n' + err.message);
  setCardVisual(card, 'Available');
}

  });
}

/*************************************************
 * 10)  Modal handlers – Fix
 *************************************************/
function wireFixModal() {
  btnFixCancel.addEventListener('click', () => {
    fixModal.classList.add('hidden');
    currentCard = null;
  });

  fixForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const roomID   = fixModal.dataset.room;
    const pcNumber = fixModal.dataset.pc;
    const fixedOn  = fixDateTime.value;        // ISO‑8601 local string
    const fixer    = fixerInput.value.trim();
    const user     = userRoster.find(u => u.fullName === fixer);

    if (!user) {
      alert('Please pick a name from the list.');
      return fixerInput.focus();
    }

    try {
      await fetchJSON('../api/fix.php', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ roomID, pcNumber, fixedOn, fixedBy: user.userId })
      });

      if (currentCard) setCardVisual(currentCard, 'Available');
      currentCard = null;
      fixModal.classList.add('hidden');

    } catch (err) {
      console.error(err);
      alert('Could not log fix.');
    }
  });
}

/*************************************************
 * 11)  Bootstrap – DOMContentLoaded
 *************************************************/
document.addEventListener('DOMContentLoaded', () => {
  // show user name
  $('.username').textContent = user.name;

  // cache DOM refs
  roomSelect      = $('#room-select');
  pcGrid          = $('.pc-grid');
  defectModal     = $('#defectModal');
  defectForm      = $('#defectForm');
  btnDefectCancel = $('#defectCancel');
  fixModal        = $('#fixModal');
  fixForm         = $('#fixForm');
  fixDateTime     = $('#fixDateTime');   // datetime-local input
  fixerInput      = $('#fixerInput');
  fixerList       = $('#fixerList');
  btnFixCancel    = $('#fixCancel');

  // init
  loadUsers();
  loadRooms();
  wireDefectModal();
  wireFixModal();

  // room change
  roomSelect.addEventListener('change', () => loadPCs(roomSelect.value));
});