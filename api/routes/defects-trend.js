// routes/defects-trend.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/* GET /api/defects-trend?month=YYYY-MM
   returns: [{ d:"2025-06-24", defects:4 }, … ] */
router.get('/', async (req, res, next) => {
  try {
    const monthParam = req.query.month || '';
    const [year, mon] = monthParam.split('-').map(Number);

    let sql, params;

    if (year && mon) {
      // When a month is specified, show daily counts for that month
      sql = `
        SELECT
          DATE_FORMAT(CheckDate, '%Y-%m-%d') AS d,
          COUNT(*) AS defects
        FROM ComputerStatusLog
        WHERE Status = 'Defective'
          AND YEAR(CheckDate) = ?
          AND MONTH(CheckDate) = ?
        GROUP BY DATE_FORMAT(CheckDate, '%Y-%m-%d')
        ORDER BY d
      `;
      params = [year, mon];
    } else {
      // Default: last 30 days
      sql = `
        SELECT
          DATE_FORMAT(CheckDate, '%Y-%m-%d') AS d,
          COUNT(*) AS defects
        FROM ComputerStatusLog
        WHERE Status = 'Defective'
          AND CheckDate >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        GROUP BY DATE_FORMAT(CheckDate, '%Y-%m-%d')
        ORDER BY d
      `;
      params = [];
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);

  } catch (err) {
    console.error('❌ [defects-trend] error:', err);
    next(err);
  }
});

export default router;
