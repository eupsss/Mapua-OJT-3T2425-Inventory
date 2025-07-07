// api/routes/update-status.js
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

  // 1️⃣ Validate
  const { roomID='', pcNumber='', status='', issues=[] } = req.body;
  if (
    !roomID.trim() ||
    !pcNumber ||
    !['Working','Defective'].includes(status)
  ) {
    return res.status(422).json({ success:false, error:'Invalid payload' });
  }
  const issuesStr = Array.isArray(issues) && issues.length
    ? issues.join(',')
    : null;

  // 2️⃣ Grab a transaction‐scoped connection
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 3️⃣ Count today's logs for this PC (in‐txn)
    const [[{ cnt }]] = await conn.execute(
      `SELECT COUNT(*) AS cnt
         FROM ComputerStatusLog
        WHERE RoomID   = ?
          AND PCNumber = ?
          AND DATE(LoggedAt)=CURDATE()`,
      [roomID, pcNumber]
    );

    // 4️⃣ Build the ticket ID
    const tag      = status === 'Working' ? 'Fixed' : 'Defective';
    const serial   = String(cnt + 1).padStart(9, '0');
    const ticketID = `${roomID}-${pcNumber}-${tag}-${serial}`;

    // 5️⃣ Update the PC’s live status
    await conn.execute(
      `UPDATE Computers
          SET Status      = ?,
              LastUpdated = NOW()
        WHERE RoomID     = ?
          AND PCNumber   = ?`,
      [status, roomID, pcNumber]
    );

    // 6️⃣ Insert a new status log row
    await conn.execute(
      `INSERT INTO ComputerStatusLog
         (RoomID, PCNumber, CheckDate, Status, Issues, ServiceTicketID, UserID, LoggedAt)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?, NOW())`,
      [roomID, pcNumber, status, issuesStr, ticketID, userID]
    );

    // 7️⃣ If we’re marking it back to Working, log the fix
    if (status === 'Working') {
      await conn.execute(
        `INSERT INTO Fixes
           (RoomID, PCNumber, FixedAt, FixedBy, ServiceTicketID)
         VALUES (?, ?, NOW(), ?, ?)`,
        [roomID, pcNumber, userID, ticketID]
      );
    }

    // 8️⃣ Commit everything at once
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
