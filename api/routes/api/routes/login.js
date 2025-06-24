// api/routes/login.js
import express from 'express';
import bcrypt  from 'bcrypt';
import { pool } from '../db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { email = '', pass = '' } = req.body;

  // 1️⃣ Basic validation
  if (!email.trim() || !pass) {
    return res
      .status(400)
      .json({ success: false, error: 'Email & password required' });
  }

  try {
    // 2️⃣ Fetch the user row
    const [rows] = await pool.execute(
      `SELECT UserID, FirstName, LastName, PasswordHash, Role
         FROM Users
        WHERE Email = ?`,
      [ email.trim().toLowerCase() ]
    );
    const user = rows[0];
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    // 3️⃣ Verify password
    const ok = await bcrypt.compare(pass, user.PasswordHash);
    if (!ok) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    // 4️⃣ Save minimal user info in session
    req.session.user = {
      id:   user.UserID,
      name: `${user.FirstName} ${user.LastName}`,
      role: user.Role
    };

    // 5️⃣ Return the same JSON shape as before
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
