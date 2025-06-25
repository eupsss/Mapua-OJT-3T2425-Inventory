// api/routes/room-uptime.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/* rows → [{ RoomID:"MPO310", uptime_pct: 97.5 }, … ] */
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        RoomID,
        ROUND( SUM(Status='Working') / COUNT(*) * 100 , 1) AS uptime_pct
      FROM Computers
      GROUP BY RoomID
      ORDER BY uptime_pct DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
