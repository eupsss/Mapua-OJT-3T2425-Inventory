<?php
/* api/assets.php
 * -----------------------------------------------------------
 *  ── MODE 1 ──  ?room=ROOMID
 *      → one row per PC (latest / active spec only)
 *
 *  ── MODE 2 ──  ?room=ROOMID&history=1&pc=PCNUMBER
 *      → all specs for that PC, newest → oldest
 * --------------------------------------------------------- */

require __DIR__ . '/config.php';    // $pdo (PDO instance)

header('Content-Type: application/json; charset=utf-8');

/* ── 1  Validate parameters ──────────────────────────────── */
$roomID  = trim($_GET['room']  ?? '');
$history = isset($_GET['history']) ? (bool)$_GET['history'] : false;
$pc      = trim($_GET['pc']    ?? '');

if ($roomID === '') {
  http_response_code(400);
  echo json_encode(['error' => 'Missing ?room= parameter']);
  exit;
}

if ($history && $pc === '') {
  http_response_code(400);
  echo json_encode(['error' => 'History mode needs ?pc=']);
  exit;
}

/* ── 2  Choose SQL based on mode ─────────────────────────── */

/* 2A  HISTORY of *one* PC ---------------------------------- */
if ($history) {
  $sql = <<<SQL
    SELECT
      InstalledAt,
      RetiredAt,
      MakeModel, SerialNumber, CPU, GPU,
      RAM_GB, Storage_GB,
      MonitorModel, MonitorSerial,
      UPSModel,     UPSSerial
    FROM   ComputerAssets
    WHERE  RoomID   = :room
      AND  PCNumber = :pc
    ORDER  BY InstalledAt DESC
SQL;

  $stmt = $pdo->prepare($sql);
  $stmt->execute([
    'room' => $roomID,
    'pc'   => $pc
  ]);
  echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC),
                   JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

/* 2B  LATEST / ACTIVE spec for every PC in the room -------- */
/*  • The sub-query picks the *newest* (max InstalledAt) row  */
$sql = <<<SQL
SELECT
  c.PCNumber,
  c.Status,                             -- Working / Defective / …
  a.InstalledAt,
  a.MakeModel,
  a.SerialNumber,
  a.CPU,
  a.GPU,
  a.RAM_GB,
  a.Storage_GB,
  a.MonitorModel,
  a.MonitorSerial,
  a.UPSModel,
  a.UPSSerial
FROM   Computers AS c
LEFT JOIN ComputerAssets AS a
  ON  a.RoomID   = c.RoomID
  AND a.PCNumber = c.PCNumber
  AND a.InstalledAt = (
        SELECT MAX(InstalledAt)
        FROM   ComputerAssets
        WHERE  RoomID   = c.RoomID
          AND  PCNumber = c.PCNumber
      )
WHERE  c.RoomID = :room
ORDER  BY CAST(c.PCNumber AS UNSIGNED)
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['room' => $roomID]);

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC),
                 JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
