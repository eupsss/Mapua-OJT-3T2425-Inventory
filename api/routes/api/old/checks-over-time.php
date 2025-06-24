<?php
require __DIR__.'/config.php';
header('Content-Type: application/json; charset=utf-8');

// Count logs per day over the last 7 days
$sql = <<<SQL
  SELECT
    DATE(CheckDate) AS d,
    COUNT(*)        AS cnt
  FROM ComputerStatusLog
  WHERE CheckDate >= CURDATE() - INTERVAL 6 DAY
  GROUP BY DATE(CheckDate)
  ORDER BY DATE(CheckDate)
SQL;

$rows = $pdo
  ->query($sql)
  ->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($rows, JSON_UNESCAPED_UNICODE);
