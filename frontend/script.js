/* global Chart */
const API_BASE = '/api';
let statusChart, checksChart, avgFixChart, defectsRoomChart;
let issuesChart, fixesChart, trendChart, issuesOTChart, uptimeChart;

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
        if (this.view === 'month') {
          t.textContent = this.year;
        } else {
          const start = this._decadeStart();
          t.textContent = `${start} – ${start + 11}`;
        }
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
    if (this.view === 'month') this._months(g);
    else                        this._years(g);
    this.container.append(g);
  }

  _months(grid) {
    const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    labels.forEach((lab,i) => {
      const cell = document.createElement('div');
      const m    = i + 1;
      cell.className = 'grid-item';
      cell.textContent = lab;

      // disable future
      const future = this.year > this.todayYear
                  || (this.year === this.todayYear && m > this.todayMonth);
      if (future) cell.classList.add('disabled');

      // mark selected
      const monthInput = document.getElementById('month-filter');
      if (monthInput) {
        const [sy,sm] = monthInput.value.split('-').map(Number);
        if (sy === this.year && sm === m) {
          cell.classList.add('selected');
        }
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
    for (let y = start; y < start + 12; y++) {
      const cell = document.createElement('div');
      cell.className = 'grid-item';
      cell.textContent = y;

      if (y > this.todayYear) cell.classList.add('disabled');
      if (y === this.year)    cell.classList.add('selected');

      cell.onclick = () => {
        if (y > this.todayYear) return;
        this.year = y;
        this.view = 'month';
        this.render();
      };
      grid.append(cell);
    }
  }

  _decadeStart() {
    return Math.floor(this.year / 10) * 10 - 1;
  }

  _change(delta) {
    if (this.view === 'month') this.year += delta;
    else                        this.year += delta * 12;
    this.render();
  }

  _commit() {
    const val = `${this.year}-${String(this.month).padStart(2,'0')}`;
    this.onChange(val);
    this.render();
  }
}

/* ─── ONCE THE DOM IS READY ────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // — Auth guard —
  const user = JSON.parse(sessionStorage.getItem('user'));
  if (!user) {
    alert('Access denied.');
    return location.href = 'login.html';
  }

  // — Populate avatar with initials (instead of the old .username) —
  const userNameEl  = document.querySelector('.user-name');
  const userEmailEl = document.querySelector('.user-email');
  if (userNameEl)  userNameEl.textContent  = user.name;
  if (userEmailEl) userEmailEl.textContent = user.email;
  const avatarEl = document.querySelector('.avatar');
  if (avatarEl) {
    const initials = user.name
      .split(' ')
      .map(n => n[0]?.toUpperCase() || '')
      .join('')
      .slice(0,2);
    avatarEl.textContent = initials;
  }

  // — Sign-out button —
  const signOut = document.getElementById('signout-btn');
  if (signOut) {
    signOut.addEventListener('click', () => {
      sessionStorage.removeItem('user');
      location.href = 'login.html';
    });
  }

  // — Month picker wiring —
  const monthInput = document.getElementById('month-filter');
  if (monthInput) {
    monthInput.value = new Date().toISOString().slice(0,7);
    const badge = document.getElementById('selected-month-display');
    if (badge) {
      badge.textContent = monthInput.value;
      badge.onclick = () => {
        const toggle = document.getElementById('month-picker-toggle');
        if (toggle) toggle.checked = !toggle.checked;
      };
    }

    new MonthYearPicker(
      document.getElementById('month-picker'),
      val => {
        monthInput.value = val;
        if (badge) badge.textContent = val;
        const toggle = document.getElementById('month-picker-toggle');
        if (toggle) toggle.checked = false;
        refreshDashboard(val);
      },
      monthInput.value
    );

    // — Initial load —
    refreshDashboard(monthInput.value);
  }

  // — Floating clock —
  const updateClock = () => {
    const n = new Date();
    const ft = document.getElementById('floating-time');
    if (!ft) return;
    ft.innerHTML =
      `<span class="time">${n.toLocaleTimeString()}</span>
       <span class="date">${n.toLocaleDateString('en-US',{
         weekday:'long', year:'numeric', month:'long', day:'numeric'
       })}</span>`;
  };
  updateClock();
  setInterval(updateClock, 1000);

  //
  // ─── ORBITNEST-STYLE WIRING ───────────────────────────────
  //

  // 1) Theme toggle
  const themeToggle = document.querySelector('.theme-toggle-btn');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const dark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
      themeToggle.textContent = dark ? '☀️' : '🌙';
    });
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
      themeToggle.textContent = '☀️';
    }
  }

  // 2) Search filter
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('.chart-card').forEach(card => {
        const title = card.querySelector('h4')?.textContent.toLowerCase() || '';
        card.style.display = title.includes(q) ? '' : 'none';
      });
    });
  }

  // 3) Mobile menu toggle
  const menuBtn = document.querySelector('.menu-toggle-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.toggle('open');
    });
  }

  // 4) Notification bell stub
  const bell = document.querySelector('.notifications');
  if (bell) {
    bell.addEventListener('click', () => {
      const count = bell.querySelector('.badge-sm')?.textContent || '0';
      alert(`You have ${count} new notification${count==='1'?'':'s'}.`);
    });
  }
});

/* ─── All your existing refreshDashboard & chart-drawing code below ───────────────────────────────── */
// … same as you had before …
async function refreshDashboard(ym) {
  await loadMetrics(ym);
  await drawChecksOverTime(ym);
  await Promise.all([
    drawAvgFixTime(ym),
    drawDefectsByRoom(ym),
    drawIssuesBreakdown(ym),
    drawFixesOverTime(ym),
    drawDefectsTrend(ym),
    drawIssuesOverTime(ym),
    drawRoomUptime(ym),
  ]);
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'charts-ready' }, '*');
  }
}

