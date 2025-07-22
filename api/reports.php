<?php
// api/reports.php
header('Content-Type: application/json; charset=utf-8');

try {
    require __DIR__ . '/config.php';   // your PDO $pdo

    // Pull every daily‐log, with the user’s full name
    $sql = "
      SELECT 
        l.CheckDate,
        l.RoomID,
        l.PCNumber,
        l.Status,
        -- Issues is stored as comma‐list or NULL
        l.Issues,
        -- build a “First Last” from Users or show ‘System’ if no user
        COALESCE(CONCAT(u.FirstName,' ',u.LastName), 'System') AS RecordedBy
      FROM ComputerStatusLog AS l
      LEFT JOIN Users AS u
        ON l.UserID = u.UserID
      ORDER BY l.CheckDate DESC, l.LoggedAt DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
      'error' => 'Server error: '.$e->getMessage()
    ]);
    exit;
}
