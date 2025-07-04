/* ─── Global Chart.js Defaults ───────────────────────────────── */
/* global Chart */
const API_BASE = '/api';
let statusChart, checksChart, avgFixChart, defectsRoomChart;
let issuesChart, fixesChart, trendChart, issuesOTChart, uptimeChart;

// 1) Typography & Layout
Chart.defaults.font.family        = "'Inter','Helvetica Neue','Arial',sans-serif";
Chart.defaults.font.size          = 12;
Chart.defaults.color              = "#444";
Chart.defaults.layout.padding     = 16;

// 2) Grid & Axes
Chart.defaults.scale.grid.color      = "rgba(0,0,0,0.05)";
Chart.defaults.scale.grid.lineWidth  = 1;
Chart.defaults.scale.ticks.color     = "#666";
Chart.defaults.scale.ticks.backdropColor = "transparent";

// 3) Legend & Tooltip
Chart.defaults.plugins.legend.position      = "bottom";
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.tooltip.padding      = 10;
Chart.defaults.plugins.tooltip.titleFont    = { weight: "600", size: 14 };
Chart.defaults.plugins.tooltip.bodyFont     = { size: 13 };

// 4) Animation & Responsiveness
Chart.defaults.animation.duration    = 500;
Chart.defaults.responsive            = true;
Chart.defaults.maintainAspectRatio   = false;

/** Apply threshold coloring to a bar dataset */
function applyThreshold(dataset, threshold, lowColor, highColor) {
  dataset.backgroundColor = dataset.data.map(v =>
    v < threshold ? lowColor : highColor
  );
}

/** Enhanced wrapper: destroy old chart & instantiate new one */
function setChart(oldChart, ctx, config) {
  if (oldChart && typeof oldChart.destroy === "function") {
    oldChart.destroy();
  }
  return new Chart(ctx, config);
}

/* ─── Month/Year Picker Component ─────────────────────────── */
class MonthYearPicker {
  constructor(container, onChange, initial) {
    this.container  = container;
    this.onChange   = onChange;
    const [y,m]     = initial.split('-').map(Number);
    this.year       = y;
    this.month      = m;
    this.view       = 'month';
    const today     = new Date();
    this.todayYear  = today.getFullYear();
    this.todayMonth = today.getMonth() + 1;
    this.render();
  }
  render() {
    this.container.innerHTML = '';
    this._header();
    this._grid();
  }
  _header() {
    const h = document.createElement('div');
    h.className = 'picker-header';
    const btn = (txt, cb) => {
      const b = document.createElement('button');
      b.textContent = txt;
      b.onclick     = cb;
      return b;
    };
    h.append(
      btn('‹', () => this._change(-1)),
      (() => {
        const t = document.createElement('span');
        t.className = 'picker-title';
        t.textContent = this.view === 'month'
          ? this.year
          : `${this._decadeStart()} – ${this._decadeStart()+11}`;
        t.onclick = () => {
          this.view = this.view === 'month' ? 'year' : 'month';
          this.render();
        };
        return t;
      })(),
      btn('›', () => this._change(1))
    );
    this.container.append(h);
  }
  _grid() {
    const g = document.createElement('div');
    g.className = 'picker-grid';
    this.view === 'month' ? this._months(g) : this._years(g);
    this.container.append(g);
  }
  _months(grid) {
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      .forEach((lab,i) => {
        const m = i+1;
        const cell = document.createElement('div');
        cell.className = 'grid-item';
        cell.textContent = lab;
        const future = this.year > this.todayYear
                    || (this.year===this.todayYear && m>this.todayMonth);
        if (future) cell.classList.add('disabled');
        const monthInput = document.getElementById('month-filter');
        if (monthInput) {
          const [sy,sm] = monthInput.value.split('-').map(Number);
          if (sy===this.year && sm===m) cell.classList.add('selected');
        }
        cell.onclick = () => {
          if (future) return;
          this.month = m;
          this._commit();
        };
        grid.append(cell);
      });
  }
  _years(grid) {
    const start = this._decadeStart();
    for (let y=start; y<start+12; y++) {
      const cell = document.createElement('div');
      cell.className = 'grid-item';
      cell.textContent = y;
      if (y>this.todayYear) cell.classList.add('disabled');
      if (y===this.year)    cell.classList.add('selected');
      cell.onclick = () => {
        if (y>this.todayYear) return;
        this.year = y;
        this.view = 'month';
        this.render();
      };
      grid.append(cell);
    }
  }
  _decadeStart() {
    return Math.floor(this.year/10)*10 - 1;
  }
  _change(delta) {
    this.view==='month' ? this.year+=delta : this.year+=delta*12;
    this.render();
  }
  _commit() {
    const val = `${this.year}-${String(this.month).padStart(2,'0')}`;
    this.onChange(val);
    this.render();
  }
}

