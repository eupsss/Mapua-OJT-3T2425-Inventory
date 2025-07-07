// routes/pcs.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

/**
 * GET /api/pcs?room=MPO310
 * Returns all PCs for a given room,
 * including the live status and (if defective) its open ServiceTicketID.
 */
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

      /* grab the most‐recent defect ticket, if any */
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
        ON l.RoomID    = c.RoomID
       AND l.PCNumber  = c.PCNumber

      WHERE c.RoomID = ?
      ORDER BY c.PCNumber
      `,
      [roomID]
    );

    // now each row is { PCNumber, Status, ServiceTicketID|null }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
