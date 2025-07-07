/*  export-sql.js  –  attach once and forget  */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('export-sql-btn');
  if (!btn) return;                  // no button on this page

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Downloading…';

    try {
      /*  Hit the protected API endpoint.
          If you send a JWT or session cookie, no extra headers are needed. */
      const res = await fetch('/api/exportSQL/export-computer-assets-sql');

      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      /*  Stream → Blob → fake <a> → click → save  */
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'computer_assets_126rows_insert.sql';
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed:\n${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = '⬇ Export SQL';
    }
  });
});
