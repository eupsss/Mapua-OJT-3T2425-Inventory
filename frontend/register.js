/* register.js – Mapúa Inventory  */
document.addEventListener('DOMContentLoaded', () => {

  /* ─── grab elements that really exist on register.html ─── */
  const form   = document.getElementById('regForm');
  const msgBox = document.getElementById('regMsg');
  if (!form || !msgBox) {
    console.error('Registration form or message box not found');
    return;                                   // abort early → no error
  }

  const btn       = form.querySelector('button[type="submit"]');
  const API_BASE  = '../api';                 // adjust if path differs

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgBox.textContent = '';

    /* collect input values */
    const fname = document.getElementById('fname').value.trim();
    const lname = document.getElementById('lname').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const pass  = document.getElementById('pass').value;

    if (!fname || !lname || !email || !pass) {
      msgBox.textContent = 'Please fill in all required fields.';
      return;
    }

    /* lock UI */
    btn.disabled = true; btn.textContent = 'Registering…';

    try {
      const res  = await fetch(`${API_BASE}/register.php`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ fname, lname, email, phone, pass })
      });
      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      /* success – inform the user or redirect */
      msgBox.textContent = 'Account created! You may now sign in.';
      form.reset();

    } catch (err) {
      console.error(err);
      msgBox.textContent = err.message === 'Failed to fetch'
        ? 'Network error – is the API running?'
        : err.message;
    } finally {
      btn.disabled = false; btn.textContent = 'Register';
    }
  });
});
