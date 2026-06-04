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
  <title>Help</title>
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial;margin:24px;line-height:1.5;color:#222}a{color:#0366d6}</style>
</head>
<body>
  <h1>Help & Support</h1>
  <p>Last updated: <?php echo htmlspecialchars($updated); ?></p>
  <p>If you need assistance, please contact the support team at <a href="mailto:contact@cvsu.dev">contact@cvsu.dev</a>.</p>
  <h2>Quick FAQs</h2>
  <ul>
    <li>How do I reset my password? Use the <a href="/forgot-password">Forgot password</a> flow.</li>
    <li>How do I create an account? Click <a href="/signup">Create account</a> and follow the steps.</li>
  </ul>
  <p><a href="/">Return to Home</a></p>
</body>
</html>
