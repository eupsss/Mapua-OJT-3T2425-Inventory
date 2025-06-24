// routes/update-status.js
import { Router } from 'express';
import { pool }   from '../db.js';

const router = Router();

router.post('/', async (req, res) => {
  // 1️⃣ Get userID from the session
  const sessUser = req.session.user;
  if (!sessUser || !sessUser.id) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const userID = sessUser.id;

  // 2️⃣ Pull payload & validate
  const { roomID = '', pcNumber = '', status = '', issues = [] } = req.body;
  if (
    !roomID.trim() ||
    !pcNumber.toString().trim() ||
    !['Available', 'Defective'].includes(status)
  ) {
    return res.status(422).json({
      success: false,
      error: 'Invalid input: roomID, pcNumber, and status (Available|Defective) are required.'
    });
  }

  // 3️⃣ Prepare derived values
  const logStatus = status === 'Available' ? 'Working' : 'Defective';
  const issuesStr = Array.isArray(issues) && issues.length
    ? issues.join(',')
    : null;

  try {
    // 4️⃣ Update the master Computers table
    await pool.execute(
      `UPDATE Computers
         SET Status = ?, LastUpdated = NOW()
       WHERE RoomID = ? AND PCNumber = ? AND PCNumber <= 40`,
      [status, roomID, pcNumber]
    );

    // 5️⃣ Insert (or upsert) into ComputerStatusLog
    await pool.execute(
      `INSERT INTO ComputerStatusLog
         (RoomID, PCNumber, CheckDate, Status, Issues, UserID, LoggedAt)
       VALUES (?, ?, CURDATE(), ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         Status   = VALUES(Status),
         Issues   = VALUES(Issues),
         UserID   = VALUES(UserID),
         LoggedAt = VALUES(LoggedAt)`,
      [roomID, pcNumber, logStatus, issuesStr, userID]
    );

    // 6️⃣ If we just marked it back to Available, record a fix
    if (status === 'Available') {
      await pool.execute(
        `INSERT INTO Fixes
           (RoomID, PCNumber, FixedAt, FixedBy)
         VALUES (?, ?, NOW(), ?)`,
        [roomID, pcNumber, userID]
      );
    }

    // 7️⃣ Success
    return res.json({ success: true });
  } catch (err) {
    console.error('❌ [update-status] error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
