<?php
/* api/issues-breakdown.php */
require __DIR__.'/config.php';
header('Content-Type: application/json; charset=utf-8');

/* one UNION-stack, each line has its own FROM */
$sql = "
  SELECT 'Mouse'             AS issue , SUM(FIND_IN_SET('Mouse',             ComputerStatusLog.Issues) > 0) AS cnt FROM ComputerStatusLog
UNION ALL
  SELECT 'Keyboard'          AS issue , SUM(FIND_IN_SET('Keyboard',          ComputerStatusLog.Issues) > 0) FROM ComputerStatusLog
UNION ALL
  SELECT 'Monitor'           AS issue , SUM(FIND_IN_SET('Monitor',           ComputerStatusLog.Issues) > 0) FROM ComputerStatusLog
UNION ALL
  SELECT 'Operating System'  AS issue , SUM(FIND_IN_SET('Operating System',  ComputerStatusLog.Issues) > 0) FROM ComputerStatusLog
UNION ALL
  SELECT 'Memory'            AS issue , SUM(FIND_IN_SET('Memory',            ComputerStatusLog.Issues) > 0) FROM ComputerStatusLog
UNION ALL
  SELECT 'CPU'               AS issue , SUM(FIND_IN_SET('CPU',               ComputerStatusLog.Issues) > 0) FROM ComputerStatusLog
UNION ALL
  SELECT 'GPU'               AS issue , SUM(FIND_IN_SET('GPU',               ComputerStatusLog.Issues) > 0) FROM ComputerStatusLog
UNION ALL
  SELECT 'Network'           AS issue , SUM(FIND_IN_SET('Network',           ComputerStatusLog.Issues) > 0) FROM ComputerStatusLog
UNION ALL
  SELECT 'Other'             AS issue , SUM(FIND_IN_SET('Other',             ComputerStatusLog.Issues) > 0) FROM ComputerStatusLog
";

echo json_encode(
  $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC),
  JSON_NUMERIC_CHECK
);
