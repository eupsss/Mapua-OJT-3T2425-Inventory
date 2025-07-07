// routes/reports.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /api/reports — returns one row per PC with true current status
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        l.ServiceTicketID,
        l.LoggedAt        AS CheckDate,
        l.RoomID,
        l.PCNumber,

        /* use the live Computers.Status, not the log’s */
        CASE 
          WHEN c.Status = 'Working'  THEN 'Fixed'
          ELSE 'Under Repair'
        END                  AS Status,

        l.Issues,

        /* latest fix on or before this log */
        (
          SELECT DATE(fx.FixedAt)
            FROM Fixes fx
           WHERE fx.RoomID   = l.RoomID
             AND fx.PCNumber = l.PCNumber
             AND fx.FixedAt  <= l.LoggedAt
           ORDER BY fx.FixedAt DESC
           LIMIT 1
        )                    AS FixedOn,

        (
          SELECT CONCAT(u2.FirstName,' ',u2.LastName)
            FROM Fixes fx
            JOIN Users u2 ON u2.UserID = fx.FixedBy
           WHERE fx.RoomID   = l.RoomID
             AND fx.PCNumber = l.PCNumber
             AND fx.FixedAt  <= l.LoggedAt
           ORDER BY fx.FixedAt DESC
           LIMIT 1
        )                    AS FixedBy,

        CONCAT(u1.FirstName,' ',u1.LastName) AS RecordedBy

      FROM (
        /* pick only the most recent log per PC */
        SELECT l.*
          FROM ComputerStatusLog l
          JOIN (
            SELECT RoomID, PCNumber, MAX(LoggedAt) AS LoggedAt
              FROM ComputerStatusLog
             GROUP BY RoomID, PCNumber
          ) latest
            ON l.RoomID   = latest.RoomID
           AND l.PCNumber = latest.PCNumber
           AND l.LoggedAt = latest.LoggedAt
      ) AS l

      /* join to get the true current status */
      JOIN Computers AS c
        ON c.RoomID   = l.RoomID
       AND c.PCNumber = l.PCNumber

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