/* ─── DOM READY & APP BOOTSTRAP ───────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // — Auth guard —
  const user = JSON.parse(sessionStorage.getItem('user'));
  if (!user) {
    alert('Access denied.');
    return location.href = 'login.html';
  }

  // — Populate username & avatar initials —
  const userNameEl = document.querySelector('.user-name');
  if (userNameEl) userNameEl.textContent = user.name;
  const avatarEls = document.querySelectorAll('.avatar');
  avatarEls.forEach(el => {
    const initials = user.name
      .split(' ')
      .map(n => n[0]?.toUpperCase()||'')
      .join('').slice(0,2);
    el.textContent = initials;
  });

  // — Sign-out button —
  const signOut = document.getElementById('signout-btn');
  if (signOut) {
    signOut.addEventListener('click', () => {
      sessionStorage.removeItem('user');
      location.href = 'login.html';
    });
  }

  // — Month-picker wiring —
  const monthInput = document.getElementById('month-filter');
  if (monthInput) {
    monthInput.value = new Date().toISOString().slice(0,7);

    const badge = document.getElementById('selected-month-display');
    if (badge) {
      badge.textContent = monthInput.value;
      badge.addEventListener('click', () => {
        const toggle = document.getElementById('month-picker-toggle');
        if (toggle) toggle.checked = !toggle.checked;
      });
    }

    const pickerContainer = document.getElementById('month-picker');
    if (pickerContainer) {
      new MonthYearPicker(
        pickerContainer,
        val => {
          monthInput.value = val;
          if (badge) badge.textContent = val;
          const toggle = document.getElementById('month-picker-toggle');
          if (toggle) toggle.checked = false;
          refreshDashboard(val);
        },
        monthInput.value
      );
    }

    // initial load
    refreshDashboard(monthInput.value);
  }

  // — Floating clock —
  const updateClock = () => {
    const ft = document.getElementById('floating-time');
    if (!ft) return;
    const now = new Date();
    ft.innerHTML = `
      <span class="time">${now.toLocaleTimeString()}</span>
      <span class="date">${now.toLocaleDateString('en-US', {
        weekday:'long', year:'numeric', month:'long', day:'numeric'
      })}</span>`;
  };
  updateClock();
  setInterval(updateClock, 1000);

  // — Theme toggle (optional) —
  const themeToggle = document.querySelector('.theme-toggle-btn');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const dark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', dark?'dark':'light');
      themeToggle.textContent = dark?'☀️':'🌙';
    });
    if (localStorage.getItem('theme')==='dark') {
      document.documentElement.classList.add('dark');
      themeToggle.textContent = '☀️';
    }
  }

  // — Search filter (optional) —
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('.chart-card').forEach(card => {
        const title = card.querySelector('h4')?.textContent.toLowerCase()||'';
        card.style.display = title.includes(q) ? '' : 'none';
      });
    });
  }

  // — Mobile menu toggle (optional) —
  const menuBtn = document.querySelector('.menu-toggle-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.classList.toggle('open');
    });
  }

  // — Notification bell stub (optional) —
  const bell = document.querySelector('.notifications');
  if (bell) {
    bell.addEventListener('click', () => {
      const count = bell.querySelector('.badge-sm')?.textContent || '0';
      alert(`You have ${count} new notification${count==='1'?'':'s'}.`);
    });
  }
});

/* ─── DASHBOARD REFRESH & CHART DRAWERS ───────────────────── */
async function refreshDashboard(ym) {
  // step 1: populate the KPI cards
  await loadMetrics(ym);
  // step 2: draw all charts in parallel
  await Promise.all([
    drawStatusChart(ym),
    drawChecksChart(ym),
    drawAvgFixChart(ym),
    drawDefectsRoomChart(ym),
    drawIssuesBreakdownChart(ym),
    drawFixesChart(ym),
    drawTrendChart(ym),
    drawIssuesOTChart(ym),
    drawUptimeChart(ym)
  ]);
}

