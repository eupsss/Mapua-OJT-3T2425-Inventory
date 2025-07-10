import { Router } from 'express';
import { pool }   from '../db.js';

const router = Router();

router.post('/', async (req, res) => {
  // 0️⃣ Auth
  const u = req.session.user;
  if (!u?.id) {
    return res.status(401).json({ success:false, error:'Not authenticated' });
  }
  const userID = u.id;

  // 1️⃣ Validate input
  const { roomID = '', pcNumber = '', status = '', issues = [] } = req.body;
  if (!roomID.trim() || !pcNumber || !['Working','Defective'].includes(status)) {
    return res.status(422).json({ success:false, error:'Invalid payload' });
  }
  const issuesStr = Array.isArray(issues) && issues.length ? issues.join(',') : null;

  // 2️⃣ Start transaction
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();


    const [[{ maxSeq }]] = await conn.execute(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(ServiceTicketID, '-', -1) AS UNSIGNED)), 0) AS maxSeq
         FROM ComputerStatusLog`
    );

    const seq = Number(maxSeq) + 1;  // numeric increment, not concatenation

    // 4️⃣ Build ticket ID (e.g. MPO310-18-Fixed-000000170)
    const tag    = status === 'Working' ? 'Fixed' : 'Defective';
    const serial = String(seq).padStart(9, '0');
    const ticketID = `${roomID}-${pcNumber}-${tag}-${serial}`;

    // 5️⃣ Update Computers table
    await conn.execute(
      `UPDATE Computers
          SET Status = ?, LastUpdated = NOW()
        WHERE RoomID = ? AND PCNumber = ?`,
      [status, roomID, pcNumber]
    );

    // 6️⃣ Insert into ComputerStatusLog
    await conn.execute(
      `INSERT INTO ComputerStatusLog
         (RoomID, PCNumber, CheckDate, Status, Issues, ServiceTicketID, UserID, LoggedAt)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?, NOW())`,
      [roomID, pcNumber, status, issuesStr, ticketID, userID]
    );

    // 7️⃣ If marking as Working, upsert into Fixes
    if (status === 'Working') {
      await conn.execute(
        `INSERT INTO Fixes
           (RoomID, PCNumber, FixedAt, FixedBy, ServiceTicketID)
         VALUES (?, ?, NOW(), ?, ?)
         ON DUPLICATE KEY UPDATE
           FixedAt = VALUES(FixedAt),
           FixedBy = VALUES(FixedBy)`,
        [roomID, pcNumber, userID, ticketID]
      );
    }

    // 8️⃣ Commit transaction
    await conn.commit();
    res.json({ success:true, serviceTicketID: ticketID });

  } catch (err) {
    await conn.rollback();
    console.error('❌ [update-status] Transaction error:', err);
    res.status(500).json({ success:false, error: err.message });
  } finally {
    conn.release();
  }
});

export default router;