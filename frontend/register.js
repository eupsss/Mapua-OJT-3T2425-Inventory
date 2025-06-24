// register.js – Mapúa Inventory
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.getElementById('regForm');
  const msgBox = document.getElementById('regMsg');
  if (!form || !msgBox) return console.error('Form or message box not found');

  const btn      = form.querySelector('button[type="submit"]');
  const API_BASE = '/api';                // ← absolute path into your Express API

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msgBox.textContent = '';

    const fname = form.fname.value.trim();
    const lname = form.lname.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const pass  = form.pass.value;

    if (!fname || !lname || !email || !pass) {
      msgBox.textContent = 'Please fill in all required fields.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Registering…';

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fname, lname, email, phone, pass })
      });
      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      msgBox.textContent = 'Account created! You may now sign in.';
      form.reset();

    } catch (err) {
      console.error(err);
      msgBox.textContent = err.message === 'Failed to fetch'
        ? 'Network error – is the API running?'
        : err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Register';
    }
  });
});
  