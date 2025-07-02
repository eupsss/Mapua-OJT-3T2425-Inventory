// routes/users.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

/**
 * GET /api/users
 * → List all users (for “Fix” modal datalist)
 */
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         UserID   AS userId,
         CONCAT(FirstName, ' ', LastName) AS fullName
       FROM Users
       ORDER BY LastName, FirstName`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id
 * → Fetch a single user’s profile for the Settings page
 */
router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Invalid user ID.' });

  try {
    const [rows] = await pool.query(
      `SELECT 
         UserID, FirstName, LastName,
         Email, ContactNo
       FROM Users
       WHERE UserID = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/users/:id
 * → Update a single user’s profile
 *    Body: { FirstName, LastName, Email, ContactNo }
 */
router.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Invalid user ID.' });

  const { FirstName, LastName, Email, ContactNo } = req.body;
  if (!FirstName || !LastName || !Email) {
    return res.status(400).json({
      success: false,
      error: 'FirstName, LastName and Email are required.'
    });
  }

  try {
    const [result] = await pool.query(
      `UPDATE Users
         SET FirstName = ?, LastName = ?, Email = ?, ContactNo = ?
       WHERE UserID = ?`,
      [FirstName, LastName, Email, ContactNo || null, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Email already in use.' });
    }
    next(err);
  }
});

export default router;
