// routes/reports.js
// GET  /api/reports
// Returns a list of all service/check records for your reports table

import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Adjust `ServiceTickets` to match your actual table name
    const [rows] = await pool.execute(
`SELECT
  
  l.ServiceTicketID,


  DATE(l.LoggedAt)                       AS CheckDate,
  l.RoomID,
  l.PCNumber,
  l.Status,
  l.Issues,


  COALESCE(DATE(f.FixedAt),        '—')  AS FixedOn,
  COALESCE(CONCAT(u2.FirstName,' ',u2.LastName), '—')
                                         AS FixedBy,

  CONCAT(u1.FirstName,' ',u1.LastName)   AS RecordedBy

FROM   ComputerStatusLog AS l


LEFT JOIN Fixes AS f
  ON f.FixID = (
       SELECT fx.FixID
       FROM   Fixes fx
       WHERE  fx.RoomID   = l.RoomID
         AND  fx.PCNumber = l.PCNumber
         AND  fx.FixedAt  <= l.LoggedAt        -- key line
       ORDER BY fx.FixedAt DESC
       LIMIT 1
     )


LEFT JOIN Users AS u1 ON u1.UserID = l.UserID      
LEFT JOIN Users AS u2 ON u2.UserID = f.FixedBy     

ORDER BY l.LoggedAt DESC;`
    );

    return res.json(rows);
  } catch (err) {
 console.error('❌ /api/reports error:', err.stack || err);
  // send the actual message back so we can see what’s wrong
  return res.status(500).json({ error: err.message });
  }
});

export default router;
