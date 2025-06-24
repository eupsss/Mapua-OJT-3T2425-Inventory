<?php
header('Content-Type: application/json');
require __DIR__.'/db.php';

$data = json_decode(file_get_contents('php://input'), true);
$fname = trim($data['fname'] ?? '');
$lname = trim($data['lname'] ?? '');
$email = trim($data['email'] ?? '');
$phone = trim($data['phone'] ?? '');
$pass  = $data['pass'] ?? '';
$role  = ($data['role'] ?? 'Viewer') === 'Admin' ? 'Admin' : 'Viewer';

if (!$fname || !$lname || !filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($pass)<6) {
  http_response_code(400); echo json_encode(['success'=>false,'error'=>'Invalid input']); exit;
}

try {
  $hash = password_hash($pass, PASSWORD_BCRYPT);
  $stmt = $pdo->prepare("
     INSERT INTO Users (FirstName,LastName,Email,ContactNo,PasswordHash,Role)
     VALUES (?,?,?,?,?,?)
  ");
  $stmt->execute([$fname,$lname,$email,$phone,$hash,$role]);
  echo json_encode(['success'=>true]);
} catch (PDOException $e) {
  $err = $e->errorInfo[1]==1062 ? 'Email already used' : 'DB error';
  http_response_code(400); echo json_encode(['success'=>false,'error'=>$err]);
}
