// users.js
console.log('▶️ users.js loaded');

// 1️⃣ Login guard & admin-only
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) {
  alert('Access denied – please sign in.');
  location.href = 'login.html';
}
if (user.role !== 'Admin') {
  alert('Access denied – admins only.');
  location.href = 'dashboard.html';
}

// show username
document.querySelector('.username').textContent = user.name;

// sign out
document.getElementById('signout-btn')
  .addEventListener('click', () => {
    sessionStorage.removeItem('user');
    location.href = 'login.html';
  });

const API = '/api/users';
const tbody = document.querySelector('#usersTable tbody');
const modal = document.getElementById('userModal');
const form  = document.getElementById('userForm');
const fields = ['userId','firstName','lastName','email','contactNo','role'];

// open modal in add/edit mode
function openModal(mode, data = {}) {
  document.getElementById('modalTitle').textContent =
    mode === 'add' ? 'Add User' : 'Edit User';
  fields.forEach(id => {
    const el = document.getElementById(id);
    el.value = data[id] || '';
    if (id === 'userId') el.disabled = mode === 'edit';
  });
  modal.classList.remove('hidden');
}

// close modal
document.getElementById('cancelBtn')
  .addEventListener('click', () => {
    modal.classList.add('hidden');
    form.reset();
  });

// load & render users
async function loadUsers() {
  tbody.innerHTML = '<tr><td colspan="7" class="center">Loading…</td></tr>';
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error(await res.text());
    const users = await res.json();

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="center">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.UserID}</td>
        <td>${u.FirstName}</td>
        <td>${u.LastName}</td>
        <td>${u.Email}</td>
        <td>${u.ContactNo || ''}</td>
        <td>${u.Role}</td>
        <td>
          <button class="btn edit" data-id="${u.UserID}">Edit</button>
          <button class="btn delete" data-id="${u.UserID}">Delete</button>
        </td>
      </tr>
    `).join('');

    // wire edit buttons
    tbody.querySelectorAll('.edit').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const r  = await fetch(`${API}/${id}`).then(r=>r.json());
        openModal('edit', {
          userId:    r.UserID,
          firstName: r.FirstName,
          lastName:  r.LastName,
          email:     r.Email,
          contactNo: r.ContactNo,
          role:      r.Role
        });
      };
    });

    // wire delete buttons
    tbody.querySelectorAll('.delete').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this user?')) return;
        await fetch(`${API}/${btn.dataset.id}`, { method: 'DELETE' });
        loadUsers();
      };
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" class="center error">Error loading users</td></tr>`;
  }
}

// handle Add User button
document.getElementById('addUserBtn')
  .addEventListener('click', () => openModal('add'));

// form submit (create or update)
form.addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    FirstName: document.getElementById('firstName').value,
    LastName:  document.getElementById('lastName').value,
    Email:     document.getElementById('email').value,
    ContactNo: document.getElementById('contactNo').value || null,
    Role:      document.getElementById('role').value
  };
  const id     = document.getElementById('userId').value;
  const method = id ? 'PUT' : 'POST';
  const url    = id ? `${API}/${id}` : API;

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    modal.classList.add('hidden');
    form.reset();
    loadUsers();
  } catch (err) {
    alert('Save failed: ' + err.message);
  }
});

// initial load
loadUsers();
