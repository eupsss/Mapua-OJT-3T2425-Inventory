<?php
/*-----------------------------------------------------------------
  api/login.php
------------------------------------------------------------------*/
header('Content-Type: application/json; charset=utf-8');
session_start();                           // enable PHP sessions

/* 1. DB connection ------------------------------------------------*/
require_once __DIR__ . '/config.php';      // creates $pdo (PDO)

/* 2. Read & validate JSON body -----------------------------------*/
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false,
                      'error'   => 'Invalid JSON']);
    exit;
}

$email = filter_var(trim($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$pass  = $data['pass'] ?? '';

if (!$email || !$pass) {
    http_response_code(400);
    echo json_encode(['success' => false,
                      'error'   => 'Email & password required']);
    exit;
}

/* 3. Look up user -------------------------------------------------*/
$stmt = $pdo->prepare(
    'SELECT UserID, FirstName, LastName, PasswordHash, Role
       FROM Users
      WHERE Email = ?'
);
$stmt->execute([$email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

/* 4. Verify password ---------------------------------------------*/
if ($user && password_verify($pass, $user['PasswordHash'])) {

    // save minimal user object in session for later API calls
    $_SESSION['user'] = [
        'id'   => (int)$user['UserID'],
        'name' => $user['FirstName'] . ' ' . $user['LastName'],
        'role' => $user['Role']
    ];

    echo json_encode(['success' => true,
                      'user'    => $_SESSION['user']]);
} else {
    http_response_code(401);                       // Unauthorized
    echo json_encode(['success' => false,
                      'error'   => 'Invalid credentials']);
}
