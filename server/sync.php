<?php
// Demo sync endpoint. Stores records in data.json (no DB needed).
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$file = __DIR__ . '/data.json';
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$since = (int)($in['since'] ?? 0);
$items = $in['items'] ?? [];

$fp = fopen($file, 'c+');
flock($fp, LOCK_EX);
$raw = stream_get_contents($fp);
$db = $raw ? json_decode($raw, true) : [];
$now = (int)(microtime(true) * 1000);

foreach ($items as $it) {
    if (empty($it['id'])) continue;
    $id = $it['id'];
    // last-write-wins on client updated_at
    if (!isset($db[$id]) || $it['updated_at'] >= $db[$id]['updated_at']) {
        $it['server_ts'] = $now;
        $db[$id] = $it;
    }
}

$changes = [];
foreach ($db as $row) {
    if ($row['server_ts'] > $since) $changes[] = $row;
}

ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($db));
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode(['ok' => true, 'server_time' => $now, 'changes' => $changes]);
