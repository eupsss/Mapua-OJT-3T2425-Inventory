// script.js - live dashboard + clock
document.addEventListener('DOMContentLoaded', async () => {
  /* ─── colour tokens ─── */
  const css          = getComputedStyle(document.documentElement);
  const colorPrimary = css.getPropertyValue('--color-primary').trim();
  const colorAccent  = css.getPropertyValue('--color-accent').trim();
  const colorText    = css.getPropertyValue('--color-text').trim();

  /* ─── metrics (defaults) ─── */
  let totalPCs = 0,
      workingPCs = 0,
      defectivePCs = 0,
      checkedToday = 0;

  try {
    const res = await fetch('../api/metrics.php');   // adjust path if needed
    if (!res.ok) throw new Error(res.status);
    const m = await res.json();
    ({ totalPCs, workingPCs, defectivePCs, checkedToday } = m);
  } catch (err) {
    console.error('Metrics load error → using zeroes', err);
  }
  /* ─── recent defects table ─── */
try {
  const res = await fetch('../api/defects.php');     // adjust path if needed
  if (!res.ok) throw new Error(res.status);
  const defects = await res.json();                  // [{RoomID,PCNumber,CheckDate,Status}, ...]

  const tbody = document.getElementById('defectTable');
  tbody.innerHTML = '';                              // clear any previous rows
  defects.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.RoomID}</td>
      <td>${d.PCNumber}</td>
      <td>${d.CheckDate}</td>
      <td>${d.Status}</td>`;
    tbody.appendChild(tr);
  });
} catch (err) {
  console.error('Defects load error', err);
}


  /* ─── update cards ─── */
  document.getElementById('total-pcs'   ).textContent = totalPCs;
  document.getElementById('working-pcs' ).textContent = workingPCs;
  document.getElementById('defective-pcs').textContent = defectivePCs;
  document.getElementById('checked-today').textContent = checkedToday;

  /* ─── status doughnut ─── */
  new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: {
      labels: ['Working', 'Defective'],
      datasets: [{
        data: [workingPCs, defectivePCs],
        backgroundColor: [colorPrimary, colorAccent],
        borderColor: colorText,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  /* ─── simple line chart (placeholder: same checked count) ─── */
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString();
  });
  const checksData = new Array(7).fill(checkedToday);

  new Chart(document.getElementById('checkChart'), {
    type: 'line',
    data: {
      labels: last7Days,
      datasets: [{
        label: 'Checked PCs',
        data: checksData,
        borderColor: colorPrimary,
        backgroundColor: colorAccent,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: colorText } },
        y: { beginAtZero: true, ticks: { color: colorText } }
      }
    }
  });

  /* ─── (optional) recent defect rows … left empty for now ─── */
});

/* ───────────────────── floating clock ───────────────────── */
function updateClock() {
  const now = new Date();
  let h = now.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  const timeStr = `${h}:${m}:${s} ${ampm}`;

  const dateStr = now.toLocaleDateString('en-US',
    { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  document.getElementById('floating-time').innerHTML =
    `<span class="time">${timeStr}</span><span class="date">${dateStr}</span>`;
}
updateClock();
setInterval(updateClock, 1000);
