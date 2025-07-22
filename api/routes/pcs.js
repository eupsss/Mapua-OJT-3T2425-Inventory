// routes/pcs.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();


router.get('/', async (req, res, next) => {
  const roomID = req.query.room;
  if (!roomID) {
    return res.status(400).json({ error: 'Missing room query parameter' });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        c.PCNumber,
        c.Status,
        l.ServiceTicketID
      FROM Computers AS c

      /* join in the most‐recent “Defective” ticket for each PC (if any) */
      LEFT JOIN (
        SELECT RoomID, PCNumber, ServiceTicketID
        FROM ComputerStatusLog
        WHERE Status = 'Defective'
          AND (RoomID, PCNumber, LoggedAt) IN (
            SELECT RoomID, PCNumber, MAX(LoggedAt)
            FROM ComputerStatusLog
            WHERE Status = 'Defective'
            GROUP BY RoomID, PCNumber
          )
      ) AS l
        ON l.RoomID   = c.RoomID
       AND l.PCNumber = c.PCNumber

      WHERE c.RoomID = ?
      ORDER BY c.PCNumber
      `,
      [roomID]
    );

    // each row now has { PCNumber, Status, ServiceTicketID|null }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
