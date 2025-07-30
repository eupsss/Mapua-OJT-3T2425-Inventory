/* ─── Global Chart.js Defaults ───────────────────────────────── */
/* global Chart */
const API_BASE = '/api';
let statusChart, checksChart, avgFixChart, defectsRoomChart;
let issuesChart, fixesChart, trendChart, issuesOTChart, uptimeChart;

// 1) Typography & Layout (Keep as is)
Chart.defaults.font.family        = "'Inter','Helvetica Neue','Arial',sans-serif";
Chart.defaults.font.size          = 12;
Chart.defaults.color              = "#444";
Chart.defaults.layout.padding     = 16;

// 2) Grid & Axes (Keep as is)
Chart.defaults.scale.grid.color      = "rgba(0,0,0,0.05)";
Chart.defaults.scale.grid.lineWidth  = 1;
Chart.defaults.scale.ticks.color     = "#666";
Chart.defaults.scale.ticks.backdropColor = "transparent";

// 3) Legend & Tooltip (Keep as is)
Chart.defaults.plugins.legend.position       = "bottom";
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.tooltip.padding      = 10;
Chart.defaults.plugins.tooltip.titleFont    = { weight: "600", size: 14 };
Chart.defaults.plugins.tooltip.bodyFont     = { size: 13 };

