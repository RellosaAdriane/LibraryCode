<?php

require_once __DIR__ . '/../PHPMailer-master/src/PHPMailer.php';
require_once __DIR__ . '/../PHPMailer-master/src/SMTP.php';
require_once __DIR__ . '/../PHPMailer-master/src/Exception.php';

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

const LIBRARY_EMAIL_PORTAL_URL = 'https://library.cvsu.dev';
const LIBRARY_EMAIL_LOGO_URL = 'https://library.cvsu.dev/logo192.png';
const LIBRARY_EMAIL_SUPPORT = 'contact@cvsu.dev';
const LIBRARY_EMAIL_LOGO_CID = 'library-logo';

function loadEnvFile($filePath)
{
    if (!is_readable($filePath)) {
        return;
    }

    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0) {
            continue;
        }

        $parts = explode('=', $trimmed, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $key = trim($parts[0]);
        $value = trim($parts[1]);

        if ($value !== '' && $value[0] === '"' && substr($value, -1) === '"') {
            $value = substr($value, 1, -1);
        }

        if ($key === '' || getenv($key) !== false) {
            continue;
        }

        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
    }
}

function resolveMailerConfig()
{
    static $envLoaded = false;
    if (!$envLoaded) {
        loadEnvFile(__DIR__ . '/../env');
        $envLoaded = true;
    }

    $fromEmail = getenv('MAIL_FROM_ADDRESS') ?: getenv('SMTP_USERNAME') ?: getenv('GMAIL_USER') ?: 'fasthostph@gmail.com';

    return [
        'host' => getenv('SMTP_HOST') ?: 'smtp.gmail.com',
        'port' => (int)(getenv('SMTP_PORT') ?: 587),
        'username' => getenv('SMTP_USERNAME') ?: $fromEmail,
        'password' => getenv('GMAIL_APP_PASSWORD') ?: getenv('SMTP_PASSWORD') ?: '',
        'secure' => getenv('SMTP_ENCRYPTION') ?: PHPMailer::ENCRYPTION_STARTTLS,
        'fromEmail' => $fromEmail,
        'fromName' => getenv('MAIL_FROM_NAME') ?: 'CVSU Library',
    ];
}

function libraryEmailLogoPath(): string
{
    $candidates = [
        __DIR__ . '/../public/logo192.png',
        __DIR__ . '/../build/logo192.png',
    ];

    foreach ($candidates as $path) {
        if (is_readable($path)) {
            return $path;
        }
    }

    return '';
}

/**
 * @return array{accent:string,accentLight:string,headerStart:string,headerEnd:string,headerMid:string,badge:string}
 */
function libraryEmailTheme(string $type): array
{
    switch ($type) {
        case 'admin':
            return [
                'accent' => '#1a1a2e',
                'accentLight' => '#e8eaf6',
                'headerStart' => '#1a1a2e',
                'headerMid' => '#16213e',
                'headerEnd' => '#0f3460',
                'badge' => 'Admin security',
            ];
        case 'reset':
            return [
                'accent' => '#0f4c75',
                'accentLight' => '#e3f2fd',
                'headerStart' => '#1a1a2e',
                'headerMid' => '#16213e',
                'headerEnd' => '#0f4c75',
                'badge' => 'Account recovery',
            ];
        default:
            return [
                'accent' => '#1b5e3b',
                'accentLight' => '#e8f5e9',
                'headerStart' => '#1a1a2e',
                'headerMid' => '#16213e',
                'headerEnd' => '#1b5e3b',
                'badge' => 'New account',
            ];
    }
}

