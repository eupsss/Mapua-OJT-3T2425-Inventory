<?php
header('Content-Type: application/json');
require __DIR__ . '/config.php';        // your PDO $pdo

/* ---- read JSON body ---- */
$data = json_decode(file_get_contents('php://input'), true);
$room = $data['roomID']    ?? '';
$pc   = $data['pcNumber']  ?? '';
$stat = $data['status']    ?? '';

try {
    $pdo->beginTransaction();

    /* 1️⃣  Update master table (PC 00-40 only) */
    $stmt = $pdo->prepare("
      UPDATE Computers
         SET Status      = IF(:s = 'Defective','Defective','Available'),
             LastUpdated = CURDATE()
       WHERE RoomID   = :r
         AND PCNumber = :p
         AND PCNumber <= '40'
    ");
    $stmt->execute(['s'=>$stat,'r'=>$room,'p'=>$pc]);

    /* 2️⃣  Upsert daily log row */
    $log = $pdo->prepare("
      INSERT INTO ComputerStatusLog (RoomID, PCNumber, CheckDate, Status)
      VALUES (:r, :p, CURDATE(), :s)
      ON DUPLICATE KEY UPDATE Status = VALUES(Status)
    ");
    $log->execute(['r'=>$room, 'p'=>$pc, 's'=>$stat]);

    $pdo->commit();
    echo json_encode(['success'=>true]);
} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
