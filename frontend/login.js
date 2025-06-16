// login.js
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  // grab the message container
  const msg = document.getElementById('loginMsg');

  // use the actual input IDs
  const payload = {
    email: document.getElementById('logEmail').value.trim(),
    pass:  document.getElementById('logPass').value
  };

  try {
    const res = await fetch('../api/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await res.json();

    if (j.success && j.user) {
      sessionStorage.setItem('user', JSON.stringify(j.user));
      window.location.href = 'index.html';
    } else {
      msg.textContent = j.error || 'Login failed';
    }
  } catch (err) {
    msg.textContent = 'Network error';
  }
});
