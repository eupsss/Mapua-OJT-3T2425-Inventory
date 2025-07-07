// routes/room-uptime.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    // parse ?month=YYYY-MM
    const monthParam = req.query.month || '';
    const [year, mon] = monthParam.split('-').map(Number);

    let rows;
    if (year && mon) {
      // monthly — for each PC, find its latest log in the month, then per-room % working
      const [stats] = await pool.query(
        `
        SELECT
          r.RoomID,
          COALESCE(
            ROUND(
              SUM(lat.Status = 'Working') / NULLIF(COUNT(lat.PCNumber),0)
              * 100
            , 1),
            100.0
          ) AS uptime_pct
        FROM Room AS r
        LEFT JOIN (
          -- grab latest status per PC in the given month
          SELECT l.RoomID, l.PCNumber, l.Status
          FROM ComputerStatusLog AS l
          JOIN (
            SELECT RoomID, PCNumber, MAX(LoggedAt) AS latest
            FROM ComputerStatusLog
            WHERE YEAR(CheckDate)  = ?
              AND MONTH(CheckDate) = ?
            GROUP BY RoomID, PCNumber
          ) AS m
            ON m.RoomID   = l.RoomID
           AND m.PCNumber = l.PCNumber
           AND m.latest   = l.LoggedAt
        ) AS lat
          ON lat.RoomID = r.RoomID
        GROUP BY r.RoomID
        ORDER BY uptime_pct DESC
        `,
        [year, mon]
      );
      rows = stats;
    } else {
      // no month filter → live snapshot from Computers
      const [live] = await pool.query(
        `
        SELECT
          RoomID,
          ROUND(
            SUM(Status='Working') / COUNT(*) * 100
          , 1) AS uptime_pct
        FROM Computers
        GROUP BY RoomID
        ORDER BY uptime_pct DESC
        `
      );
      rows = live;
    }

    res.json(rows);
  }
  catch (err) {
    console.error('❌ [room-uptime] error:', err);
    next(err);
  }
});

export default router;
