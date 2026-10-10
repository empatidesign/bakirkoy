using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Security;
using Xunit;

namespace Nexora.UnitTests.Domain;

// Kullanıcı isteği (2026-09-21): "5 yanlış denemede kilitle, süre botlar tarafından
// tahmin edilemesin, 4-5 dakika içinde farklı saniye". Taban süre 4 dakikaya (önceki
// 1 dakikadan) çıkarıldı ve her denemede kriptografik olarak yeniden üretilen 0-60 sn
// jitter eklenir (LockoutJitter.NextSeconds, RandomNumberGenerator ile) — gerçek kilit
// süresi hesap hesap farklı bir noktada 4-5 dakika arasında biter, sabit bir sayı
// olmadığı için otomatik yeniden deneme zamanlaması kurulamaz.
public class AccountLockoutTests
{
    private static Participant MakeParticipant() => Participant.Create(
        tckn: "12345678950",
        fullName: "Test Katılımcı",
        birthDate: new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        gender: Gender.Male,
        isMinor: false,
        passwordHash: "hash",
        email: null,
        phone: null,
        guardianPhone: null,
        guardianEmail: null,
        address: null);

    // Üretim varsayılanları: 5 deneme eşiği, 4 dakika taban süre, 0-60 sn jitter aralığı
    // (bkz. appsettings.json LockoutSettings).
    private const int DefaultThreshold = 5;
    private const int DefaultLockoutMinutes = 4;
    private const int DefaultJitterMaxSeconds = 60;

    private static AdminUser MakeAdmin() =>
        AdminUser.Create("Test Yönetici", "test@nexora.local", null, null, "hash", Guid.NewGuid());

    [Fact]
    public void Participant_5_hatali_girişten_once_kilitlenmez()
    {
        var p = MakeParticipant();
        for (var i = 0; i < 4; i++) p.RecordFailedLogin(DefaultThreshold, DefaultLockoutMinutes, LockoutJitter.NextSeconds(DefaultJitterMaxSeconds));
        Assert.False(p.IsLocked);
        Assert.Equal(4, p.FailedLoginCount);
    }

    [Fact]
    public void Participant_5_hatali_girişte_kilitlenir_ve_sure_4_ile_5_dakika_arasidir()
    {
        var p = MakeParticipant();
        var before = DateTime.UtcNow;
        for (var i = 0; i < 5; i++) p.RecordFailedLogin(DefaultThreshold, DefaultLockoutMinutes, LockoutJitter.NextSeconds(DefaultJitterMaxSeconds));
        var after = DateTime.UtcNow;

        Assert.True(p.IsLocked);
        Assert.Equal(5, p.FailedLoginCount);
        Assert.NotNull(p.LockedUntil);
        // Kilit süresi taban 4dk + 0-60sn jitter, yani gerçek süre 4-5 dakika arasında
        // olmalı (ne sabit 4dk ne sabit 5dk — jitter'ın çalıştığı, sabit olmadığı kanıtlanır).
        Assert.InRange(p.LockedUntil!.Value, before.AddMinutes(4).AddSeconds(-5), after.AddMinutes(5).AddSeconds(5));
    }

    [Fact]
    public void Participant_Unlock_kilidi_ve_sayaci_sifirlar()
    {
        var p = MakeParticipant();
        for (var i = 0; i < 5; i++) p.RecordFailedLogin(DefaultThreshold, DefaultLockoutMinutes, LockoutJitter.NextSeconds(DefaultJitterMaxSeconds));
        Assert.True(p.IsLocked);

        p.Unlock();

        Assert.False(p.IsLocked);
        Assert.Null(p.LockedUntil);
        Assert.Equal(0, p.FailedLoginCount);
    }

    [Fact]
    public void AdminUser_5_hatali_girişte_kilitlenir_ve_sure_4_ile_5_dakika_arasidir()
    {
        var a = MakeAdmin();
        var before = DateTime.UtcNow;
        for (var i = 0; i < 5; i++) a.RecordFailedLogin(DefaultThreshold, DefaultLockoutMinutes, LockoutJitter.NextSeconds(DefaultJitterMaxSeconds));
        var after = DateTime.UtcNow;

        Assert.True(a.IsLocked);
        Assert.NotNull(a.LockedUntil);
        Assert.InRange(a.LockedUntil!.Value, before.AddMinutes(4).AddSeconds(-5), after.AddMinutes(5).AddSeconds(5));
    }

    [Fact]
    public void AdminUser_Unlock_kilidi_ve_sayaci_sifirlar()
    {
        var a = MakeAdmin();
        for (var i = 0; i < 5; i++) a.RecordFailedLogin(DefaultThreshold, DefaultLockoutMinutes, LockoutJitter.NextSeconds(DefaultJitterMaxSeconds));
        Assert.True(a.IsLocked);

        a.Unlock();

        Assert.False(a.IsLocked);
        Assert.Null(a.LockedUntil);
        Assert.Equal(0, a.FailedLoginCount);
    }

    // Jitter'ın gerçekten çalıştığını (her çağrıda farklı bir değer üretebildiğini)
    // kanıtlar — sabit bir gecikme olsaydı bot bunu tam olarak ölçüp tahmin edebilirdi.
    [Fact]
    public void LockoutJitter_farkli_cagrilar_farkli_degerler_uretebilir()
    {
        var values = new HashSet<int>();
        for (var i = 0; i < 50; i++) values.Add(LockoutJitter.NextSeconds(60));

        Assert.True(values.Count > 1, "50 çağrıda en az iki farklı jitter değeri üretilmeli; aksi halde süre sabit ve tahmin edilebilir kalır.");
        Assert.All(values, v => Assert.InRange(v, 0, 60));
    }

    [Fact]
    public void LockoutJitter_maxSeconds_sifirsa_daima_sifir_doner()
    {
        for (var i = 0; i < 10; i++)
            Assert.Equal(0, LockoutJitter.NextSeconds(0));
    }
}
