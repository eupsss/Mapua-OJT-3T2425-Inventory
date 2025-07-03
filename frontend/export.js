// export.js
(async () => {
  // 1️⃣ Ensure we have a Gemini key
  if (!window.GEMINI_KEY) {
    alert('⚠️ Gemini API key missing – check your .env');
    return;
  }

  // 2️⃣ Grab DOM references
  const downloadBtn = document.getElementById('download-btn');
  const homeBtn     = document.getElementById('home-btn');
  const progWrap    = document.getElementById('progress-wrapper');
  const progBar     = document.getElementById('progress-bar');
  const progText    = document.getElementById('progress-text');
  const iframe      = document.getElementById('dash-frame');

  // 3️⃣ IDs of the canvas elements we expect
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

  // 4️⃣ Poll until at least one canvas is in the iframe (or timeout)
  async function waitForCharts() {
    const TIMEOUT  = 10000;  // ms
    const INTERVAL = 200;    // ms
    const start    = Date.now();

    // Wait for initial iframe load
    await new Promise(resolve => {
      if (iframe.contentWindow.document.readyState === 'complete') {
        return resolve();
      }
      iframe.onload = () => resolve();
    });

    // Poll for any of our chart canvases
    while (Date.now() - start < TIMEOUT) {
      const doc = iframe.contentWindow.document;
      if (chartIds.some(id => doc.getElementById(id))) {
        return;
      }
      await new Promise(r => setTimeout(r, INTERVAL));
    }
    throw new Error('Timeout waiting for charts to appear in iframe');
  }

  // 5️⃣ Helper to print markdown **bold** in jsPDF
  function markdownBold(doc, text, x, y, maxW) {
    const lineH = 14;
    let cx = x, cy = y;
    text.split(/(\*\*[^*]+\*\*)/).forEach(seg => {
      const bold = /^\*\*.+\*\*$/.test(seg);
      const raw  = bold ? seg.slice(2, -2) : seg;
      doc.setFont('Helvetica', bold ? 'bold' : 'normal');
      raw.split(' ').forEach((w, i, arr) => {
        const chunk = i === arr.length - 1 ? w : w + ' ';
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

  // 6️⃣ Main export logic
  downloadBtn.addEventListener('click', async () => {
    progWrap.classList.remove('hidden');
    progBar.style.width  = '0%';
    progText.textContent = 'Loading charts…';

    // 6a) Wait for charts to render in the iframe
    try {
      await waitForCharts();
    } catch (err) {
      return alert('⏱️ ' + err.message);
    }
    progBar.style.width  = '10%';
    progText.textContent = 'Fetching insights…';

    // 6b) Extract chart data & titles
    const doc      = iframe.contentWindow.document;
    const payloads = [];

    chartIds.forEach(id => {
      const canvas = doc.getElementById(id);
      if (!canvas) return;

      const chart = iframe.contentWindow.Chart.getChart(canvas);
      if (!chart) return;

      // Determine title from Chart.js title plugin or fallback to ID
      let title = id;
      const tp   = chart.options?.plugins?.title;
      if (tp) {
        if (typeof tp.text === 'string') title = tp.text;
        else if (Array.isArray(tp.text)) title = tp.text.join(' ');
      }

      const values = chart.data.datasets.flatMap(ds => ds.data);
      payloads.push({ id, title, labels: chart.data.labels, values });
    });

    if (!payloads.length) {
      return alert('❗️ No charts found to export. Make sure they have rendered.');
    }

    // 6c) Fetch Gemini insights for each chart
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

    // 6d) Build the PDF
    progText.textContent = 'Rendering PDF…';
    const { jsPDF } = window.jspdf;
    const pdf       = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    const W         = pdf.internal.pageSize.getWidth();
    const H         = pdf.internal.pageSize.getHeight();
    const margin    = 40;
    let addedPages  = 0;

    for (let i = 0; i < payloads.length; i++) {
      const { id } = payloads[i];
      const canvas = doc.getElementById(id);
      if (!canvas) {
        console.warn('Skipping missing canvas for', id);
        continue;
      }

      // Render to an offscreen bitmap
      const bmp = await html2canvas(canvas, { backgroundColor:'#fff', scale:2 });
      if (!bmp.width || !bmp.height) {
        console.warn('Skipping zero-size chart for', id);
        continue;
      }

      // Compute a safe scale (never zero)
      const s1 = (W - 2*margin) / bmp.width;
      const s2 = (H/2 - 2*margin) / bmp.height;
      const scale = Math.max(0.01, Math.min(s1, s2));

      const w = bmp.width * scale;
      const h = bmp.height * scale;
      const x = Math.max(margin, (W - w)/2);
      const y = margin;

      // Only add a new page after the first
      if (addedPages > 0) pdf.addPage();

      try {
        pdf.addImage(bmp.toDataURL('image/png'), 'PNG', x, y, w, h, undefined, 'FAST');
      } catch (err) {
        console.error('Error adding image for', id, err);
        continue;
      }

      // Draw insight text below
      const textY = y + h + 20;
      markdownBold(pdf, insights[i], margin, textY, W - 2*margin);

      addedPages++;
      progBar.style.width = `${50 + Math.round(addedPages/payloads.length*50)}%`;
    }

    if (addedPages === 0) {
      return alert('❗️ All charts were skipped; PDF is empty.');
    }

    pdf.save('Inventory_With_Insights.pdf');
    progText.textContent = 'Done!';
  });

  // 7️⃣ Navigate back home
  homeBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
})();