// 4) Animation & Responsiveness (Keep as is)
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
    // ... (Keep your MonthYearPicker class as is) ...
    constructor(container, onChange, initial) {
        this.container  = container;
        this.onChange   = onChange;
        const [y,m]    = initial.split('-').map(Number);
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


/* ─── GLOBAL DOM READY & APP BOOTSTRAP ───────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    // --- Auth guard ---
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) {
        alert('Access denied.');
        return location.href = 'login.html';
    }

    // --- Populate username & avatar initials ---
    const userNameEl = document.querySelector('.user-name');
    if (userNameEl) {
        const parts = user.name.trim().split(' ');
        userNameEl.textContent = "Hi, " + parts[0] + "!";
    }
    const avatarEls = document.querySelectorAll('.avatar');
    avatarEls.forEach(el => {
        const initials = user.name
            .split(' ')
            .map(n => n[0]?.toUpperCase()||'')
            .join('').slice(0,2);
        el.textContent = initials;
    });

    // --- Sign-out button ---
    const signOut = document.getElementById('signout-btn');
    if (signOut) {
        signOut.addEventListener('click', () => {
            sessionStorage.removeItem('user');
            location.href = 'login.html';
        });
    }

    // --- Floating clock ---
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

    // --- Theme toggle (optional) ---
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

    // --- Search filter (optional) ---
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            const q = e.target.value.trim().toLowerCase();
            // This search is for chart cards. For RFID, you'd need a different one.
            // It will only apply if .chart-card elements are present.
            document.querySelectorAll('.chart-card').forEach(card => {
                const title = card.querySelector('h4')?.textContent.toLowerCase()||'';
                card.style.display = title.includes(q) ? '' : 'none';
            });
        });
    }

    // --- Mobile menu toggle (optional) ---
    const menuBtn = document.querySelector('.menu-toggle-btn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.classList.toggle('open');
        });
    }

    // --- Notification bell stub (optional) ---
    const bell = document.querySelector('.notifications');
    if (bell) {
        bell.addEventListener('click', () => {
            const count = bell.querySelector('.badge-sm')?.textContent || '0';
            alert(`You have ${count} new notification${count==='1'?'':'s'}.`);
        });
    }

    // --- Export PDF button ---
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            // This will only work if month-filter exists (i.e., on dashboard page)
            const month = document.getElementById('month-filter')?.value || '';
            window.open(`export.html?month=${encodeURIComponent(month)}`, '_blank');
        });
    }

    // --- HIGHLIGHT ACTIVE SIDEBAR LINK BASED ON CURRENT PAGE ---
    const currentPage = window.location.pathname.split('/').pop(); // e.g., "index.html" or "rfid.html"
    document.querySelectorAll('.sidebar-nav ul li').forEach(li => {
        li.classList.remove('active'); // Clear all active states first
        const link = li.querySelector('a');
        if (link && link.getAttribute('href') === currentPage) {
            li.classList.add('active'); // Add active to the matching link
        }
        // Special case for index.html if you want it to be "dashboard.html" in link
        if (currentPage === 'index.html' && link && link.getAttribute('href') === 'index.html') {
             li.classList.add('active');
        }
    });


    // --- PAGE-SPECIFIC INITIALIZATION ---
    // This is where we call different functions based on the current page.
    if (currentPage === 'index.html') { // Or 'dashboard.html' if that's what your link points to
        initializeDashboardScripts();
    } else if (currentPage === 'rfid.html') {
        initializeRfidPageScripts();
    }
    // Add more 'else if' blocks for other pages as needed:
    // else if (currentPage === 'rooms.html') {
    //     initializeRoomsPageScripts(); // You'd create this function for rooms.html
    // }
});


/* ─── DASHBOARD-SPECIFIC INITIALIZATION ───────────────────── */
// This function will only run when index.html (your dashboard) loads.
function initializeDashboardScripts() {
    console.log("Dashboard Module: Initializing page-specific scripts...");
    // Month-picker wiring
    const monthInput = document.getElementById('month-filter');
    if (monthInput) {
        if (!monthInput.value) { // Initialize if not already set
          monthInput.value = new Date().toISOString().slice(0,7);
        }

        const badge = document.getElementById('selected-month-display');
        if (badge) {
            badge.textContent = monthInput.value;
            badge.onclick = () => { // Using onclick to replace previous handler
                const toggle = document.getElementById('month-picker-toggle');
                if (toggle) toggle.checked = !toggle.checked;
            };
        }

        const pickerContainer = document.getElementById('month-picker');
        if (pickerContainer) {
            new MonthYearPicker( // Re-instantiate MonthYearPicker for this page
                pickerContainer,
                val => {
                    monthInput.value = val;
                    if (badge) badge.textContent = val;
                    const toggle = document.getElementById('month-picker-toggle');
                    if (toggle) toggle.checked = false;
                    refreshDashboard(val); // Re-run dashboard refresh with new month
                },
                monthInput.value
            );
        }
        refreshDashboard(monthInput.value); // Initial load of dashboard data
    }
}


/* ─── DASHBOARD REFRESH & CHART DRAWERS ───────────────────── */
async function refreshDashboard(ym) {
    // ... (Keep your existing refreshDashboard function as is) ...
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
    // ... (Keep your drawStatusChart function as is) ...
    const res = await fetch(`${API_BASE}/metrics?month=${ym}`);
    if (!res.ok) return;
    const { workingPCs, defectivePCs, totalPCs } = await res.json();

    statusChart = setChart(
        statusChart,
        document.getElementById('statusChart').getContext('2d'),
        {
            type: 'doughnut',
            data: {
                labels: ['Working','Defective'],
                datasets: [{
                    data: [workingPCs, defectivePCs],
                    backgroundColor: [
                        getCSSVar('--color-primary'),
                        getCSSVar('--color-accent')
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                cutout: '60%',          // smaller hole
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        align: 'center',
                        labels: { boxWidth: 12, padding: 16 }
                    },
                    tooltip: {
                        padding: 8,
                        callbacks: {
                            label(ctx) {
                                const c = ctx.parsed;
                                const p = ((c/totalPCs)*100).toFixed(1);
                                return `${ctx.label}: ${c} PCs (${p}%)`;
                            }
                        }
                    }
                }
            },
            plugins: [
                {
                    id: 'center-text',
                    beforeDraw(chart) {
                        const { ctx, chartArea: { left, right, top, bottom } } = chart;
                        ctx.save();
                        const centerX = (left + right) / 2;
                        const centerY = (top + bottom) / 2;
                        const diameter = right - left;
                        const fontSize = Math.floor(diameter * 0.1);
                        ctx.font         = `${fontSize}px sans-serif`;
                        ctx.fillStyle    = getCSSVar('--color-text');
                        ctx.textAlign    = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('', centerX, centerY - fontSize * 0.3);
                        ctx.fillText(totalPCs, centerX, centerY  * 1.0);
                        ctx.restore();
                    }
                }
            ]
        }
    );
}


/* ─── 2) Checks Over Time ─────────────────────────────────── */
async function drawChecksChart(ym) {
    // ... (Keep your drawChecksChart function as is) ...
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
    // ... (Keep your drawAvgFixChart function as is) ...
    try {
        // 1) fetch & parse
        const res = await fetch(`${API_BASE}/avg-fix-time?month=${ym}`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const payload = await res.json();
        console.log('avg-fix-time payload:', payload);

        // 2) coerce to Number
        const avgH = Number(payload.avgHours);
        const avgHours = isNaN(avgH) ? 0 : avgH;

        // 3) grab the canvas & guard
        const canvas = document.getElementById('avgFixTimeChart');
        if (!canvas) {
            console.warn('avgFixTimeChart <canvas> not found');
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn('Could not getContext on avgFixTimeChart');
            return;
        }

        // 4) draw the chart, telling Chart.js how tall to go
        avgFixChart = setChart(
            avgFixChart,
            ctx,
            {
                type: 'bar',
                data: {
                    labels: ['Avg hrs'],
                    datasets: [{
                        data: [avgHours],
                        borderRadius: 8,
                        borderWidth: 1,
                        // optional: color‐threshold in place of onResize
                        backgroundColor: avgHours < 1
                            ? getCSSVar('--color-primary')
                            : getCSSVar('--color-accent')
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${ctx.parsed.y.toFixed(2)} hrs`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            // ensure the bar is fully visible
                            suggestedMax: Math.ceil(avgHours)
                        }
                    }
                }
            }
        );
    } catch (err) {
        console.error('❌ drawAvgFixChart error:', err);
    }
}

/* ─── 4) Defects by Room ─────────────────────────────────── */
async function drawDefectsRoomChart(ym) {
    // ... (Keep your drawDefectsRoomChart function as is) ...
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
    // ... (Keep your drawIssuesBreakdownChart function as is) ...
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
    // ... (Keep your drawFixesChart function as is) ...
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
    // ... (Keep your drawTrendChart function as is) ...
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
    // ... (Keep your drawIssuesOTChart function as is) ...
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
    // ... (Keep your drawUptimeChart function as is) ...
    const res = await fetch(`${API_BASE}/room-uptime?month=${ym}`);
    if (!res.ok) return;
    const rows = await res.json();

    uptimeChart = setChart(
        uptimeChart,
        document.getElementById('roomUptimeChart').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels: rows.map(r => r.RoomID),
                datasets: [{
                    label: 'Uptime %',          // give it a real label
                    data: rows.map(r => r.uptime_pct),
                    backgroundColor: getCSSVar('--color-primary'),
                    borderRadius: 6,
                    barThickness: 10
                }]
            },
            options: {
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: v => v + '%'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.parsed.x.toFixed(1)}%`
                        }
                    }
                }
            }
        }
    );
}


/* ─── RFID-SPECIFIC INITIALIZATION ───────────────────────── */
// This function will only run when rfid.html loads.
let rfidLogs = []; // Initialize globally so data persists if page is revisited (though full refresh clears)
let rfidStudents = {
    'STU001': { name: 'John Doe', scans: 0, lastScan: null },
    'STU002': { name: 'Jane Smith', scans: 0, lastScan: null },
    'STU003': { name: 'Robert Johnson', scans: 0, lastScan: null }
};

function initializeRfidPageScripts() {
    console.log("RFID Module: Initializing page-specific scripts...");

    // INTERNAL TAB FUNCTIONALITY FOR RFID MODULE (Scan, Logs, Reports)
    // Ensure this listener is re-attached if elements are dynamically loaded,
    // but since we're using full page loads, attaching in this init is fine.
    document.querySelectorAll('#rfid-internal-tab-nav .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#rfid-internal-tab-nav .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.rfid-main-module .tab-content').forEach(tab => tab.classList.remove('active'));

            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Mock RFID scan simulation
    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('student-name');
            const idInput = document.getElementById('student-id');

            if (!nameInput || !nameInput.value || !idInput || !idInput.value) {
                alert('Please enter both student name and ID');
                return;
            }
            simulateRFIDScan(nameInput.value, idInput.value);
        });
    }

    const manualBtn = document.getElementById('manual-btn');
    if (manualBtn) {
        manualBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('student-name');
            const idInput = document.getElementById('student-id');

            if (!nameInput || !nameInput.value || !idInput || !idInput.value) {
                alert('Please enter both student name and ID');
                return;
            }
            addLogEntry(nameInput.value, idInput.value);
            clearInputs();
        });
    }

    function simulateRFIDScan(name, id) {
        const statusElement = document.getElementById('rfid-status');
        if (!statusElement) return;
        statusElement.innerHTML = '<span class="text-blue-600">Scanning RFID card...</span>';

        setTimeout(() => {
            statusElement.innerHTML = '<span class="text-green-600">RFID scan successful!</span>';

            addLogEntry(name, id);
            clearInputs();

            setTimeout(() => {
                statusElement.innerHTML = '<span class="text-gray-600">Ready to scan</span>';
            }, 2000);
        }, 1500);
    }

    function addLogEntry(name, id) {
        const timestamp = new Date();
        if (!rfidStudents[id]) {
            rfidStudents[id] = { name, scans: 0, lastScan: null };
        }
        rfidStudents[id].scans++;
        rfidStudents[id].lastScan = timestamp;

        rfidLogs.unshift({
            timestamp: timestamp.toISOString(),
            name,
            id,
            status: 'Present'
        });

        updateStudentDB();
        refreshLogsDisplay();
    }

    function updateStudentDB() {
        const container = document.getElementById('student-db');
        if (!container) return;
        container.innerHTML = '';

        for (const [id, student] of Object.entries(rfidStudents)) {
            const row = document.createElement('tr');
            row.className = 'student-entry';

            row.innerHTML = `
                <td class="py-2 px-4 border-b">${id}</td>
                <td class="py-2 px-4 border-b">${student.name}</td>
                <td class="py-2 px-4 border-b">${student.lastScan ? new Date(student.lastScan).toLocaleString() : '-'}</td>
                <td class="py-2 px-4 border-b">${student.scans}</td>
            `;
            container.appendChild(row);
        }
    }

    function clearInputs() {
        const studentNameInput = document.getElementById('student-name');
        const studentIdInput = document.getElementById('student-id');
        if (studentNameInput) studentNameInput.value = '';
        if (studentIdInput) studentIdInput.value = '';
    }

    function refreshLogsDisplay() {
        const container = document.getElementById('logs-container');
        if (!container) return;
        container.innerHTML = '';

        rfidLogs.forEach(log => {
            const row = document.createElement('tr');
            row.className = 'log-entry';

            const formattedDate = new Date(log.timestamp).toLocaleString();

            row.innerHTML = `
                <td class="py-2 px-4 border-b">${formattedDate}</td>
                <td class="py-2 px-4 border-b">${log.id}</td>
                <td class="py-2 px-4 border-b">${log.name}</td>
                <td class="py-2 px-4 border-b">
                    <span class="inline-block px-2 py-1 rounded-full ${log.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${log.status}
                    </span>
                </td>
            `;
            container.appendChild(row);
        });
    }

    // Export logs to CSV
    const exportLogsBtn = document.getElementById('export-logs');
    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', () => {
            if (rfidLogs.length === 0) {
                alert('No logs to export');
                return;
            }

            let csv = 'Timestamp,Student ID,Student Name,Status\n';
            rfidLogs.forEach(log => {
                csv += `"${new Date(log.timestamp).toLocaleString()}","${log.id}","${log.name}","${log.status}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rfid_logs_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Refresh logs button
    const refreshLogsBtn = document.getElementById('refresh-logs');
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', refreshLogsDisplay);
    }

    // Initialize with some sample data (for demo)
    // Ensure this only runs once per page load to not duplicate data on button clicks
    // It's already conditional on rfidLogs.length === 0 so it's fine.
    if (rfidLogs.length === 0) {
        rfidLogs = [
            { timestamp: '2023-05-15T09:30:00Z', name: 'John Doe', id: 'STU001', status: 'Present' },
            { timestamp: '2023-05-15T10:15:00Z', name: 'Jane Smith', id: 'STU002', status: 'Present' },
            { timestamp: '2023-05-15T11:20:00Z', name: 'Robert Johnson', id: 'STU003', status: 'Present' }
        ];
    }

    refreshLogsDisplay();
    updateStudentDB();
}


/* ─── Utility to read CSS vars ───────────────────────────── */
function getCSSVar(name) {
  return getComputedStyle(document.documentElement)
           .getPropertyValue(name)
           .trim();
}