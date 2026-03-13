<?php

session_start();
header('Content-Type: application/json');

$ADMIN_USER = "admin";
$ADMIN_PASS = "myStrongPassword123";

$input = json_decode(file_get_contents('php://input'), true);

$user = $input['username'] ?? '';
$pass = $input['password'] ?? '';

if ($user === $ADMIN_USER && $pass === $ADMIN_PASS) {

    $_SESSION['admin'] = true;

    echo json_encode([
        "success" => true
    ]);

} else {

    http_response_code(401);

    echo json_encode([
        "success" => false
    ]);
}
