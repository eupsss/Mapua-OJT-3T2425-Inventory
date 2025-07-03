// api/routes/room-uptime.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const monthParam = req.query.month || '';
    const [year, mon] = monthParam.split('-').map(Number);

    let rows;
    if (year && mon) {
      // Monthly uptime = % of logged checks that were "Working"
      const [stats] = await pool.query(
        `
        SELECT
          RoomID,
          ROUND(
            SUM(Status = 'Working') / COUNT(*) * 100
          , 1) AS uptime_pct
        FROM ComputerStatusLog
        WHERE YEAR(CheckDate)=? AND MONTH(CheckDate)=?
        GROUP BY RoomID
        ORDER BY uptime_pct DESC
        `,
        [year, mon]
      );
      rows = stats;
    } else {
      // No month filter → fall back to current Computers table
      const [live] = await pool.query(
        `
        SELECT
          RoomID,
          ROUND(
            SUM(Status = 'Working') / COUNT(*) * 100
          , 1) AS uptime_pct
        FROM Computers
        GROUP BY RoomID
        ORDER BY uptime_pct DESC
        `
      );
      rows = live;
    }

    res.json(rows);
  } catch (err) {
    console.error('❌ [room-uptime] error:', err);
    next(err);
  }
});

export default router;
