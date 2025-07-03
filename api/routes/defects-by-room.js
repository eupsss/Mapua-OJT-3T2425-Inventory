// routes/defects-by-room.js
import { Router } from 'express';
import { pool }   from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    // parse ?month=YYYY-MM
    const monthParam = req.query.month || '';
    const [year, mon] = monthParam.split('-').map(Number);
    let rows;

    if (year && mon) {
      // filter ComputerStatusLog by year/month
      [rows] = await pool.query(`
        SELECT 
          l.RoomID,
          COUNT(*) AS defects
        FROM ComputerStatusLog AS l
        WHERE l.Status = 'Defective'
          AND YEAR(l.CheckDate)=? 
          AND MONTH(l.CheckDate)=?
        GROUP BY l.RoomID
        ORDER BY l.RoomID
      `, [year, mon]);
    } else {
      // no month filter → all time aggregate
      [rows] = await pool.query(`
        SELECT 
          l.RoomID,
          COUNT(*) AS defects
        FROM ComputerStatusLog AS l
        WHERE l.Status = 'Defective'
        GROUP BY l.RoomID
        ORDER BY l.RoomID
      `);
    }

    res.json(rows);
  } catch (e) {
    console.error('❌ [defects-by-room]', e);
    res.status(500).json({ error: 'DB error' });
  }
});

export default router;
