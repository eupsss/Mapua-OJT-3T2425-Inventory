// routes/fix.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

router.post('/', async (req, res, next) => {
  const { roomID, pcNumber, fixedOn, fixedBy, serviceTicketID } = req.body;
  if (!roomID || !pcNumber || !fixedOn || !fixedBy || !serviceTicketID) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) mark that ticket back to Working—but leave LoggedAt and UserID intact
    await conn.query(
      `UPDATE ComputerStatusLog
         SET Status = 'Working'
       WHERE ServiceTicketID = ?`,
      [ serviceTicketID ]
    );

    // 2) upsert the Fixes record with your chosen timestamp
    await conn.query(
      `INSERT INTO Fixes
         (RoomID, PCNumber, FixedAt, FixedBy, ServiceTicketID)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         FixedAt = VALUES(FixedAt),
         FixedBy = VALUES(FixedBy)`,
      [ roomID, pcNumber, fixedOn, fixedBy, serviceTicketID ]
    );

    // 3) update your live Computers snapshot
    await conn.query(
      `UPDATE Computers
         SET Status      = 'Working',
             LastFixedAt = ?,
             LastFixedBy = ?,
             LastUpdated = ?
       WHERE RoomID   = ?
         AND PCNumber = ?`,
      [ fixedOn, fixedBy, fixedOn, roomID, pcNumber ]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('❌ /api/fix error:', err);
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
