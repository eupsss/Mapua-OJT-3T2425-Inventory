<?php
require __DIR__.'/config.php';
echo json_encode(
  $pdo->query("
    SELECT RoomID, COUNT(*) AS defects
    FROM   ComputerStatusLog
    WHERE  Status='Defective'
    GROUP  BY RoomID
    ORDER  BY defects DESC
  ")->fetchAll(PDO::FETCH_ASSOC)
);
