<?php
require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

/* 1)  Decode + sanity-check ------------------------------------------------ */
$data = json_decode(file_get_contents('php://input'), true);

$roomID   = $data['roomID']   ?? null;
$pcNumber = $data['pcNumber'] ?? null;
$fixedRaw = $data['fixedOn']  ?? null;     // e.g. 2025-06-17T22:30
$fixedBy  = $data['fixedBy']  ?? null;     // UserID int

if (!$roomID || !$pcNumber || !$fixedRaw || !$fixedBy) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid payload']);
    exit;
}

/* Convert 2025-06-17T22:30 --> 2025-06-17 22:30:00 */
$fixedAt = date('Y-m-d H:i:s', strtotime($fixedRaw));

try {
    $pdo->beginTransaction();

    /* 2-a  insert into Fixes */
    $ins = $pdo->prepare(
        'INSERT INTO Fixes (RoomID, PCNumber, FixedAt, FixedBy)
         VALUES (:room, :pc, :fixedAt, :fixedBy)'
    );
    $ins->execute([
        ':room'    => $roomID,
        ':pc'      => $pcNumber,
        ':fixedAt' => $fixedAt,
        ':fixedBy' => $fixedBy
    ]);

    /* 2-b  close latest ComputerStatusLog entry                   */
    $updLog = $pdo->prepare(
        'UPDATE ComputerStatusLog
            SET Status = "Available"
          WHERE RoomID   = :room
            AND PCNumber = :pc
            AND Status   = "Defective"
          ORDER BY LoggedAt DESC
          LIMIT 1'
    );
    $updLog->execute([':room' => $roomID, ':pc' => $pcNumber]);

    /* 2-c  update master Computers row  (OPTIONAL – keep / trim) */
    $updPc = $pdo->prepare(
        'UPDATE Computers
            SET Status      = "Available",
                LastFixedAt = :fixedAt,
                LastFixedBy = :fixedBy
          WHERE RoomID   = :room
            AND PCNumber = :pc'
    );
    $updPc->execute([
        ':fixedAt' => $fixedAt,
        ':fixedBy' => $fixedBy,
        ':room'    => $roomID,
        ':pc'      => $pcNumber
    ]);

    $pdo->commit();
    echo json_encode(['ok' => true]);

} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        'error'   => 'Database operation failed',
        'driver'  => $e->getCode(),
        'message' => $e->getMessage()   // log internally in prod
    ]);
}
