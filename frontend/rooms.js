/* ====================================================================
   rooms.js - Mapúa Inventory  (merged defect + fix flows)
   Updated: unify only 'Working'/'Defective' statuses in UI
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
  const payload  = await res.json().catch(() => ({}));
  if (!res.ok)  throw new Error(payload.error || res.statusText);
  return payload;
}

/* update-status.php – mark PC as Defective / Working */
async function updateStatus(roomID, pcNumber, status, issues) {
  const payload = { roomID, pcNumber, status, issues, userID: user.id };
  const j = await fetchJSON(API_BASE + 'update-status', {
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
  const row        = logicalRow + 1;
  const idx        = (n - 1) % 8;
  return { row, col: idx < 4 ? 9 - idx : 8 - idx };
}

function setCardVisual(card, status) {
  // status: 'Working' or 'Defective'
  card.dataset.status = status;
  card.classList.toggle('selected', status === 'Defective');
  const icon = $('img', card);
  if (icon) {
    // use 'Available.png' for Working state to reuse icon
    const imgName = status === 'Working' ? 'Available' : 'defective';
    icon.src = `../icons/${imgName}.png`;
    icon.alt = status;
  }
  const label = $('span.pc-number', card);
  if (label) {
    // green for Working, primary color for Defective
    label.style.color = status === 'Working'
      ? '#238636'
      : 'var(--color-primary)';
  }
}

/*************************************************
 * 6)  Build a single PC card
 *************************************************/
function makeCard(roomID, { PCNumber, Status }) {
  const num = Number(PCNumber);
  if (isNaN(num) || num > 40) return;
  // treat any non-defective state as Working
  const initStatus = Status === 'Defective' ? 'Defective' : 'Working';

  const card = document.createElement('div');
  card.className   = 'pc-card';
  card.dataset.pc  = PCNumber;

  card.innerHTML = `
    <img class="pc-icon" src="../icons/${initStatus === 'Working' ? 'Available' : 'defective'}.png" alt="${initStatus}">
    <span class="pc-number">${PCNumber}</span>
  `;

  setCardVisual(card, initStatus);

  const { row, col } = positionFor(PCNumber);
  card.style.gridRow    = row;
  card.style.gridColumn = col;

  card.addEventListener('click', () => {
    if (card.dataset.status === 'Working') {
      // report a defect
      pending = { card, roomID, pcNumber: PCNumber };
      defectModal.classList.remove('hidden');
    } else {
      // log a fix
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
    userRoster = await fetchJSON(API_BASE + 'users');
    fixerList.innerHTML = userRoster
      .map(u => `<option value="${u.fullName}" data-id="${u.userId}">`)
      .join('');
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
    const rooms = await fetchJSON(API_BASE + 'rooms');
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
    const pcs = await fetchJSON(`${API_BASE}pcs?room=${encodeURIComponent(roomID)}`);
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

    const issues = $$('input[name="issues"]:checked', defectForm)
      .map(cb => cb.value);
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
      setCardVisual(card, 'Working');
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
    const fixedOn  = fixDateTime.value;
    const fixer    = fixerInput.value.trim();
    const userItem = userRoster.find(u => u.fullName === fixer);

    if (!userItem) {
      alert('Please pick a name from the list.');
      return fixerInput.focus();
    }

    try {
      await fetchJSON(`${API_BASE}fix`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ roomID, pcNumber, fixedOn, fixedBy: userItem.userId })
      });

      if (currentCard) setCardVisual(currentCard, 'Working');
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
  fixDateTime     = $('#fixDateTime');
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
