<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

// Sample insert logic for borrowing
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $studentNo    = $_POST['studentNo'] ?? '';
    $itemCategory = $_POST['itemCategory'] ?? '';
    $itemDetails  = $_POST['itemDetails'] ?? '';
    $dueAt        = $_POST['dueAt'] ?? null;

    if (empty($studentNo) || empty($itemCategory)) {
        echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
        exit;
    }

    $sql = "INSERT INTO BorrowedItems (StudentNo, ItemCategory, ItemDetails, DueAt)
            VALUES (:studentNo, :itemCategory, :itemDetails, :dueAt)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':studentNo'    => $studentNo,
        ':itemCategory' => $itemCategory,
        ':itemDetails'  => $itemDetails,
        ':dueAt'        => $dueAt
    ]);

    echo json_encode(['status' => 'success', 'message' => 'Item borrowed successfully']);
}
?>
