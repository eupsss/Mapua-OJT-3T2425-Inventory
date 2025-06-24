<?php

header('Content-Type: application/json');

$host     = 'localhost';
$dbname   = 'mapuainventory';
$user     = 'root';    // XAMPP default
$pass     = '';        // XAMPP default (blank)

try {
  $pdo = new PDO(
    "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
    $user, $pass,
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]
  );
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(['success'=>false,'error'=>'Database connection failed']);
  exit;
}
