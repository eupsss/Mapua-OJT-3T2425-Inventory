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
const nowDateTimeLocal = () => new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
const API_BASE = '../api/';

/*************************************************
 * 2)  Module-scope state
 *************************************************/
let pending       = null;   // defect report in progress
let currentCard   = null;   // fix dialog current card
let userRoster    = [];     // users for fixer autocomplete
let currentConfig = 1;      // layout of currently selected room

/*************************************************
 * 3)  DOM refs  (set on DOMContentLoaded)
 *************************************************/
let roomSelect, pcGrid,
    defectModal, defectForm, btnDefectCancel,
    fixModal,    fixForm,    fixDateTime, fixerInput, fixerList, btnFixCancel,
    checkAllBtn,
    roomModal,   roomForm,   roomCancel,  addRoomBtn;

/*************************************************
 * 4)  Fetch helper
 *************************************************/
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...opts
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || res.statusText);
  return payload;
}

/* update-status – mark PC Working/Defective */
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
function positionFor(pc, cfg = 1) {
  const n = Number(pc);

  /* CONFIG 1 – original 8×5 lab (41 PCs) */
  if (cfg === 1) {
    if (n === 0) return { row: 1, col: 9 };
    const logicalRow = Math.ceil(n / 8);
    const row        = logicalRow + 1;
    const idx        = (n - 1) % 8;
    return { row, col: idx < 4 ? 9 - idx : 8 - idx };
  }

  /* CONFIG 2 – 5 on the right, 3 on the left (aisle at col 4) */
  if (cfg === 2) {
    if (n === 0) return { row: 1, col: 9 };
    const logicalRow = Math.ceil(n / 8);
    const row        = logicalRow + 1;
    const idx        = (n - 1) % 8;
    // idx 0-4 → cols 9,8,7,6,5 ; idx 5-7 → cols 3,2,1
    return { row, col: idx < 5 ? 9 - idx : 8 - idx };
  }

  /* fallback – left→right, 10 columns */
  const idx = n - 1;
  return {
    row: Math.floor(idx / 10) + 2,
    col: (idx % 10) + 1
  };
}

function setCardVisual(card, status) {
  card.dataset.status = status;
  card.classList.toggle('selected', status === 'Defective');
  const icon = $('img', card);
  if (icon) {
    const imgName = status === 'Working' ? 'Available' : 'defective';
    icon.src = `../icons/${imgName}.png`;
    icon.alt = status;
  }
  const label = $('span.pc-number', card);
  if (label) {
    label.style.color =
      status === 'Working' ? '#238636' : 'var(--color-primary)';
  }
}

/*************************************************
 * 6)  Build one PC card
 *************************************************/
function makeCard(roomID, { PCNumber, Status }) {
  const num = Number(PCNumber);
  if (isNaN(num)) return;

  const initStatus = Status === 'Defective' ? 'Defective' : 'Working';
  const card = document.createElement('div');
  card.className  = 'pc-card';
  card.dataset.pc = PCNumber;
  card.innerHTML = `
    <img class="pc-icon"
         src="../icons/${initStatus === 'Working' ? 'Available' : 'defective'}.png"
         alt="${initStatus}">
    <span class="pc-number">${PCNumber}</span>
  `;

  setCardVisual(card, initStatus);
  const { row, col } = positionFor(PCNumber, currentConfig);
  card.style.gridRow    = row;
  card.style.gridColumn = col;

  card.addEventListener('click', () => {
    if (card.dataset.status === 'Working') {
      pending = { card, roomID, pcNumber: PCNumber };
      defectModal.classList.remove('hidden');
    } else {
      currentCard           = card;
      fixModal.dataset.room = roomID;
      fixModal.dataset.pc   = PCNumber;
      fixDateTime.value     = nowDateTimeLocal();
      fixerInput.value      = '';
      fixModal.classList.remove('hidden');
      fixerInput.focus();
    }
  });

  pcGrid.appendChild(card);
}