async function loadMetrics(ym) {
  const r = await fetch(`${API_BASE}/metrics?month=${ym}`);
  if (!r.ok) return;
  const { totalPCs, workingPCs, defectivePCs, checkedToday } = await r.json();
  ['total','working','defective'].forEach((k,i) =>
    document.getElementById(`${k}-pcs`).textContent = [totalPCs, workingPCs, defectivePCs][i]
  );
  document.getElementById('checked-today').textContent = checkedToday;
  statusChart = setChart(
    statusChart,
    document.getElementById('statusChart').getContext('2d'),
    {
      type:'doughnut',
      data:{
        labels:['Working','Defective'],
        datasets:[{
          data:[workingPCs,defectivePCs],
          backgroundColor:[getCSSVar('--color-primary'),getCSSVar('--color-accent')],
          borderColor: getCSSVar('--color-text')
        }]
      },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom' } }
      }
    }
  );
}

async function drawChecksOverTime(ym) {
  const r = await fetch(`${API_BASE}/checks-over-time?month=${ym}`);
  if (!r.ok) return;
  const d = await r.json();
  checksChart = setChart(
    checksChart,
    document.getElementById('checkChart').getContext('2d'),
    {
      type:'line',
      data:{
        labels:d.map(x=>x.d),
        datasets:[{
          label:'Checked PCs',
          data:d.map(x=>x.cnt),
          borderColor: getCSSVar('--color-primary'),
          backgroundColor: getCSSVar('--color-accent'),
          tension:.3, fill:true
        }]
      },
      options:{ responsive:true, maintainAspectRatio:false }
    }
  );
}

// 3. Average Fix Time
async function drawAvgFixTime(ym) {
  const r = await fetch(`${API_BASE}/avg-fix-time?month=${ym}`);
  if (!r.ok) return;
  const { avgHours=0 } = await r.json();
  avgFixChart = setChart(avgFixChart,
    document.getElementById('avgFixTimeChart').getContext('2d'),
    {
      type:'bar',
      data:{
        labels:['Avg hrs'],
        datasets:[{
          data:[avgHours],
          backgroundColor:getCSSVar('--color-accent'),
          borderColor:getCSSVar('--color-primary')
        }]
      },
      options:{ plugins:{ legend:{ display:false } },
        scales:{ y:{ beginAtZero:true } }, responsive:true
      }
    }
  );
}

// 4. Defects by Room
async function drawDefectsByRoom(ym) {
  const r = await fetch(`${API_BASE}/defects-by-room?month=${ym}`);
  if (!r.ok) return;
  const d = await r.json();
  defectsRoomChart = setChart(defectsRoomChart,
    document.getElementById('defectsByRoomChart').getContext('2d'),
    {
      type:'bar',
      data:{
        labels:d.map(x=>x.RoomID),
        datasets:[{
          data:d.map(x=>x.defects),
          backgroundColor:getCSSVar('--color-primary')
        }]
      },
      options:{ plugins:{ legend:{ display:false } },
        indexAxis:'y', responsive:true
      }
    }
  );
}

