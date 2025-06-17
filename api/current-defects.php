<?php
// api/current-defects.php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/config.php';   // → $pdo

// 1️⃣ grab & sanitize date param (YYYY-MM-DD)
$rawDate = $_GET['date'] ?? date('Y-m-d');
$date    = date('Y-m-d', strtotime($rawDate));

// 2️⃣ build & run SQL
$sql = "
  SELECT
    l.RoomID,
    l.PCNumber,
    l.CheckDate       AS Date,
    COALESCE(CONCAT(u.FirstName,' ',u.LastName),'–') AS RecordedBy,
    l.Status,
    l.Issues,
    (
      SELECT DATE(f.FixedAt)
      FROM Fixes f
      WHERE f.RoomID    = l.RoomID
        AND f.PCNumber  = l.PCNumber
        AND f.FixedAt  >= l.LoggedAt
      ORDER BY f.FixedAt
      LIMIT 1
    ) AS FixedOn
  FROM ComputerStatusLog l
  JOIN Computers c 
    ON c.RoomID   = l.RoomID
   AND c.PCNumber = l.PCNumber
  LEFT JOIN Users u 
    ON u.UserID   = l.UserID
  WHERE l.CheckDate = :date
    AND l.Status    = 'Defective'
  ORDER BY l.RoomID, CAST(l.PCNumber AS UNSIGNED)
";

$stmt = $pdo->prepare($sql);
$stmt->execute([':date' => $date]);

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
