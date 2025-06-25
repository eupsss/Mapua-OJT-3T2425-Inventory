// api/routes/issues-over-time.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/* rows → [{ ym:"2025-06", issue:"Mouse", cnt:5 }, … ] */
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        DATE_FORMAT(CheckDate,'%Y-%m')                         AS ym,
        SUBSTRING_INDEX(SUBSTRING_INDEX(Issues, ',', n.n), ',', -1) AS issue,
        COUNT(*)                                               AS cnt
      FROM ComputerStatusLog,
           ( SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
             SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 ) n
      WHERE n.n <= 1 + LENGTH(Issues) - LENGTH(REPLACE(Issues, ',', ''))
      GROUP BY ym, issue
      ORDER BY ym, issue;
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
