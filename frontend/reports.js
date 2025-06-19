// reports.js – v2.1  (robust sign-out)
console.log('▶️ reports.js loaded');


/* 1️⃣ Login guard */
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied. Please login first.');
  location.href = 'login.html';
}

/* 2️⃣ DOM ready */
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
async function loadReport() {
  const tbody = document.querySelector('#reportsTable tbody');
  tbody.innerHTML = loadingRow();

  try {
    const res  = await fetch('../api/reports.php');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();

    // ★ DEBUG: inspect what the API actually returned
    console.log('📝 report rows:', rows);

    tbody.innerHTML = '';
    if (!rows.length) return (tbody.innerHTML = noRowsRow());

    rows.forEach(r => tbody.appendChild(renderRow(r)));
  } catch (err) {
    console.error('Report load failed', err);
    tbody.innerHTML = errorRow();
  }
}

  loadReport();
});

/* 3️⃣ Fetch + render */
async function loadReport() {
  const tbody = document.querySelector('#reportsTable tbody');
  tbody.innerHTML = loadingRow();

  try {
    const res = await fetch('../api/reports.php');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    console.log(rows);


    tbody.innerHTML = '';
    if (!rows.length) return (tbody.innerHTML = noRowsRow());

    rows.forEach(r => tbody.appendChild(renderRow(r)));
  } catch (err) {
    console.error('Report load failed', err);
    tbody.innerHTML = errorRow();
  }
}

/* 4️⃣ Row helpers */
function renderRow(r) {
  // decide what to show in the Status column
  const statusDisplay =
        (r.FixedOn && r.FixedOn !== '—')   // any non-dash date means repaired
          ? 'Fixed'
          : 'Under Repair';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${r.CheckDate}</td>
    <td>${r.RoomID}</td>
    <td>${r.PCNumber}</td>
    <td>${statusDisplay}</td>          <!-- 👈 computed status -->
    <td>${r.Issues || ''}</td>
    <td>${r.FixedOn}</td>
    <td>${r.FixedBy}</td>
    <td>${r.RecordedBy}</td>
  `;
  return tr;
}


// and in your loading/no-data/error rows:
const loadingRow = () => `<tr><td colspan="8" class="center">Loading…</td></tr>`;
const noRowsRow  = () => `<tr><td colspan="8" class="center">No records found.</td></tr>`;
const errorRow   = () => `<tr><td colspan="8" class="center error">Error loading data</td></tr>`;
