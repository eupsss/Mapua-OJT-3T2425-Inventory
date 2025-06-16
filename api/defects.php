<?php
header('Content-Type: application/json');
require __DIR__ . '/config.php';   // PDO  $pdo

/* return the 15 most-recent “Defective” entries (PC ≤ 40) */
$sql = "
  SELECT l.RoomID,
         l.PCNumber,
         l.CheckDate,
         l.Status
    FROM ComputerStatusLog l
   WHERE l.Status = 'Defective'
     AND l.PCNumber <= '40'
ORDER BY l.CheckDate DESC
   LIMIT 15";
echo json_encode($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC));
