<?php
// config.php
// Adjust these to match your XAMPP/MySQL setup
$dbHost = '127.0.0.1';
$dbName = 'MapuaInventory';
$dbUser = 'root';
$dbPass = ''; 

try {
    $pdo = new PDO(
        "mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4",
        $dbUser,
        $dbPass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}
