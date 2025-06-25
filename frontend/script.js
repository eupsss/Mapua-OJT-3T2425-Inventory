/* global Chart */
const API_BASE = '/api';

/* ─────────────────────────────────────────────────────────
   0.  Chart.js global tweaks & handles
   ───────────────────────────────────────────────────────── */
Chart.defaults.plugins.legend.labels.boxWidth  = 14;
Chart.defaults.plugins.legend.labels.boxHeight = 10;

let statusChart, checksChart, avgFixChart,
    defectsRoomChart, issuesChart, fixesChart,
    trendChart, issuesOTChart, uptimeChart;

/* ─────────────────────────────────────────────────────────
   1.  DOM Ready
   ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* 1-a  Auth guard */
  const user = JSON.parse(sessionStorage.getItem('user'));
  if (!user) { alert('Access denied.'); return location.href = 'login.html'; }
  document.querySelector('.username').textContent = user.name;

  /* sign-out */
  document.getElementById('signout-btn')
          .addEventListener('click', () => { sessionStorage.removeItem('user'); location.href = 'login.html'; });

  /* 1-b  Theme colours */
  const CSS  = getComputedStyle(document.documentElement);
  const clrP = CSS.getPropertyValue('--color-primary').trim();
  const clrA = CSS.getPropertyValue('--color-accent').trim();
  const clrT = CSS.getPropertyValue('--color-text').trim();

  /* 1-c  ctx */
  const ctx = id => document.getElementById(id).getContext('2d');
  const statusCtx  = ctx('statusChart');
  const checkCtx   = ctx('checkChart');
  const avgFixCtx  = ctx('avgFixTimeChart');
  const roomCtx    = ctx('defectsByRoomChart');
  const issuesCtx  = ctx('issuesBreakdownChart');
  const fixesCtx   = ctx('fixesOverTimeChart');
  const trendCtx   = ctx('defectsTrendChart');
  const issuesOTCtx= ctx('issuesOverTimeChart');
  const uptimeCtx  = ctx('roomUptimeChart');

  /* helper */
  const setChart = (old, ctx, cfg) => { old?.destroy(); return new Chart(ctx, cfg); };

  /* ───────────────────────────────────────────────────────
     2.  API fetchers
     ─────────────────────────────────────────────────────── */

  /* 2-a KPI + doughnut */
  async function loadMetrics() {
    const r = await fetch(`${API_BASE}/metrics`);  if (!r.ok) return;
    const { totalPCs, workingPCs, defectivePCs, checkedToday } = await r.json();
    ['total','working','defective'].forEach((k,i)=> document.getElementById(`${k}-pcs`).textContent = [totalPCs,workingPCs,defectivePCs][i]);
    document.getElementById('checked-today').textContent = checkedToday;

    statusChart = setChart(statusChart, statusCtx, {
      type:'doughnut',
      data:{ labels:['Working','Defective'],
             datasets:[{ data:[workingPCs,defectivePCs], backgroundColor:[clrP,clrA], borderColor:clrT }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
    });
  }

  /* 2-b Checks over time */
  async function drawChecksOverTime() {
    const r = await fetch(`${API_BASE}/checks-over-time`); if(!r.ok) return;
    const d = await r.json();
    checksChart = setChart(checksChart, checkCtx, {
      type:'line',
      data:{ labels:d.map(x=>x.d), datasets:[{ label:'Checked PCs', data:d.map(x=>x.cnt), borderColor:clrP, backgroundColor:clrA, tension:.3, fill:true }]},
      options:{ responsive:true, maintainAspectRatio:false }
    });
  }

  /* 2-c Average fix hours */
  async function drawAvgFixTime() {
    const r = await fetch(`${API_BASE}/avg-fix-time`); if(!r.ok) return;
    const { avgHours = 0 } = await r.json();
    avgFixChart = setChart(avgFixChart, avgFixCtx, {
      type:'bar',
      data:{ labels:['Avg hrs'], datasets:[{ data:[avgHours], backgroundColor:clrA, borderColor:clrP }]},
      options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } }, responsive:true }
    });
  }

  /* 2-d Defects by room */
  async function drawDefectsByRoom() {
    const r = await fetch(`${API_BASE}/defects-by-room`); if(!r.ok) return;
    const d = await r.json();
    defectsRoomChart = setChart(defectsRoomChart, roomCtx, {
      type:'bar',
      data:{ labels:d.map(x=>x.RoomID), datasets:[{ data:d.map(x=>x.defects), backgroundColor:clrP }]},
      options:{ plugins:{ legend:{ display:false } }, indexAxis:'y', responsive:true }
    });
  }

  /* 2-e Issues pie */
  async function drawIssuesBreakdown() {
    const r = await fetch(`${API_BASE}/issues-breakdown`); if(!r.ok) return;
    const d = await r.json();
    const palette = [clrP, clrA, '#6c757d', '#17a2b8', '#28a745', '#ffc107'];
    issuesChart = setChart(issuesChart, issuesCtx, {
      type:'pie',
      data:{ labels:d.map(x=>x.issue), datasets:[{ data:d.map(x=>x.cnt), backgroundColor:palette }]},
      options:{ responsive:true, maintainAspectRatio:false }
    });
  }

  /* 2-f Fixes over time */
  async function drawFixesOverTime() {
    const r = await fetch(`${API_BASE}/fixes-over-time`); if(!r.ok) return;
    const d = await r.json();
    fixesChart = setChart(fixesChart, fixesCtx, {
      type:'line',
      data:{ labels:d.map(x=>x.d), datasets:[{ label:'Fixes', data:d.map(x=>x.cnt), borderColor:clrP, backgroundColor:clrA, tension:.3, fill:false }]},
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } }
    });
  }

  /* 2-g NEW Daily defects trend */
  async function drawDefectsTrend() {
    const r = await fetch(`${API_BASE}/defects-trend`); if(!r.ok) return;
    const d = await r.json();
    trendChart = setChart(trendChart, trendCtx, {
      type:'line',
      data:{ labels:d.map(x=>x.d), datasets:[{ label:'Defects', data:d.map(x=>x.defects), borderColor:clrA, backgroundColor:clrP, tension:.25, fill:true }]},
      options:{ responsive:true }
    });
  }

  /* 2-h NEW Issue mix over time (stacked bar) */
  async function drawIssuesOverTime() {
    const r = await fetch(`${API_BASE}/issues-over-time`); if(!r.ok) return;
    const rows = await r.json();                          // [{ym, issue, cnt}]
    const labels = [...new Set(rows.map(r=>r.ym))];
    const issues = [...new Set(rows.map(r=>r.issue))];
    const datasets = issues.map((iss,i)=>({
      label:iss,
      data:labels.map(ym=>{
        const hit = rows.find(r=>r.ym===ym && r.issue===iss);
        return hit ? hit.cnt : 0;
      }),
      backgroundColor: Chart.helpers.color(clrP).alpha(0.25 + 0.1*i).rgbString()
    }));

    issuesOTChart = setChart(issuesOTChart, issuesOTCtx, {
      type:'bar',
      data:{ labels, datasets },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom' } },
        scales:{ x:{ stacked:true }, y:{ stacked:true, beginAtZero:true } }
      }
    });
  }

  /* 2-i NEW Room uptime */
  async function drawRoomUptime() {
    const r = await fetch(`${API_BASE}/room-uptime`); if(!r.ok) return;
    const d = await r.json();                             // [{RoomID, uptime_pct}]
    uptimeChart = setChart(uptimeChart, uptimeCtx, {
      type:'bar',
      data:{ labels:d.map(x=>x.RoomID), datasets:[{ data:d.map(x=>x.uptime_pct), backgroundColor:clrA }]},
      options:{
        indexAxis:'y',
        plugins:{ legend:{ display:false } },
        scales:{ x:{ beginAtZero:true, max:100 } },
        responsive:true
      }
    });
  }

  /* ───────────────────────────────────────────────────────
     3. Clock
     ─────────────────────────────────────────────────────── */
  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');
    document.getElementById('floating-time').innerHTML =
      `<span class="time">${hh}:${mm}:${ss}</span>
       <span class="date">${now.toLocaleDateString('en-US',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })}</span>`;
  }

  /* ───────────────────────────────────────────────────────
     4.  Bootstrap
     ─────────────────────────────────────────────────────── */
  (async () => {
    document.getElementById('date-filter').value = new Date().toISOString().slice(0,10);

    await loadMetrics();
    await drawChecksOverTime();

    await Promise.all([
      drawAvgFixTime(),
      drawDefectsByRoom(),
      drawIssuesBreakdown(),
      drawFixesOverTime(),
      drawDefectsTrend(),
      drawIssuesOverTime(),
      drawRoomUptime()
    ]);

    updateClock(); setInterval(updateClock, 1000);

    /* let export.html know charts are ready */
    if (window.parent !== window) window.parent.postMessage({ type:'charts-ready' }, '*');
  })();
});
