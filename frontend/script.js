const API_BASE = '/api';

/* ─────────────────────────────────────────────────────────
   0.  Global chart defaults & mutable chart handles
   ───────────────────────────────────────────────────────── */
Chart.defaults.plugins.legend.labels.boxWidth  = 14;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
console.log('Chart is ', Chart);


let statusChart      = null;
let checksChart      = null;
let avgFixChart      = null;
let defectsRoomChart = null;
let issuesChart      = null;
let fixesChart       = null;

/* ─────────────────────────────────────────────────────────
   1.  DOM Ready
   ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* 1-a  Auth guard & sign-out */
  const user = JSON.parse(sessionStorage.getItem('user'));
  if (!user) {
    alert('Access denied. Please login first.');
    return (location.href = 'login.html');
  }
  document.querySelector('.username').textContent = user.name;

  const signOutBtn = document.getElementById('signout-btn');
  signOutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem('user');
    location.href = 'login.html';
  });

  /* 1-b  Theme colours pulled from CSS variables */
  const css          = getComputedStyle(document.documentElement);
  const colorPrimary = css.getPropertyValue('--color-primary').trim();
  const colorAccent  = css.getPropertyValue('--color-accent').trim();
  const colorText    = css.getPropertyValue('--color-text').trim();

  /* 1-c  Handy DOM refs */
  const dateInput = document.getElementById('date-filter');
  const totalEl   = document.getElementById('total-pcs');
  const workEl    = document.getElementById('working-pcs');
  const defEl     = document.getElementById('defective-pcs');
  const todayEl   = document.getElementById('checked-today');

  const statusCtx  = document.getElementById('statusChart').getContext('2d');
  const checkCtx   = document.getElementById('checkChart').getContext('2d');
  const avgFixCtx  = document.getElementById('avgFixTimeChart').getContext('2d');
  const roomCtx    = document.getElementById('defectsByRoomChart').getContext('2d');
  const issuesCtx  = document.getElementById('issuesBreakdownChart').getContext('2d');
  const fixesCtx   = document.getElementById('fixesOverTimeChart').getContext('2d');

  /* 1-d  Helper: destroy-if-exists → recreate */
  function setChart(old, ctx, cfg) {
    old?.destroy();
    return new Chart(ctx, cfg);
  }

  /* ───────────────────────────────────────────────────────
     2.  API calls + chart renders
     ─────────────────────────────────────────────────────── */

  // 2-a KPI cards + doughnut
  async function loadMetrics() {
    try {
      const res  = await fetch(`${API_BASE}/metrics`);
      if (!res.ok) throw new Error(res.status);
      const { totalPCs, workingPCs, defectivePCs, checkedToday } = await res.json();

      totalEl.textContent = totalPCs;
      workEl .textContent = workingPCs;
      defEl  .textContent = defectivePCs;
      todayEl.textContent = checkedToday;

      statusChart = setChart(statusChart, statusCtx, {
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
    } catch (err) {
      console.error('Metrics error:', err);
    }
  }

  // 2-b Checks over time
  async function drawChecksOverTime() {
    try {
      const res  = await fetch(`${API_BASE}/checks-over-time`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

      checksChart = setChart(checksChart, checkCtx, {
        type: 'line',
        data: {
          labels: data.map(r => r.d),
          datasets: [{
            label: 'Checked PCs',
            data: data.map(r => r.cnt),
            borderColor: colorPrimary,
            backgroundColor: colorAccent,
            tension: 0.3,
            fill: true
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    } catch (err) {
      console.error('Checks-over-time error:', err);
    }
  }

  // 2-c Average fix time
  async function drawAvgFixTime() {
    try {
      const res  = await fetch(`${API_BASE}/avg-fix-time`);
      if (!res.ok) throw new Error(res.status);
      const { avgHours = 0 } = await res.json();

      avgFixChart = setChart(avgFixChart, avgFixCtx, {
        type: 'bar',
        data: {
          labels: ['Avg hrs'],
          datasets: [{
            data: [avgHours],
            backgroundColor: colorAccent,
            borderColor: colorPrimary
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } },
          responsive: true,
          maintainAspectRatio: false
        }
      });
    } catch (err) {
      console.error('Avg-fix-time error:', err);
    }
  }

  // 2-d Defects by room
  async function drawDefectsByRoom() {
    try {
      const res  = await fetch(`${API_BASE}/defects-by-room`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

      defectsRoomChart = setChart(defectsRoomChart, roomCtx, {
        type: 'bar',
        data: {
          labels: data.map(r => r.RoomID),
          datasets: [{
            data: data.map(r => r.defects),
            backgroundColor: colorPrimary
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false
        }
      });
    } catch (err) {
      console.error('Defects-by-room error:', err);
    }
  }

  // 2-e Issues breakdown
  async function drawIssuesBreakdown() {
    try {
      const res  = await fetch(`${API_BASE}/issues-breakdown`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

      issuesChart = setChart(issuesChart, issuesCtx, {
        type: 'pie',
        data: {
          labels: data.map(i => i.issue),
          datasets: [{
            data: data.map(i => i.cnt),
            backgroundColor: [
              colorPrimary,
              colorAccent,
              '#6c757d',
              '#17a2b8',
              '#28a745'
            ]
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    } catch (err) {
      console.error('Issues-breakdown error:', err);
    }
  }

  // 2-f Fixes over time
  async function drawFixesOverTime() {
    try {
      const res  = await fetch(`${API_BASE}/fixes-over-time`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

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
    } catch (err) {
      console.error('Fixes-over-time error:', err);
    }
  }

  /* ───────────────────────────────────────────────────────
     3.  Live clock widget
     ─────────────────────────────────────────────────────── */
  function updateClock() {
    const now = new Date();
    const hh  = now.getHours().toString().padStart(2, '0');
    const mm  = now.getMinutes().toString().padStart(2, '0');
    const ss  = now.getSeconds().toString().padStart(2, '0');

    document.getElementById('floating-time').innerHTML = `
      <span class="time">${hh}:${mm}:${ss}</span>
      <span class="date">${now.toLocaleDateString('en-US',{
        weekday:'long', year:'numeric', month:'long', day:'numeric'
      })}</span>`;
  }

  /* ───────────────────────────────────────────────────────
     4.  Bootstrap sequence
     ─────────────────────────────────────────────────────── */
  (async () => {
    dateInput && (dateInput.value = new Date().toISOString().slice(0,10));

    await loadMetrics();
    await drawChecksOverTime();
    await Promise.all([
      drawAvgFixTime(),
      drawDefectsByRoom(),
      drawIssuesBreakdown(),
      drawFixesOverTime()
    ]);

    updateClock();
    setInterval(updateClock, 1000);

    // notify parent frame (for embedded scenarios)
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'charts-ready' }, '*');
    }
  })();

});
