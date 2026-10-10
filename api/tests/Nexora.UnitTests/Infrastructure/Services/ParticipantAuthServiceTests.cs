using System.Linq.Expressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Configuration;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.Nvi.Dtos;
using Nexora.Application.Features.ParticipantAuth.Dtos;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Specialized;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class ParticipantAuthServiceTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IParticipantRepository> _participants = new();
    private readonly Mock<IParticipantGuardianRepository> _guardians = new();
    private readonly Mock<IAuditLogRepository> _auditLogs = new();
    private readonly Mock<IJwtService> _jwt = new();
    private readonly Mock<IOtpService> _otp = new();
    private readonly Mock<IRedisService> _redis = new();
    private readonly Mock<INviService> _nvi = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<IActivityLogger> _log = new();
    private readonly ParticipantAuthService _service;

    public ParticipantAuthServiceTests()
    {
        _uow.SetupGet(x => x.Participants).Returns(_participants.Object);
        _participants.Setup(x => x.CountByPhoneCandidatesAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        _uow.SetupGet(x => x.ParticipantGuardians).Returns(_guardians.Object);
        _uow.SetupGet(x => x.AuditLogs).Returns(_auditLogs.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _uow.Setup(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.RollbackAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PasswordPolicy:GeneratedLength"] = "12",
                ["SmsSettings:UseMockMode"] = "true",
                ["TokenSettings:Mobile:RefreshTokenDays"] = "30",
                ["JwtSettings:AccessTokenMinutes"] = "60"
            })
            .Build();

        _service = new ParticipantAuthService(
            _uow.Object,
            _jwt.Object,
            _otp.Object,
            _redis.Object,
            _nvi.Object,
            config,
            Mock.Of<IOptionsMonitor<ParticipantSettings>>(m => m.CurrentValue == new ParticipantSettings()),
            Mock.Of<IFileStorageService>(),
            _audit.Object,
            _log.Object,
            Mock.Of<ICurrentUser>());
    }

    [Fact]
    public async Task LoginAsync_bastaki_sifir_farkli_telefon_kaydini_bulur()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByPhoneAsync("05326886602", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Participant?)null);
        _participants.Setup(x => x.GetByPhoneAsync("5326886602", It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _jwt.Setup(x => x.GeneratePendingOtpToken(participant.Id, It.IsAny<string>())).Returns("otp-session");

        var result = await _service.LoginAsync(
            new CitizenLoginRequest("05326886602", "Passw0rd!"),
            CancellationToken.None);

        Assert.True(result.RequiresOtp);
        Assert.Equal("otp-session", result.OtpSessionToken);
        _participants.Verify(x => x.GetByPhoneAsync("5326886602", It.IsAny<CancellationToken>()), Times.Once);
        _otp.Verify(x => x.SendAsync(participant.Id, participant.Phone!, "sms", OtpPurpose.TwoFactor, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LoginAsync_cooldown_suruyorsa_yeni_kod_gondermez_ama_otp_oturumu_doner()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByPhoneAsync("5326886602", It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _jwt.Setup(x => x.GeneratePendingOtpToken(participant.Id, It.IsAny<string>())).Returns("otp-session");
        _otp.Setup(x => x.IsOnCooldownAsync(participant.Id, OtpPurpose.TwoFactor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await _service.LoginAsync(
            new CitizenLoginRequest("5326886602", "Passw0rd!"),
            CancellationToken.None);

        Assert.True(result.RequiresOtp);
        Assert.Equal("otp-session", result.OtpSessionToken);
        _otp.Verify(x => x.SendAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<OtpPurpose>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConfirmFamilyFromNviAsync_secim_null_ise_conflict_firlatir_ve_repo_cagirmaz()
    {
        var request = new CitizenFamilyConfirmRequest(null!);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ConfirmFamilyFromNviAsync(Guid.NewGuid(), request, CancellationToken.None));

        Assert.Equal("NO_SELECTION", ex.ErrorCode);
        _participants.Verify(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _nvi.Verify(x => x.GetPersonAndChildrenAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConfirmFamilyFromNviAsync_secim_bos_ise_conflict_firlatir()
    {
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ConfirmFamilyFromNviAsync(Guid.NewGuid(), new CitizenFamilyConfirmRequest([]), CancellationToken.None));

        Assert.Equal("NO_SELECTION", ex.ErrorCode);
    }

    [Fact]
    public async Task ConfirmFamilyFromNviAsync_katilimci_yoksa_not_found_firlatir()
    {
        var participantId = Guid.NewGuid();
        _participants.Setup(x => x.GetByIdAsync(participantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Participant?)null);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ConfirmFamilyFromNviAsync(participantId, new CitizenFamilyConfirmRequest(["22222222222"]), CancellationToken.None));

        Assert.Equal("PARTICIPANT_NOT_FOUND", ex.ErrorCode);
        _nvi.Verify(x => x.GetPersonAndChildrenAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConfirmFamilyFromNviAsync_secili_cocuk_nvi_sonucunda_yoksa_conflict_firlatir()
    {
        var parent = CreateParticipant("11111111110", "Veli Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(parent.Id, It.IsAny<CancellationToken>())).ReturnsAsync(parent);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(parent.Tckn, parent.BirthDate, 18, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null,
                new NviPersonDto(parent.Tckn, "Veli", "Kisi", parent.BirthDate, Gender.Female, null),
                [new NviChildDto("33333333334", "Cocuk", "Bir", new DateTime(2015, 1, 1), Gender.Male, null)]));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ConfirmFamilyFromNviAsync(parent.Id, new CitizenFamilyConfirmRequest(["22222222222"]), CancellationToken.None));

        Assert.Equal("INVALID_FAMILY_SELECTION", ex.ErrorCode);
        _uow.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConfirmFamilyFromNviAsync_gecerli_ve_yabanci_karisik_secimde_hicbirini_islemez()
    {
        var parent = CreateParticipant("11111111110", "Veli Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(parent.Id, It.IsAny<CancellationToken>())).ReturnsAsync(parent);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(parent.Tckn, parent.BirthDate, 18, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null,
                new NviPersonDto(parent.Tckn, "Veli", "Kisi", parent.BirthDate, Gender.Female, null),
                [new NviChildDto("33333333334", "Cocuk", "Bir", new DateTime(2015, 1, 1), Gender.Male, null)]));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ConfirmFamilyFromNviAsync(parent.Id,
                new CitizenFamilyConfirmRequest(["33333333334", "99999999998"]), CancellationToken.None));

        Assert.Equal("INVALID_FAMILY_SELECTION", ex.ErrorCode);
        _uow.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConfirmFamilyFromNviAsync_yeni_cocuk_icin_participant_ve_guardian_link_ekler()
    {
        var parent = CreateParticipant("11111111110", "Veli Kisi", isMinor: false);
        var childTckn = "22222222222";
        _participants.Setup(x => x.GetByIdAsync(parent.Id, It.IsAny<CancellationToken>())).ReturnsAsync(parent);
        _participants.Setup(x => x.GetChildrenAsync(parent.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _participants.Setup(x => x.GetGuardianLinksAsync(parent.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _participants.Setup(x => x.GetByTcknAsync(childTckn, It.IsAny<CancellationToken>())).ReturnsAsync((Participant?)null);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(parent.Tckn, parent.BirthDate, 18, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null,
                new NviPersonDto(parent.Tckn, "Veli", "Kisi", parent.BirthDate, Gender.Female, null),
                [new NviChildDto(childTckn, "Cocuk", "Kisi", new DateTime(2015, 1, 1), Gender.Male, "Adres") ]));

        var result = await _service.ConfirmFamilyFromNviAsync(parent.Id, new CitizenFamilyConfirmRequest([childTckn]), CancellationToken.None);

        Assert.Equal(1, result.TotalFound);
        Assert.Equal(1, result.NewlyAdded);
        Assert.Equal(0, result.AlreadyExisted);
        _participants.Verify(x => x.AddAsync(It.Is<Participant>(p => p.Tckn == childTckn && p.IsMinor), It.IsAny<CancellationToken>()), Times.Once);
        _guardians.Verify(x => x.AddAsync(It.Is<ParticipantGuardian>(g => g.GuardianId == parent.Id), It.IsAny<CancellationToken>()), Times.Once);
        _uow.Verify(x => x.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---- Mobil QA 2026-09-22 regresyon kilitleri ----

    [Fact]
    public async Task PreviewFamilyFromNviAsync_kendi_ailesini_maskelemeden_doner()
    {
        // Madde 123: bu uç, MaskCitizenIdentity (varsayılan true) yüzünden vatandaşın
        // KENDİ çocuklarının adlarını da maskeliyordu; listeden kimin seçileceği
        // ayırt edilemediği için ekran kullanılamaz haldeydi.
        var parent = CreateParticipant("11111111110", "Veli Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(parent.Id, It.IsAny<CancellationToken>())).ReturnsAsync(parent);
        _participants.Setup(x => x.GetChildrenAsync(parent.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(parent.Tckn, parent.BirthDate, 18, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null,
                new NviPersonDto(parent.Tckn, "Veli", "Kisi", parent.BirthDate, Gender.Female, null),
                [new NviChildDto("22222222222", "Ayse", "Kisi", new DateTime(2015, 1, 1), Gender.Female, null)]));

        var result = await _service.PreviewFamilyFromNviAsync(parent.Id, CancellationToken.None);

        Assert.Equal(parent.Tckn, result.Tckn);
        Assert.Equal("Veli Kisi", result.FullName);
        var child = Assert.Single(result.Children);
        Assert.Equal("Ayse Kisi", child.FullName);
        Assert.DoesNotContain('*', child.FullName);
    }

    [Fact]
    public async Task RemoveProfilePhotoAsync_fotografi_temizler_ve_kaydeder()
    {
        // Madde 125: fotoğraf yüklenebiliyor ama kaldırılamıyordu (silme ucu hiç yoktu).
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        participant.SetPhoto("https://cdn.example/foto.jpg");
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>())).ReturnsAsync(participant);

        await _service.RemoveProfilePhotoAsync(participant.Id, CancellationToken.None);

        Assert.Null(participant.PhotoUrl);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RemoveProfilePhotoAsync_fotograf_yoksa_hata_firlatmaz_ve_yazmaz()
    {
        // Idempotency: fotoğrafı olmayan kullanıcıda ikinci çağrı da sessizce başarılı olmalı.
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>())).ReturnsAsync(participant);

        await _service.RemoveProfilePhotoAsync(participant.Id, CancellationToken.None);

        Assert.Null(participant.PhotoUrl);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RemoveProfilePhotoAsync_katilimci_yoksa_not_found_firlatir()
    {
        var id = Guid.NewGuid();
        _participants.Setup(x => x.GetByIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync((Participant?)null);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.RemoveProfilePhotoAsync(id, CancellationToken.None));

        Assert.Equal("PARTICIPANT_NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public async Task VerifyOtpAsync_pending_token_gecersizse_conflict_firlatir_ve_otp_dogrulamaz()
    {
        _jwt.Setup(x => x.ValidatePendingOtpToken("bad-token")).Returns(((Guid, string)?)null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.VerifyOtpAsync(new CitizenVerifyOtpRequest("bad-token", "123456"), CancellationToken.None));

        Assert.Equal("OTP_SESSION_EXPIRED", ex.ErrorCode);
        _otp.Verify(x => x.VerifyAsync(It.IsAny<Guid>(), It.IsAny<OtpPurpose>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // 2026-09-22 bulgusu (vatandaş test raporu): "Şifremi unuttum" ile eski şifreyle
    // açılmış bir OTP oturumu, şifre paralel olarak sıfırlandıktan SONRA bile OTP
    // koduyla tamamlanıp giriş sağlayabiliyordu (session fixation). Pending-OTP JWT'sine
    // gömülen şifre parmak izi (PasswordFingerprint) artık VerifyOtpAsync'te güncel
    // PasswordHash ile karşılaştırılır; uyuşmuyorsa OTP hiç doğrulanmadan reddedilir.
    [Fact]
    public async Task VerifyOtpAsync_sifre_token_uretildikten_sonra_degistiyse_conflict_firlatir_ve_otp_dogrulamaz()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        // Token, ESKİ (o anki) şifrenin parmak iziyle üretilmişti; sonrasında
        // katılımcının PasswordHash'i değişti (paralel reset-password çağrısı).
        _jwt.Setup(x => x.ValidatePendingOtpToken("stale-token"))
            .Returns((participant.Id, "eski-sifrenin-parmak-izi"));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.VerifyOtpAsync(new CitizenVerifyOtpRequest("stale-token", "111111"), CancellationToken.None));

        Assert.Equal("OTP_SESSION_EXPIRED", ex.ErrorCode);
        _otp.Verify(x => x.VerifyAsync(It.IsAny<Guid>(), It.IsAny<OtpPurpose>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // Aynı düzeltmenin normal (şifre değişmemiş) akışı KIRMADIĞININ kanıtı: parmak izi
    // eşleştiğinde OTP normal şekilde doğrulanıp token üretilmeye devam etmelidir.
    [Fact]
    public async Task VerifyOtpAsync_sifre_degismediyse_parmak_izi_eslesir_ve_otp_dogrulanir()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        var fingerprint = Nexora.Infrastructure.Security.PasswordFingerprint.Compute(participant.PasswordHash);
        _jwt.Setup(x => x.ValidatePendingOtpToken("fresh-token"))
            .Returns((participant.Id, fingerprint));
        _jwt.Setup(x => x.GenerateCitizenAccessToken(participant, It.IsAny<Guid>())).Returns("access-token");
        _jwt.Setup(x => x.GenerateRefreshToken()).Returns("refresh-token");

        await _service.VerifyOtpAsync(new CitizenVerifyOtpRequest("fresh-token", "111111"), CancellationToken.None);

        _otp.Verify(x => x.VerifyAsync(participant.Id, OtpPurpose.TwoFactor, "111111", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task VerifyOtpAsync_OTP_sirasinda_hesap_engellendiyse_reddeder_ve_kodu_tuketmez()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        participant.SetStatus(ParticipantStatus.Blocked, "test engel");
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        var fingerprint = Nexora.Infrastructure.Security.PasswordFingerprint.Compute(participant.PasswordHash);
        _jwt.Setup(x => x.ValidatePendingOtpToken("fresh-token"))
            .Returns((participant.Id, fingerprint));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.VerifyOtpAsync(new CitizenVerifyOtpRequest("fresh-token", "111111"), CancellationToken.None));

        Assert.Equal("ACCOUNT_BLOCKED", ex.ErrorCode);
        _otp.Verify(x => x.VerifyAsync(It.IsAny<Guid>(), It.IsAny<OtpPurpose>(), It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ResetPasswordAsync_son_24_saatte_iki_degisiklik_varsa_limiti_engeller()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByPhoneAsync(participant.Phone!, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _auditLogs.Setup(x => x.CountAsync(
                It.IsAny<Expression<Func<AuditLog, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ResetPasswordAsync(
                new CitizenResetPasswordRequest(participant.Phone!, "111111", "NewPass1!"),
                CancellationToken.None));

        Assert.Equal("PASSWORD_CHANGE_DAILY_LIMIT", ex.ErrorCode);
        _otp.Verify(x => x.VerifyAsync(
            It.IsAny<Guid>(),
            It.IsAny<OtpPurpose>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ResetPasswordAsync_limit_dolmadiysa_sifreyi_degistirir()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByPhoneAsync(participant.Phone!, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _auditLogs.Setup(x => x.CountAsync(
                It.IsAny<Expression<Func<AuditLog, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        await _service.ResetPasswordAsync(
            new CitizenResetPasswordRequest(participant.Phone!, "111111", "NewPass1!"),
            CancellationToken.None);

        Assert.True(BCrypt.Net.BCrypt.Verify("NewPass1!", participant.PasswordHash));
        _otp.Verify(x => x.VerifyAsync(
            participant.Id,
            OtpPurpose.PasswordReset,
            "111111",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ResetPasswordAsync_eszamanli_iki_istekten_yalniz_biri_sifreyi_degistirir()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByPhoneAsync(participant.Phone!, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _auditLogs.Setup(x => x.CountAsync(
                It.IsAny<Expression<Func<AuditLog, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        var consumed = 0;
        _otp.Setup(x => x.VerifyAsync(participant.Id, OtpPurpose.PasswordReset, "111111", It.IsAny<CancellationToken>()))
            .Returns(() => Interlocked.Increment(ref consumed) == 1
                ? Task.CompletedTask
                : throw new ConflictException("OTP kodu bulunamadı veya süresi dolmuş. Yeni kod talep edin.", "OTP_EXPIRED"));

        async Task<bool> Attempt(string newPassword)
        {
            try
            {
                await _service.ResetPasswordAsync(
                    new CitizenResetPasswordRequest(participant.Phone!, "111111", newPassword), CancellationToken.None);
                return true;
            }
            catch (ConflictException ex) when (ex.ErrorCode == "OTP_EXPIRED")
            {
                return false;
            }
        }

        var results = await Task.WhenAll(Attempt("FirstPass1!"), Attempt("SecondPass1!"));

        Assert.Equal(1, results.Count(ok => ok));
        _otp.Verify(x => x.VerifyAsync(participant.Id, OtpPurpose.PasswordReset, "111111", It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task ResetPasswordAsync_yeni_sifre_mevcut_sifreyle_ayniysa_reddeder_ve_kodu_tuketmez()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        var oldHash = participant.PasswordHash;
        _participants.Setup(x => x.GetByPhoneAsync(participant.Phone!, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _auditLogs.Setup(x => x.CountAsync(
                It.IsAny<Expression<Func<AuditLog, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ResetPasswordAsync(
                new CitizenResetPasswordRequest(participant.Phone!, "111111", "Passw0rd!"),
                CancellationToken.None));

        Assert.Equal("SAME_AS_CURRENT_PASSWORD", ex.ErrorCode);
        Assert.Equal(oldHash, participant.PasswordHash);
        _otp.Verify(x => x.VerifyAsync(
            It.IsAny<Guid>(),
            It.IsAny<OtpPurpose>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ResetPasswordAsync_kod_hataliysa_sifre_karsilastirmasi_yapmadan_OTP_INVALID_doner()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByPhoneAsync(participant.Phone!, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _auditLogs.Setup(x => x.CountAsync(
                It.IsAny<Expression<Func<AuditLog, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);
        _otp.Setup(x => x.VerifyWithoutConsumingAsync(participant.Id, OtpPurpose.PasswordReset, "999999", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ConflictException("Kod hatalı.", "OTP_MISMATCH"));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ResetPasswordAsync(
                new CitizenResetPasswordRequest(participant.Phone!, "999999", "Passw0rd!"),
                CancellationToken.None));

        Assert.Equal("OTP_INVALID", ex.ErrorCode);
    }

    // IDN-11 düzeltmesi (2026-09-01): eski UpdateContactAsync tek istekte OTP'siz
    // değişiklik uyguluyordu. Bu regresyon testleri yeni iki adımlı akışın (1)
    // OTP doğrulanmadan katılımcı kaydını DEĞİŞTİRMEDİĞİNİ ve (2) doğru OTP
    // ile çağrıldığında değişikliği uyguladığını kanıtlar.
    [Fact]
    public async Task RequestContactChangeAsync_yeni_telefona_OTP_gonderir_ama_kaydi_degistirmez()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);

        var result = await _service.RequestContactChangeAsync(
            participant.Id,
            new CitizenRequestContactChangeRequest(null, "5559998877", "Passw0rd!"),
            CancellationToken.None);

        Assert.Equal("sms", result.OtpChannel);
        _otp.Verify(x => x.SendAsync(participant.Id, "5559998877", "sms", OtpPurpose.ContactChange, It.IsAny<CancellationToken>()), Times.Once);
        // OTP gönderme aşamasında katılımcı kaydı henüz değişmemeli — asıl açık buydu.
        Assert.Equal("5551112233", participant.Phone);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RequestContactChangeAsync_yanlis_mevcut_sifre_reddeder_ve_OTP_gondermez()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.RequestContactChangeAsync(
            participant.Id,
            new CitizenRequestContactChangeRequest(null, "5559998877", "YanlisSifre1!"),
            CancellationToken.None));

        Assert.Equal("INVALID_CURRENT_PASSWORD", ex.ErrorCode);
        _otp.Verify(x => x.SendAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
            OtpPurpose.ContactChange, It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConfirmContactChangeAsync_OTP_talep_edilmeden_cagrilirsa_conflict_firlatir_ve_degisiklik_uygulanmaz()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        // Servis GetAsync<PendingContactChange> çağırır; GetAsync<object> kurulumu
        // eşleşmediği için InvalidCastException'a yol açıyordu.
        _redis.Setup(x => x.GetAsync<ParticipantAuthService.PendingContactChange>(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ParticipantAuthService.PendingContactChange?)null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ConfirmContactChangeAsync(participant.Id, new CitizenConfirmContactChangeRequest("111111"), CancellationToken.None));

        Assert.Equal("CONTACT_CHANGE_NOT_REQUESTED", ex.ErrorCode);
        Assert.Equal("5551112233", participant.Phone);
        _otp.Verify(x => x.VerifyAsync(It.IsAny<Guid>(), It.IsAny<OtpPurpose>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConfirmContactChangeAsync_yanlis_OTP_ile_degisiklik_uygulanmaz()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);

        // InternalsVisibleTo sayesinde tip doğrudan kullanılır; yansımayla kurulan
        // GetAsync<object> mock'u servisin GetAsync<PendingContactChange> çağrısıyla
        // eşleşmediği için InvalidCastException veriyordu.
        var pending = new ParticipantAuthService.PendingContactChange(null, "5559998877", "sms", "5559998877");
        _redis.Setup(x => x.GetAsync<ParticipantAuthService.PendingContactChange>(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(pending);

        _otp.Setup(x => x.VerifyAsync(participant.Id, OtpPurpose.ContactChange, "000000", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ConflictException("OTP kodu hatalı.", "OTP_MISMATCH"));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ConfirmContactChangeAsync(participant.Id, new CitizenConfirmContactChangeRequest("000000"), CancellationToken.None));

        Assert.Equal("OTP_MISMATCH", ex.ErrorCode);
        Assert.Equal("5551112233", participant.Phone);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConfirmContactChangeAsync_dogru_OTP_ile_telefonu_gunceller()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);

        // InternalsVisibleTo sayesinde tip doğrudan kullanılır; yansımayla kurulan
        // GetAsync<object> mock'u servisin GetAsync<PendingContactChange> çağrısıyla
        // eşleşmediği için InvalidCastException veriyordu.
        var pending = new ParticipantAuthService.PendingContactChange(null, "5559998877", "sms", "5559998877");
        _redis.Setup(x => x.GetAsync<ParticipantAuthService.PendingContactChange>(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(pending);

        _otp.Setup(x => x.VerifyAsync(participant.Id, OtpPurpose.ContactChange, "111111", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await _service.ConfirmContactChangeAsync(participant.Id, new CitizenConfirmContactChangeRequest("111111"), CancellationToken.None);

        Assert.Equal("5559998877", participant.Phone);
        Assert.Equal("5559998877", result.Phone);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // Bulgu (2026-09-23): eski sistemden aktarılan üyelerin ilk şifre belirleme anında
    // (first-login ekranı) NVI adres/çocuk senkronizasyonunun AYNI istekte, hemen
    // tetiklendiğini ve NVI sonuçsuz döndüğünde (ör. gerçek NVI kimlik bilgileri henüz
    // .env'e girilmemişse) NviResyncPending bayrağının retry garantisi için true'ya
    // set edildiğini kanıtlayan regresyon testleri — SyncNviOnLoginAsync önceden void
    // dönüyordu ve bu durumda hiçbir bayrak set/temizlemediği için o katılımcı
    // sonsuza dek senkronizasyondan çıkıyordu (bkz. metot üstündeki yorum).
    [Fact]
    public async Task DeleteAccountAsync_sifre_dogruysa_hesabi_soft_delete_eder_ve_oturumlari_kapatir()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _redis.Setup(x => x.SetMembersAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        await _service.DeleteAccountAsync(participant.Id, new CitizenDeleteAccountRequest("Passw0rd!"), CancellationToken.None);

        _participants.Verify(x => x.Delete(participant), Times.Once);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _redis.Verify(x => x.RemoveAsync(It.Is<string>(k => k.Contains(participant.Id.ToString())), It.IsAny<CancellationToken>()), Times.AtLeastOnce);
    }

    [Fact]
    public async Task DeleteAccountAsync_sifre_hataliysa_silmez()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.DeleteAccountAsync(participant.Id, new CitizenDeleteAccountRequest("Yanlis1!"), CancellationToken.None));

        Assert.Equal("INVALID_PASSWORD", ex.ErrorCode);
        _participants.Verify(x => x.Delete(It.IsAny<Participant>()), Times.Never);
    }

    [Fact]
    public async Task ChangeInitialPasswordAsync_gecici_sifre_tekrar_girilirse_reddeder()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        participant.ResetTemporaryPassword(BCrypt.Net.BCrypt.HashPassword("Gecici1!"));
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ChangeInitialPasswordAsync(participant.Id, new CitizenChangeInitialPasswordRequest("Gecici1!"), CancellationToken.None));

        Assert.Equal("SAME_AS_CURRENT_PASSWORD", ex.ErrorCode);
        Assert.True(participant.MustChangePassword);
    }

    [Fact]
    public async Task ChangeInitialPasswordAsync_NVI_sonuc_verirse_ayni_istekte_senkronize_eder_ve_pending_kalmaz()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        participant.ResetTemporaryPassword(participant.PasswordHash);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(participant.Tckn, participant.BirthDate, It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null,
                new NviPersonDto(participant.Tckn, "Test", "Kisi", participant.BirthDate, Gender.Female, "Adres"), []));
        _nvi.Setup(x => x.GetAddressAsync(participant.Tckn, participant.BirthDate, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviAddressResponse(true, null, new NviAddressDto("Yeni Adres", "İstanbul", "Sultangazi", "Mah", "2055")));
        _participants.Setup(x => x.GetChildrenAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        await _service.ChangeInitialPasswordAsync(participant.Id, new CitizenChangeInitialPasswordRequest("NewPass1!"), CancellationToken.None);

        Assert.False(participant.MustChangePassword);
        Assert.False(participant.NviResyncPending);
        Assert.NotNull(participant.LastNviSyncAt);
        _nvi.Verify(x => x.GetPersonAndChildrenAsync(participant.Tckn, participant.BirthDate, It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ChangeInitialPasswordAsync_NVI_sonucsuz_donerse_NviResyncPending_true_kalir_retry_garantilenir()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        participant.ResetTemporaryPassword(participant.PasswordHash);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        // NVI_USERNAME/PASSWORD henüz girilmemiş senaryosu: servis Success=false döner.
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(participant.Tckn, participant.BirthDate, It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(false, "NVI kimlik bilgileri eksik", null, []));

        await _service.ChangeInitialPasswordAsync(participant.Id, new CitizenChangeInitialPasswordRequest("NewPass1!"), CancellationToken.None);

        Assert.False(participant.MustChangePassword);
        // Kritik doğrulama: senkronizasyon başarısız oldu ama bayrak retry için TRUE kalmalı,
        // aksi halde bu katılımcı NVI kimlik bilgileri sonradan girilse bile bir daha hiç
        // denenmez (düzeltme öncesi tam olarak bu bug vardı).
        Assert.True(participant.NviResyncPending);
        Assert.Null(participant.LastNviSyncAt);
    }

    // Staj-test bulgusu (2026-09-23): kayıt akışında OTP resend cooldown'ı,
    // RegisterAsync'in her denemede ürettiği RASTGELE pendingId'ye bağlıydı.
    // Kullanıcı OTP ekranından çıkıp kayıt formuna yeniden girip tekrar
    // gönderdiğinde yeni bir pendingId (dolayısıyla yeni bir cooldown key'i)
    // oluştuğu için önceki cooldown hiç görülmeden kod tekrar gönderiliyordu.
    // Bu test, aynı TCKN için art arda iki RegisterAsync çağrısının ikincisinde
    // cooldown kontrolünün (EnsureCanResendAsync) TETİKLENDİĞİNİ ve cooldown
    // aktifken OTP_RESEND_COOLDOWN ile reddedildiğini kanıtlar.
    [Fact]
    public async Task RegisterAsync_ayni_tckn_ile_tekrar_cagrilirsa_cooldown_kontrolu_yapar_ve_devam_ederse_yeni_kod_gonderir()
    {
        var request = new CitizenRegisterRequest(
            "11111111110", new DateTime(1990, 1, 1), "5551112233", "test@example.com", "Passw0rd1!", null, null);
        _participants.Setup(x => x.GetByTcknIncludingDeletedAsync(request.Tckn, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Participant?)null);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(request.Tckn, request.BirthDate, 18, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null,
                new NviPersonDto(request.Tckn, "Test", "Kisi", request.BirthDate, Gender.Female, "Adres"), []));
        _nvi.Setup(x => x.GetAddressAsync(request.Tckn, request.BirthDate, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviAddressResponse(false, null, null));
        _jwt.Setup(x => x.GeneratePendingOtpToken(It.IsAny<Guid>())).Returns("otp-session");

        await _service.RegisterAsync(request, CancellationToken.None);

        // İlk çağrıda cooldown boş olmalı (henüz başlatılmadı) ve gönderim sonrası
        // TCKN'e bağlı cooldown BAŞLATILMALIDIR — aksi halde ikinci çağrıda hiçbir
        // şey engellenmez (bu satır olmadan test anlamsızlaşır).
        _otp.Verify(x => x.EnsureCanResendAsync(It.IsAny<Guid>(), OtpPurpose.TwoFactor, It.IsAny<CancellationToken>()), Times.Once);
        _otp.Verify(x => x.StartCooldownAsync(It.IsAny<Guid>(), OtpPurpose.TwoFactor, It.IsAny<CancellationToken>()), Times.Once);
        _otp.Verify(x => x.SendAsync(It.IsAny<Guid>(), request.Phone, "sms", OtpPurpose.TwoFactor, It.IsAny<CancellationToken>()), Times.Once);

        // İkinci deneme (OTP ekranından çıkıp kayıt formuna yeniden girip tekrar
        // "Kayıt Ol" — RegisterScreen.handleStep2 -> citizenRegister -> RegisterAsync):
        // cooldown hâlâ aktifken servis reddetmelidir.
        _otp.Setup(x => x.EnsureCanResendAsync(It.IsAny<Guid>(), OtpPurpose.TwoFactor, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ConflictException("Yeni kod talep etmek için 175 saniye bekleyin.", "OTP_RESEND_COOLDOWN"));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RegisterAsync(request, CancellationToken.None));

        Assert.Equal("OTP_RESEND_COOLDOWN", ex.ErrorCode);
        // Cooldown reddedince NVI'ye tekrar gidilmemeli/yeni kod gönderilmemeli —
        // istek en erken noktada durdurulmalı.
        _nvi.Verify(x => x.GetPersonAndChildrenAsync(request.Tckn, request.BirthDate, 18, It.IsAny<CancellationToken>()), Times.Once);
        _otp.Verify(x => x.SendAsync(It.IsAny<Guid>(), request.Phone, "sms", OtpPurpose.TwoFactor, It.IsAny<CancellationToken>()), Times.Once);
    }

    // Aynı TCKN için ard arda iki RegisterAsync çağrısı, İKİ FARKLI rastgele
    // pendingId üretse bile (bu servis kasıtlı olarak öyle tasarlanmış — bkz.
    // PendingRegKey/CompleteRegistrationAsync) cooldown kimliğinin SABİT (TCKN'den
    // türetilmiş) olduğunu, yani pendingId'den bağımsız olduğunu kanıtlar.
    [Fact]
    public async Task RegisterAsync_cooldown_kimligi_pendingId_degil_TCKNe_bagli_sabit_kalir()
    {
        var request = new CitizenRegisterRequest(
            "11111111110", new DateTime(1990, 1, 1), "5551112233", "test@example.com", "Passw0rd1!", null, null);
        _participants.Setup(x => x.GetByTcknIncludingDeletedAsync(request.Tckn, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Participant?)null);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(request.Tckn, request.BirthDate, 18, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null,
                new NviPersonDto(request.Tckn, "Test", "Kisi", request.BirthDate, Gender.Female, "Adres"), []));
        _nvi.Setup(x => x.GetAddressAsync(request.Tckn, request.BirthDate, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviAddressResponse(false, null, null));
        _jwt.Setup(x => x.GeneratePendingOtpToken(It.IsAny<Guid>())).Returns("otp-session");

        var cooldownIds = new List<Guid>();
        _otp.Setup(x => x.EnsureCanResendAsync(It.IsAny<Guid>(), OtpPurpose.TwoFactor, It.IsAny<CancellationToken>()))
            .Callback<Guid, OtpPurpose, CancellationToken>((id, _, _) => cooldownIds.Add(id))
            .Returns(Task.CompletedTask);
        _otp.Setup(x => x.StartCooldownAsync(It.IsAny<Guid>(), OtpPurpose.TwoFactor, It.IsAny<CancellationToken>()))
            .Callback<Guid, OtpPurpose, CancellationToken>((id, _, _) => cooldownIds.Add(id))
            .Returns(Task.CompletedTask);

        await _service.RegisterAsync(request, CancellationToken.None);
        await _service.RegisterAsync(request, CancellationToken.None);

        Assert.Equal(4, cooldownIds.Count);
        Assert.Single(cooldownIds.Distinct());
    }

    [Fact]
    public async Task ChangePasswordAsync_dogru_mevcut_sifre_ile_gunceller_ve_security_version_artirir()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        var beforeVersion = participant.SecurityVersion;
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>())).ReturnsAsync(participant);
        _auditLogs.Setup(x => x.CountAsync(It.IsAny<Expression<Func<AuditLog, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync(0);

        await _service.ChangePasswordAsync(participant.Id,
            new CitizenChangePasswordRequest("Passw0rd!", "YeniParol1!"), CancellationToken.None);

        Assert.False(participant.MustChangePassword);
        Assert.False(participant.IsFirstLogin);
        Assert.Equal(beforeVersion + 1, participant.SecurityVersion);
        Assert.True(BCrypt.Net.BCrypt.Verify("YeniParol1!", participant.PasswordHash));
    }

    [Fact]
    public async Task ChangePasswordAsync_yanlis_mevcut_sifre_INVALID_CURRENT_PASSWORD_doner()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>())).ReturnsAsync(participant);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ChangePasswordAsync(participant.Id,
                new CitizenChangePasswordRequest("YanlisSifre1!", "YeniParol1!"), CancellationToken.None));
        Assert.Equal("INVALID_CURRENT_PASSWORD", ex.ErrorCode);
    }

    [Fact]
    public async Task ChangePasswordAsync_yeni_sifre_mevcutla_ayni_SAME_AS_CURRENT_PASSWORD_doner()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>())).ReturnsAsync(participant);
        _auditLogs.Setup(x => x.CountAsync(It.IsAny<Expression<Func<AuditLog, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync(0);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ChangePasswordAsync(participant.Id,
                new CitizenChangePasswordRequest("Passw0rd!", "Passw0rd!"), CancellationToken.None));
        Assert.Equal("SAME_AS_CURRENT_PASSWORD", ex.ErrorCode);
    }

    [Fact]
    public async Task ForgotPasswordAsync_engelli_hesaba_reset_kodu_gondermez()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        participant.SetStatus(ParticipantStatus.Blocked, "test engel");
        _participants.Setup(x => x.GetByPhoneAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ForgotPasswordAsync(new CitizenForgotPasswordRequest("5551112233"), CancellationToken.None));

        Assert.Equal("PARTICIPANT_NOT_FOUND", ex.ErrorCode);
        _otp.Verify(x => x.SendAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
            OtpPurpose.PasswordReset, It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ForgotPasswordAsync_olmayan_hesap_icin_eslesen_kayit_bulunamadi_der()
    {
        _participants.Setup(x => x.GetByPhoneAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Participant?)null);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ForgotPasswordAsync(new CitizenForgotPasswordRequest("5559998877"), CancellationToken.None));

        Assert.Equal("PARTICIPANT_NOT_FOUND", ex.ErrorCode);
        Assert.Equal("Eşleşen bir kayıt bulunamadı.", ex.Message);
        _otp.Verify(x => x.SendAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
            OtpPurpose.PasswordReset, It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ForgotPasswordAsync_aktif_hesaba_reset_kodu_gonderir()
    {
        var participant = CreateParticipant("11111111110", "Test Kisi", isMinor: false);
        _participants.Setup(x => x.GetByPhoneAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _otp.Setup(x => x.IsOnCooldownAsync(participant.Id, OtpPurpose.PasswordReset, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        await _service.ForgotPasswordAsync(new CitizenForgotPasswordRequest("5551112233"), CancellationToken.None);

        _otp.Verify(x => x.SendAsync(participant.Id, It.IsAny<string>(), It.IsAny<string>(),
            OtpPurpose.PasswordReset, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LoginAsync_telefon_birden_fazla_hesaba_aitse_TCKN_ister()
    {
        _participants.Setup(x => x.CountByPhoneCandidatesAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.LoginAsync(new CitizenLoginRequest("05551112233", "Passw0rd!"), CancellationToken.None));

        Assert.Equal("IDENTIFIER_REQUIRES_CONTEXT", ex.ErrorCode);
        // Belirsiz telefon: hiçbir hesabın hash'i/kilidi işlenmemeli, OTP gönderilmemeli.
        _otp.Verify(x => x.SendAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<OtpPurpose>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // Panelden açılmış, telefonsuz ve hiç etkinleştirilmemiş kayıt (ad/soyad/TC var).
    private static Participant CreateUnclaimedWithoutContact(string tckn)
    {
        var p = Participant.Create(tckn, "Panel Kisi", new DateTime(1980, 1, 1), Gender.Male, false,
            BCrypt.Net.BCrypt.HashPassword("Rastgele1!"), null, null, null, null, null);
        SetId(p, Guid.NewGuid());
        return p;
    }

    [Fact]
    public async Task LoginAsync_panelden_acilmis_telefonsuz_kayitta_ACTIVATION_REQUIRED_doner_ve_kilit_islemez()
    {
        var participant = CreateUnclaimedWithoutContact("11111111110");
        _participants.Setup(x => x.GetByTcknAsync("11111111110", It.IsAny<CancellationToken>())).ReturnsAsync(participant);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.LoginAsync(new CitizenLoginRequest("11111111110", "Yanlis1!"), CancellationToken.None));

        Assert.Equal("ACTIVATION_REQUIRED", ex.ErrorCode);
        Assert.Equal(0, participant.FailedLoginCount);
        _otp.Verify(x => x.SendAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<OtpPurpose>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ForgotPasswordAsync_telefonsuz_kayitta_dogum_tarihi_yoksa_BIRTHDATE_REQUIRED_doner()
    {
        var participant = CreateUnclaimedWithoutContact("11111111110");
        _participants.Setup(x => x.GetByTcknAsync("11111111110", It.IsAny<CancellationToken>())).ReturnsAsync(participant);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ForgotPasswordAsync(new CitizenForgotPasswordRequest("11111111110"), CancellationToken.None));

        Assert.Equal("BIRTHDATE_REQUIRED", ex.ErrorCode);
        _otp.Verify(x => x.SendAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<OtpPurpose>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ForgotPasswordAsync_telefonsuz_dogrulanmis_kayit_dogum_tarihiyle_kayit_akisina_yonlenir_ve_silinmez()
    {
        var participant = CreateUnclaimedWithoutContact("11111111110");
        participant.MarkVerified(); // eski sistemden aktarılmış, doğrulanmış ama telefonsuz
        var birth = new DateTime(1980, 1, 1);
        _participants.Setup(x => x.GetByTcknAsync("11111111110", It.IsAny<CancellationToken>())).ReturnsAsync(participant);
        _participants.Setup(x => x.GetByTcknIncludingDeletedAsync("11111111110", It.IsAny<CancellationToken>())).ReturnsAsync(participant);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync("11111111110", birth, 18, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null,
                new NviPersonDto("11111111110", "Panel", "Kisi", birth, Gender.Male, null),
                [new NviChildDto("33333333334", "Cocuk", "Bir", new DateTime(2015, 1, 1), Gender.Male, null)]));

        var result = await _service.ForgotPasswordAsync(new CitizenForgotPasswordRequest("11111111110", birth), CancellationToken.None);

        Assert.True(result.RegistrationRequired);
        Assert.NotNull(result.Registration);
        Assert.Single(result.Registration!.Children);
        _participants.Verify(x => x.Delete(It.IsAny<Participant>()), Times.Never);
        _otp.Verify(x => x.SendAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<OtpPurpose>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ForgotPasswordAsync_telefonsuz_kayitta_dogum_tarihi_NVI_ile_eslesmezse_NVI_NOT_FOUND()
    {
        var participant = CreateUnclaimedWithoutContact("11111111110");
        _participants.Setup(x => x.GetByTcknAsync("11111111110", It.IsAny<CancellationToken>())).ReturnsAsync(participant);
        _participants.Setup(x => x.GetByTcknIncludingDeletedAsync("11111111110", It.IsAny<CancellationToken>())).ReturnsAsync(participant);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync("11111111110", It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(false, "yok", null, []));

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ForgotPasswordAsync(new CitizenForgotPasswordRequest("11111111110", new DateTime(1999, 9, 9)), CancellationToken.None));
        Assert.Equal("NVI_NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public async Task NviLookupAsync_panelden_acilmis_telefonsuz_kayit_kayit_akisina_alinir()
    {
        _participants.Setup(x => x.GetByTcknIncludingDeletedAsync("11111111110", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateUnclaimedWithoutContact("11111111110"));
        _nvi.Setup(x => x.GetPersonAndChildrenAsync("11111111110", It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(false, "yok", null, []));

        // ALREADY_REGISTERED kapısını geçip NVİ sorgusuna ulaştığını kanıtlar.
        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.NviLookupAsync(new CitizenNviLookupRequest("11111111110", new DateTime(1980, 1, 1)), CancellationToken.None));
        Assert.Equal("NVI_NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public async Task NviLookupAsync_telefonu_olan_dogrulanmis_hesapta_hala_ALREADY_REGISTERED_doner()
    {
        _participants.Setup(x => x.GetByTcknIncludingDeletedAsync("11111111110", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateParticipant("11111111110", "Test Kisi", isMinor: false));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.NviLookupAsync(new CitizenNviLookupRequest("11111111110", new DateTime(1980, 1, 1)), CancellationToken.None));
        Assert.Equal("ALREADY_REGISTERED", ex.ErrorCode);
    }

    private static Participant CreateParticipant(string tckn, string fullName, bool isMinor)
    {
        var participant = Participant.Create(tckn, fullName, new DateTime(1988, 1, 1), Gender.Female, isMinor,
            BCrypt.Net.BCrypt.HashPassword("Passw0rd!"), "veli@example.com", "5551112233", null, null, null);
        SetId(participant, Guid.NewGuid());
        participant.MarkVerified();
        participant.CompleteInitialPassword(participant.PasswordHash);
        return participant;
    }

    private static void SetId(object entity, Guid id)
    {
        var prop = entity.GetType().BaseType?.GetProperty("Id") ?? entity.GetType().GetProperty("Id");
        prop?.SetValue(entity, id);
    }
}
