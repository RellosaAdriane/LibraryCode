#!/usr/bin/env php
<?php

declare(strict_types=1);

$root = dirname(__DIR__);
require_once $root . '/db.php';
require_once $root . '/reset_password_helpers.php';
require_once $root . '/admin_2fa_store.php';

$passed = 0;
$failed = 0;

function auth_test(string $name, callable $fn): void
{
    global $passed, $failed;

    try {
        $fn();
        $passed++;
        echo "PASS  {$name}\n";
    } catch (Throwable $error) {
        $failed++;
        echo "FAIL  {$name} — {$error->getMessage()}\n";
    }
}

function auth_assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function seedResetOtp(string $email, string $code, int $now, int $ttlSeconds = 300): void
{
    otp_set_record(
        'reset',
        $email,
        password_hash($code, PASSWORD_DEFAULT),
        $now + $ttlSeconds,
        0,
        $now
    );
}

auth_test('inspectResetOtpRecord accepts a valid code', function () {
    $email = 'unit-reset-valid@cvsu.edu.ph';
    $code = '445566';
    $now = time();
    seedResetOtp($email, $code, $now);

    $result = inspectResetOtpRecord($email, $code, $now);
    auth_assert_true($result['success'] === true, 'Expected OTP verification to succeed');

    otp_delete_record('reset', $email);
});

auth_test('inspectResetOtpRecord rejects an invalid code', function () {
    $email = 'unit-reset-invalid@cvsu.edu.ph';
    $code = '778899';
    $now = time();
    seedResetOtp($email, $code, $now);

    $result = inspectResetOtpRecord($email, '000000', $now);
    auth_assert_true($result['success'] === false, 'Expected invalid OTP to fail');
    auth_assert_true(($result['invalid_code'] ?? false) === true, 'Expected invalid_code flag');

    otp_delete_record('reset', $email);
});

auth_test('inspectResetOtpRecord rejects expired codes', function () {
    $email = 'unit-reset-expired@cvsu.edu.ph';
    $code = '112233';
    $now = time();
    seedResetOtp($email, $code, $now - 600, 120);

    $result = inspectResetOtpRecord($email, $code, $now);
    auth_assert_true($result['success'] === false, 'Expected expired OTP to fail');
    auth_assert_true(($result['expired'] ?? false) === true, 'Expected expired flag');
});

auth_test('reset OTP survives rate-store write', function () {
    $email = 'unit-reset-store@cvsu.edu.ph';
    $code = '654321';
    $now = time();
    seedResetOtp($email, $code, $now);

    writeResetRateStore(defaultResetStore());

    $record = otp_get_record('reset', $email);
    auth_assert_true(is_array($record), 'Expected OTP record to remain after rate-store write');
    auth_assert_true(password_verify($code, $record['otp_hash'] ?? ''), 'Expected OTP hash to remain valid');

    otp_delete_record('reset', $email);
});

auth_test('passwordStrengthScore detects weak passwords', function () {
    auth_assert_true(passwordStrengthScore('password') <= 2, 'Expected weak password score');
    auth_assert_true(passwordStrengthScore('Str0ng!Pass') >= 4, 'Expected strong password score');
});

auth_test('createAdmin2faChallenge replaces previous challenges', function () {
    $email = 'unit-admin-2fa@cvsu.edu.ph';
    $first = createAdmin2faChallenge($email);
    auth_assert_true($first['success'] === true, 'Expected first challenge creation to succeed');

    $second = createAdmin2faChallenge($email);
    auth_assert_true($second['success'] === true, 'Expected second challenge creation to succeed');
    auth_assert_true($first['otp_code'] !== $second['otp_code'], 'Expected a fresh OTP on resend');

    $staleVerify = verifyAdmin2faChallenge($first['challenge_id'], $email, $first['otp_code']);
    auth_assert_true($staleVerify['success'] === false, 'Expected stale challenge OTP to fail');

    $latestVerify = verifyAdmin2faChallenge($second['challenge_id'], $email, $second['otp_code']);
    auth_assert_true($latestVerify['success'] === true, 'Expected latest challenge OTP to succeed');
});

auth_test('verifyAdmin2faChallenge accepts latest OTP with stale challenge id', function () {
    $email = 'unit-admin-fallback@cvsu.edu.ph';
    $challenge = createAdmin2faChallenge($email);
    auth_assert_true($challenge['success'] === true, 'Expected challenge creation to succeed');

    $staleId = bin2hex(random_bytes(16));
    $verify = verifyAdmin2faChallenge($staleId, $email, $challenge['otp_code']);
    auth_assert_true($verify['success'] === true, 'Expected fallback verification against latest challenge');
});

echo PHP_EOL;
echo "Summary: {$passed} passed, {$failed} failed" . PHP_EOL;

exit($failed > 0 ? 1 : 0);
