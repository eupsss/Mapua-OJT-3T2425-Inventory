// routes/metrics.js
import express from 'express';
import { pool }  from '../db.js';
const router = express.Router();

function parseYearMonth(ym) {
  if (typeof ym==='string' && /^\d{4}-\d{2}$/.test(ym)) {
    const [y,m] = ym.split('-').map(n=>parseInt(n,10));
    if (y>2000 && m>=1 && m<=12) return [y,m];
  }
  const now = new Date();
  return [ now.getFullYear(), now.getMonth()+1 ];
}

router.get('/', async (req, res, next) => {
  try {
    const [year, month] = parseYearMonth(req.query.month);

    // 1) total PCs (live snapshot)
    const [[{ totalPCs }]] = await pool.query(`
      SELECT COUNT(*) AS totalPCs
        FROM Computers
    `);

    // 2) how many distinct PCs went defective in that month
    const [[{ defectivePCs }]] = await pool.query(`
      SELECT COUNT(DISTINCT RoomID, PCNumber) AS defectivePCs
        FROM ComputerStatusLog
       WHERE Status     = 'Defective'
         AND YEAR(CheckDate)  = ?
         AND MONTH(CheckDate) = ?
    `, [year, month]);

    // 3) working PCs = total minus defective
    const workingPCs = totalPCs - (defectivePCs || 0);

    // 4) total checks that month (optional: from StatusLog or ComputerStatusLog)
    const [[{ checkedThisMonth }]] = await pool.query(`
      SELECT COUNT(*) AS checkedThisMonth
        FROM ComputerStatusLog
       WHERE YEAR(CheckDate)=? AND MONTH(CheckDate)=?
    `, [year, month]);

    res.json({
      totalPCs,
      workingPCs,
      defectivePCs,
      checkedToday: checkedThisMonth
    });
  } catch (err) {
    console.error('❌ [metrics] error:', err);
    next(err);
  }
});

export default router;
