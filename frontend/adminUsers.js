// adminUsers.js
;(async () => {
  // 1️⃣ Admin guard
  const me = JSON.parse(sessionStorage.getItem('user'));
  if (!me || me.role !== 'Admin') {
    alert('Access denied – admins only');
    location.href = 'login.html';
    return;
  }

  // 2️⃣ Render avatar, name & sign-out
// 2️⃣ Render avatar, name & sign-out
const initials = me.name
  .split(' ')
  .map(n => n[0].toUpperCase())
  .slice(0,2)
  .join('');
document.querySelectorAll('.avatar').forEach(el => el.textContent = initials);

const firstName = me.name.trim().split(' ')[0];
document.querySelectorAll('.profile-name, .username')
  .forEach(el => el.textContent = "Hi, " + firstName + "!");

document.getElementById('signout-btn')
  .addEventListener('click', () => {
    sessionStorage.removeItem('user');
    location.href = 'login.html';
  });

  // 3️⃣ Setup table & “Add User” button
  const tbody = document.querySelector('#usersTable tbody');
  document.getElementById('add-user-btn')
    .addEventListener('click', () => location.href = 'user-add.html');

  // 4️⃣ Load & render users
  async function loadUsers() {
    tbody.innerHTML = '<tr><td colspan="7" class="center">Loading…</td></tr>';
    try {
      const res = await fetch('/api/adminUsers', { credentials:'same-origin' });
      if (!res.ok) throw new Error(await res.text());
      const users = await res.json();

      if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="center">No users found.</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      users.forEach(u => {
        // pick whichever casing your API uses:
        const id        = u.UserID ?? u.userID ?? u.id;
        const firstName = u.FirstName ?? u.firstName ?? '';
        const lastName  = u.LastName  ?? u.lastName  ?? '';
        const email     = u.Email     ?? u.email     ?? '';
        const contact   = u.ContactNo ?? u.contactNo ?? u.phone     ?? '';
        const role      = u.Role      ?? u.role      ?? '';

        const tr = document.createElement('tr');
        tr.dataset.id = id;
        tr.innerHTML = `
          <td class="cell userID">${id}</td>
          <td class="cell firstName">${firstName}</td>
          <td class="cell lastName" >${lastName}</td>
          <td class="cell email"    >${email}</td>
          <td class="cell contactNo">${contact}</td>
          <td class="cell role"     >${role}</td>
          <td class="actions">
            <button class="action-btn edit">Edit</button>
            <button class="action-btn delete">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      wireRowActions();
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="7" class="center error">Error loading users</td></tr>';
    }
  }

  // 5️⃣ Wire Edit/Delete
  function wireRowActions() {
    // DELETE
    tbody.querySelectorAll('.delete').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this user?')) return;
        const id = btn.closest('tr').dataset.id;
        const res = await fetch(`/api/adminUsers/${id}`, {
          method:'DELETE', credentials:'same-origin'
        });
        if (!res.ok) {
          alert('Delete failed: ' + await res.text());
        } else {
          loadUsers();
        }
      };
    });

    // EDIT → inline inputs & dropdown for role
    tbody.querySelectorAll('.edit').forEach(btn => {
      btn.onclick = () => {
        const tr = btn.closest('tr');
        if (tr.classList.contains('editing')) return;
        tr.classList.add('editing');

        const cells    = [...tr.querySelectorAll('td.cell')];
        const original = cells.map(td => td.textContent);

        // Replace with inputs/select
        cells.forEach((td, idx) => {
          const key = td.classList[1];
          td.textContent = '';
          if (key === 'userID') {
            td.textContent = original[idx];
            return;
          }
          let input;
          if (key === 'role') {
            input = document.createElement('select');
            ['Admin','Viewer','Ticketing','Inventory'].forEach(r => {
              const opt = document.createElement('option');
              opt.value = r;
              opt.textContent = r;
              if (r === original[idx]) opt.selected = true;
              input.appendChild(opt);
            });
          } else {
            input = document.createElement('input');
            input.value = original[idx];
          }
          input.style.width = '100%';
          td.appendChild(input);
        });

        // Swap buttons
        const actions = tr.querySelector('.actions');
        actions.innerHTML = `
          <button class="action-btn save">Save</button>
          <button class="action-btn cancel">Cancel</button>
        `;

        // CANCEL → revert cells
        actions.querySelector('.cancel').onclick = () => {
          cells.forEach((td, i) => td.textContent = original[i]);
          tr.classList.remove('editing');
          actions.innerHTML = `
            <button class="action-btn edit">Edit</button>
            <button class="action-btn delete">Delete</button>
          `;
          wireRowActions();
        };

        // SAVE → PUT to API
        actions.querySelector('.save').onclick = async () => {
          const id = tr.dataset.id;
          const getVal = key => {
            const td = tr.querySelector(`td.${key}`);
            const inp = td.querySelector('input,select');
            return inp ? inp.value.trim() : td.textContent.trim();
          };
          const payload = {
            firstName: getVal('firstName'),
            lastName:  getVal('lastName'),
            email:     getVal('email'),
            contactNo: getVal('contactNo'),
            role:      getVal('role')
          };
          try {
            const resp = await fetch(`/api/adminUsers/${id}`, {
              method:'PUT',
              credentials:'same-origin',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify(payload)
            });
            if (!resp.ok) throw new Error(await resp.text());
            loadUsers();
          } catch (e) {
            alert('Save failed: ' + e.message);
          }
        };
      };
    });
  }

  // 6️⃣ Kick off
  loadUsers();
})();
