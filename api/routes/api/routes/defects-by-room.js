import { Router } from 'express';
import { pool }   from '../db.js';

const router = Router();

const latestStatus = `
  SELECT l.RoomID, l.PCNumber, l.Status
    FROM ComputerStatusLog  AS l
    JOIN (
      SELECT RoomID, PCNumber, MAX(LoggedAt) AS lastLog
        FROM ComputerStatusLog
    GROUP BY RoomID, PCNumber
    ) AS x
      ON  x.RoomID   = l.RoomID
     AND x.PCNumber = l.PCNumber
     AND x.lastLog  = l.LoggedAt
`;

router.get('/', async (_, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.RoomID,
             SUM(ls.Status = 'Defective') AS defects
        FROM ComputerAssets a
   LEFT JOIN (${latestStatus}) ls
          ON ls.RoomID   = a.RoomID
         AND ls.PCNumber = a.PCNumber
    GROUP BY a.RoomID
    ORDER BY a.RoomID
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

export default router;
