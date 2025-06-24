// api/routes/register.js
import express from 'express';
import bcrypt  from 'bcrypt';
import { pool } from '../db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { fname = '', lname = '', email = '', phone = '', pass = '' } = req.body;

  // Basic validation
  if (!fname.trim() || !lname.trim() || !email.trim() || !pass) {
    return res
      .status(400)
      .json({ success: false, error: 'First name, last name, email & password required' });
  }

  const emailAddr = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr)) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid email format' });
  }

  try {
    // Hash the password
    const hash = await bcrypt.hash(pass, 10);

    // Insert into Users table (adjust columns/names to match your schema)
    const [result] = await pool.execute(
      `INSERT INTO Users (FirstName, LastName, Email, ContactNo, PasswordHash)
       VALUES (?, ?, ?, ?, ?)`,
      [fname.trim(), lname.trim(), emailAddr, phone.trim(), hash]
    );

    res.json({ success: true, userId: result.insertId });
  } catch (err) {
    console.error('Registration error:', err);
    // Duplicate email?
    if (err.code === 'ER_DUP_ENTRY') {
      return res
        .status(409)
        .json({ success: false, error: 'Email is already registered' });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
