<?php

header('Content-Type: application/json; charset=utf-8');

$db = new SQLite3('quiz.db');

$result = $db->query("SELECT chapter, arabic, english, starred FROM vocab");

$data = [];

while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
	    $data[] = $row;
}

echo json_encode($data, JSON_UNESCAPED_UNICODE);

?>
