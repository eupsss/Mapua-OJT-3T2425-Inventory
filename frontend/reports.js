// reports.js
// Guard route & render a change-log table

// 1️⃣ Redirect if not logged in
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied. Please login first.');
  location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  // show username
  document.querySelector('.username').textContent = user.name;

  // sign-out button
  document.getElementById('btnSignOut')
    .addEventListener('click', () => {
      sessionStorage.removeItem('user');
      location.href = 'login.html';
    });

  loadReport();
});

async function loadReport() {
  const tbody = document.querySelector('#reportsTable tbody');
  tbody.innerHTML = `
    <tr><td colspan="6" style="text-align:center;padding:1rem">
      Loading…
    </td></tr>
  `;

  try {
    const res = await fetch('../api/reports.php');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    // expected shape: [{ CheckDate, RoomID, PCNumber, Status, Issues, RecordedBy }, …]

    tbody.innerHTML = ''; // clear loading row

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="6" style="text-align:center;padding:1rem">
          No records found.
        </td></tr>
      `;
      return;
    }

    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.CheckDate}</td>
        <td>${r.RoomID}</td>
        <td>${r.PCNumber}</td>
        <td>${r.Status}</td>
        <td>${r.Issues || ''}</td>
        <td>${r.RecordedBy}</td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error('Failed to load report:', err);
    tbody.innerHTML = `
      <tr><td colspan="6" style="color:red;text-align:center;padding:1rem">
        Error loading data
      </td></tr>
    `;
  }
}
