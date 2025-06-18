/* ────────────────────────────────
   dashboard script.js  — single-file version
──────────────────────────────────*/

/* hold chart instances so we can .destroy() them before redraw */
let statusChart = null;
let checksChart = null;
let avgFixChart = null;
let defectsRoomChart = null;
let issuesChart = null;
let fixesChart = null;
Chart.defaults.plugins.legend.labels.boxWidth  = 14;
Chart.defaults.plugins.legend.labels.boxHeight = 10;

/* wait for DOM */
document.addEventListener('DOMContentLoaded', () => {
  /* 0. guard + username */
  
  const user = JSON.parse(sessionStorage.getItem('user'));
  if (!user) {
    alert('Access denied. Please login first.');
    return location.href = 'login.html';
  }
  document.querySelector('.username').textContent = user.name;

  /* 1. theme colours */
  const css          = getComputedStyle(document.documentElement);
  const colorPrimary = css.getPropertyValue('--color-primary').trim();
  const colorAccent  = css.getPropertyValue('--color-accent').trim();
  const colorText    = css.getPropertyValue('--color-text').trim();

  /* 2. DOM refs */
  const dateInput  = document.querySelector('#date-filter');
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

  /* helper to destroy + create */
  function setChart (oldChartRef, ctx, cfg) {
    if (oldChartRef) oldChartRef.destroy();
    return new Chart(ctx, cfg);
  }

  /* 3. KPI + two core charts */
  async function loadMetrics () {
    let totalPCs=0, workingPCs=0, defectivePCs=0, checkedToday=0;
    try {
      const res = await fetch('../api/metrics.php');
      if (!res.ok) throw new Error(res.status);
      ({ totalPCs, workingPCs, defectivePCs, checkedToday } = await res.json());
    } catch(err) { console.error('metrics', err); }

    totalEl.textContent = totalPCs;
    workEl .textContent = workingPCs;
    defEl  .textContent = defectivePCs;
    todayEl.textContent = checkedToday;

    /* doughnut */
    statusChart = setChart(statusChart, statusCtx, {
      type:'doughnut',
      data:{ labels:['Working','Defective'], datasets:[{ data:[workingPCs,defectivePCs], backgroundColor:[colorPrimary,colorAccent], borderColor:colorText }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom'} }}
    });

    /* line checks */
    const labels = [...Array(7)].map((_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i));
      return d.toLocaleDateString();
    });
    checksChart=setChart(checksChart,checkCtx,{
      type:'line',
      data:{ labels, datasets:[{ label:'Checked PCs', data:Array(7).fill(checkedToday), borderColor:colorPrimary, backgroundColor:colorAccent, tension:0.3, fill:true }]},
      options:{ responsive:true, maintainAspectRatio:false }
    });
  }

  /* 4. additional charts (use real data when API ready) */
  async function drawAvgFixTime(){
    try{
      const { avgHours }=await (await fetch('../api/avg-fix-time.php')).json();
      avgFixChart=setChart(avgFixChart,avgFixCtx,{type:'bar',data:{labels:['Avg hrs'],datasets:[{data:[avgHours||0],backgroundColor:colorAccent,borderColor:colorPrimary}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
    }catch(e){console.error('avg fix',e);} }

  async function drawDefectsByRoom(){
    try{ const data=await (await fetch('../api/defects-by-room.php')).json();
      defectsRoomChart=setChart(defectsRoomChart,roomCtx,{type:'bar',data:{labels:data.map(r=>r.RoomID),datasets:[{data:data.map(r=>r.defects),backgroundColor:colorPrimary}]},options:{plugins:{legend:{display:false}},indexAxis:'y'}});
    }catch(e){console.error('room',e);} }

  async function drawIssuesBreakdown(){
    try{ const data=await (await fetch('../api/issues-breakdown.php')).json();
      issuesChart=setChart(issuesChart,issuesCtx,{type:'pie',data:{labels:data.map(i=>i.issue),datasets:[{data:data.map(i=>i.cnt),backgroundColor:[colorPrimary,colorAccent,'#6c757d','#17a2b8','#28a745']}]}});
    }catch(e){console.error('issues',e);} }

  async function drawFixesOverTime(){
    try{ const data=await (await fetch('../api/fixes-over-time.php')).json();
      fixesChart=setChart(fixesChart,fixesCtx,{type:'line',data:{labels:data.map(r=>r.d),datasets:[{label:'Fixes',data:data.map(r=>r.cnt),borderColor:colorPrimary,backgroundColor:colorAccent,tension:0.3,fill:false}]},options:{plugins:{legend:{position:'bottom'}}}});
    }catch(e){console.error('fixes',e);} }

  /* 5. clock 24-hour */
  function updateClock(){
    const n=new Date();
    const hh=String(n.getHours()).padStart(2,'0');
    const mm=String(n.getMinutes()).padStart(2,'0');
    const ss=String(n.getSeconds()).padStart(2,'0');
    document.getElementById('floating-time').innerHTML=`<span class="time">${hh}:${mm}:${ss}</span><span class="date">${n.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>`;
  }

  /* 6. bootstrap */
  (async () => {
    const today = new Date().toISOString().slice(0, 10);
    dateInput.value = today;

    await loadMetrics();
    await Promise.all([
      drawAvgFixTime(),
      drawDefectsByRoom(),
      drawIssuesBreakdown(),
      drawFixesOverTime()
    ]);

    updateClock();
    setInterval(updateClock, 1000);

    /* ✉️ tell any parent window we’re ready */
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'charts-ready' }, '*');
    }
  })();


});