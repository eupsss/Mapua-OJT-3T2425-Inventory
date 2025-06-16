/* ====================================================================
   rooms.js - Mapúa Inventory
   ==================================================================== */

/* ───── 0. Login guard ─────────────────────────────────────────────── */
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied – please sign in.');
  location.href = 'login.html';
}

/* ───── 1. DOM ready ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* show user’s name in header */
  document.querySelector('.username').textContent = user.name;

  /* DOM refs --------------------------------------------------------- */
  const roomSelect  = document.getElementById('room-select');
  const pcGrid      = document.querySelector('.pc-grid');
  const modal       = document.getElementById('defectModal');
  const defectForm  = document.getElementById('defectForm');
  const btnCancel   = document.getElementById('defectCancel');

  const API_BASE = '../api/';

  /* hold clicked card until user confirms issues in modal */
  let pending = null;

  /* ───── 2. Grid helpers ──────────────────────────────────────────── */
  function positionFor(pc) {
    const n = Number(pc);                 // 0-40
    if (n === 0) return { row: 1, col: 9 };

    const logicalRow = Math.ceil(n / 8);  // 1-5
    const row = logicalRow + 1;           // physical row (skip row 1)
    const idx = (n - 1) % 8;              // 0-7 in its row

    /* right block (cols 9-6) then left block (4-1) */
    return {
      row,
      col: idx < 4 ? 9 - idx : 8 - idx
    };
  }

  /* build JSON & post to backend ------------------------------------ */
  async function updateStatus(roomID, pcNumber, status, issues) {
    const payload = {
      roomID,
      pcNumber,
      status,
      issues,
      userID: user.id               // 🔑 ALWAYS include who did it
    };

    const res = await fetch(API_BASE + 'update-status.php', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload)
    });

    const j = await res.json();
    if (!j.success) throw new Error(j.error || 'API error');
  }

  /* build ONE card --------------------------------------------------- */
  function makeCard(roomID, { PCNumber, Status }) {
    const n = Number(PCNumber);
    if (isNaN(n) || n > 40) return;       // ignore instructor PC41+

    const status = (Status || '').toLowerCase() === 'defective'
                   ? 'Defective' : 'Working';

    /* element */
    const card = document.createElement('div');
    card.className = 'pc-card';
    card.dataset.pc     = PCNumber;
    card.dataset.status = status;
    if (status === 'Defective') card.classList.add('selected');

    card.innerHTML = `
      <img class="pc-icon"
           src="../icons/${status === 'Working' ? 'working' : 'defective'}.png"
           alt="${status}">
      <span class="pc-number">${PCNumber}</span>
    `;

    /* place in grid */
    const { row, col } = positionFor(PCNumber);
    card.style.gridRow    = row;
    card.style.gridColumn = col;

    /* click handler */
    card.addEventListener('click', () => {
      if (card.dataset.status === 'Working') {
        /* open modal to choose issues */
        pending = { card, roomID, pcNumber: PCNumber };
        modal.classList.remove('hidden');
      } else {
        /* flip back to Working immediately */
        toggleStatus(card, roomID, PCNumber, 'Working', []);
      }
    });

    pcGrid.appendChild(card);
  }

  /* optimistic toggle + rollback ------------------------------------ */
  async function toggleStatus(card, roomID, pcNumber, newStatus, issues) {
    const icon = card.querySelector('img');

    /* optimistic UI */
    card.dataset.status = newStatus;
    card.classList.toggle('selected', newStatus === 'Defective');
    icon.src = `../icons/${newStatus === 'Working' ? 'working' : 'defective'}.png`;

    try {
      await updateStatus(roomID, pcNumber, newStatus, issues);
    } catch (err) {
      console.error(err);
      alert('Failed to update. Please try again.');

      /* rollback */
      const rollback = newStatus === 'Working' ? 'Defective' : 'Working';
      card.dataset.status = rollback;
      card.classList.toggle('selected', rollback === 'Defective');
      icon.src = `../icons/${rollback === 'Working' ? 'working' : 'defective'}.png`;
    }
  }

  /* ───── 3. Fetch rooms & PCs ─────────────────────────────────────── */
  async function loadRooms() {
    try {
      const res = await fetch(API_BASE + 'rooms.php');
      const rooms = await res.json();

      rooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = r.RoomID;
        roomSelect.appendChild(opt);
      });
    } catch (e) {
      console.error('rooms.php failed', e);
    }
  }

  async function loadPCs(roomID) {
    pcGrid.innerHTML = '';
    if (!roomID) return;

    try {
      const res = await fetch(`${API_BASE}pcs.php?room=${encodeURIComponent(roomID)}`);
      const pcs = await res.json();
      pcs.forEach(pc => makeCard(roomID, pc));
    } catch (e) {
      console.error('pcs.php failed', e);
    }
  }

  /* ───── 4. Modal events ──────────────────────────────────────────── */
  btnCancel.addEventListener('click', () => {
    modal.classList.add('hidden');
    defectForm.reset();
    pending = null;
  });

  defectForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!pending) return;

    const issues = Array.from(
      defectForm.querySelectorAll('input[name="issues"]:checked')
    ).map(cb => cb.value);

    modal.classList.add('hidden');
    defectForm.reset();

    const { card, roomID, pcNumber } = pending;
    toggleStatus(card, roomID, pcNumber, 'Defective', issues);
    pending = null;
  });

  /* ───── 5. Kick-off ──────────────────────────────────────────────── */
  roomSelect.addEventListener('change', () => loadPCs(roomSelect.value));
  loadRooms();                    // fill dropdown
});
