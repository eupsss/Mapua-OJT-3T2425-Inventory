console.log('▶️ rooms.js loaded');

// ───── 0. Login guard ─────────────────────────────────────────
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied – please sign in.');
  location.href = 'login.html';
}

// ───── 1. Convenience helpers ─────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const nowDateTimeLocal = () => new Date().toISOString().slice(0,16);
const API_BASE = '../api/';

// ───── 2. State & DOM refs ────────────────────────────────────
let pending     = null;
let currentCard = null;
let userRoster  = [];
let currentConfig = 1;

let roomSelect, pcGrid,
    defectModal, defectForm, btnDefectCancel,
    otherCheckbox, otherWrapper, otherTextInput,
    fixModal, fixForm, fixDateTime, fixerInput, fixerList, btnFixCancel,
    checkAllBtn,
    bulkFixModal, bulkFixForm, bulkFixDateTime, bulkFixerInput, bulkFixCancel,
    roomModal, roomForm, roomCancel, addRoomBtn,
    signOutBtn;

// ───── 3. fetchJSON helper ─────────────────────────────────────
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, { credentials:'same-origin', ...opts });
  const json = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(json.error||res.statusText);
  return json;
}

// ───── 4. Layout & styling ────────────────────────────────────
function positionFor(n, cfg) {
  if (isNaN(n)) return {row:1,col:1};
  if (cfg === 1) {
    if (n === 0) return {row:1,col:9};
    const row = Math.ceil(n/8) + 1, idx = (n-1)%8;
    return { row, col: idx<4?9-idx:8-idx };
  }
  if (cfg === 2) {
    if (n === 0) return {row:1,col:9};
    const row = Math.ceil(n/8) + 1, idx = (n-1)%8;
    return { row, col: idx<5?9-idx:8-idx };
  }
  const idx = n-1;
  return { row: Math.floor(idx/10)+2, col: (idx%10)+1 };
}

function setCardVisual(card, status) {
  card.dataset.status = status;
  card.classList.toggle('selected', status==='Defective');
  const img = $('img', card);
  img.src = `../icons/${status==='Working'?'Available':'defective'}.png`;
  img.alt = status;
  $('span.pc-number', card).style.color =
    status==='Working' ? '#238636' : 'var(--color-primary)';
}

// ───── 5. Build a PC card ──────────────────────────────────────
function makeCard(roomID, { PCNumber, Status, ServiceTicketID }) {
  const card = document.createElement('div');
  card.className = 'pc-card';
  card.dataset.pc     = PCNumber;
  card.dataset.ticket = ServiceTicketID || '';
  card.innerHTML = `
    <img class="pc-icon" src="../icons/${Status==='Working'?'Available':'defective'}.png" alt="${Status}">
    <span class="pc-number">${PCNumber}</span>
  `;
  setCardVisual(card, Status);
  const {row, col} = positionFor(Number(PCNumber), currentConfig);
  card.style.gridRow    = row;
  card.style.gridColumn = col;
  card.addEventListener('click', () => {
    if (card.dataset.status === 'Working') {
      // defect flow
      pending = { card, roomID, pc: PCNumber };
      defectModal.classList.remove('hidden');
    } else {
      // fix flow
      currentCard = card;
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

// ───── 6. Load users ───────────────────────────────────────────
async function loadUsers() {
  try {
    userRoster = await fetchJSON(API_BASE + 'users');
    fixerList.innerHTML = userRoster
      .map(u => `<option value="${u.fullName}" data-id="${u.userId}">`)
      .join('');
  } catch (e) {
    console.error('loadUsers failed', e);
  }
}

// ───── 7. Load rooms ───────────────────────────────────────────
async function loadRooms() {
  try {
    const rooms = await fetchJSON(API_BASE + 'rooms');
    roomSelect.innerHTML = '<option value="">-- Choose a room --</option>';
    rooms.forEach(r => {
      const o = document.createElement('option');
      o.value = r.RoomID;
      o.textContent = r.RoomID;
      o.dataset.config = r.Room_Config;
      roomSelect.appendChild(o);
    });
  } catch (e) {
    console.error('loadRooms failed', e);
  }
}

// ───── 8. Load PCs ─────────────────────────────────────────────
async function loadPCs(roomID) {
  pcGrid.innerHTML = '';
  if (!roomID) return;
  try {
    const pcs = await fetchJSON(`${API_BASE}pcs?room=${roomID}`);
    pcs.forEach(pc => makeCard(roomID, pc));
  } catch (e) {
    console.error('loadPCs failed', e);
  }
}

// ───── 9. Defect modal ─────────────────────────────────────────
function wireDefectModal() {
  btnDefectCancel.addEventListener('click', () => {
    defectForm.reset();
    otherWrapper.classList.add('hidden');
    defectModal.classList.add('hidden');
    pending = null;
  });

  otherCheckbox.addEventListener('change', () => {
    if (otherCheckbox.checked) {
      otherWrapper.classList.remove('hidden');
      otherTextInput.focus();
    } else {
      otherWrapper.classList.add('hidden');
      otherTextInput.value = '';
    }
  });

  defectForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!pending) return;
    let issues = $$('input[name="issues"]:checked', defectForm).map(cb=>cb.value);
    if (issues.includes('Other')) {
      const txt = otherTextInput.value.trim();
      issues = txt ? issues.filter(i=>'Other'!==i).concat(txt)
                   : issues.filter(i=>'Other'!==i);
    }

    const { card, roomID, pc } = pending;
    defectModal.classList.add('hidden');
    defectForm.reset();
    otherWrapper.classList.add('hidden');
    pending = null;

    setCardVisual(card, 'Defective');

    try {
      const { serviceTicketID } = await fetchJSON(API_BASE + 'update-status', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          roomID,
          pcNumber: pc,
          status: 'Defective',
          issues,
          userID: user.id
        })
      });
      card.dataset.ticket = serviceTicketID;
    } catch (err) {
      console.error(err);
      alert('Failed to report defect');
      setCardVisual(card, 'Working');
    }
  });
}

