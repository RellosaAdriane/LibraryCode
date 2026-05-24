<?php

require_once __DIR__ . '/../PHPMailer-master/src/PHPMailer.php';
require_once __DIR__ . '/../PHPMailer-master/src/SMTP.php';
require_once __DIR__ . '/../PHPMailer-master/src/Exception.php';

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

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
        'fromName' => getenv('MAIL_FROM_NAME') ?: 'Library System',
    ];
}

function sendSignupOtpEmail($toEmail, $firstName, $otpCode)
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

        $mail->setFrom($mailConfig['fromEmail'], $mailConfig['fromName']);
        $mail->Sender = $mailConfig['fromEmail'];
        $mail->addAddress($toEmail, $firstName ?: 'Student');

        $mail->isHTML(true);
        $mail->Subject = 'Your Library Signup OTP';
        $mail->Body = '<p>Hello ' . htmlspecialchars($firstName ?: 'Student') . ',</p>'
            . '<p>Your OTP for signup is:</p>'
            . '<h2 style="letter-spacing:2px;">' . htmlspecialchars($otpCode) . '</h2>'
            . '<p>This code expires in 5 minutes.</p>';
        $mail->AltBody = "Your OTP for signup is: {$otpCode}. It expires in 5 minutes.";

        $mail->send();
        return ['success' => true];
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Failed to send OTP email. ' . $mail->ErrorInfo
        ];
    }
}

function sendPasswordResetOtpEmail($toEmail, $firstName, $otpCode)
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

        $mail->setFrom($mailConfig['fromEmail'], $mailConfig['fromName']);
        $mail->Sender = $mailConfig['fromEmail'];
        $mail->addAddress($toEmail, $firstName ?: 'Student');

        $mail->isHTML(true);
        $mail->Subject = 'Your Password Reset OTP';
        $mail->Body = '<p>Hello ' . htmlspecialchars($firstName ?: 'Student') . ',</p>'
            . '<p>Your OTP for password reset is:</p>'
            . '<h2 style="letter-spacing:2px;">' . htmlspecialchars($otpCode) . '</h2>'
            . '<p>This code expires in 5 minutes.</p>';
        $mail->AltBody = "Your OTP for password reset is: {$otpCode}. It expires in 5 minutes.";

        $mail->send();
        return ['success' => true];
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Failed to send password reset OTP email. ' . $mail->ErrorInfo
        ];
    }
}

function sendAdminLoginOtpEmail($toEmail, $firstName, $otpCode)
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

        $mail->setFrom($mailConfig['fromEmail'], $mailConfig['fromName']);
        $mail->Sender = $mailConfig['fromEmail'];
        $mail->addAddress($toEmail, $firstName ?: 'Admin');

        $mail->isHTML(true);
        $mail->Subject = 'Your Admin Login Verification Code';
        $mail->Body = '<p>Hello ' . htmlspecialchars($firstName ?: 'Admin') . ',</p>'
            . '<p>Your OTP for admin login is:</p>'
            . '<h2 style="letter-spacing:2px;">' . htmlspecialchars($otpCode) . '</h2>'
            . '<p>This code expires in 5 minutes.</p>';
        $mail->AltBody = "Your OTP for admin login is: {$otpCode}. It expires in 5 minutes.";

        $mail->send();
        return ['success' => true];
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Failed to send admin login OTP. ' . $mail->ErrorInfo
        ];
    }
}

