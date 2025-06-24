// routes/rooms.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

/**
 * GET /api/rooms
 * Returns all RoomIDs for the room-select dropdown.
 */
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT RoomID 
         FROM Room
        ORDER BY RoomID`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
