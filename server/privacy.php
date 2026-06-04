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
  <title>Privacy Notice</title>
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial;margin:24px;line-height:1.5;color:#222}a{color:#0366d6}</style>
</head>
<body>
  <h1>Privacy Notice</h1>
  <p>Last updated: <?php echo htmlspecialchars($updated); ?></p>
  <p>We respect your privacy. This site collects only the information necessary to provide library services, such as name, email, affiliation, and authentication tokens. We store minimal personal data and employ reasonable safeguards to protect it.</p>
  <p>We do not sell or rent personal data. Data may be used for account management, notifications, and security auditing. For requests related to data access, correction, or removal, contact the site administrator at <a href="mailto:contact@cvsu.dev">contact@cvsu.dev</a>.</p>
  <p><a href="/">Return to Home</a></p>
</body>
</html>