async function loadMetrics(ym) {
  const r = await fetch(`${API_BASE}/metrics?month=${ym}`);
  if (!r.ok) return;
  const { totalPCs, workingPCs, defectivePCs, checkedToday } = await r.json();
  const totalEl = document.getElementById('total-pcs');
  if (totalEl) {
    totalEl.textContent = totalPCs;
}
  const workingEl = document.getElementById('working-pcs');
  if (workingEl) workingEl.textContent = workingPCs;

  const defectiveEl = document.getElementById('defective-pcs');
  if (defectiveEl) defectiveEl.textContent = defectivePCs;

  const checkedEl = document.getElementById('checked-today');
  if (checkedEl) checkedEl.textContent = checkedToday;
  }

/* ─── 1) PC Status Breakdown ──────────────────────────────── */
async function drawStatusChart(ym) {
  const res = await fetch(`${API_BASE}/metrics?month=${ym}`);
  if (!res.ok) return;
  const { workingPCs, defectivePCs } = await res.json();
  statusChart = setChart(
    statusChart,
    document.getElementById('statusChart').getContext('2d'),
    {
      type: 'doughnut',
      data: {
        labels: ['Working','Defective'],
        datasets: [{
          data: [workingPCs,defectivePCs],
          backgroundColor: [
            getCSSVar('--color-primary'),
            getCSSVar('--color-accent')
          ],
          hoverOffset: 8,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        cutout: '60%',
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${ctx.parsed} PCs`
            }
          }
        }
      }
    }
  );
}

/* ─── 2) Checks Over Time ─────────────────────────────────── */
async function drawChecksChart(ym) {
  const res = await fetch(`${API_BASE}/checks-over-time?month=${ym}`);
  if (!res.ok) return;
  const data = await res.json();
  const ctx  = document.getElementById('checkChart').getContext('2d');
  const gradient = ctx.createLinearGradient(0,0,0,200);
  gradient.addColorStop(0, getCSSVar('--color-accent')+'88');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  checksChart = setChart(
    checksChart,
    ctx,
    {
      type: 'line',
      data: {
        labels: data.map(d=>d.d),
        datasets: [{
          label: 'Checked PCs',
          data: data.map(d=>d.cnt),
          borderColor: getCSSVar('--color-primary'),
          backgroundColor: gradient,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: { scales: { y: { beginAtZero: true } } }
    }
  );
}

/* ─── 3) Average Time to Fix ─────────────────────────────── */
async function drawAvgFixChart(ym) {
  const res = await fetch(`${API_BASE}/avg-fix-time?month=${ym}`);
  if (!res.ok) return;
  const { avgHours=0 } = await res.json();
  avgFixChart = setChart(
    avgFixChart,
    document.getElementById('avgFixTimeChart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: ['Avg hrs'],
        datasets: [{ data:[avgHours], borderRadius:8, borderWidth:1 }]
      },
      options: {
        plugins: {
          legend: { display:false },
          tooltip: {
            callbacks: { label: ctx => `${ctx.parsed.y.toFixed(1)} hrs` }
          }
        },
        scales: { y: { beginAtZero:true } },
        onResize: chart => applyThreshold(
          chart.data.datasets[0],
          1,
          getCSSVar('--color-primary'),
          getCSSVar('--color-accent')
        )
      }
    }
  );
}

/* ─── 4) Defects by Room ─────────────────────────────────── */
async function drawDefectsRoomChart(ym) {
  const res = await fetch(`${API_BASE}/defects-by-room?month=${ym}`);
  if (!res.ok) return;
  const rows = await res.json();
  rows.sort((a,b)=>b.defects - a.defects);
  defectsRoomChart = setChart(
    defectsRoomChart,
    document.getElementById('defectsByRoomChart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: rows.map(r=>r.RoomID),
        datasets: [{
          data: rows.map(r=>r.defects),
          borderRadius:6,
          barThickness:12
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend:{ display:false } },
        scales: { x:{ beginAtZero:true } }
      }
    }
  );
}

/* ─── 5) Issues Breakdown ────────────────────────────────── */
async function drawIssuesBreakdownChart(ym) {
  const res = await fetch(`${API_BASE}/issues-breakdown?month=${ym}`);
  if (!res.ok) return;
  const rows = await res.json();
  const palette = [
    getCSSVar('--color-primary'),
    getCSSVar('--color-accent'),
    '#6c757d','#17a2b8','#28a745','#ffc107'
  ];
  issuesChart = setChart(
    issuesChart,
    document.getElementById('issuesBreakdownChart').getContext('2d'),
    {
      type: 'pie',
      data: {
        labels: rows.map(r=>r.issue),
        datasets: [{
          data: rows.map(r=>r.cnt),
          backgroundColor: palette,
          borderColor: '#fff',
          borderWidth: 1
        }]
      },
      options: {
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${ctx.parsed} issues`
            }
          }
        }
      }
    }
  );
}

