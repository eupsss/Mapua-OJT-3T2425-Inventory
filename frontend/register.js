document.getElementById('regForm').addEventListener('submit', async e => {
  e.preventDefault();

  /* 🟢  grab the feedback element */
  const msg = document.getElementById('regMsg');

  const payload = {
    fname: document.getElementById('fname').value.trim(),
    lname: document.getElementById('lname').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    pass : document.getElementById('pass').value,
    role : 'Viewer'          // hard-wired
  };

  try {
    const res = await fetch('../api/register.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await res.json();

    if (j.success) {
      msg.style.color = 'green';
      msg.textContent = 'Registered! Redirecting…';
      setTimeout(() => location.href = 'login.html', 1500);
    } else {
      msg.style.color = 'red';
      msg.textContent = j.error || 'Registration failed';
    }
  } catch (err) {
    msg.style.color = 'red';
    msg.textContent = 'Network error';
  }
});
