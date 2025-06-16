<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/config.php';

/* last 10 defects (today → older) */
$sql = "
SELECT
  csl.RoomID,
  csl.PCNumber,
  csl.CheckDate,
  csl.Status,
  COALESCE(CONCAT(u.FirstName,' ',u.LastName),'–') AS RecordedBy
FROM ComputerStatusLog csl
LEFT JOIN Users u  ON u.UserID = csl.UserID
WHERE csl.Status = 'Defective'
ORDER BY csl.LoggedAt DESC
LIMIT 10
";
echo json_encode($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC));
