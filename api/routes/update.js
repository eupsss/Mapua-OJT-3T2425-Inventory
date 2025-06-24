// routes/update-status.js
import { Router } from 'express';
import { pool }   from '../db.js';

const router = Router();

router.post('/', async (req, res) => {
  const { room, pc, status } = req.body || {};
  if (!room || !pc || !status) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const [rs] = await pool.execute(`
      UPDATE ComputerAssets
         SET Status = :status
       WHERE RoomID = :room AND PCNumber = :pc
    `, { room, pc, status });

    res.json({ affectedRows: rs.affectedRows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

export default router;
