<?php
require __DIR__.'/config.php';
header('Content-Type: application/json; charset=utf-8');

/* ── reports: defect / available history + who fixed it ───────────── */
$sql = <<<SQL
SELECT
  /* NEW — Service Ticket number */
  l.ServiceTicketID,

  /* Existing columns */
  DATE(l.LoggedAt)                       AS CheckDate,
  l.RoomID,
  l.PCNumber,
  l.Status,
  l.Issues,

  /* dash when no matching fix */
  COALESCE(DATE(f.FixedAt),        '—')  AS FixedOn,
  COALESCE(CONCAT(u2.FirstName,' ',u2.LastName), '—')
                                         AS FixedBy,

  CONCAT(u1.FirstName,' ',u1.LastName)   AS RecordedBy

FROM   ComputerStatusLog AS l


LEFT JOIN Fixes AS f
  ON f.FixID = (
       SELECT fx.FixID
       FROM   Fixes fx
       WHERE  fx.RoomID   = l.RoomID
         AND  fx.PCNumber = l.PCNumber
         AND  fx.FixedAt  <= l.LoggedAt        -- key line
       ORDER BY fx.FixedAt DESC
       LIMIT 1
     )

/* user look-ups */
LEFT JOIN Users AS u1 ON u1.UserID = l.UserID      -- recorded by
LEFT JOIN Users AS u2 ON u2.UserID = f.FixedBy     -- fixed by

ORDER BY l.LoggedAt DESC;
SQL;

/* return as JSON */
echo json_encode(
  $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC),
  JSON_UNESCAPED_UNICODE
);
?>
