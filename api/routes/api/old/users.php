<?php
require __DIR__ . '/config.php';      // supplies $pdo (PDO connection)

header('Content-Type: application/json; charset=utf-8');

// ------------------------------------------------------------------
// 1) Build the query — filter by role if ?role=… is present
// ------------------------------------------------------------------
$where  = '';
$params = [];

if (!empty($_GET['role'])) {
    $where = 'WHERE Role = :role';   // assumes a `Role` column (varchar)
    $params[':role'] = $_GET['role'];
}

$sql = "
    SELECT
      UserID                       AS userId,
      CONCAT(FirstName,' ',LastName) AS fullName
    FROM Users
    {$where}
    ORDER BY fullName
";

// ------------------------------------------------------------------
// 2) Execute and emit JSON
// ------------------------------------------------------------------
try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($users, JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error'   => 'Database query failed',
        'message' => $e->getMessage()
    ]);
    // In production you might log the error instead of returning it
}
