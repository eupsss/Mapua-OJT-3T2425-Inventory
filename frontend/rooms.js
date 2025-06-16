// rooms.js
// Revised: explicit grid placement (00-40 only) so numbering/order are correct

/*
  Visual grid (9 columns): 1-4  |gap|  6-9
  ───────────────────────────────────────────
  Row 1 : PC00 at col 9
  Row 2 : 05 06 07 08 |gap| 04 03 02 01
  Row 3 : 13‥16       |gap| 12 11 10 09
  Row 4 : 21‥24       |gap| 20 19 18 17
  Row 5 : 29‥32       |gap| 28 27 26 25
  Row 6 : 37 38 39 40 |gap|  —  —  —  —
  (Instructor PC41 is ignored here.)
*/

document.addEventListener('DOMContentLoaded', () => {
  const roomSelect = document.getElementById('room-select');
  const pcGrid     = document.querySelector('.pc-grid');
  const API_BASE   = '../api/'; // relative to frontend

  /* ---------------------------------------------------------
     Helper → map PC number (string '00'-'40') to {row,col}
  --------------------------------------------------------- */
  function positionFor(pcNum) {
    const n = parseInt(pcNum, 10); // 0-40
    if (n === 0) return { row: 1, col: 9 }; // PC00 top-right

    const logicalRow = Math.ceil(n / 8);     // 1-5 (groups of 8)
    const row = logicalRow + 1;              // +1 to skip row-1
    const idx = (n - 1) % 8;                // 0-7 inside row

    let col;
    if (idx < 4) {
      // right block  (lower numbers) → cols 9-6 (rtl)
      col = 9 - idx;        // 0→9,1→8,2→7,3→6
    } else {
      // left block   (higher numbers) → cols 4-1 (ltr)
      col = 8 - idx;        // 4→4,5→3,6→2,7→1
    }
    return { row, col };
  }

  /* --------------------------------------------------------- */
  async function loadRooms() {
    try {
      const res = await fetch(`${API_BASE}rooms.php`);
      const rooms = await res.json();
      rooms.forEach(({ RoomID }) => {
        const opt = document.createElement('option');
        opt.value = RoomID;
        opt.textContent = RoomID;
        roomSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Error loading rooms:', err);
    }
  }

  async function loadPCs(roomID) {
    pcGrid.innerHTML = '';
    if (!roomID) return;

    try {
      const res = await fetch(`${API_BASE}pcs.php?room=${encodeURIComponent(roomID)}`);
      const pcs = await res.json();

      pcs.forEach(({ PCNumber, Status }) => {
        // Skip instructor PC41 or any numbers > 40
        if (parseInt(PCNumber, 10) > 40) return;

        const status = (Status && Status.toLowerCase() === 'defective') ? 'Defective' : 'Working';

        // Card markup
        const card   = document.createElement('div');
        card.className     = 'pc-card';
        card.dataset.pc    = PCNumber;
        card.dataset.status= status;
        if (status === 'Defective') card.classList.add('selected');

        const img   = document.createElement('img');
        img.className = 'pc-icon';
        img.src  = status === 'Working' ? '../icons/working.png' : '../icons/defective.png';
        img.alt  = status;

        const label = document.createElement('span');
        label.className = 'pc-number';
        label.textContent = PCNumber;

        card.append(img, label);

        // Explicit placement
        const { row, col } = positionFor(PCNumber);
        card.style.gridRow    = row;
        card.style.gridColumn = col;

        pcGrid.appendChild(card);

        /* ---------- Click to toggle ---------- */
        card.addEventListener('click', async () => {
          const newStatus = card.dataset.status === 'Working' ? 'Defective' : 'Working';
          card.dataset.status = newStatus;
          card.classList.toggle('selected');
          img.src = newStatus === 'Working' ? '../icons/working.png' : '../icons/defective.png';

          try {
            const upd = await fetch(`${API_BASE}update-status.php`, {
              method  : 'POST',
              headers : { 'Content-Type': 'application/json' },
              body    : JSON.stringify({ roomID, pcNumber: PCNumber, status: newStatus })
            });
            const result = await upd.json();
            if (!result.success) throw new Error(result.error || 'Update failed');
          } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update status. Please try again.');
            // rollback
            const rollback = newStatus === 'Working' ? 'Defective' : 'Working';
            card.dataset.status = rollback;
            card.classList.toggle('selected');
            img.src = rollback === 'Working' ? '../icons/working.png' : '../icons/defective.png';
          }
        });
      });
    } catch (err) {
      console.error('Error loading PCs:', err);
    }
  }

  roomSelect.addEventListener('change', () => loadPCs(roomSelect.value));
  loadRooms();
});