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

require __DIR__.'/config.php';          //  $pdo
$body = json_decode(file_get_contents('php://input'), true);

$room   = trim($body['roomID']    ?? '');
$pc     = trim($body['pcNumber']  ?? '');
$status = trim($body['status']    ?? '');
$issues =        $body['issues']  ?? [];
$userID = intval($body['userID']  ?? 0);

if (!$room || !$pc || !in_array($status,['Working','Defective'],true) || !$userID){
    http_response_code(422);
    echo json_encode(['success'=>false,'error'=>'Invalid input']);
    exit;
}

$issuesStr = (is_array($issues) && $issues) ? implode(',',$issues) : null;

try{
    $pdo->beginTransaction();

    /* 1️⃣  keep master table in sync */
    $upd = $pdo->prepare("
        UPDATE Computers
           SET Status      = IF(:st='Defective','Defective','Available'),
               LastUpdated = NOW()
         WHERE RoomID=:rm AND PCNumber=:pc AND PCNumber<='40'
    ");
    $upd->execute([':st'=>$status, ':rm'=>$room, ':pc'=>$pc]);

    /* 2️⃣  UPSERT into ComputerStatusLog  (one row per PC/day) */
    $log = $pdo->prepare("
        INSERT INTO ComputerStatusLog
               (RoomID,PCNumber,CheckDate,Status,Issues,UserID,LoggedAt)
        VALUES (:rm,:pc,CURDATE(),:st,:iss,:uid,NOW())
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

    $pdo->commit();
    echo json_encode(['success'=>true]);
}catch(Exception $e){
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
