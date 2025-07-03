// routes/checks-over-time.js
import { Router } from 'express';
import { pool }   from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const monthParam = req.query.month || '';
    const [year, mon] = monthParam.split('-').map(Number);

    let sql, params;

    if (year && mon) {
      // Month view: daily counts for the specified month
      sql = `
        SELECT
          DATE_FORMAT(CheckDate, '%Y-%m-%d') AS d,
          COUNT(*) AS cnt
        FROM ComputerStatusLog
        WHERE YEAR(CheckDate) = ? AND MONTH(CheckDate) = ?
        GROUP BY DATE_FORMAT(CheckDate, '%Y-%m-%d')
        ORDER BY d
      `;
      params = [year, mon];
    } else {
      // Default: last 7 days
      sql = `
        SELECT
          DATE_FORMAT(CheckDate, '%Y-%m-%d') AS d,
          COUNT(*) AS cnt
        FROM ComputerStatusLog
        WHERE CheckDate >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE_FORMAT(CheckDate, '%Y-%m-%d')
        ORDER BY d
      `;
      params = [];
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);

  } catch (e) {
    console.error('❌ [checks-over-time]', e);
    res.status(500).json({ error: 'DB error' });
  }
});

export default router;
