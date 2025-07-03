// api/routes/issues-over-time.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/* GET /api/issues-over-time?month=YYYY-MM
   Response: [{ ym:"2025-07", issue:"Mouse", cnt:5 }, … ] */
router.get('/', async (req, res, next) => {
  try {
    const monthParam = req.query.month || '';
    const [year, mon] = monthParam.split('-').map(Number);

    if (!year || !mon) {
      return res
        .status(400)
        .json({ error: 'Missing or invalid `month` query parameter. Use `?month=YYYY-MM`.' });
    }

    // We use a small numbers table (1–9) to split the comma-separated SET
    const [rows] = await pool.query(
      `
      SELECT
        DATE_FORMAT(CheckDate, '%Y-%m') AS ym,
        SUBSTRING_INDEX(
          SUBSTRING_INDEX(Issues, ',', n.n),
          ',', -1
        ) AS issue,
        COUNT(*) AS cnt
      FROM ComputerStatusLog
      JOIN (
        SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
        SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL
        SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
      ) AS n
        ON n.n <= 1 + LENGTH(Issues) - LENGTH(REPLACE(Issues, ',', ''))
      WHERE
        Status = 'Defective'
        AND YEAR(CheckDate)  = ?
        AND MONTH(CheckDate) = ?
      GROUP BY ym, issue
      ORDER BY ym, issue
      `,
      [year, mon]
    );

    res.json(rows);
  } catch (err) {
    console.error('❌ [issues-over-time]', err);
    next(err);
  }
});

export default router;