/* ─── 6) Fixes Over Time ─────────────────────────────────── */
async function drawFixesChart(ym) {
  const res = await fetch(`${API_BASE}/fixes-over-time?month=${ym}`);
  if (!res.ok) return;
  const data = await res.json();
  fixesChart = setChart(
    fixesChart,
    document.getElementById('fixesOverTimeChart').getContext('2d'),
    {
      type: 'line',
      data: {
        labels: data.map(d=>d.d),
        datasets: [{
          label: 'Fixes',
          data: data.map(d=>d.cnt),
          borderColor: getCSSVar('--color-primary'),
          tension:0.3,
          fill:false,
          pointStyle:'rectRounded',
          pointRadius:5
        }]
      },
      options: {
        scales: {
          x:{ grid:{ borderDash:[4,4] } }
        }
      }
    }
  );
}

/* ─── 7) Daily Defects Trend ─────────────────────────────── */
async function drawTrendChart(ym) {
  const res = await fetch(`${API_BASE}/defects-trend?month=${ym}`);
  if (!res.ok) return;
  const data = await res.json();
  const ctx  = document.getElementById('defectsTrendChart').getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,200);
  grad.addColorStop(0, getCSSVar('--color-accent')+'55');
  grad.addColorStop(1,'rgba(255,255,255,0)');
  trendChart = setChart(
    trendChart,
    ctx,
    {
      type: 'line',
      data: {
        labels: data.map(d=>d.d),
        datasets: [{
          label: 'Defects',
          data: data.map(d=>d.defects),
          borderColor: getCSSVar('--color-accent'),
          backgroundColor: grad,
          tension:0.35,
          fill:true
        }]
      }
    }
  );
}

/* ─── 8) Issue Mix by Month ──────────────────────────────── */
async function drawIssuesOTChart(ym) {
  const res = await fetch(`${API_BASE}/issues-over-time?month=${ym}`);
  if (!res.ok) return;
  const rows = await res.json();
  const labels = [...new Set(rows.map(r=>r.ym))];
  const issues = [...new Set(rows.map(r=>r.issue))];
  const datasets = issues.map((iss,i) => ({
    label: iss,
    data: labels.map(lbl => {
      const rec = rows.find(r=>r.ym===lbl && r.issue===iss);
      return rec ? rec.cnt : 0;
    }),
    backgroundColor: Chart.helpers
      .color(getCSSVar('--color-primary'))
      .alpha(0.2 + 0.1*i)
      .rgbString()
  }));
  issuesOTChart = setChart(
    issuesOTChart,
    document.getElementById('issuesOverTimeChart').getContext('2d'),
    {
      type: 'bar',
      data: { labels, datasets },
      options: {
        scales: {
          x:{ stacked:true },
          y:{ stacked:true, beginAtZero:true }
        }
      }
    }
  );
}

/* ─── 9) Room Uptime Ranking ─────────────────────────────── */
async function drawUptimeChart(ym) {
  const res = await fetch(`${API_BASE}/room-uptime?month=${ym}`);
  if (!res.ok) return;
  const rows = await res.json();
  uptimeChart = setChart(
    uptimeChart,
    document.getElementById('roomUptimeChart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: rows.map(r=>r.RoomID),
        datasets:[{
          data: rows.map(r=>r.uptime_pct),
          borderRadius:6,
          barThickness:10
        }]
      },
      options: {
        indexAxis:'y',
        scales:{
          x:{
            beginAtZero:true,
            max:100,
            ticks:{ callback: v => `${v}%` }
          }
        },
        plugins:{
          tooltip:{
            callbacks:{ label: ctx => `${ctx.parsed.x.toFixed(1)}%` }
          }
        }
      }
    }
  );
}

/* ─── Utility to read CSS vars ───────────────────────────── */
function getCSSVar(name) {
  return getComputedStyle(document.documentElement)
           .getPropertyValue(name)
           .trim();
}
