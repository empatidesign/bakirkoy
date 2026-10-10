using Nexora.Domain.Enums;

namespace Nexora.Application.Common.Interfaces;

public interface IOtpService
{
    int ResendCooldownSeconds { get; }
    Task SendAsync(Guid userId, string target, string channel, OtpPurpose purpose, CancellationToken ct);
    Task VerifyAsync(Guid userId, OtpPurpose purpose, string code, CancellationToken ct);
    Task VerifyWithoutConsumingAsync(Guid userId, OtpPurpose purpose, string code, CancellationToken ct);
    Task EnsureCanResendAsync(Guid userId, OtpPurpose purpose, CancellationToken ct);
    Task<bool> IsOnCooldownAsync(Guid userId, OtpPurpose purpose, CancellationToken ct);

    /// <summary>
    /// Kod göndermeden yalnızca cooldown başlatır. Şifre sıfırlamada artık OTP yerine
    /// geçici şifre gönderiliyor (2026-09-07); o akış da aynı hız sınırını kullanmalı.
    /// </summary>
    Task StartCooldownAsync(Guid userId, OtpPurpose purpose, CancellationToken ct);

    int ValiditySeconds { get; }

    Task<int> GetRemainingValiditySecondsAsync(Guid userId, OtpPurpose purpose, CancellationToken ct);

    Task<int> GetRemainingCooldownSecondsAsync(Guid userId, OtpPurpose purpose, CancellationToken ct);

    Task ClearLockoutAsync(Guid userId, OtpPurpose purpose, CancellationToken ct);

    Task InvalidateAsync(Guid userId, OtpPurpose purpose, CancellationToken ct);
}
