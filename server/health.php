<?php
header('Content-Type: application/json');

echo json_encode([
    'status' => 'ok',
    'timestamp' => gmdate('c')
]);
