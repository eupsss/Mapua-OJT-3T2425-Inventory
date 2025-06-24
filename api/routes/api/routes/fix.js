// routes/fix.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

/**
 * POST /api/fix
 * Body: { roomID, pcNumber, fixedOn, fixedBy }
 * Logs a fix and updates the PC back to “Working”.
 */
router.post('/', async (req, res, next) => {
  const { roomID, pcNumber, fixedOn, fixedBy } = req.body;
  if (!roomID || !pcNumber || !fixedOn || !fixedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1) Insert into Fixes
    const [result] = await pool.query(
      `INSERT INTO Fixes (RoomID, PCNumber, FixedAt, FixedBy)
       VALUES (?, ?, ?, ?)`,
      [roomID, pcNumber, fixedOn, fixedBy]
    );

    // 2) Optionally, update Computers.Status back to Working
    await pool.query(
      `UPDATE Computers
          SET Status = 'Working',
              LastUpdated = ?
        WHERE RoomID = ? AND PCNumber = ?`,
      [fixedOn, roomID, pcNumber]
    );

    res.json({ success: true, fixId: result.insertId });
  } catch (err) {
    next(err);
  }
});

export default router;