function libraryRenderOtpDigitBoxes(string $otpCode, string $accent): string
{
    $digits = preg_replace('/\D/', '', $otpCode);
    if ($digits === '') {
        $digits = '000000';
    }
    $digits = str_pad(substr($digits, 0, 6), 6, '0', STR_PAD_LEFT);

    $cells = '';
    foreach (str_split($digits) as $digit) {
        $safeDigit = htmlspecialchars($digit, ENT_QUOTES, 'UTF-8');
        $cells .= '<td align="center" style="padding:0 5px;">'
            . '<table role="presentation" cellspacing="0" cellpadding="0" border="0">'
            . '<tr><td align="center" width="46" height="54" style="width:46px;height:54px;background:#ffffff;border:2px solid #d1e7d7;border-radius:12px;box-shadow:0 2px 0 #e2efe6;font-size:28px;font-weight:700;color:'
            . htmlspecialchars($accent, ENT_QUOTES, 'UTF-8')
            . ';font-family:\'SF Mono\',\'Courier New\',Courier,monospace;mso-line-height-rule:exactly;line-height:54px;">'
            . $safeDigit
            . '</td></tr></table></td>';
    }

    return '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;"><tr>'
        . $cells
        . '</tr></table>';
}

/**
 * @param list<string> $steps
 */
function libraryRenderEmailSteps(array $steps, string $accent): string
{
    $rows = '';
    $index = 1;
    foreach ($steps as $step) {
        $safeStep = htmlspecialchars($step, ENT_QUOTES, 'UTF-8');
        $num = (string)$index;
        $rows .= '<tr><td style="padding:0 0 12px;">'
            . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">'
            . '<tr>'
            . '<td width="32" valign="top" style="width:32px;padding-right:12px;">'
            . '<div style="width:28px;height:28px;border-radius:50%;background:'
            . htmlspecialchars($accent, ENT_QUOTES, 'UTF-8')
            . ';color:#ffffff;font-size:13px;font-weight:700;text-align:center;line-height:28px;">'
            . $num
            . '</div></td>'
            . '<td valign="top" style="font-size:14px;line-height:1.55;color:#4b5563;">'
            . $safeStep
            . '</td></tr></table></td></tr>';
        $index += 1;
    }

    return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' . $rows . '</table>';
}

/**
 * @param array{
 *   preheader?: string,
 *   title: string,
 *   recipientName: string,
 *   intro: string,
 *   otpCode: string,
 *   expiryNote?: string,
 *   footerNote?: string,
 *   accentLabel?: string,
 *   type?: string,
 *   steps?: list<string>,
 *   logoSrc?: string
 * } $options
 */
