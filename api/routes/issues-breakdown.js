// routes/issues-breakdown.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const monthParam = req.query.month || '';
    const [year, mon] = monthParam.split('-').map(Number);

    // Base SQL: list of all possible issues
    let sql = `
      SELECT
        i.issue,
        SUM(FIND_IN_SET(i.issue, c.Issues) > 0) AS cnt
      FROM (
        SELECT 'Mouse'             AS issue UNION ALL
        SELECT 'Keyboard'          UNION ALL
        SELECT 'Monitor'           UNION ALL
        SELECT 'Operating System'  UNION ALL
        SELECT 'Memory'            UNION ALL
        SELECT 'CPU'               UNION ALL
        SELECT 'GPU'               UNION ALL
        SELECT 'Network'           UNION ALL
        SELECT 'Other'
      ) AS i
      CROSS JOIN ComputerStatusLog AS c
    `;
    const params = [];

    // If month filter provided, restrict by CheckDate
    if (year && mon) {
      sql += `
        WHERE YEAR(c.CheckDate) = ?
          AND MONTH(c.CheckDate) = ?
      `;
      params.push(year, mon);
    }

    // Group & return
    sql += `
      GROUP BY i.issue
      ORDER BY cnt DESC, i.issue
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows);

  } catch (err) {
    console.error('❌ [issues-breakdown] error:', err);
    next(err);
  }
});

export default router;