// 5. Issues Breakdown
async function drawIssuesBreakdown(ym) {
  const r = await fetch(`${API_BASE}/issues-breakdown?month=${ym}`);
  if (!r.ok) return;
  const d = await r.json();
  const palette = [
    getCSSVar('--color-primary'),
    getCSSVar('--color-accent'),
    '#6c757d','#17a2b8','#28a745','#ffc107'
  ];
  issuesChart = setChart(issuesChart,
    document.getElementById('issuesBreakdownChart').getContext('2d'),
    {
      type:'pie',
      data:{
        labels:d.map(x=>x.issue),
        datasets:[{ data:d.map(x=>x.cnt), backgroundColor:palette }]
      },
      options:{ responsive:true, maintainAspectRatio:false }
    }
  );
}

// 6. Fixes Over Time
async function drawFixesOverTime(ym) {
  const r = await fetch(`${API_BASE}/fixes-over-time?month=${ym}`);
  if (!r.ok) return;
  const d = await r.json();
  fixesChart = setChart(fixesChart,
    document.getElementById('fixesOverTimeChart').getContext('2d'),
    {
      type:'line',
      data:{
        labels:d.map(x=>x.d),
        datasets:[{
          label:'Fixes',
          data:d.map(x=>x.cnt),
          borderColor: getCSSVar('--color-primary'),
          backgroundColor: getCSSVar('--color-accent'),
          tension:.3, fill:false
        }]
      },
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } }
    }
  );
}

// 7. Daily Defects Trend
async function drawDefectsTrend(ym) {
  const r = await fetch(`${API_BASE}/defects-trend?month=${ym}`);
  if (!r.ok) return;
  const d = await r.json();
  trendChart = setChart(trendChart,
    document.getElementById('defectsTrendChart').getContext('2d'),
    {
      type:'line',
      data:{
        labels:d.map(x=>x.d),
        datasets:[{
          label:'Defects',
          data:d.map(x=>x.defects),
          borderColor:getCSSVar('--color-accent'),
          backgroundColor:getCSSVar('--color-primary'),
          tension:.25, fill:true
        }]
      },
      options:{ responsive:true }
    }
  );
}

// 8. Issue Mix by Month
async function drawIssuesOverTime(ym) {
  const r = await fetch(`${API_BASE}/issues-over-time?month=${ym}`);
  if (!r.ok) return;
  const rows = await r.json();
  const labels = [...new Set(rows.map(r=>r.ym))];
  const issues = [...new Set(rows.map(r=>r.issue))];
  const datasets = issues.map((iss,i)=>({
    label: iss,
    data: labels.map(ymv=>{
      const hit = rows.find(r=>r.ym===ymv && r.issue===iss);
      return hit ? hit.cnt : 0;
    }),
    backgroundColor: Chart.helpers.color(getCSSVar('--color-primary'))
      .alpha(0.25 + 0.1*i).rgbString()
  }));
  issuesOTChart = setChart(issuesOTChart,
    document.getElementById('issuesOverTimeChart').getContext('2d'),
    {
      type:'bar',
      data:{ labels, datasets },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom' } },
        scales:{ x:{ stacked:true }, y:{ stacked:true, beginAtZero:true } }
      }
    }
  );
}

// 9. Room Uptime Ranking
async function drawRoomUptime(ym) {
  const r = await fetch(`${API_BASE}/room-uptime?month=${ym}`);
  if (!r.ok) return;
  const d = await r.json();
  uptimeChart = setChart(uptimeChart,
    document.getElementById('roomUptimeChart').getContext('2d'),
    {
      type:'bar',
      data:{
        labels:d.map(x=>x.RoomID),
        datasets:[{ data:d.map(x=>x.uptime_pct), backgroundColor:getCSSVar('--color-accent') }]
      },
      options:{
        indexAxis:'y',
        plugins:{ legend:{ display:false } },
        scales:{ x:{ beginAtZero:true, max:100 } },
        responsive:true
      }
    }
  );
}

function setChart(oldC, ctx, cfg) {
  if (oldC && typeof oldC.destroy === 'function') oldC.destroy();
  return new Chart(ctx, cfg);
}
function getCSSVar(name) {
  return getComputedStyle(document.documentElement)
             .getPropertyValue(name)
             .trim();
}
