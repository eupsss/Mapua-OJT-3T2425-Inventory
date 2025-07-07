// routes/adminUsers.js
import express from 'express';
import { pool }   from '../db.js';

const router = express.Router();

// ─── Admin guard middleware ─────────────────────────────
router.use((req, res, next) => {
  const user = req.session.user;
  if (!user || user.role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden – admin only' });
  }
  next();
});

// ─── List all users ──────────────────────────────────────
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         UserID     AS userID,
         FirstName  AS firstName,
         LastName   AS lastName,
         Email,
         ContactNo  AS contactNo,
         Role,
         CreatedAt  AS createdAt
       FROM Users
       ORDER BY LastName, FirstName`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── Fetch one user ─────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user ID' });

  try {
    const [rows] = await pool.query(
      `SELECT
         UserID     AS userID,
         FirstName  AS firstName,
         LastName   AS lastName,
         Email,
         ContactNo  AS contactNo,
         Role
       FROM Users
       WHERE UserID = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ─── Update a user ──────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const { firstName, lastName, email, contactNo, role } = req.body;
  if (!id || !firstName || !lastName || !email || !role) {
    return res.status(422).json({ error: 'Missing required fields' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE Users
         SET FirstName = ?, LastName = ?, Email = ?, ContactNo = ?, Role = ?
       WHERE UserID = ?`,
      [ firstName, lastName, email, contactNo || null, role, id ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already in use' });
    }
    next(err);
  }
});

export default router;
