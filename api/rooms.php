<?php
header('Content-Type: application/json');
require __DIR__ . '/config.php';

try {
    $stmt = $pdo->query("SELECT RoomID FROM `Room` ORDER BY RoomID");
    $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rooms);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch rooms']);
}
