<?php
require __DIR__.'/config.php';   // $pdo

$sql = "
SELECT ROUND(AVG(TIMESTAMPDIFF(SECOND, d.LoggedAt, f.FixedAt))/3600, 2) AS avgHours
FROM   ComputerStatusLog d
JOIN   Fixes f
  ON   f.RoomID   = d.RoomID
 AND   f.PCNumber = d.PCNumber
WHERE  d.Status   = 'Defective'
  -- only the first defect instance for that day
  AND   NOT EXISTS (
        SELECT 1 FROM ComputerStatusLog d2
        WHERE  d2.RoomID=d.RoomID AND d2.PCNumber=d.PCNumber
        AND    d2.LoggedAt < d.LoggedAt
        AND    DATE(d2.LoggedAt)=DATE(d.LoggedAt)
  );
";
echo json_encode($pdo->query($sql)->fetch(PDO::FETCH_ASSOC));
