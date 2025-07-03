// export.js
(async () => {
  // 1️⃣ Check for Gemini key
  if (!window.GEMINI_KEY) {
    alert('⚠️ Gemini API key missing – check your .env');
    return;
  }

  // 2️⃣ DOM refs
  const downloadBtn = document.getElementById('download-btn');
  const homeBtn     = document.getElementById('home-btn');
  const progWrap    = document.getElementById('progress-wrapper');
  const progBar     = document.getElementById('progress-bar');
  const progText    = document.getElementById('progress-text');
  const iframe      = document.getElementById('dash-frame');

  // 3️⃣ The canvas IDs we expect in the dashboard
  const chartIds = [
    'statusChart',
    'checkChart',
    'avgFixTimeChart',
    'defectsByRoomChart',
    'issuesBreakdownChart',
    'fixesOverTimeChart',
    'defectsTrendChart',
    'issuesOverTimeChart',
    'roomUptimeChart'
  ];

  // 4️⃣ Poll until at least one chart canvas exists in iframe
  async function waitForCharts() {
    const TIMEOUT  = 10000; // ms
    const INTERVAL = 200;   // ms
    const start    = Date.now();

    // ensure iframe has loaded
    await new Promise(res => {
      if (iframe.contentWindow.document.readyState === 'complete') {
        return res();
      }
      iframe.onload = () => res();
    });

    // poll for any of our chart canvases
    while (Date.now() - start < TIMEOUT) {
      const doc = iframe.contentWindow.document;
      if (chartIds.some(id => doc.getElementById(id))) {
        return;
      }
      await new Promise(r => setTimeout(r, INTERVAL));
    }
    throw new Error('Timeout waiting for charts to appear');
  }

  // 5️⃣ Helper to render **bold** text in jsPDF
  function markdownBold(doc, text, x, y, maxW) {
    const lineH = 14;
    let cx = x, cy = y;
    text.split(/(\*\*[^*]+\*\*)/).forEach(seg => {
      const isBold = /^\*\*.+\*\*$/.test(seg);
      const raw    = isBold ? seg.slice(2, -2) : seg;
      doc.setFont('Helvetica', isBold ? 'bold' : 'normal');
      raw.split(' ').forEach((w,i,arr) => {
        const chunk = (i === arr.length - 1 ? w : w + ' ');
        const wpx   = doc.getTextWidth(chunk);
        if (cx + wpx > x + maxW) {
          cx = x;
          cy += lineH;
        }
        doc.text(chunk, cx, cy);
        cx += wpx;
      });
    });
    return cy + lineH;
  }

  // 6️⃣ Main export flow
  downloadBtn.addEventListener('click', async () => {
    progWrap.classList.remove('hidden');
    progBar.style.width  = '0%';
    progText.textContent = 'Loading charts…';

    // wait for charts to show up
    try {
      await waitForCharts();
    } catch (err) {
      return alert('⏱️ ' + err.message);
    }
    progBar.style.width  = '10%';
    progText.textContent = 'Fetching insights…';

    // 6a) Extract chart data
    const doc      = iframe.contentWindow.document;
    const payloads = [];

    chartIds.forEach(id => {
      const canvas = doc.getElementById(id);
      if (!canvas) return;

      const chart = iframe.contentWindow.Chart.getChart(canvas);
      if (!chart) return;

      // get title from Chart.js title plugin or fallback to ID
      let title = id;
      const tp   = chart.options?.plugins?.title;
      if (tp) {
        if (typeof tp.text === 'string') title = tp.text;
        else if (Array.isArray(tp.text)) title = tp.text.join(' ');
      }

      const values = chart.data.datasets.flatMap(ds => ds.data);
      payloads.push({ id, title, labels: chart.data.labels, values, canvas });
    });

    if (!payloads.length) {
      return alert('❗️ No charts found to export. Make sure the dashboard has rendered them.');
    }

    // 6b) Fetch Gemini insights
    const insights = [];
    for (let i = 0; i < payloads.length; i++) {
      const { title, labels, values } = payloads[i];
      const prompt = `
You are a data-analytics expert.
Provide one concise, formal paragraph analysis of the chart “${title}”.
DATA:
• LABELS: ${JSON.stringify(labels)}
• VALUES: ${JSON.stringify(values)}
GUIDELINES:
- ≤ 150 words
- Wrap key metrics in **double asterisks**
      `.trim();

      const resp = await fetch('/api/insights', {
        method: 'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!resp.ok) {
        console.error('Insights API error', resp.status);
        return alert(`Insights error: ${resp.status}`);
      }
      const { text } = await resp.json();
      insights.push(text || '(no analysis)');
      progBar.style.width = `${10 + Math.round((i+1)/payloads.length*40)}%`;
    }

    // 6c) Render PDF
    progText.textContent = 'Rendering PDF…';
    const { jsPDF } = window.jspdf;
    const pdf       = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    const W         = pdf.internal.pageSize.getWidth();
    const H         = pdf.internal.pageSize.getHeight();
    const margin    = 40;
    let pageCount   = 0;

    for (let i = 0; i < payloads.length; i++) {
      const { canvas } = payloads[i];
      // pull raw data URL from the chart <canvas>
      const imgData = canvas.toDataURL('image/png');
      const cw      = canvas.width;
      const ch      = canvas.height;
      if (!cw || !ch) {
        console.warn('Skipping zero-dimension canvas:', payloads[i].id);
        continue;
      }

      // compute scale
      const s1 = (W - 2*margin) / cw;
      const s2 = (H/2 - 2*margin) / ch;
      const scale = Math.min(s1, s2);

      const w = cw * scale;
      const h = ch * scale;
      const x = (W - w) / 2;
      const y = margin;

      if (pageCount > 0) pdf.addPage();
      pageCount++;

      pdf.addImage(imgData, 'PNG', x, y, w, h, undefined, 'FAST');

      // draw insight below
      const textY = y + h + 20;
      markdownBold(pdf, insights[i], margin, textY, W - 2*margin);

      progBar.style.width = `${50 + Math.round(pageCount/payloads.length*50)}%`;
    }

    if (pageCount === 0) {
      return alert('❗️ All charts were skipped; PDF would be empty.');
    }

    pdf.save('Inventory_With_Insights.pdf');
    progText.textContent = 'Done!';
  });

  // 7️⃣ Return Home
  homeBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
})();
