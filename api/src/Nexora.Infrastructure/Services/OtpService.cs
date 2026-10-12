using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Configuration;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services.Email;

namespace Nexora.Infrastructure.Services;

public class OtpService(IRedisService redis, IOptions<OtpSettings> otpOptions, ISmsService sms, IEmailService email, ILogger<OtpService> logger) : IOtpService
{
    private OtpSettings Otp => otpOptions.Value;

    private int MaxAttempts => Otp.MaxAttempts;

    private int LockoutMaxFailures => Otp.LockoutMaxFailures;

    private int LockoutWindowSeconds => Otp.LockoutWindowSeconds;

    public int ValiditySeconds => Otp.ValiditySeconds;

    public int ResendCooldownSeconds => Otp.ResendCooldownSeconds;

    public async Task SendAsync(Guid userId, string target, string channel, OtpPurpose purpose, CancellationToken ct)
    {
        await EnsureNotLockedOutAsync(userId, purpose, ct);

        var mockCode = Otp.MockCode;
        var code = string.IsNullOrEmpty(mockCode)
            ? RandomNumberGenerator.GetInt32(100000, 1000000).ToString()
            : mockCode;

        var data = new OtpData(code, channel, target, DateTime.UtcNow.AddSeconds(ValiditySeconds));
        await redis.SetAsync(Key(userId, purpose), data, TimeSpan.FromSeconds(ValiditySeconds), ct);
        await redis.RemoveAsync(AttemptKey(userId, purpose), ct);
        await redis.SetAsync(CooldownKey(userId, purpose), 1, TimeSpan.FromSeconds(ResendCooldownSeconds), ct);

        var delivered = true;
        if (!string.IsNullOrEmpty(mockCode) || string.IsNullOrWhiteSpace(target))
        {
        }
        else if (string.Equals(channel, "sms", StringComparison.OrdinalIgnoreCase))
        {
            var smsMessage = $"Bakırköy Belediyesi doğrulama kodunuz: {code}. Kod {ValiditySeconds} saniye geçerlidir. Kodu kimseyle paylaşmayın.";
            delivered = await sms.SendOneAsync(target, smsMessage, ct);
        }
        else if (string.Equals(channel, "email", StringComparison.OrdinalIgnoreCase))
        {
            var content = EmailTemplates.VerificationCode(null, code, ValiditySeconds);
            delivered = await email.SendAsync(target, content.Subject, content.HtmlBody, null, ct);
        }

        if (!delivered)
        {
            await redis.RemoveAsync(Key(userId, purpose), ct);
            await redis.RemoveAsync(CooldownKey(userId, purpose), ct);
            logger.LogWarning("[OTP] Teslimat başarısız. UserId={UserId} Purpose={Purpose} Channel={Channel} Target={Target} Delivered=false",
                userId, purpose, channel, MaskForLog(target));
            throw new ConflictException(
                "Doğrulama kodu şu anda gönderilemedi. Lütfen daha sonra tekrar deneyin.", "OTP_DELIVERY_FAILED");
        }

        logger.LogInformation("[OTP] UserId={UserId} Purpose={Purpose} Channel={Channel} Target={Target} Delivered=true",
            userId, purpose, channel, MaskForLog(target));
    }

    public async Task EnsureCanResendAsync(Guid userId, OtpPurpose purpose, CancellationToken ct)
    {
        var remaining = await redis.GetTtlSecondsAsync(CooldownKey(userId, purpose), ct);
        if (remaining > 0)
            throw new ConflictException($"Yeni kod talep etmek için {remaining} saniye bekleyin.", "OTP_RESEND_COOLDOWN");
    }

    public async Task<bool> IsOnCooldownAsync(Guid userId, OtpPurpose purpose, CancellationToken ct)
        => await redis.GetTtlSecondsAsync(CooldownKey(userId, purpose), ct) > 0;

    public async Task StartCooldownAsync(Guid userId, OtpPurpose purpose, CancellationToken ct)
        => await redis.SetAsync(CooldownKey(userId, purpose), 1, TimeSpan.FromSeconds(ResendCooldownSeconds), ct);

    public async Task<int> GetRemainingValiditySecondsAsync(Guid userId, OtpPurpose purpose, CancellationToken ct)
        => Math.Max(await redis.GetTtlSecondsAsync(Key(userId, purpose), ct), 0);

    public async Task<int> GetRemainingCooldownSecondsAsync(Guid userId, OtpPurpose purpose, CancellationToken ct)
        => Math.Max(await redis.GetTtlSecondsAsync(CooldownKey(userId, purpose), ct), 0);

    public async Task ClearLockoutAsync(Guid userId, OtpPurpose purpose, CancellationToken ct)
    {
        await redis.RemoveAsync(FailureKey(userId, purpose), ct);
        await redis.RemoveAsync(AttemptKey(userId, purpose), ct);
    }

