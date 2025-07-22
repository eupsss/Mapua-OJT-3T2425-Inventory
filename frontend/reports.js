// reports.js – v3.0
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
//── Inject user info (corrected)
const firstName = user.name.trim().split(' ')[0];

// top‐bar username: first name only
document.querySelector('.username').textContent = user.name;

// sidebar .user-name: greeting + first name
document.querySelector('.user-name').textContent = `Hi, ${firstName}!`;

// avatar initials stay the same
document.querySelectorAll('.avatar').forEach(el => {
  const initials = user.name
    .split(' ')
    .map(n => n[0]?.toUpperCase()||'')
    .join('')
    .slice(0,2);
  el.textContent = initials;
});



  //── Sign out
  document.getElementById('signout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('user');
    location.href = 'login.html';
  });

  //── Date filter & clear
  const dateInput = document.getElementById('fixed-date-filter');
  dateInput.addEventListener('change', () => renderTableRows(latestRows));
  document.getElementById('clear-date-filter')
    .addEventListener('click', () => {
      dateInput.value = '';
      renderTableRows(latestRows);
    });

  //── Column sorting
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

  //── Sticky dropdowns
  document.querySelectorAll('.dropdown').forEach(dd => {
    const btn = dd.querySelector('.filter-btn');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelectorAll('.dropdown.open').forEach(other => {
        if (other !== dd) other.classList.remove('open');
      });
      dd.classList.toggle('open');
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown.open')
      .forEach(dd => dd.classList.remove('open'));
  });
  document.querySelectorAll('.dropdown-menu')
    .forEach(menu => menu.addEventListener('click', e => e.stopPropagation()));

  //── Initial load
  loadAndRenderFiltered();
});

async function loadAndRenderFiltered() {
  const tbody = document.querySelector('#reportsTable tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="center">Loading…</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/reports`);
    if (!res.ok) throw new Error(res.status);
    const rows = await res.json();

    // — now just keep all rows, in API order
    latestRows = rows;

    // add DisplayStatus
    latestRows.forEach(r => {
      r.DisplayStatus = (r.Status === 'Fixed') ? 'Fixed' : 'Under Repair';
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
  document.querySelectorAll('.dropdown').forEach(dd => {
    const field = dd.dataset.field; // "Status" or "RoomID"
    const menu  = dd.querySelector('.dropdown-menu');

    const values = Array.from(
      new Set(rows.map(r =>
        field === 'Status' ? r.Status : r[field] || ''
      ))
    ).filter(v => v).sort();

    menu.innerHTML = values.map(val => `
      <li>
        <label>
          <input type="checkbox" value="${val}"/>
          ${val}
        </label>
      </li>
    `).join('');

    menu.querySelectorAll('input[type="checkbox"]').forEach(cb =>
      cb.addEventListener('change', () => renderTableRows(latestRows))
    );
  });
}

// Helper: turn any ISO string into “YYYY-MM-DDTHH:mm:ss” in Asia/Manila
function manilaTime(iso) {
  if (!iso) return '';
  return new Date(iso)
    .toLocaleString('sv-SE', {       // ascii hyphen between "sv" and "SE"
      timeZone: 'Asia/Manila',
      hour12: false
    })
    .replace(' ', 'T');
}

function renderTableRows(rows) {
  const tbody = document.querySelector('#reportsTable tbody');
  tbody.innerHTML = '';
  let filtered = [...rows];

  // Dropdown filters
  document.querySelectorAll('.dropdown').forEach(dd => {
    const field   = dd.dataset.field;
    const checked = [...dd.querySelectorAll('input:checked')].map(i => i.value);
    if (checked.length) {
      filtered = filtered.filter(r => {
        if (field === 'Status') return checked.includes(r.Status);
        return checked.includes(String(r[field]));
      });
    }
  });

  // Fixed-on date picker filter (YYYY-MM-DD)
  const dateVal = document.getElementById('fixed-date-filter').value;
  if (dateVal) {
    filtered = filtered.filter(r => {
      if (!r.FixedOn) return false;
      return r.FixedOn.slice(0, 10) === dateVal;
    });
  }

  // Sorting
  if (currentSort.key) {
    filtered.sort((a, b) => {
      let av = a[currentSort.key] || '';
      let bv = b[currentSort.key] || '';
      if (currentSort.key.toLowerCase().includes('date')) {
        av = Date.parse(av) || 0;
        bv = Date.parse(bv) || 0;
      }
      return av < bv
        ? (currentSort.asc ? -1 : 1)
        : (av > bv
           ? (currentSort.asc ? 1 : -1)
           : 0);
    });
  }

  // Empty state
  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="center">No records found.</td></tr>';
    return;
  }

  // Render
  filtered.forEach(r => {
    const dateCell    = manilaTime(r.CheckDate);
    const fixedOnCell = r.Status === 'Fixed'
      ? manilaTime(r.FixedOn)
      : '';
    const fixedByCell = r.Status === 'Fixed'
      ? (r.FixedBy || '')
      : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.ServiceTicketID}</td>
      <td>${dateCell}</td>
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
