/* ───────────────────────────────────────────────────────────────
   export.js – dashboard-to-PDF with Gemini insights (bold aware)
   ─────────────────────────────────────────────────────────────── */
(async () => {

  /* Guard for missing key */
  if (!window.GEMINI_KEY) {
    alert('⚠️ Gemini API key missing – check your .env');
    return;
  }

  /* 1.  DOM refs */
  const btn      = document.getElementById('download-btn');
  const homeBtn  = document.getElementById('home-btn');
  const progWrap = document.getElementById('progress-wrapper');
  const progBar  = document.getElementById('progress-bar');
  const progText = document.getElementById('progress-text');
  const iframe   = document.getElementById('dash-frame');

  /* 2.  All canvas IDs we want in the PDF (old + new) */
  const chartIds = [
    'statusChart',
    'checkChart',
    'avgFixTimeChart',
    'defectsByRoomChart',
    'issuesBreakdownChart',
    'fixesOverTimeChart',
    'defectsTrendChart',      // ← NEW
    'issuesOverTimeChart',    // ← NEW
    'roomUptimeChart'         // ← NEW
  ];

  /* 3. wait until iframe posts “charts-ready” */
  function waitForCharts () {
    return new Promise(res => {
      function handler (e) {
        if (e.data?.type === 'charts-ready') {
          window.removeEventListener('message', handler);
          res();
        }
      }
      window.addEventListener('message', handler);
      iframe.contentWindow.location.reload();
    });
  }

  /* 4.  helper – render **bold** in jsPDF */
  function markdownBold (doc, text, x, y, maxW) {
    const lineH = 14;
    let cx = x, cy = y;

    text.split(/(\*\*[^*]+\*\*)/).forEach(seg => {
      const bold = seg.startsWith('**') && seg.endsWith('**');
      const raw  = bold ? seg.slice(2, -2) : seg;

      raw.split(/\s+/).forEach((w, i, a) => {
        const chunk = (i === a.length-1) ? w : w + ' ';
        const wpx   = doc.getTextWidth(chunk);
        if (cx + wpx > x + maxW) { cx = x; cy += lineH; }
        doc.setFont('Helvetica', bold ? 'bold' : 'normal');
        doc.text(chunk, cx, cy);
        cx += wpx;
      });
    });
    return cy + lineH;
  }

  /* 5.  Main click handler */
  btn.addEventListener('click', async () => {
    progWrap.classList.remove('hidden');
    progBar.style.width  = '0%';
    progText.textContent = 'Loading charts…';

    await waitForCharts();
    progBar.style.width  = '10%';
    progText.textContent = 'Fetching insights…';

    /* Gather chart metadata */
    const payloads = chartIds.map(id => {
      const doc    = iframe.contentWindow.document;
      const canvas = doc.getElementById(id);
      if (!canvas) return null;                          // skip missing
      const chart  = iframe.contentWindow.Chart.getChart(canvas);
      const title  = canvas.closest('.chart-card').querySelector('h4').textContent;

      /* Some charts (stacked bar) may have multiple datasets – flatten */
      const flatVals = chart.data.datasets
        .map(ds => ds.data)
        .flat();

      return { id, title, labels: chart.data.labels, values: flatVals };
    }).filter(Boolean);                                  // remove nulls

    /*  Fetch Gemini insight per chart */
    const insights = [];
    for (let i = 0; i < payloads.length; i++) {
      const { title, labels, values } = payloads[i];

      const prompt =
        `You are **a data-insights analyst**.\n` +
        `Write a concise, formal paragraph analysing the chart "**${title}**".\n` +
        `LABELS: ${JSON.stringify(labels)}\n` +
        `VALUES: ${JSON.stringify(values)}\n` +
        `• ≤150 words\n` +
        `• Use business terms (uptime, defect rate, trend…)\n` +
        `• Wrap key metrics in **double asterisks**\n` +
        `Return ONE plain paragraph.`;

      const resp = await fetch('/api/insights', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ prompt })
      });

      if (!resp.ok) {
        console.error('Insights proxy failed', resp.status, await resp.text());
        alert(`Insights error ${resp.status}`);
        return;
      }

      const { text } = await resp.json();
      insights.push(text || '(no analysis)');
      progBar.style.width =
        `${10 + Math.round((i+1)/payloads.length*40)}%`;
    }

    /*  Build PDF */
    progText.textContent = 'Rendering PDF…';
    const { jsPDF } = window.jspdf;
    const pdf  = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    const W    = pdf.internal.pageSize.getWidth();
    const H    = pdf.internal.pageSize.getHeight();
    const m    = 40;

    for (let i = 0; i < payloads.length; i++) {
      const { id } = payloads[i];
      const canvas = iframe.contentWindow.document.getElementById(id);
      const bmp    = await html2canvas(canvas, { backgroundColor:'#fff', scale:2 });
      const img    = bmp.toDataURL('image/png');
      const r      = Math.min((W-2*m)/bmp.width, (H/2-2*m)/bmp.height);
      const w      = bmp.width*r, h=bmp.height*r;

      pdf.addImage(img, 'PNG', (W-w)/2, m, w, h, '', 'FAST');
      pdf.setFontSize(12);
      markdownBold(pdf, insights[i], m, m + h + 20, W - 2*m);

      if (i < payloads.length - 1) pdf.addPage();
      progBar.style.width =
        `${50 + Math.round((i+1)/payloads.length*50)}%`;
    }

    pdf.save('Inventory_Charts_With_Insights.pdf');
    progText.textContent = 'Done!';
  });

  /* 6. Home */
  homeBtn.addEventListener('click',
    () => window.location.href = 'index.html');
})();
