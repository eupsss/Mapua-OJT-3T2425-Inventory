// settings.js
const API_BASE = '../api/';

document.addEventListener('DOMContentLoaded', async () => {
  // 1) Pull the minimal session user
  const sessionUser = JSON.parse(sessionStorage.getItem('user'));
  if (!sessionUser || !sessionUser.id) {
    alert('Please sign in first.');
    return location.href = 'login.html';
  }

  // 2) Populate sidebar/header user info
  document.querySelectorAll('.user-name').forEach(el => {
    el.textContent = sessionUser.name;
  });
  document.querySelectorAll('.avatar').forEach(el => {
    const initials = sessionUser.name
      .split(' ')
      .map(n => n[0]?.toUpperCase()||'')
      .join('')
      .slice(0,2);
    el.textContent = initials;
  });

  // 3) Fetch the full profile from API
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

  // 4) Show full name in the page’s header span.username
  const usernameSpan = document.querySelector('.username');
  if (usernameSpan) {
    usernameSpan.textContent = `${profile.FirstName} ${profile.LastName}`;
  }

  // 5) Prefill the form fields
  document.getElementById('firstName').value = profile.FirstName || '';
  document.getElementById('lastName').value  = profile.LastName  || '';
  document.getElementById('email').value     = profile.Email     || '';
  document.getElementById('contactNo').value = profile.ContactNo || '';

  // 6) Cancel → reset form values
  document.getElementById('cancelBtn')
    .addEventListener('click', () => {
      document.getElementById('firstName').value = profile.FirstName || '';
      document.getElementById('lastName').value  = profile.LastName  || '';
      document.getElementById('email').value     = profile.Email     || '';
      document.getElementById('contactNo').value = profile.ContactNo || '';
  });

  // 7) Sign-out → clear session + redirect
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('user');
      location.href = 'login.html';
    });
  }

  // 8) Save → PUT to API, update sessionStorage, show success
  document.getElementById('profileForm')
    .addEventListener('submit', async e => {
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

        // 9) Reflect changes in sessionStorage
        sessionUser.name      = `${updated.FirstName} ${updated.LastName}`;
        sessionUser.email     = updated.Email;
        sessionUser.contactNo = updated.ContactNo;
        sessionStorage.setItem('user', JSON.stringify(sessionUser));

        // 10) Update UI
        document.querySelectorAll('.user-name').forEach(el => {
          el.textContent = sessionUser.name;
        });
        if (usernameSpan) {
          usernameSpan.textContent = sessionUser.name;
        }

        alert('Profile updated successfully.');
      } catch (err) {
        console.error('Save profile error:', err);
        alert('Error saving profile:\n' + err.message);
      }
    });
});
