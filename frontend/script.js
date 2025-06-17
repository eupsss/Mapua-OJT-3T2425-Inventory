/* ────────────────────────────────
   dashboard script.js
──────────────────────────────────*/
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied. Please login first.');
  location.href = 'login.html';
} else {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.username').textContent = user.name;
  });
}

document.addEventListener('DOMContentLoaded', async () => {

  /* ─── colour tokens ─── */
  const css          = getComputedStyle(document.documentElement);
  const colorPrimary = css.getPropertyValue('--color-primary').trim();
  const colorAccent  = css.getPropertyValue('--color-accent').trim();
  const colorText    = css.getPropertyValue('--color-text').trim();

  /* ─── metrics ─── */
  let totalPCs = 0, workingPCs = 0, defectivePCs = 0, checkedToday = 0;
  try {
    const mRes = await fetch('../api/metrics.php');
    if (!mRes.ok) throw new Error(mRes.status);
    ({ totalPCs, workingPCs, defectivePCs, checkedToday } = await mRes.json());
  } catch (err) { console.error('Metrics load error → zeros', err); }

/* ─── recent defects ─── */
try {
  // NEW endpoint – pulls live data from Computers table
  const dRes = await fetch('../api/current-defects.php');
  if (!dRes.ok) throw new Error(dRes.status);

  /**  Expected : [
  *      { RoomID:"MPO310", PCNumber:"04",
  *        LastUpdated:"2025-06-18 09:12:33",
  *        RecordedBy:"Jane D.",
  *        Issues:"Mouse,Memory" }
  *   ]                                               */
  const defects = await dRes.json();

  const tbody = document.getElementById('defectTable');
  tbody.innerHTML = '';

  if (!defects.length) {
    tbody.innerHTML =
      `<tr><td colspan="5" style="text-align:center;padding:1rem">
         🎉 No PCs are marked defective right now
       </td></tr>`;
  } else {
    defects.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.RoomID}</td>
        <td>${d.PCNumber}</td>
        <td>${d.LastUpdated.split(' ')[0]}</td>        <!-- date only -->
        <td>${d.RecordedBy}</td>
        <td>${d.Issues || '-'}</td>
      `;
      tbody.appendChild(tr);
    });
  }
} catch (err) {
  console.error('Defects load error', err);
}

/* ────────────────────────────────
   dashboard script.js
──────────────────────────────────*/
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied. Please login first.');
  location.href = 'login.html';
} else {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.username').textContent = user.name;
  });
}

document.addEventListener('DOMContentLoaded', async () => {

  /* ─── colour tokens ─── */
  const css          = getComputedStyle(document.documentElement);
  const colorPrimary = css.getPropertyValue('--color-primary').trim();
  const colorAccent  = css.getPropertyValue('--color-accent').trim();
  const colorText    = css.getPropertyValue('--color-text').trim();

  /* ─── metrics ─── */
  let totalPCs = 0, workingPCs = 0, defectivePCs = 0, checkedToday = 0;
  try {
    const mRes = await fetch('../api/metrics.php');
    if (!mRes.ok) throw new Error(mRes.status);
    ({ totalPCs, workingPCs, defectivePCs, checkedToday } = await mRes.json());
  } catch (err) { console.error('Metrics load error → zeros', err); }

  /* ─── recent defects ─── */
  try {
    const dRes = await fetch('../api/defects.php');
    if (!dRes.ok) throw new Error(dRes.status);
    const defects = await dRes.json();          // [{…RecordedBy…}, …]

    const tbody = document.getElementById('defectTable');
    tbody.innerHTML = '';                       // fresh slate
    defects.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.RoomID}</td>
        <td>${d.PCNumber}</td>
        <td>${d.CheckDate}</td>
        <td>${d.RecordedBy}</td>
        <td>${d.Status}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error('Defects load error', err); }

  /* ─── update KPI cards ─── */
  document.getElementById('total-pcs').textContent      = totalPCs;
  document.getElementById('working-pcs').textContent    = workingPCs;
  document.getElementById('defective-pcs').textContent  = defectivePCs;
  document.getElementById('checked-today').textContent  = checkedToday;

  /* ─── doughnut ─── */
  new Chart(document.getElementById('statusChart'), {
    type : 'doughnut',
    data : {
      labels: ['Working', 'Defective'],
      datasets: [{
        data: [workingPCs, defectivePCs],
        backgroundColor: [colorPrimary, colorAccent],
        borderColor: colorText,
        borderWidth: 1
      }]
    },
    options : {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  /* ─── simple line placeholder ─── */
  const last7Days  = [...Array(7).keys()].map(i=>{
    const d = new Date(); d.setDate(d.getDate() - (6-i));
    return d.toLocaleDateString();
  });
  const checksData = Array(7).fill(checkedToday);

  new Chart(document.getElementById('checkChart'), {
    type : 'line',
    data : {
      labels: last7Days,
      datasets: [{
        label: 'Checked PCs',
        data : checksData,
        borderColor: colorPrimary,
        backgroundColor: colorAccent,
        tension: 0.3,
        fill: true
      }]
    },
    options : {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: colorText } },
        y: { beginAtZero: true, ticks: { color: colorText } }
      }
    }
  });
});

/* ─── floating clock ─── */
function updateClock () {
  const now = new Date();
  let   h   = now.getHours();
  const am  = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  const time = `${h}:${m}:${s} ${am}`;
  const date = now.toLocaleDateString('en-US',
              { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  document.getElementById('floating-time').innerHTML =
    `<span class="time">${time}</span><span class="date">${date}</span>`;
}
updateClock(); setInterval(updateClock,1000);

  /* ─── update KPI cards ─── */
  document.getElementById('total-pcs').textContent      = totalPCs;
  document.getElementById('working-pcs').textContent    = workingPCs;
  document.getElementById('defective-pcs').textContent  = defectivePCs;
  document.getElementById('checked-today').textContent  = checkedToday;

  /* ─── doughnut ─── */
  new Chart(document.getElementById('statusChart'), {
    type : 'doughnut',
    data : {
      labels: ['Working', 'Defective'],
      datasets: [{
        data: [workingPCs, defectivePCs],
        backgroundColor: [colorPrimary, colorAccent],
        borderColor: colorText,
        borderWidth: 1
      }]
    },
    options : {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  /* ─── simple line placeholder ─── */
  const last7Days  = [...Array(7).keys()].map(i=>{
    const d = new Date(); d.setDate(d.getDate() - (6-i));
    return d.toLocaleDateString();
  });
  const checksData = Array(7).fill(checkedToday);

  new Chart(document.getElementById('checkChart'), {
    type : 'line',
    data : {
      labels: last7Days,
      datasets: [{
        label: 'Checked PCs',
        data : checksData,
        borderColor: colorPrimary,
        backgroundColor: colorAccent,
        tension: 0.3,
        fill: true
      }]
    },
    options : {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: colorText } },
        y: { beginAtZero: true, ticks: { color: colorText } }
      }
    }
  });
});

/* ─── floating clock ─── */
function updateClock () {
  const now = new Date();
  let   h   = now.getHours();
  const am  = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  const time = `${h}:${m}:${s} ${am}`;
  const date = now.toLocaleDateString('en-US',
              { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  document.getElementById('floating-time').innerHTML =
    `<span class="time">${time}</span><span class="date">${date}</span>`;
}
updateClock(); setInterval(updateClock,1000);