/*************************************************
 * 7)  Load users into datalist
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
      opt.value          = r.RoomID;
      opt.textContent    = r.RoomID;
      opt.dataset.config = r.Room_Config ?? 1;
      opt.dataset.pcnum  = r.PC_NUM     ?? 41;
      roomSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('rooms route failed', err);
  }
}

async function loadPCs(roomID) {
  pcGrid.innerHTML = '';
  if (!roomID) return;
  try {
    const pcs = await fetchJSON(
      `${API_BASE}pcs?room=${encodeURIComponent(roomID)}`
    );
    pcs.forEach(pc => makeCard(roomID, pc));
  } catch (err) {
    console.error('pcs route failed', err);
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

  defectForm.addEventListener('submit', async e => {
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

  fixForm.addEventListener('submit', async e => {
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
        body   : JSON.stringify({
          roomID, pcNumber, fixedOn, fixedBy: userItem.userId
        })
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
 * 11)  Bulk Check All
 *************************************************/
function wireCheckAll() {
  checkAllBtn.addEventListener('click', async () => {
    const roomID = roomSelect.value;
    if (!roomID) {
      alert('Please select a room first.');
      return;
    }
    const cards = $$('.pc-card');
    if (!cards.length) {
      alert('No PCs to check in this room.');
      return;
    }
    if (!confirm('Mark all PCs as Working?')) return;
    try {
      await Promise.all(cards.map(card => {
        const pcNumber = card.dataset.pc;
        setCardVisual(card, 'Working');
        return updateStatus(roomID, pcNumber, 'Working', []);
      }));
      alert('All PCs marked as Working successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to check all PCs:\n' + err.message);
      loadPCs(roomID);
    }
  });
}

/*************************************************
 * 12)  Add-Room Modal
 *************************************************/
function wireAddRoomModal() {
  addRoomBtn.addEventListener('click', () => {
    roomModal.classList.remove('hidden');
    $('#roomID').focus();
  });

  roomCancel.addEventListener('click', () => {
    roomModal.classList.add('hidden');
    roomForm.reset();
  });

  roomForm.addEventListener('submit', async e => {
    e.preventDefault();
    const roomID     = $('#roomID').value.trim().toUpperCase();
    const roomConfig = Number($('#roomConfig').value) || 1;
    const pcNum      = Number($('#pcNum').value)      || 41;
    if (!roomID) return alert('Room ID is required.');
    try {
      await fetchJSON(API_BASE + 'rooms', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ roomID, roomConfig, pcNum })
      });
      alert('Room added successfully.');
      roomModal.classList.add('hidden');
      roomForm.reset();
      roomSelect.innerHTML =
        '<option value="">-- Choose a room --</option>';
      await loadRooms();
    } catch (err) {
      console.error(err);
      alert('Unable to add room:\n' + err.message);
    }
  });
}

/*************************************************
 * 13)  Bootstrap – DOMContentLoaded
 *************************************************/
document.addEventListener('DOMContentLoaded', () => {
  $('.username').textContent = user.name || 'Admin';
  const userNameEl  = document.querySelector('.user-name');
  const avatarEl = document.querySelector('.avatar');
  if (avatarEl) {
    const initials = user.name
      .split(' ')
      .map(n => n[0]?.toUpperCase() || '')
      .join('')
      .slice(0,2);
    avatarEl.textContent = initials;
  }
  if (userNameEl)  userNameEl.textContent  = user.name;

  /* Grab elements */
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

  checkAllBtn     = $('#bulkCheck');

  roomModal       = $('#roomModal');
  roomForm        = $('#roomForm');
  roomCancel      = $('#roomCancel');
  addRoomBtn      = $('#addRoomBtn');

  /* Initialize flows */
  loadUsers();
  loadRooms();
  wireDefectModal();
  wireFixModal();
  wireCheckAll();
  wireAddRoomModal();

  /* Handle room config change (toggle CSS grid template) */
  roomSelect.addEventListener('change', () => {
    const sel = roomSelect.selectedOptions[0];
    currentConfig = Number(sel?.dataset.config || 1);
    pcGrid.classList.toggle('config-2', currentConfig === 2);
    loadPCs(roomSelect.value);
  });
});
