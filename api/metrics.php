<?php
header('Content-Type: application/json');
require __DIR__ . '/config.php';          // same PDO $pdo you used before

try {
    /* PCs 00-40 only (ignore instructor 41) */
    $tot   = $pdo->query("
        SELECT COUNT(*) FROM Computers
        WHERE PCNumber <= '40'
    ")->fetchColumn();

    $def   = $pdo->query("
        SELECT COUNT(*) FROM Computers
        WHERE PCNumber <= '40' AND Status = 'Defective'
    ")->fetchColumn();

    $work  = $tot - $def;

    /* how many unique PCs were checked today? */
    $stmt = $pdo->prepare("
      SELECT COUNT(DISTINCT PCNumber)
        FROM ComputerStatusLog
       WHERE CheckDate = CURDATE()
         AND PCNumber <= '40'
    ");
    $stmt->execute();
    $checked = $stmt->fetchColumn();

    echo json_encode([
        'totalPCs'     => (int)$tot,
        'workingPCs'   => (int)$work,
        'defectivePCs' => (int)$def,
        'checkedToday' => (int)$checked
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'metrics failed']);
}
