// routes/metrics.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    // 1️⃣ Total PCs
    const [[{ totalPCs }]] = await pool.query(`
      SELECT COUNT(*) AS totalPCs
        FROM Computers
    `);

    // 2️⃣ Working vs Defective
    const [[{ workingPCs, defectivePCs }]] = await pool.query(`
      SELECT
        SUM(Status = 'Working')   AS workingPCs,
        SUM(Status = 'Defective') AS defectivePCs
      FROM Computers
    `);

    // 3️⃣ Checked today
    const [[{ checkedToday }]] = await pool.query(`
      SELECT COUNT(*) AS checkedToday
        FROM ComputerStatusLog
       WHERE CheckDate = CURDATE()
    `);

    res.json({
      totalPCs:       totalPCs       || 0,
      workingPCs:     workingPCs     || 0,
      defectivePCs:   defectivePCs   || 0,
      checkedToday:   checkedToday   || 0
    });
  } catch (err) {
    console.error('❌ [metrics] error:', err);
    next(err);
  }
});

export default router;
