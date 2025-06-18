/* login.js – Mapúa Inventory */
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.getElementById('loginForm');
  const msgBox = document.getElementById('loginMsg');
  const btn    = form.querySelector('button[type="submit"]');

  /* relative path → api/ */
  const API_BASE = '../api';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgBox.textContent = '';                         // clear

    const email = document.getElementById('logEmail').value.trim();
    const pass  = document.getElementById('logPass').value;

    if (!email || !pass) {
      return (msgBox.textContent = 'Both fields are required.');
    }

    /* lock UI */
    btn.disabled = true; btn.textContent = 'Signing in…';

    try {
      const res  = await fetch(`${API_BASE}/login.php`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email, pass })
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      /* success → store + go to dashboard */
      sessionStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = 'index.html';

    } catch (err) {
      console.error(err);
      msgBox.textContent = err.message === 'Failed to fetch'
        ? 'Network error – is the API running?'
        : err.message;
      btn.disabled = false; btn.textContent = 'Login';
    }
  });
});
