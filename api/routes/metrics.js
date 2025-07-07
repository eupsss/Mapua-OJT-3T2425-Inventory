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

// …snip…

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
SELECT 
  COUNT(*) AS defectivePCs
FROM (
  -- 1) for each PC active in July, get its single latest log datetime
  SELECT 
    RoomID,
    PCNumber,
    MAX(LoggedAt) AS latestLoggedAt
  FROM ComputerStatusLog
  WHERE YEAR(CheckDate)  = ?
    AND MONTH(CheckDate) =  ?
  GROUP BY 
    RoomID,
    PCNumber
) AS lastLogs
-- 2) join back to the main log so we know which PC we're talking about
JOIN ComputerStatusLog AS log
  ON log.RoomID   = lastLogs.RoomID
 AND log.PCNumber = lastLogs.PCNumber
 AND log.LoggedAt = lastLogs.latestLoggedAt

-- 3) now join to the *current* status
JOIN Computers AS comp
  ON comp.RoomID   = log.RoomID
 AND comp.PCNumber = log.PCNumber

-- 4) only count those machines whose current status is still Defective
WHERE comp.Status = 'Defective';

  `, [year, month]);

    // 3) working PCs = total minus defective
    const workingPCs = totalPCs - (defectivePCs || 0);

    // 4) total checks that month
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

// …snip…


export default router;
