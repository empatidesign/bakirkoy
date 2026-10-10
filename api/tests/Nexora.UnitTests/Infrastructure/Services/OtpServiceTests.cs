using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Configuration;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class OtpServiceTests
{
    private static OtpSettings Settings() => new()
    {
        MockCode = "",
        ExpiresInMinutes = 5,
        ResendCooldownSeconds = 60,
        MaxAttempts = 5,
        LockoutMaxFailures = 15,
        LockoutWindowSeconds = 3600,
    };

    private static Mock<IRedisService> RedisMock()
    {
        var redis = new Mock<IRedisService>();
        redis.Setup(r => r.GetAsync<long?>(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync((long?)0);
        redis.Setup(r => r.SetAsync(It.IsAny<string>(), It.IsAny<It.IsAnyType>(), It.IsAny<TimeSpan?>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        redis.Setup(r => r.RemoveAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        redis.Setup(r => r.GetTtlSecondsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(0);
        redis.Setup(r => r.IncrementWithExpiryAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return redis;
    }

    private static OtpService Build(Mock<IRedisService> redis, Mock<ISmsService>? sms = null, Mock<IEmailService>? email = null)
        => new(redis.Object, Options.Create(Settings()),
            (sms ?? new Mock<ISmsService>()).Object,
            (email ?? new Mock<IEmailService>()).Object,
            Mock.Of<ILogger<OtpService>>());

    [Fact]
    public void F14_validity_OtpSettings_ten_gelir_ve_cooldown_dan_ayridir()
    {
        var svc = Build(RedisMock());
        Assert.Equal(300, svc.ValiditySeconds);       // ExpiresInMinutes(5)*60
        Assert.Equal(60, svc.ResendCooldownSeconds);  // ayrı ayar, validity'ye eşit DEĞİL
    }

    [Fact]
    public async Task F23_teslimat_basarisizsa_OTP_DELIVERY_FAILED_firlatir_ve_kodu_siler()
    {
        var redis = RedisMock();
        var sms = new Mock<ISmsService>();
        sms.Setup(s => s.SendOneAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var svc = Build(redis, sms);
        var userId = Guid.NewGuid();

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            svc.SendAsync(userId, "05001112233", "sms", OtpPurpose.TwoFactor, CancellationToken.None));

        Assert.Equal("OTP_DELIVERY_FAILED", ex.ErrorCode);
        redis.Verify(r => r.RemoveAsync($"otp:{userId}:{OtpPurpose.TwoFactor}", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task F23_teslimat_basariliysa_hata_yok()
    {
        var redis = RedisMock();
        var sms = new Mock<ISmsService>();
        sms.Setup(s => s.SendOneAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var svc = Build(redis, sms);

        await svc.SendAsync(Guid.NewGuid(), "05001112233", "sms", OtpPurpose.TwoFactor, CancellationToken.None);
        // istisna fırlatılmazsa test geçer
    }

    [Fact]
    public async Task F27_dogru_kod_atomik_CompareAndConsume_ile_tuketilir()
    {
        var redis = RedisMock();
        var userId = Guid.NewGuid();
        var key = $"otp:{userId}:{OtpPurpose.TwoFactor}";
        var raw = JsonSerializer.Serialize(new
        {
            Code = "123456",
            Channel = "sms",
            Target = "05001112233",
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
        });
        redis.Setup(r => r.GetRawStringAsync(key, It.IsAny<CancellationToken>())).ReturnsAsync(raw);
        redis.Setup(r => r.CompareAndConsumeAsync(key, raw, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var svc = Build(redis);
        await svc.VerifyAsync(userId, OtpPurpose.TwoFactor, "123456", CancellationToken.None);

        redis.Verify(r => r.CompareAndConsumeAsync(key, raw, It.IsAny<CancellationToken>()), Times.Once);
        redis.Verify(r => r.TryConsumeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task F27_yanlis_kod_tuketmez_ve_OTP_MISMATCH_doner()
    {
        var redis = RedisMock();
        var userId = Guid.NewGuid();
        var key = $"otp:{userId}:{OtpPurpose.TwoFactor}";
        var raw = JsonSerializer.Serialize(new
        {
            Code = "123456",
            Channel = "sms",
            Target = "05001112233",
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
        });
        redis.Setup(r => r.GetRawStringAsync(key, It.IsAny<CancellationToken>())).ReturnsAsync(raw);

        var svc = Build(redis);
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            svc.VerifyAsync(userId, OtpPurpose.TwoFactor, "000000", CancellationToken.None));

        Assert.Equal("OTP_MISMATCH", ex.ErrorCode);
        redis.Verify(r => r.CompareAndConsumeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
