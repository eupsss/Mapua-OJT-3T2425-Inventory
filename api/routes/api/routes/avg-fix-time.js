// routes/avg-fix-time.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        AVG(
          TIMESTAMPDIFF(
            HOUR,
            cl.LoggedAt,   -- timestamp when the defect was logged
            f.FixedAt      -- timestamp when it was fixed
          )
        ) AS avgHours
      FROM Fixes AS f
      JOIN ComputerStatusLog AS cl
        ON  cl.RoomID    = f.RoomID
        AND cl.PCNumber  = f.PCNumber
        AND cl.Status    = 'Defective'
      WHERE f.FixedAt IS NOT NULL
    `);
    res.json({ avgHours: rows[0].avgHours || 0 });
  } catch (err) {
    console.error('❌ [avg-fix-time] error:', err);
    next(err);
  }
});

export default router;
