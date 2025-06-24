<?php
// db.php — Database connection config

$host     = 'localhost';
$dbname   = 'MapuaInventory';
$username = 'root';  // 👈 Replace with your DB username
$password = '';  // 👈 Replace with your DB password

try {
  $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => 'Database connection failed']);
  exit;
}
