// routes/pcs.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

/**
 * GET /api/pcs?room=MPO310
 * Returns all PCs (number + status) for a given room.
 */
router.get('/', async (req, res, next) => {
  const roomID = req.query.room;
  if (!roomID) {
    return res.status(400).json({ error: 'Missing room query parameter' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT PCNumber, Status
         FROM Computers
        WHERE RoomID = ?
        ORDER BY PCNumber`,
      [roomID]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
