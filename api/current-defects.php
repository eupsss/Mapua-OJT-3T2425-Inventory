<?php
// api/current-defects.php
header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/config.php';   // → $pdo

$sql = "
  SELECT  c.RoomID,
          c.PCNumber,
          c.LastUpdated,
          COALESCE(CONCAT(u.FirstName,' ',u.LastName),'–') AS RecordedBy,
          l.Issues
  FROM    Computers c
  JOIN    ComputerStatusLog l
           ON  l.RoomID     = c.RoomID
           AND l.PCNumber   = c.PCNumber
           AND l.CheckDate  = CURDATE()             -- today’s log row
  LEFT JOIN Users u  ON u.UserID = l.UserID
  WHERE   c.Status = 'Defective'
  ORDER BY c.RoomID, CAST(c.PCNumber AS UNSIGNED);
";

echo json_encode($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC));
