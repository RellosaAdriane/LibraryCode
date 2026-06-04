<?php
require_once __DIR__ . '/datetime_utils.php';
initLibraryTimezone();
header('Content-Type: text/html; charset=utf-8');
$updated = libraryNow()->format('F j, Y');
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Terms of Use</title>
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial;margin:24px;line-height:1.5;color:#222}a{color:#0366d6}</style>
</head>
<body>
  <h1>Terms of Use</h1>
  <p>Last updated: <?php echo htmlspecialchars($updated); ?></p>
  <p>By using this service you agree to comply with applicable policies and laws. You are responsible for keeping your account credentials secure and for any activity that occurs under your account.</p>
  <p>Prohibited activities include unauthorized access, abuse of resources, and actions that violate the rights of others. The operators reserve the right to suspend or remove accounts that violate these terms.</p>
  <p>For questions about these terms, contact <a href="mailto:contact@cvsu.dev">contact@cvsu.dev</a>.</p>
  <p><a href="/">Return to Home</a></p>
</body>
</html>
