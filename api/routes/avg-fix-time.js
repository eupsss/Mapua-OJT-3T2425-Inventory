// routes/avg-fix-time.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const monthParam = req.query.month || '';
    const [year, mon] = monthParam.split('-').map(Number);

    let sql = `
      SELECT
        AVG(
          TIMESTAMPDIFF(
            HOUR,
            cl.LoggedAt,   -- when the defect was logged
            f.FixedAt      -- when it was fixed
          )
        ) AS avgHours
      FROM Fixes AS f
      JOIN ComputerStatusLog AS cl
        ON cl.RoomID   = f.RoomID
       AND cl.PCNumber = f.PCNumber
       AND cl.Status   = 'Defective'
      WHERE f.FixedAt IS NOT NULL
    `;
    const params = [];

    if (year && mon) {
      sql += `
        AND YEAR(f.FixedAt) = ?
        AND MONTH(f.FixedAt) = ?
      `;
      params.push(year, mon);
    }

    const [rows] = await pool.query(sql, params);
    const avgHours = rows[0].avgHours ?? 0;
    res.json({ avgHours });

  } catch (err) {
    console.error('❌ [avg-fix-time] error:', err);
    next(err);
  }
});

export default router;
