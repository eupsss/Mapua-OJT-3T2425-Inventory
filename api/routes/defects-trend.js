// api/routes/defects-trend.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/* rows → [{ d:"2025-06-24", defects:4 }, … ] */
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        CheckDate                    AS d,
        COUNT(*)                     AS defects
      FROM   ComputerStatusLog
      WHERE  Status = 'Defective'
      GROUP  BY CheckDate
      ORDER  BY CheckDate
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