    public async Task InvalidateAsync(Guid userId, OtpPurpose purpose, CancellationToken ct)
    {
        await redis.RemoveAsync(Key(userId, purpose), ct);
        await redis.RemoveAsync(CooldownKey(userId, purpose), ct);
        await redis.RemoveAsync(AttemptKey(userId, purpose), ct);
        await redis.RemoveAsync(FailureKey(userId, purpose), ct);
    }

    private static string MaskForLog(string? target)
        => string.IsNullOrEmpty(target) ? "" : target.Length <= 2 ? "**" : new string('*', target.Length - 2) + target[^2..];

    public async Task VerifyAsync(Guid userId, OtpPurpose purpose, string code, CancellationToken ct)
        => await VerifyInternalAsync(userId, purpose, code, consume: true, ct);

    public async Task VerifyWithoutConsumingAsync(Guid userId, OtpPurpose purpose, string code, CancellationToken ct)
        => await VerifyInternalAsync(userId, purpose, code, consume: false, ct);

    private async Task VerifyInternalAsync(Guid userId, OtpPurpose purpose, string code, bool consume, CancellationToken ct)
    {
        await EnsureNotLockedOutAsync(userId, purpose, ct);

        var key = Key(userId, purpose);
        var raw = await redis.GetRawStringAsync(key, ct);
        var data = raw is null ? null : System.Text.Json.JsonSerializer.Deserialize<OtpData>(raw);

        if (data is null || DateTime.UtcNow > data.ExpiresAt)
            throw new ConflictException("OTP kodu bulunamadı veya süresi dolmuş. Yeni kod talep edin.", "OTP_EXPIRED");

        var attempts = await redis.GetAsync<long?>(AttemptKey(userId, purpose), ct) ?? 0;
        if (attempts >= MaxAttempts)
            throw new ConflictException("Çok fazla hatalı deneme. Yeni kod talep edin.", "OTP_TOO_MANY_ATTEMPTS");

        if (!FixedTimeEquals(data.Code, code))
        {
            var remaining = data.ExpiresAt - DateTime.UtcNow;
            var attemptTtl = remaining > TimeSpan.Zero ? remaining : TimeSpan.FromSeconds(1);
            await redis.IncrementWithExpiryAsync(AttemptKey(userId, purpose), attemptTtl, ct);

            var totalFailures = await redis.IncrementWithExpiryAsync(
                FailureKey(userId, purpose), TimeSpan.FromSeconds(LockoutWindowSeconds), ct);
            if (totalFailures >= LockoutMaxFailures)
            {
                logger.LogWarning("[OTP] Kilitlendi UserId={UserId} Purpose={Purpose} Failures={Failures}",
                    userId, purpose, totalFailures);
                await redis.RemoveAsync(key, ct);
                await redis.RemoveAsync(AttemptKey(userId, purpose), ct);
                throw BuildLockoutException(await GetLockoutRemainingSecondsAsync(userId, purpose, ct));
            }

            throw new ConflictException("OTP kodu hatalı.", "OTP_MISMATCH");
        }

        if (!consume) return;

        if (!await redis.CompareAndConsumeAsync(key, raw!, ct))
            throw new ConflictException("OTP kodu bulunamadı veya süresi dolmuş. Yeni kod talep edin.", "OTP_EXPIRED");
        await redis.RemoveAsync(AttemptKey(userId, purpose), ct);
        await redis.RemoveAsync(FailureKey(userId, purpose), ct);
        await redis.RemoveAsync(CooldownKey(userId, purpose), ct);
    }

    private async Task EnsureNotLockedOutAsync(Guid userId, OtpPurpose purpose, CancellationToken ct)
    {
        var failures = await redis.GetAsync<long?>(FailureKey(userId, purpose), ct) ?? 0;
        if (failures < LockoutMaxFailures) return;

        throw BuildLockoutException(await GetLockoutRemainingSecondsAsync(userId, purpose, ct));
    }

    private async Task<int> GetLockoutRemainingSecondsAsync(Guid userId, OtpPurpose purpose, CancellationToken ct)
        => Math.Max(await redis.GetTtlSecondsAsync(FailureKey(userId, purpose), ct), 0);

    private static ConflictException BuildLockoutException(int remainingSeconds)
    {
        var minutes = Math.Max((int)Math.Ceiling(remainingSeconds / 60d), 1);
        return new ConflictException(
            $"Çok fazla hatalı doğrulama denemesi yapıldı. Lütfen {minutes} dakika sonra tekrar deneyin.",
            "OTP_LOCKED_OUT");
    }

    private static bool FixedTimeEquals(string a, string b)
        => System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(a), System.Text.Encoding.UTF8.GetBytes(b));

    private static string Key(Guid userId, OtpPurpose purpose) => $"otp:{userId}:{purpose}";
    private static string CooldownKey(Guid userId, OtpPurpose purpose) => $"otp-cooldown:{userId}:{purpose}";
    private static string AttemptKey(Guid userId, OtpPurpose purpose) => $"otp-attempts:{userId}:{purpose}";
    private static string FailureKey(Guid userId, OtpPurpose purpose) => $"otp-failures:{userId}:{purpose}";

    private record OtpData(string Code, string Channel, string Target, DateTime ExpiresAt);
}
