<?php
require __DIR__.'/config.php';
echo json_encode(
  $pdo->query("
    SELECT DATE(FixedAt) AS d, COUNT(*) AS cnt
    FROM   Fixes
    GROUP  BY d
    ORDER  BY d
  ")->fetchAll(PDO::FETCH_ASSOC)
);
