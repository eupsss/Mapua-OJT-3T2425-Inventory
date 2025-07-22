// routes/update-status.js
import { Router } from 'express';
import { pool }   from '../db.js';

const router = Router();

router.post('/', async (req, res) => {
  // 0) Auth
  const u = req.session.user;
  if (!u?.id) {
    return res.status(401).json({ success:false, error:'Not authenticated' });
  }
  const userID = u.id;

  // 1) Parse & validate
  const {
    roomID    = '',
    pcNumber  = '',
    status    = '',               // 'Defective' or 'Working'
    issues    = [],               // array of strings, only for defects
    reportedAt = null,            // "YYYY-MM-DD HH:MM:00", override for defect
    fixedAt    = null             // "YYYY-MM-DD HH:MM:00", override for fix
  } = req.body;

  if (
    !roomID.trim() ||
    !pcNumber ||
    !['Defective','Working'].includes(status)
  ) {
    return res
      .status(422)
      .json({ success:false, error:'Invalid payload' });
  }

  const issuesStr =
    Array.isArray(issues) && issues.length
      ? issues.join(',')
      : null;

  // Choose the correct timestamp override
  const timestampOverride =
    status === 'Defective' ? reportedAt
  : status === 'Working'  ? fixedAt
  : null;

  // 2) Start transaction
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 3) Build a sequential ticket ID
    const [[{ maxSeq }]] = await conn.query(
      `SELECT
         COALESCE(
           MAX(CAST(SUBSTRING_INDEX(ServiceTicketID,'-',-1) AS UNSIGNED)),
           0
         ) AS maxSeq
       FROM ComputerStatusLog`
    );
    const seq      = Number(maxSeq) + 1;
    const tag      = status === 'Working' ? 'Fixed' : 'Defective';
    const serial   = String(seq).padStart(9, '0');
    const ticketID = `${roomID}-${pcNumber}-${tag}-${serial}`;

    // 4) Update the Computers “master” row
    await conn.query(
      `UPDATE Computers
         SET Status      = ?,
             LastUpdated = COALESCE(?, NOW())
       WHERE RoomID   = ?
         AND PCNumber = ?`,
      [ status, timestampOverride, roomID, pcNumber ]
    );

    // 5) Insert into ComputerStatusLog
    await conn.query(
      `INSERT INTO ComputerStatusLog
         (RoomID, PCNumber, CheckDate, Status, Issues, ServiceTicketID, UserID, LoggedAt)
       VALUES
         (?,       ?,        CURDATE(), ?,      ?,      ?,               ?,      COALESCE(?, NOW()))
      `,
      [
        roomID,
        pcNumber,
        status,
        issuesStr,
        ticketID,
        userID,
        timestampOverride
      ]
    );

    // 6) If it's a fix, also write to Fixes
    if (status === 'Working') {
      await conn.query(
        `INSERT INTO Fixes
           (RoomID, PCNumber, FixedAt, FixedBy, ServiceTicketID)
         VALUES
           (?,       ?,        COALESCE(?, NOW()),    ?,           ?)
         ON DUPLICATE KEY UPDATE
           FixedAt = VALUES(FixedAt),
           FixedBy = VALUES(FixedBy)
        `,
        [ roomID, pcNumber, timestampOverride, userID, ticketID ]
      );
    }

    // 7) Commit & respond
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
