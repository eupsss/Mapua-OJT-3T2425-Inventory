// routes/rooms.js
import express from 'express';
import { pool }  from '../db.js';

const router = express.Router();

/*───────────────────────────────────────────────────────────────
  GET /api/rooms
────────────────────────────────────────────────────────────────*/
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT RoomID, Room_Config, PC_NUM
         FROM Room
        ORDER BY RoomID`
    );
    res.json(rows);                             // [{ RoomID, … }]
  } catch (err) { next(err); }
});

/*───────────────────────────────────────────────────────────────
  POST /api/rooms
  Body: { roomID, roomConfig = 1, pcNum = 41 }
────────────────────────────────────────────────────────────────*/
router.post('/', async (req, res, next) => {
  try {
    const { roomID, roomConfig = 1, pcNum = 41 } = req.body ?? {};
    if (!roomID) return res.status(400).json({ error: 'Room ID is required.' });

    /* ① add room */
    await pool.query(
      `INSERT INTO Room (RoomID, Room_Config, PC_NUM) VALUES (?,?,?)`,
      [roomID.toUpperCase(), roomConfig, pcNum]
    );

    /* ② seed Computers */
    const comps = [];
    for (let n = 0; n < pcNum; n++) {
      comps.push([roomID.toUpperCase(), n.toString().padStart(2, '0')]);
    }
    await pool.query(
      `INSERT INTO Computers (RoomID, PCNumber) VALUES ?`,
      [comps]
    );

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Room already exists.' });
    next(err);                      // one path = one response
  }
});

export default router;
