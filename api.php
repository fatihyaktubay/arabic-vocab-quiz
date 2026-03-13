<?php
session_start();

header('Content-Type: application/json; charset=utf-8');

$db = new SQLite3(__DIR__ . '/quiz.db');
$method = $_SERVER['REQUEST_METHOD'];

// Protect write operations
if (in_array($method, ['POST', 'PUT', 'DELETE'], true) && !isset($_SESSION['admin'])) {
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "error" => "Not authorized"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------- GET : return all vocabulary ----------
if ($method === 'GET') {
    $result = $db->query("
        SELECT id, chapter, arabic, english, starred
        FROM vocab
        ORDER BY chapter, id
    ");

    if (!$result) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "error" => $db->lastErrorMsg()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = [];

    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $data[] = $row;
    }

    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------- POST : update starred status ----------
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    $id = isset($input['id']) ? (int)$input['id'] : 0;
    $starred = isset($input['starred']) ? (int)$input['starred'] : 0;

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "Invalid id"
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $db->prepare("
        UPDATE vocab
        SET starred = :starred
        WHERE id = :id
    ");

    if (!$stmt) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "error" => $db->lastErrorMsg()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt->bindValue(':starred', $starred, SQLITE3_INTEGER);
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);

    $result = $stmt->execute();

    if (!$result) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "error" => $db->lastErrorMsg()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        "success" => true,
        "id" => $id,
        "starred" => $starred,
        "changes" => $db->changes()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------- PUT : edit question ----------
if ($method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);

    $id = isset($input['id']) ? (int)$input['id'] : 0;
    $arabic = trim($input['arabic'] ?? '');
    $english = trim($input['english'] ?? '');

    if ($id <= 0 || $arabic === '' || $english === '') {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "Invalid input"
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $db->prepare("
        UPDATE vocab
        SET arabic = :arabic,
            english = :english
        WHERE id = :id
    ");

    if (!$stmt) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "error" => $db->lastErrorMsg()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt->bindValue(':arabic', $arabic, SQLITE3_TEXT);
    $stmt->bindValue(':english', $english, SQLITE3_TEXT);
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);

    $result = $stmt->execute();

    if (!$result) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "error" => $db->lastErrorMsg()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        "success" => true,
        "id" => $id,
        "changes" => $db->changes()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------- DELETE : remove question ----------
if ($method === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);

    $id = isset($input['id']) ? (int)$input['id'] : 0;

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "Invalid id"
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $db->prepare("
        DELETE FROM vocab
        WHERE id = :id
    ");

    if (!$stmt) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "error" => $db->lastErrorMsg()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);

    $result = $stmt->execute();

    if (!$result) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "error" => $db->lastErrorMsg()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        "success" => true,
        "id" => $id,
        "changes" => $db->changes()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------- fallback ----------
http_response_code(405);
echo json_encode([
    "success" => false,
    "error" => "Unsupported request method"
], JSON_UNESCAPED_UNICODE);