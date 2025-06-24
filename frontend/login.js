/* login.js – Mapúa Inventory */
document.addEventListener('DOMContentLoaded', () => {
  const form       = document.getElementById('loginForm');
  const msgBox     = document.getElementById('loginMsg');
  const btn        = form.querySelector('button[type="submit"]');

  // Point this at your Express route, not the old PHP file
  const API_ENDPOINT = '/api/login';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgBox.textContent = '';

    const emailInput = document.getElementById('logEmail');
    const passInput  = document.getElementById('logPass');
    const email      = emailInput.value.trim();
    const pass       = passInput.value;

    if (!email || !pass) {
      return msgBox.textContent = 'Both fields are required.';
    }

    // Lock UI
    btn.disabled     = true;
    const originalText = btn.textContent;
    btn.textContent  = 'Signing in…';

    try {
      const res = await fetch(API_ENDPOINT, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',                     // allow session cookie
        body:        JSON.stringify({ email, pass })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error (${res.status}): ${errText}`);
      }

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Unexpected response format from server.');
      }

      if (!data.success) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      sessionStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = 'index.html';

    } catch (err) {
      console.error(err);
      msgBox.textContent = err.message.includes('Failed to fetch')
        ? 'Network error – is the API running?'
        : err.message;
    } finally {
      btn.disabled    = false;
      btn.textContent = originalText;
    }
  });
});