// ───── 10. Fix modal ────────────────────────────────────────────
function wireFixModal() {
  btnFixCancel.addEventListener('click', () => {
    fixModal.classList.add('hidden');
    currentCard = null;
  });

  fixForm.addEventListener('submit', async e => {
    e.preventDefault();
    const roomID   = fixModal.dataset.room;
    const pc       = fixModal.dataset.pc;
    const fixedOn  = fixDateTime.value;
    const name     = fixerInput.value.trim();
    const usr      = userRoster.find(u => u.fullName === name);
    if (!usr) return alert('Pick a name from the list');

    const serviceTicketID = currentCard.dataset.ticket;
    if (!serviceTicketID) {
      return alert('Missing ticket ID – please report the defect first');
    }

    try {
      await fetchJSON(API_BASE + 'fix', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          roomID,
          pcNumber: pc,
          fixedOn,
          fixedBy: usr.userId,
          serviceTicketID
        })
      });
      setCardVisual(currentCard, 'Working');
      fixModal.classList.add('hidden');
      currentCard = null;
    } catch (err) {
      console.error(err);
      alert('Could not log fix');
    }
  });
}

// ───── 11. Bulk “Check All” (serialized) ─────────────────────
function wireCheckAll() {
  checkAllBtn.addEventListener('click', async () => {
    // now handled by bulkFixModal opener
  });
}

