// reports.js – v2.2  (robust sign-out, JS-based API)
console.log('▶️ reports.js loaded');

// 1️⃣ Login guard
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied. Please login first.');
  location.href = 'login.html';
}

// 2️⃣ Constants & DOM ready
const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
  // inject user name
  document.querySelector('.username').textContent = user.name;

  // sign-out button – accept either id
  const signOutBtn = document.querySelector('#signout-btn, #btnSignOut');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('user');
      location.href = 'login.html';
    });
  }

  // load the report once the DOM is ready
  loadReport();
});

// 3️⃣ Fetch + render report
async function loadReport() {
  const tbody = document.querySelector('#reportsTable tbody');
  tbody.innerHTML = loadingRow();

  try {
    const res = await fetch(`${API_BASE}/reports`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();
    console.log('📝 report rows:', rows);

    tbody.innerHTML = '';
    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = noRowsRow();
      return;
    }
    rows.forEach(r => tbody.appendChild(renderRow(r)));
  } catch (err) {
    console.error('Report load failed', err);
    tbody.innerHTML = errorRow();
  }
}

// 4️⃣ Row helpers
function renderRow(r) {
  const statusDisplay =
    (r.FixedOn && r.FixedOn !== '—') ? 'Fixed' : 'Under Repair';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${r.ServiceTicketID}</td>
    <td>${r.CheckDate}</td>
    <td>${r.RoomID}</td>
    <td>${r.PCNumber}</td>
    <td>${statusDisplay}</td>
    <td>${r.Issues || ''}</td>
    <td>${r.FixedOn || ''}</td>
    <td>${r.FixedBy || ''}</td>
    <td>${r.RecordedBy || ''}</td>
  `;
  return tr;
}

const loadingRow = () => `<tr><td colspan="9" class="center">Loading…</td></tr>`;
const noRowsRow  = () => `<tr><td colspan="9" class="center">No records found.</td></tr>`;
const errorRow   = () => `<tr><td colspan="9" class="center error">Error loading data</td></tr>`;
