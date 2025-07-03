// routes/fixes-over-time.js
import { Router } from 'express';
import { pool }   from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    // Parse optional ?month=YYYY-MM
    const monthParam = req.query.month || '';
    const [year, mon] = monthParam.split('-').map(Number);

    let sql, params;

    if (year && mon) {
      // Monthly view: one data point per day in that month
      sql = `
        SELECT
          DATE_FORMAT(FixedAt, '%Y-%m-%d') AS d,
          COUNT(*) AS cnt
        FROM Fixes
        WHERE YEAR(FixedAt) = ? 
          AND MONTH(FixedAt) = ?
        GROUP BY DATE_FORMAT(FixedAt, '%Y-%m-%d')
        ORDER BY d
      `;
      params = [year, mon];
    } else {
      // Default view: last 7 days (including today)
      sql = `
        SELECT
          DATE_FORMAT(FixedAt, '%Y-%m-%d') AS d,
          COUNT(*) AS cnt
        FROM Fixes
        WHERE FixedAt >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE_FORMAT(FixedAt, '%Y-%m-%d')
        ORDER BY d
      `;
      params = [];
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);

  } catch (e) {
    console.error('❌ [fixes-over-time] error:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

export default router;
