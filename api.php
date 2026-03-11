<?php

header('Content-Type: application/json; charset=utf-8');

$db = new SQLite3('quiz.db');

$method = $_SERVER['REQUEST_METHOD'];


// ---------- GET : return all vocabulary ----------
if ($method === 'GET') {

    $result = $db->query("
        SELECT id, chapter, arabic, english, starred
        FROM vocab
        ORDER BY chapter, id
    ");

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

    $stmt = $db->prepare("
        UPDATE vocab
        SET starred = :starred
        WHERE id = :id
    ");

    $stmt->bindValue(':starred', $starred, SQLITE3_INTEGER);
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);

    $stmt->execute();

    echo json_encode(["success" => true]);
    exit;
}


// ---------- fallback ----------
echo json_encode(["error" => "Unsupported request"]);