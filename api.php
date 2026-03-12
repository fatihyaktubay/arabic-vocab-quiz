<?php

header('Content-Type: application/json; charset=utf-8');

$db = new SQLite3(__DIR__ . '/quiz.db');

$method = $_SERVER['REQUEST_METHOD'];

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

    echo json_encode([
        "success" => true,
        "id" => $id,
        "starred" => $starred,
        "changes" => $db->changes()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}


if ($method === 'PUT') {

    $input = json_decode(file_get_contents('php://input'), true);

    $id = (int)$input['id'];
    $arabic = $input['arabic'];
    $english = $input['english'];

    $stmt = $db->prepare("
        UPDATE vocab
        SET arabic = :arabic,
            english = :english
        WHERE id = :id
    ");

    $stmt->bindValue(':arabic', $arabic, SQLITE3_TEXT);
    $stmt->bindValue(':english', $english, SQLITE3_TEXT);
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);

    $stmt->execute();

    echo json_encode([
        "success" => true,
        "changes" => $db->changes()
    ]);

    exit;
}

if ($method === 'DELETE') {

    $input = json_decode(file_get_contents('php://input'), true);

    $id = (int)$input['id'];

    $stmt = $db->prepare("
        DELETE FROM vocab
        WHERE id = :id
    ");

    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();

    echo json_encode([
        "success" => true,
        "changes" => $db->changes()
    ]);

    exit;
}



echo json_encode(["error" => "Unsupported request"], JSON_UNESCAPED_UNICODE);