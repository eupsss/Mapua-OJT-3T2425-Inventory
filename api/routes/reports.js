// routes/reports.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /api/reports — returns one row per status-change (full history)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
SELECT
  l.ServiceTicketID                           AS ServiceTicketID,
  DATE_FORMAT(l.LoggedAt, '%Y-%m-%d %H:%i:%s') AS CheckDate,
  l.RoomID                                    AS RoomID,
  l.PCNumber                                  AS PCNumber,
  CASE WHEN f.FixedAt IS NOT NULL THEN 'Fixed' ELSE 'Under Repair' END
                                              AS Status,
  l.Issues                                    AS Issues,
  DATE_FORMAT(f.FixedAt, '%Y-%m-%d %H:%i:%s') AS FixedOn,
  CONCAT(u2.FirstName,' ',u2.LastName)        AS FixedBy,
  CONCAT(u1.FirstName,' ',u1.LastName)        AS RecordedBy
FROM   ComputerStatusLog AS l
LEFT   JOIN Fixes     AS f  USING(ServiceTicketID)
LEFT   JOIN Users     AS u1 ON u1.UserID = l.UserID
LEFT   JOIN Users     AS u2 ON u2.UserID = f.FixedBy
ORDER  BY l.LoggedAt DESC
      `
    );

    res.json(rows);
  } catch (err) {
    console.error('❌ /api/reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
