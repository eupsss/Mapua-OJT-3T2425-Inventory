// script.js — Mapúa Inventory Dashboard (with Sign-Out)

let statusChart      = null;
let checksChart      = null;
let avgFixChart      = null;
let defectsRoomChart = null;
let issuesChart      = null;
let fixesChart       = null;

// Tweak default legend box sizes
Chart.defaults.plugins.legend.labels.boxWidth  = 14;
Chart.defaults.plugins.legend.labels.boxHeight = 10;

document.addEventListener('DOMContentLoaded', () => {
  // ─── 0. Auth guard & Sign-Out ────────────────────────
  const user = JSON.parse(sessionStorage.getItem('user'));
  if (!user) {
    alert('Access denied. Please login first.');
    return location.href = 'login.html';
  }

  // Populate username
  document.querySelector('.username').textContent = user.name;

  // Sign-Out button
  const signOutBtn = document.getElementById('signout-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('user');
      location.href = 'login.html';
    });
  }

  // ─── 1. Theme colors ───────────────────────────────────
  const css          = getComputedStyle(document.documentElement);
  const colorPrimary = css.getPropertyValue('--color-primary').trim();
  const colorAccent  = css.getPropertyValue('--color-accent').trim();
  const colorText    = css.getPropertyValue('--color-text').trim();

  // ─── 2. DOM refs ──────────────────────────────────────
  const dateInput  = document.getElementById('date-filter');
  const totalEl    = document.getElementById('total-pcs');
  const workEl     = document.getElementById('working-pcs');
  const defEl      = document.getElementById('defective-pcs');
  const todayEl    = document.getElementById('checked-today');

  const statusCtx  = document.getElementById('statusChart').getContext('2d');
  const checkCtx   = document.getElementById('checkChart').getContext('2d');
  const avgFixCtx  = document.getElementById('avgFixTimeChart').getContext('2d');
  const roomCtx    = document.getElementById('defectsByRoomChart').getContext('2d');
  const issuesCtx  = document.getElementById('issuesBreakdownChart').getContext('2d');
  const fixesCtx   = document.getElementById('fixesOverTimeChart').getContext('2d');

  // ─── helper to destroy + recreate a chart ───────────────
  function setChart(oldChartRef, ctx, cfg) {
    if (oldChartRef) oldChartRef.destroy();
    return new Chart(ctx, cfg);
  }

  // ─── 3. Fetch & render KPIs + Status Doughnut ───────────
  async function loadMetrics () {
    let totalPCs = 0, workingPCs = 0, defectivePCs = 0, checkedToday = 0;
    try {
      const res = await fetch('../api/metrics.php');
      if (!res.ok) throw new Error(res.status);
      ({ totalPCs, workingPCs, defectivePCs, checkedToday } = await res.json());
    } catch(err) {
      console.error('metrics error', err);
    }

    totalEl.textContent = totalPCs;
    workEl .textContent = workingPCs;
    defEl  .textContent = defectivePCs;
    todayEl.textContent = checkedToday;

    statusChart = setChart(statusChart, statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Working','Defective'],
        datasets: [{
          data: [workingPCs, defectivePCs],
          backgroundColor: [colorPrimary, colorAccent],
          borderColor: colorText
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  // ─── 4. Checks Over Time (7-day history) ────────────────
  async function drawChecksOverTime() {
    try {
      const res  = await fetch('../api/checks-over-time.php');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

      const labels = data.map(r => r.d);
      const counts = data.map(r => r.cnt);

      checksChart = setChart(checksChart, checkCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Checked PCs',
            data: counts,
            borderColor: colorPrimary,
            backgroundColor: colorAccent,
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    } catch (e) {
      console.error('checks over time error', e);
    }
  }

  // ─── 5. Average Fix Time ─────────────────────────────────
  async function drawAvgFixTime(){
    try {
      const { avgHours } = await (await fetch('../api/avg-fix-time.php')).json();
      avgFixChart = setChart(avgFixChart, avgFixCtx, {
        type: 'bar',
        data: {
          labels: ['Avg hrs'],
          datasets: [{
            data: [avgHours || 0],
            backgroundColor: colorAccent,
            borderColor: colorPrimary
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    } catch (e) {
      console.error('avg fix time error', e);
    }
  }

  // ─── 6. Defects by Room ──────────────────────────────────
  async function drawDefectsByRoom(){
    try {
      const data = await (await fetch('../api/defects-by-room.php')).json();
      defectsRoomChart = setChart(defectsRoomChart, roomCtx, {
        type: 'bar',
        data: {
          labels: data.map(r => r.RoomID),
          datasets: [{ data: data.map(r => r.defects), backgroundColor: colorPrimary }]
        },
        options: {
          plugins: { legend: { display: false } },
          indexAxis: 'y'
        }
      });
    } catch (e) {
      console.error('defects by room error', e);
    }
  }

  // ─── 7. Issues Breakdown ─────────────────────────────────
  async function drawIssuesBreakdown(){
    try {
      const data = await (await fetch('../api/issues-breakdown.php')).json();
      issuesChart = setChart(issuesChart, issuesCtx, {
        type: 'pie',
        data: {
          labels: data.map(i => i.issue),
          datasets: [{
            data: data.map(i => i.cnt),
            backgroundColor: [
              colorPrimary, colorAccent,
              '#6c757d', '#17a2b8', '#28a745'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    } catch (e) {
      console.error('issues breakdown error', e);
    }
  }

  // ─── 8. Fixes Over Time ──────────────────────────────────
  async function drawFixesOverTime(){
    try {
      const data = await (await fetch('../api/fixes-over-time.php')).json();
      fixesChart = setChart(fixesChart, fixesCtx, {
        type: 'line',
        data: {
          labels: data.map(r => r.d),
          datasets: [{
            label: 'Fixes',
            data: data.map(r => r.cnt),
            borderColor: colorPrimary,
            backgroundColor: colorAccent,
            tension: 0.3,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    } catch (e) {
      console.error('fixes over time error', e);
    }
  }

  // ─── 9. Live 24-hour Clock ───────────────────────────────
  function updateClock(){
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2, '0');
    const mm  = String(now.getMinutes()).padStart(2, '0');
    const ss  = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('floating-time').innerHTML = `
      <span class="time">${hh}:${mm}:${ss}</span>
      <span class="date">${now.toLocaleDateString('en-US',{
        weekday:'long',year:'numeric',month:'long',day:'numeric'
      })}</span>
    `;
  }

  // ─── 10. Bootstrap Everything ────────────────────────────
  (async () => {
    // initialize date filter if used
    if (dateInput) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }

    await loadMetrics();
    await drawChecksOverTime();
    await Promise.all([
      drawAvgFixTime(),
      drawDefectsByRoom(),
      drawIssuesBreakdown(),
      drawFixesOverTime()
    ]);

    // start clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // notify parent window if embedded
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'charts-ready' }, '*');
    }
  })();

});
