<?php
/* api/update-status.php
   body:
   {
     "roomID"  : "MPO310",
     "pcNumber": "04",
     "status"  : "Working" | "Defective",
     "issues"  : ["Mouse","Memory"],          // optional
     "userID"  : 7                            // required
   }
*/
header('Content-Type: application/json; charset=utf-8');
require __DIR__.'/config.php';   // gives you $pdo

$body   = json_decode(file_get_contents('php://input'), true);
$room   = trim($body['roomID']    ?? '');
$pc     = trim($body['pcNumber']  ?? '');
$status = trim($body['status']    ?? '');
$issues =        $body['issues']  ?? [];
$userID = intval($body['userID']  ?? 0);

if (
    !$room
 || !$pc
 || !in_array($status, ['Available','Defective'], true)
 || !$userID
) {
    http_response_code(422);
    echo json_encode(['success'=>false,'error'=>'Invalid input']);
    exit;
}

$issuesStr = (is_array($issues) && $issues) ? implode(',', $issues) : null;

try {
    $pdo->beginTransaction();

    // 1️⃣ keep master table in sync
    $upd = $pdo->prepare("
        UPDATE Computers
        SET Status      = :st,        -- ← no IF(), just use the value
            LastUpdated = NOW()
        WHERE RoomID   = :rm
        AND PCNumber = :pc
        AND PCNumber <= '40'
    ");
    $upd->execute([
        ':st' => $status,   // 'Working' or 'Defective'
        ':rm' => $room,
        ':pc' => $pc
    ]);


    // 2️⃣ upsert into ComputerStatusLog
    $log = $pdo->prepare("
        INSERT INTO ComputerStatusLog
               (RoomID, PCNumber, CheckDate, Status, Issues, UserID, LoggedAt)
        VALUES (:rm, :pc, CURDATE(), :st, :iss, :uid, NOW())
        ON DUPLICATE KEY UPDATE
               Status   = VALUES(Status),
               Issues   = VALUES(Issues),
               UserID   = VALUES(UserID),
               LoggedAt = VALUES(LoggedAt)
    ");
    $log->execute([
        ':rm'  => $room,
        ':pc'  => $pc,
        ':st'  => $status,
        ':iss' => $issuesStr,
        ':uid' => $userID
    ]);

    // 3️⃣ record a fix event when a PC is marked back to WORKING
    if ($status === 'Available') {
        $fix = $pdo->prepare("
            INSERT INTO Fixes
                   (RoomID, PCNumber, FixedAt, FixedBy)
            VALUES (:rm, :pc, NOW(), :uid)
        ");
        $fix->execute([
            ':rm'  => $room,
            ':pc'  => $pc,
            ':uid' => $userID
        ]);
    }

    $pdo->commit();
    echo json_encode(['success'=>true]);

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success'=>false, 'error'=>$e->getMessage()]);
}