// ───── 11b. Bulk-Fix modal ─────────────────────────────────────
function wireBulkFixModal() {
  // DOM refs
  bulkFixModal      = $('#bulkFixModal');
  bulkFixForm       = $('#bulkFixForm');
  bulkFixDateTime   = $('#bulkFixDateTime');
  bulkFixerInput    = $('#bulkFixerInput');
  bulkFixCancel     = $('#bulkFixCancel');

  // Cancel
  bulkFixCancel.addEventListener('click', () => {
    bulkFixForm.reset();
    bulkFixModal.classList.add('hidden');
  });

  // Open on “Check All”
  checkAllBtn.addEventListener('click', () => {
    const roomID = roomSelect.value;
    if (!roomID) return alert('Select a room first');
    // set Philippines “now” as default & max
    const phNow = new Date().toLocaleString('sv-SE', {
      timeZone: 'Asia/Manila', hour12: false
    }).replace(' ', 'T').slice(0,16);
    bulkFixDateTime.value = phNow;
    bulkFixDateTime.max   = phNow;
    bulkFixerInput.value  = '';
    bulkFixModal.classList.remove('hidden');
    bulkFixerInput.focus();
  });

  // Confirm bulk fix
  bulkFixForm.addEventListener('submit', async e => {
    e.preventDefault();
    const roomID  = roomSelect.value;
    const fixedOn = bulkFixDateTime.value;
    const name    = bulkFixerInput.value.trim();
    const fixer   = userRoster.find(u => u.fullName === name);
    if (!fixer) return alert('Pick a name from the list');

    bulkFixModal.classList.add('hidden');

    const cards = $$('.pc-card');
    try {
      for (const card of cards) {
        setCardVisual(card, 'Working');

        // 1) mark Working + get new ticket
        const { serviceTicketID } = await fetchJSON(
          API_BASE + 'update-status',
          {
            method: 'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({
              roomID,
              pcNumber: card.dataset.pc,
              status: 'Working',
              issues: [],
              userID: user.id
            })
          }
        );

        // 2) log fix on chosen datetime & by chosen fixer
        await fetchJSON(API_BASE + 'fix', {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({
            roomID,
            pcNumber: card.dataset.pc,
            fixedOn,
            fixedBy: fixer.userId,
            serviceTicketID
          })
        });
      }

      alert(`All PCs fixed on ${fixedOn} by ${fixer.fullName}`);
    } catch (err) {
      console.error(err);
      alert('Bulk fix failed—refreshing grid');
      loadPCs(roomID);
    }
  });
}

// ───── 12. Add-Room modal ───────────────────────────────────────
function wireAddRoomModal() {
  addRoomBtn.addEventListener('click', () => roomModal.classList.remove('hidden'));
  roomCancel.addEventListener('click', () => roomModal.classList.add('hidden'));
  roomForm.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      roomID:     $('#roomID').value.trim().toUpperCase(),
      roomConfig:+$('#roomConfig').value || 1,
      pcNum:     +$('#pcNum').value     || 41
    };
    try {
      await fetchJSON(API_BASE+'rooms', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      alert('Room added');
      roomModal.classList.add('hidden');
      loadRooms();
    } catch (err) {
      console.error(err);
      alert('Unable to add room');
    }
  });
}

// ───── 13. Bootstrap ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // DOM refs
  roomSelect       = $('#room-select');
  pcGrid           = $('.pc-grid');
  defectModal      = $('#defectModal');
  defectForm       = $('#defectForm');
  btnDefectCancel  = $('#defectCancel');
  otherCheckbox    = $('#issue-other-checkbox');
  otherWrapper     = document.querySelector('.other-input-wrapper');
  otherTextInput   = $('#issue-other-text');
  fixModal         = $('#fixModal');
  fixForm          = $('#fixForm');
  fixDateTime      = $('#fixDateTime');
  fixerInput       = $('#fixerInput');
  fixerList        = $('#fixerList');
  btnFixCancel     = $('#fixCancel');
  checkAllBtn      = $('#bulkCheck');
  roomModal        = $('#roomModal');
  roomForm         = $('#roomForm');
  roomCancel       = $('#roomCancel');
  addRoomBtn       = $('#addRoomBtn');
  signOutBtn       = $('#signout-btn');

  // show user
  $('.username').textContent = user.name;
  $('.user-name').textContent = user.name;
  document.querySelectorAll('.avatar').forEach(el => {
    const initials = user.name.split(' ')
                       .map(n => n[0].toUpperCase())
                       .join('').slice(0,2);
    el.textContent = initials;
  });

  // sign-out
  signOutBtn.addEventListener('click', ()=> {
    sessionStorage.removeItem('user');
    location.href = 'login.html';
  });

  // init
  loadUsers();
  loadRooms();
  wireDefectModal();
  wireFixModal();
  wireCheckAll();       // no-op now
  wireBulkFixModal();   // <-- newly added
  wireAddRoomModal();

  roomSelect.addEventListener('change', ()=> {
    currentConfig = +roomSelect.selectedOptions[0].dataset.config || 1;
    pcGrid.classList.toggle('config-2', currentConfig===2);
    loadPCs(roomSelect.value);
  });
});
