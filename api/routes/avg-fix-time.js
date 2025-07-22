// routes/avg-fix-time.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

//  GET /api/avg-fix-time?month=YYYY-MM   ← month filter is optional
router.get('/', async (req, res) => {
  try {
    /*--------------------------------------------------------------------
      1) Parse optional month filter (YYYY-MM)
    --------------------------------------------------------------------*/
    const monthParam = req.query.month || '';      // e.g. “2025-07”
    let year, mon;
    if (/^\d{4}-\d{2}$/.test(monthParam)) {
      [year, mon] = monthParam.split('-').map(Number);
    }

    /*--------------------------------------------------------------------
      2) Build the SQL:
         • keep ONLY rows whose ServiceTicketID still has “-Defective-”
         • for each Fix row, find the very first LoggedAt for that ticket
         • take TIMESTAMPDIFF(HOUR, defectTime, FixedAt)
    --------------------------------------------------------------------*/
    let sql = `
      SELECT
        COALESCE(
          AVG(
            TIMESTAMPDIFF(
              HOUR,
              (
                SELECT d0.LoggedAt
                  FROM ComputerStatusLog AS d0
                 WHERE d0.ServiceTicketID = f.ServiceTicketID
                 ORDER BY d0.LoggedAt
                 LIMIT 1
              ),
              f.FixedAt
            )
          ),
          0
        ) AS avgHours
      FROM Fixes AS f
      WHERE f.FixedAt IS NOT NULL
        AND f.ServiceTicketID LIKE '%-Defective-%'   -- <-- key line
    `;
    const params = [];

    if (year && mon) {
      sql += `
        AND YEAR(f.FixedAt)  = ?
        AND MONTH(f.FixedAt) = ?
      `;
      params.push(year, mon);
    }

    /*--------------------------------------------------------------------
      3) Execute & respond
    --------------------------------------------------------------------*/
    const [rows] = await pool.query(sql, params);
    const raw = Number(rows[0].avgHours) || 0;
    const avg = Math.round(raw * 10) / 10;           // one decimal place

    return res.json({ avgHours: avg });

  } catch (err) {
    console.error('❌ [avg-fix-time] error:', err);
    return res.json({ avgHours: 0 });
  }
});

export default router;
