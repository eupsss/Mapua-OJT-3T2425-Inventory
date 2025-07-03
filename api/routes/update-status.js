// api/routes/update-status.js
import { Router } from 'express';
import { pool }   from '../db.js';

const router = Router();

/* ── helper: pull last ticket for this PC (today) ─────────────── */
async function latestTicket(conn, roomID, pcNumber) {
  const [rows] = await conn.execute(
    `SELECT ServiceTicketID
       FROM ComputerStatusLog
      WHERE RoomID   = ?
        AND PCNumber = ?
      ORDER BY LoggedAt DESC
      LIMIT 1`,
    [roomID, pcNumber]
  );
  return rows.length ? rows[0].ServiceTicketID : null;
}

/* ───────────────────────── route ─────────────────────────────── */
router.post('/', async (req, res) => {
  /* 0️⃣  Auth */
  const u = req.session.user;
  if (!u || !u.id) {
    return res.status(401).json({ success:false, error:'Not authenticated' });
  }
  const userID = u.id;

  /* 1️⃣  Validate */
  const { roomID='', pcNumber='', status='', issues=[] } = req.body;
  if (!roomID.trim() || !pcNumber || !['Working','Defective'].includes(status)) {
    return res.status(422).json({ success:false, error:'Invalid payload' });
  }
  const issuesStr = Array.isArray(issues)&&issues.length ? issues.join(',') : null;

  /* 2️⃣  Transaction */
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    /* a) Computers */
    await conn.execute(
      `UPDATE Computers
          SET Status = ?, LastUpdated = NOW()
        WHERE RoomID=? AND PCNumber=?`,
      [status, roomID, pcNumber]
    );

    /* b) ComputerStatusLog
          – pass NULL so trigger builds the ticket */
    await conn.execute(
      `INSERT INTO ComputerStatusLog
         (RoomID,PCNumber,CheckDate,Status,Issues,ServiceTicketID,UserID,LoggedAt)
       VALUES (?, ?, CURDATE(), ?, ?, NULL, ?, NOW())
       ON DUPLICATE KEY UPDATE
         Status  = VALUES(Status),
         Issues  = VALUES(Issues),
         UserID  = VALUES(UserID),
         LoggedAt= VALUES(LoggedAt)`,
      [roomID, pcNumber, status, issuesStr, userID]
    );

    /* c) fetch the ticket the trigger (or earlier row) produced */
    const ticketID = await latestTicket(conn, roomID, pcNumber);

    /* d) Fixes row when status becomes Working */
    if (status === 'Working') {
      await conn.execute(
        `INSERT INTO Fixes
           (RoomID, PCNumber, FixedAt, FixedBy, ServiceTicketID)
         VALUES (?, ?, NOW(), ?, ?)`,
        [roomID, pcNumber, userID, ticketID]
      );
    }

    await conn.commit();
    res.json({ success:true });
  } catch (e) {
    await conn.rollback();
    console.error('❌ [update-status] SQL Error:', e.code, e.sqlMessage);
    res.status(500).json({ success:false, error: e.sqlMessage });
  

  } finally {
    conn.release();
  }
});

export default router;