function libraryBuildOtpEmailHtml(array $options): string
{
    $type = $options['type'] ?? 'signup';
    $theme = libraryEmailTheme($type);

    $preheader = htmlspecialchars($options['preheader'] ?? $options['title'], ENT_QUOTES, 'UTF-8');
    $title = htmlspecialchars($options['title'], ENT_QUOTES, 'UTF-8');
    $name = htmlspecialchars($options['recipientName'], ENT_QUOTES, 'UTF-8');
    $intro = htmlspecialchars($options['intro'], ENT_QUOTES, 'UTF-8');
    $expiry = htmlspecialchars($options['expiryNote'] ?? 'Expires in 5 minutes — request a new code if it runs out.', ENT_QUOTES, 'UTF-8');
    $footerNote = htmlspecialchars(
        $options['footerNote'] ?? 'If you did not request this code, you can safely ignore this email.',
        ENT_QUOTES,
        'UTF-8'
    );
    $accentLabel = htmlspecialchars($options['accentLabel'] ?? 'Verification code', ENT_QUOTES, 'UTF-8');
    $portal = htmlspecialchars(LIBRARY_EMAIL_PORTAL_URL, ENT_QUOTES, 'UTF-8');
    $logo = htmlspecialchars($options['logoSrc'] ?? LIBRARY_EMAIL_LOGO_URL, ENT_QUOTES, 'UTF-8');
    $support = htmlspecialchars(LIBRARY_EMAIL_SUPPORT, ENT_QUOTES, 'UTF-8');
    $badge = htmlspecialchars($theme['badge'], ENT_QUOTES, 'UTF-8');
    $year = date('Y');

    $accent = $theme['accent'];
    $accentLight = $theme['accentLight'];
    $headerStart = $theme['headerStart'];
    $headerMid = $theme['headerMid'];
    $headerEnd = $theme['headerEnd'];

    $otpBoxes = libraryRenderOtpDigitBoxes($options['otpCode'], $accent);

    $defaultSteps = [
        'Open <a href="' . $portal . '" style="color:' . $accent . ';font-weight:600;text-decoration:none;">library.cvsu.dev</a> in your browser.',
        'Enter all six digits exactly as shown — no spaces required.',
        'Submit the form before the timer runs out.',
    ];
    $steps = $options['steps'] ?? $defaultSteps;
    $stepsHtml = libraryRenderEmailSteps($steps, $accent);

    return <<<HTML
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>{$title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    @media only screen and (max-width: 620px) {
      .email-shell { width:100% !important; }
      .email-pad { padding:24px 20px !important; }
      .otp-cell { padding:0 3px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e8edf3;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">{$preheader} &#847; &#847; &#847;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8edf3;padding:36px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;border-collapse:separate;">
          <!-- Header -->
          <tr>
            <td style="border-radius:18px 18px 0 0;padding:0;overflow:hidden;">
              <!--[if mso]>
              <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:140px;">
                <v:fill type="gradient" color="{$headerStart}" color2="{$headerEnd}" angle="135" />
                <v:textbox inset="0,0,0,0">
              <![endif]-->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:{$headerStart};background-image:linear-gradient(135deg,{$headerStart} 0%,{$headerMid} 48%,{$headerEnd} 100%);">
                <tr>
                  <td align="center" style="padding:32px 28px 30px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
                      <tr>
                        <td style="background:rgba(255,255,255,0.12);border-radius:16px;padding:10px;border:1px solid rgba(255,255,255,0.2);">
                          <img src="{$logo}" width="80" height="80" alt="CVSU Library" style="display:block;width:80px;height:80px;border-radius:10px;" />
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.72);font-weight:600;">Cavite State University</p>
                    <h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">CVSU Library</h1>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td style="background:rgba(255,255,255,0.15);border-radius:999px;padding:6px 16px;border:1px solid rgba(255,255,255,0.22);">
                          <span style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;">{$badge}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!--[if mso]></v:textbox></v:rect><![endif]-->
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="email-pad" style="background-color:#ffffff;padding:36px 40px 30px;border-left:1px solid #dde4ec;border-right:1px solid #dde4ec;box-shadow:0 1px 0 #ffffff inset;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">
                <tr>
                  <td style="border-bottom:2px solid {$accentLight};padding-bottom:14px;">
                    <p style="margin:0;font-size:12px;font-weight:700;color:{$accent};text-transform:uppercase;letter-spacing:0.1em;">{$title}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px;font-size:17px;line-height:1.5;color:#111827;">Hello <strong>{$name}</strong>,</p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#5b6574;">{$intro}</p>

              <!-- OTP card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 12px;">
                <tr>
                  <td align="center" style="background:{$accentLight};border:1px solid #cfe8d4;border-radius:16px;padding:26px 18px 22px;">
                    <p style="margin:0 0 18px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">{$accentLabel}</p>
                    {$otpBoxes}
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td align="center">
                    <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
                      <span style="display:inline-block;vertical-align:middle;margin-right:6px;font-size:14px;">&#9201;</span>
                      {$expiry}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e8edf3;border-radius:14px;padding:20px 22px;">
                    <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em;">What to do next</p>
                    {$stepsHtml}
                  </td>
                </tr>
              </table>

              <!-- Security -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:linear-gradient(90deg,#fffbeb 0%,#fffdf5 100%);border:1px solid #fde68a;border-left:5px solid #f59e0b;border-radius:12px;padding:16px 18px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="padding-right:10px;font-size:18px;line-height:1;">&#128274;</td>
                        <td valign="top">
                          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#b45309;">Keep this code private</p>
                          <p style="margin:0;font-size:13px;line-height:1.6;color:#92400e;">Never share your OTP. CVSU Library staff will <em>never</em> ask for it by email, chat, or phone.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 18px;">
                <tr>
                  <td align="center" style="border-radius:12px;background:{$accent};mso-padding-alt:0;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{$portal}" style="height:46px;v-text-anchor:middle;width:240px;" arcsize="20%" strokecolor="{$accent}" fillcolor="{$accent}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Open library portal &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{$portal}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;background:{$accent};box-shadow:0 4px 14px rgba(27,94,59,0.35);">Open library portal &rarr;</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af;text-align:center;">{$footerNote}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-radius:0 0 18px 18px;background-color:#f1f5f9;border:1px solid #dde4ec;border-top:2px solid #e2e8f0;padding:22px 28px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">Questions? We're here to help.</p>
              <p style="margin:0 0 14px;font-size:14px;">
                <a href="mailto:{$support}" style="color:{$accent};text-decoration:none;font-weight:700;">{$support}</a>
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                &copy; {$year} Cavite State University Library<br />
                <a href="{$portal}" style="color:#64748b;text-decoration:underline;">library.cvsu.dev</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
}

function libraryBuildOtpEmailText(
    string $title,
    string $recipientName,
    string $intro,
    string $otpCode,
    string $expiryNote = 'This code expires in 5 minutes.',
    string $footerNote = 'If you did not request this code, you can safely ignore this email.'
): string {
    $digits = preg_replace('/\D/', '', $otpCode);
    $formatted = trim(chunk_split(substr($digits, 0, 6), 1, ' '));

    return implode("\n", [
        'CVSU LIBRARY',
        'Cavite State University',
        str_repeat('─', 40),
        strtoupper($title),
        '',
        'Hello ' . $recipientName . ',',
        '',
        $intro,
        '',
        'YOUR CODE: ' . ($formatted !== '' ? $formatted : $otpCode),
        $expiryNote,
        '',
        'WHAT TO DO NEXT:',
        '1. Open ' . LIBRARY_EMAIL_PORTAL_URL,
        '2. Enter all six digits (no spaces)',
        '3. Submit before the code expires',
        '',
        'SECURITY: Never share this code. Staff will never ask for it.',
        '',
        $footerNote,
        '',
        'Support: ' . LIBRARY_EMAIL_SUPPORT,
    ]);
}

function librarySendEmail(string $toEmail, string $recipientName, string $subject, string $htmlBody, string $textBody): array
{
    $mailConfig = resolveMailerConfig();
    if ($mailConfig['password'] === '') {
        return [
            'success' => false,
            'message' => 'Mail server is not configured. Set the required mail environment variables.'
        ];
    }

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host = $mailConfig['host'];
        $mail->SMTPAuth = true;
        $mail->Username = $mailConfig['username'];
        $mail->Password = $mailConfig['password'];
        $mail->SMTPSecure = $mailConfig['secure'];
        $mail->Port = $mailConfig['port'];
        $mail->CharSet = PHPMailer::CHARSET_UTF8;

        $mail->setFrom($mailConfig['fromEmail'], $mailConfig['fromName']);
        $mail->Sender = $mailConfig['fromEmail'];
        $mail->addAddress($toEmail, $recipientName);

        $logoPath = libraryEmailLogoPath();
        if ($logoPath !== '') {
            $mail->addEmbeddedImage($logoPath, LIBRARY_EMAIL_LOGO_CID, 'cvsu-library-logo.png');
        }

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $htmlBody;
        $mail->AltBody = $textBody;

        $mail->send();
        return ['success' => true];
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Failed to send email. ' . $mail->ErrorInfo
        ];
    }
}

function libraryOtpEmailLogoSrc(): string
{
    return libraryEmailLogoPath() !== '' ? 'cid:' . LIBRARY_EMAIL_LOGO_CID : LIBRARY_EMAIL_LOGO_URL;
}

function sendSignupOtpEmail($toEmail, $firstName, $otpCode)
{
    $name = $firstName ?: 'Student';
    $subject = 'Your CVSU Library signup code';
    $html = libraryBuildOtpEmailHtml([
        'type' => 'signup',
        'logoSrc' => libraryOtpEmailLogoSrc(),
        'preheader' => "Your signup code is {$otpCode} — valid for 5 minutes",
        'title' => 'Complete your registration',
        'recipientName' => $name,
        'intro' => 'Welcome! You are one step away from your library account. Use the verification code below on the signup page.',
        'otpCode' => $otpCode,
        'accentLabel' => 'Signup verification code',
        'steps' => [
            'Go to the signup page at library.cvsu.dev and continue where you left off.',
            'Enter all six digits from this email into the verification field.',
            'Choose a strong password and finish creating your account.',
        ],
    ]);
    $text = libraryBuildOtpEmailText(
        'Complete your registration',
        $name,
        'Use this code to finish creating your library account.',
        $otpCode
    );

    return librarySendEmail($toEmail, $name, $subject, $html, $text);
}

function sendPasswordResetOtpEmail($toEmail, $firstName, $otpCode)
{
    $name = $firstName ?: 'Student';
    $subject = 'Reset your CVSU Library password';
    $html = libraryBuildOtpEmailHtml([
        'type' => 'reset',
        'logoSrc' => libraryOtpEmailLogoSrc(),
        'preheader' => "Your password reset code is {$otpCode}",
        'title' => 'Password reset request',
        'recipientName' => $name,
        'intro' => 'We received a request to change the password for your library account. If this was you, enter the code on the forgot-password page.',
        'otpCode' => $otpCode,
        'accentLabel' => 'Password reset code',
        'footerNote' => 'If you did not request a password reset, ignore this email — your password will not change.',
        'steps' => [
            'Open the forgot-password page at library.cvsu.dev.',
            'Enter the six-digit code, then your new password twice.',
            'Sign in with your new password once the reset succeeds.',
        ],
    ]);
    $text = libraryBuildOtpEmailText(
        'Password reset request',
        $name,
        'Use this code on the forgot-password page to reset your password.',
        $otpCode,
        'This code expires in 5 minutes.',
        'If you did not request a password reset, ignore this email.'
    );

    return librarySendEmail($toEmail, $name, $subject, $html, $text);
}

function sendAdminLoginOtpEmail($toEmail, $firstName, $otpCode)
{
    $name = $firstName ?: 'Admin';
    $subject = 'CVSU Library admin login verification';
    $html = libraryBuildOtpEmailHtml([
        'type' => 'admin',
        'logoSrc' => libraryOtpEmailLogoSrc(),
        'preheader' => "Admin login code {$otpCode} — do not share",
        'title' => 'Admin sign-in verification',
        'recipientName' => $name,
        'intro' => 'A sign-in attempt was made on the library admin dashboard using your account. Enter this code only if you are signing in right now.',
        'otpCode' => $otpCode,
        'accentLabel' => 'Admin login code',
        'footerNote' => 'Not you? Change your password immediately and contact support.',
        'steps' => [
            'Return to the admin login screen where the code was requested.',
            'Enter all six digits to complete two-factor verification.',
            'You will be redirected to the admin dashboard after success.',
        ],
    ]);
    $text = libraryBuildOtpEmailText(
        'Admin sign-in verification',
        $name,
        'Use this code to complete admin two-factor login.',
        $otpCode,
        'This code expires in 5 minutes.',
        'If you are not signing in, secure your account immediately.'
    );

    return librarySendEmail($toEmail, $name, $subject, $html, $text);
}
