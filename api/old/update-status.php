<?php
// api/update-status.php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/config.php';   // gives you $pdo

// 1️⃣ Decode & validate input
$body         = json_decode(file_get_contents('php://input'), true);
$room         = trim($body['roomID']    ?? '');
$pc           = trim($body['pcNumber']  ?? '');
$inputStatus  = trim($body['status']    ?? '');  // only "Available" or "Defective"
$issuesArr    = $body['issues']           ?? [];
$userID       = intval($body['userID']    ?? 0);

if (
    !$room
 || !$pc
 || !in_array($inputStatus, ['Available','Defective'], true)
 || $userID <= 0
) {
    http_response_code(422);
    echo json_encode([
      'success' => false,
      'error'   => 'Invalid input – status must be Available or Defective'
    ]);
    exit;
}

// 2️⃣ Map values for each table
$dbStatus   = $inputStatus;               // fits Computers.Status enum
$logStatus  = ($inputStatus === 'Available')
             ? 'Working'                  // fits ComputerStatusLog.Status enum
             : 'Defective';
$issuesStr  = (is_array($issuesArr) && count($issuesArr))
             ? implode(',', $issuesArr)
             : null;

try {
    $pdo->beginTransaction();

    // 3️⃣ Update the master Computers table
    $upd = $pdo->prepare("
        UPDATE Computers
           SET Status      = :status,
               LastUpdated = NOW()
         WHERE RoomID   = :room
           AND PCNumber = :pc
           AND PCNumber <= '40'
    ");
    $upd->execute([
      ':status'   => $dbStatus,
      ':room'     => $room,
      ':pc'       => $pc
    ]);

    // 4️⃣ Insert or update today’s status log
    $log = $pdo->prepare("
        INSERT INTO ComputerStatusLog
               (RoomID, PCNumber, CheckDate, Status, Issues, UserID, LoggedAt)
        VALUES (:room, :pc, CURDATE(), :status, :issues, :user, NOW())
        ON DUPLICATE KEY UPDATE
               Status   = VALUES(Status),
               Issues   = VALUES(Issues),
               UserID   = VALUES(UserID),
               LoggedAt = VALUES(LoggedAt)
    ");
    $log->execute([
      ':room'    => $room,
      ':pc'      => $pc,
      ':status'  => $logStatus,
      ':issues'  => $issuesStr,
      ':user'    => $userID
    ]);

    // 5️⃣ If we just marked it back to "Available", record a fix
    if ($inputStatus === 'Available') {
        $fix = $pdo->prepare("
            INSERT INTO Fixes
                   (RoomID, PCNumber, FixedAt, FixedBy)
            VALUES (:room, :pc, NOW(), :user)
        ");
        $fix->execute([
          ':room' => $room,
          ':pc'   => $pc,
          ':user' => $userID
        ]);
    }

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
      'success' => false,
      'error'   => $e->getMessage()
    ]);
}
