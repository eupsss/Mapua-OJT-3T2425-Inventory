<?php
header('Content-Type: application/json');
require __DIR__ . '/config.php';

$room = $_GET['room'] ?? '';
if (!$room) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing room parameter']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT PCNumber, Status
          FROM `Computers`
         WHERE RoomID = :room
         ORDER BY LPAD(PCNumber, 2, '0')
    ");
    $stmt->execute(['room' => $room]);
    $pcs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($pcs);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch PCs']);
}
