<?php
require __DIR__.'/config.php';
header('Content-Type: application/json; charset=utf-8');

/* ── reports: defect / available history + who fixed it ───────────── */
$sql = <<<SQL
SELECT
  DATE(l.LoggedAt)                       AS CheckDate,
  l.RoomID,
  l.PCNumber,
  l.Status,
  l.Issues,

  DATE(f.FixedAt)                        AS FixedOn,
  CONCAT(u2.FirstName,' ',u2.LastName)   AS FixedBy,

  CONCAT(u1.FirstName,' ',u1.LastName)   AS RecordedBy

FROM ComputerStatusLog AS l

/* first Fix *after* this log row (if any) */
LEFT JOIN Fixes AS f
  ON f.FixID = (
       SELECT  MIN(fx.FixID)
       FROM    Fixes fx
       WHERE   fx.RoomID   = l.RoomID
         AND   fx.PCNumber = l.PCNumber
         AND   fx.FixedAt  >= l.LoggedAt
     )

/* user names */
LEFT JOIN Users AS u1 ON u1.UserID = l.UserID      /* recorder  */
LEFT JOIN Users AS u2 ON u2.UserID = f.FixedBy     /* technician*/

/* show every change; add a WHERE if you only want open defects
   WHERE l.Status = 'Defective' */
ORDER BY l.LoggedAt DESC;
SQL;

echo json_encode(
    $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC),
    JSON_UNESCAPED_UNICODE
);
