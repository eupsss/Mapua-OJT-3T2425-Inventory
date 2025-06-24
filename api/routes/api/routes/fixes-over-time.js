// routes/fixes-over-time.js
import { Router } from 'express';
import { pool }   from '../db.js';

const router = Router();

router.get('/', async (_, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE(FixedAt) AS d, COUNT(*) AS cnt
        FROM Fixes
       WHERE FixedAt >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(FixedAt)
    ORDER BY d
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

export default router;
