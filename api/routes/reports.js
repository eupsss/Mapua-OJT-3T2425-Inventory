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
        l.ServiceTicketID,
        l.LoggedAt     AS CheckDate,
        l.RoomID,
        l.PCNumber,

        /* show “Fixed” if the live status is Working, else “Under Repair” */
        CASE
          WHEN c.Status = 'Working' THEN 'Fixed'
          ELSE 'Under Repair'
        END AS Status,

        l.Issues,

        /* find the latest fix on or before this log */
        (
          SELECT fx.FixedAt
          FROM Fixes fx
          WHERE fx.RoomID   = l.RoomID
            AND fx.PCNumber = l.PCNumber
            AND fx.FixedAt  <= l.LoggedAt
          ORDER BY fx.FixedAt DESC
          LIMIT 1
        ) AS FixedOn,

        (
          SELECT CONCAT(u2.FirstName, ' ', u2.LastName)
          FROM Fixes fx
          JOIN Users u2 ON u2.UserID = fx.FixedBy
          WHERE fx.RoomID   = l.RoomID
            AND fx.PCNumber = l.PCNumber
            AND fx.FixedAt  <= l.LoggedAt
          ORDER BY fx.FixedAt DESC
          LIMIT 1
        ) AS FixedBy,

        CONCAT(u1.FirstName, ' ', u1.LastName) AS RecordedBy

      FROM ComputerStatusLog AS l

      /* join to get the true current status at query time */
      JOIN Computers AS c
        ON c.RoomID   = l.RoomID
       AND c.PCNumber = l.PCNumber

      /* who recorded this log entry */
      LEFT JOIN Users AS u1
        ON u1.UserID = l.UserID

      ORDER BY l.LoggedAt DESC;
      `
    );

    res.json(rows);
  } catch (err) {
    console.error('❌ /api/reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
