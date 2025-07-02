// settings.js
const API_BASE = '../api/';

document.addEventListener('DOMContentLoaded', async () => {
  // 1) Get the minimal session user
  const sessionUser = JSON.parse(sessionStorage.getItem('user'));
  if (!sessionUser || !sessionUser.id) {
    alert('Please sign in first.');
    return location.href = 'login.html';
  }

  // 2) Fetch the complete profile
  let profile;
  try {
    const res = await fetch(`${API_BASE}users/${sessionUser.id}`, {
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(await res.text());
    profile = await res.json();
  } catch (err) {
    console.error('Failed to load profile:', err);
    return alert('Could not load your profile.');
  }

  // 3) Show full name in header
  const usernameSpan = document.querySelector('.username');
  usernameSpan.textContent = `${profile.FirstName} ${profile.LastName}`;

  // 4) Prefill the form
  document.getElementById('firstName').value = profile.FirstName;
  document.getElementById('lastName').value  = profile.LastName;
  document.getElementById('email').value     = profile.Email;
  document.getElementById('contactNo').value = profile.ContactNo || '';

  // 5) Handle Cancel – reset to fresh profile values
  document.getElementById('cancelBtn').addEventListener('click', () => {
    document.getElementById('firstName').value = profile.FirstName;
    document.getElementById('lastName').value  = profile.LastName;
    document.getElementById('email').value     = profile.Email;
    document.getElementById('contactNo').value = profile.ContactNo || '';
  });
  document.getElementById('signOutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('user');
  location.href = 'login.html';
});


  // 6) Handle Save – PUT back to API then update sessionStorage
  document.getElementById('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const updated = {
      FirstName: document.getElementById('firstName').value.trim(),
      LastName : document.getElementById('lastName').value.trim(),
      Email    : document.getElementById('email').value.trim(),
      ContactNo: document.getElementById('contactNo').value.trim(),
    };

    try {
      const res = await fetch(`${API_BASE}users/${sessionUser.id}`, {
        method:      'PUT',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(updated),
      });
      if (!res.ok) throw new Error(await res.text());

      // 7) Reflect changes in sessionStorage
      sessionUser.name      = `${updated.FirstName} ${updated.LastName}`;
      sessionUser.email     = updated.Email;
      sessionUser.contactNo = updated.ContactNo;
      sessionStorage.setItem('user', JSON.stringify(sessionUser));

      // 8) Update UI
      usernameSpan.textContent = sessionUser.name;
      alert('Profile updated successfully.');
    } catch (err) {
      console.error('Save profile error:', err);
      alert('Error saving profile:\n' + err.message);
    }
  });
});
