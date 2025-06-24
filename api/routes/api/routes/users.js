// routes/users.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

/**
 * GET /api/users
 * Returns a list of all users for the “Fix” modal datalist.
 */
router.get('/', async (req, res, next) => {
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

export default router;
