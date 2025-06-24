// routes/assets.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /api/assets?room=ROOMID
// GET /api/assets?room=ROOMID&history=1&pc=PCNUMBER
router.get('/', async (req, res) => {
  const room    = (req.query.room    || '').trim();
  const history = req.query.history !== undefined;
  const pc      = (req.query.pc      || '').trim();

  // validate
  if (!room) {
    return res.status(400).json({ error: 'Missing ?room= parameter' });
  }
  if (history && !pc) {
    return res.status(400).json({ error: 'History mode needs ?pc=' });
  }

  try {
    if (history) {
      // MODE 2: full history for one PC
      const [rows] = await pool.execute(
        `SELECT
           InstalledAt,
           RetiredAt,
           MakeModel,
           SerialNumber,
           CPU,
           GPU,
           RAM_GB,
           Storage_GB,
           MonitorModel,
           MonitorSerial,
           UPSModel,
           UPSSerial
         FROM ComputerAssets
         WHERE RoomID = ?
           AND PCNumber = ?
         ORDER BY InstalledAt DESC`,
        [room, pc]
      );
      return res.json(rows);
    } else {
      // MODE 1: latest/active spec for every PC in the room
      const [rows] = await pool.execute(
        `SELECT
           c.PCNumber,
           c.Status,
           a.InstalledAt,
           a.MakeModel,
           a.SerialNumber,
           a.CPU,
           a.GPU,
           a.RAM_GB,
           a.Storage_GB,
           a.MonitorModel,
           a.MonitorSerial,
           a.UPSModel,
           a.UPSSerial
         FROM Computers AS c
         LEFT JOIN ComputerAssets AS a
           ON a.RoomID   = c.RoomID
          AND a.PCNumber = c.PCNumber
          AND a.InstalledAt = (
            SELECT MAX(InstalledAt)
            FROM ComputerAssets
            WHERE RoomID   = c.RoomID
              AND PCNumber = c.PCNumber
          )
         WHERE c.RoomID = ?
         ORDER BY CAST(c.PCNumber AS UNSIGNED)`,
        [room]
      );
      return res.json(rows);
    }
  } catch (err) {
    console.error('❌ /api/assets error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
