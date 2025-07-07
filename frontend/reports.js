// reports.js – v2.8
console.log('▶️ reports.js loaded');

// 1️⃣ Login guard
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied. Please login first.');
  location.href = 'login.html';
}

const API_BASE = '/api';
let currentSort = { key: null, asc: true };
let latestRows = [];

document.addEventListener('DOMContentLoaded', () => {
  //── Inject user info ─────────────────────────────────────
  document.querySelector('.username').textContent = user.name;
  document.querySelectorAll('.avatar, .user-name').forEach(el => {
    if (el.classList.contains('user-name')) {
      el.textContent = user.name;
    } else {
      const initials = user.name
        .split(' ')
        .map(n => n[0]?.toUpperCase() || '')
        .join('')
        .slice(0, 2);
      el.textContent = initials;
    }
  });

  //── Sign out ─────────────────────────────────────────────
  document.getElementById('signout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('user');
    location.href = 'login.html';
  });

  //── Date filter & clear ─────────────────────────────────
  document.getElementById('fixed-date-filter')
    .addEventListener('change', () => renderTableRows(latestRows));
  document.getElementById('clear-date-filter')
    .addEventListener('click', () => {
      document.getElementById('fixed-date-filter').value = '';
      renderTableRows(latestRows);
    });

  //── Column sorting ──────────────────────────────────────
  document.querySelectorAll('#reportsTable thead th[data-sort]')
    .forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (currentSort.key === key) {
          currentSort.asc = !currentSort.asc;
        } else {
          currentSort.key = key;
          currentSort.asc = true;
        }
        document.querySelectorAll('thead th')
          .forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(currentSort.asc ? 'sort-asc' : 'sort-desc');
        renderTableRows(latestRows);
      });
    });

  //── Initial load ────────────────────────────────────────
  loadAndRenderFiltered();
});

// Deduplicate by RoomID+PCNumber, keeping the highest ticket sequence
function getLatestPerPC(rows) {
  const map = new Map();
  rows.forEach(r => {
    const key = `${r.RoomID}-${r.PCNumber}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
    } else {
      const prevSeq = parseInt((existing.ServiceTicketID || '').split('-').pop(), 10) || 0;
      const currSeq = parseInt((r.ServiceTicketID || '').split('-').pop(), 10) || 0;
      if (currSeq > prevSeq) map.set(key, r);
    }
  });
  return Array.from(map.values());
}

async function loadAndRenderFiltered() {
  const tbody = document.querySelector('#reportsTable tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="center">Loading…</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/reports`);
    if (!res.ok) throw new Error(res.status);
    const rows = await res.json();

    // 1) pick only the latest per PC
    latestRows = getLatestPerPC(rows);

    // 2) compute a DisplayStatus for the UI
    latestRows.forEach(r => {
      r.DisplayStatus = (r.Status === 'Fixed')
        ? 'Fixed'
        : 'Under Repair';
    });

    populateDropdowns(latestRows);
    renderTableRows(latestRows);
  } catch (err) {
    console.error('Report load failed', err);
    tbody.innerHTML =
      '<tr><td colspan="9" class="center error">Error loading data</td></tr>';
  }
}

function populateDropdowns(rows) {
  // For each dropdown (Status, Room)
  document.querySelectorAll('.dropdown').forEach(dd => {
    const field = dd.dataset.field; // "Status" or "RoomID"
    const menu  = dd.querySelector('.dropdown-menu');

    // If it's the Status dropdown, use raw r.Status (Working/Defective)
    // Otherwise use r[field] (e.g. r.RoomID)
    const values = Array.from(
      new Set(
        rows.map(r => field === 'Status'
          ? r.Status
          : String(r[field] ?? '')
        ).filter(v => v)
      )
    ).sort();

    menu.innerHTML = values.map(val => `
      <li>
        <label>
          <input type="checkbox" value="${val}"/>
          ${val}
        </label>
      </li>
    `).join('');

    // Re-render on any checkbox change
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb =>
      cb.addEventListener('change', () => renderTableRows(latestRows))
    );
  });
}

function renderTableRows(rows) {
  const tbody = document.querySelector('#reportsTable tbody');
  tbody.innerHTML = '';
  let filtered = rows.slice();

  // 1) Apply dropdown filters
  document.querySelectorAll('.dropdown').forEach(dd => {
    const field = dd.dataset.field;
    const checked = Array.from(
      dd.querySelectorAll('input:checked')
    ).map(i => i.value);

    if (checked.length) {
      filtered = filtered.filter(r => {
        // For Status, filter on raw r.Status
        if (field === 'Status') return checked.includes(r.Status);
        // Otherwise filter on the given field
        return checked.includes(String(r[field]));
      });
    }
  });

  // 2) Apply date filter
  const dateVal = document.getElementById('fixed-date-filter').value;
  if (dateVal) {
    filtered = filtered.filter(r => r.FixedOn === dateVal);
  }

  // 3) Sorting
  if (currentSort.key) {
    filtered.sort((a, b) => {
      let av = a[currentSort.key] || '';
      let bv = b[currentSort.key] || '';
      if (currentSort.key.toLowerCase().includes('date')) {
        av = Date.parse(av) || 0;
        bv = Date.parse(bv) || 0;
      }
      if (av < bv) return currentSort.asc ? -1 : 1;
      if (av > bv) return currentSort.asc ? 1 : -1;
      return 0;
    });
  }

  // 4) Render
  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="center">No records found.</td></tr>';
    return;
  }

  filtered.forEach(r => {
    const tr = document.createElement('tr');
// only show fixed-on/by when the raw status is Working
const fixedOnCell = (r.Status === 'Fixed' ? r.FixedOn || '' : '');
const fixedByCell = (r.Status === 'Fixed' ? r.FixedBy  || '' : '');

tr.innerHTML = `
  <td>${r.ServiceTicketID}</td>
  <td>${r.CheckDate}</td>
  <td>${r.RoomID}</td>
  <td>${r.PCNumber}</td>
  <td>${r.DisplayStatus}</td>
  <td>${r.Issues || ''}</td>
  <td>${fixedOnCell}</td>
  <td>${fixedByCell}</td>
  <td>${r.RecordedBy || ''}</td>
`;

    tbody.appendChild(tr);
  });
}
