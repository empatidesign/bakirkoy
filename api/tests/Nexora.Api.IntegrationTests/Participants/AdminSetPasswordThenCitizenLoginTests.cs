using System.Text;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Persistence;
using Xunit;

namespace Nexora.Api.IntegrationTests.Participants;

/// <summary>
/// Kullanıcı bulgusu (2026-09-23): "adminde 61039414008 üyesinin şifresini değiştiriyorum
/// fakat TC ve şifre doğru olmasına rağmen citizen portala girdiğimde TC veya şifre yanlış
/// hatası veriyor."
///
/// Bu testler GERÇEK hosted API üzerinden tam zinciri koşar:
///   POST /api/v1/participants/{id}/set-password  (admin)
///   POST /api/v1/auth/citizen/login              (vatandaş, TCKN + aynı şifre)
/// Böylece sorunun hash'leme, kayıt seçimi (TCKN araması), hesap durumu veya kilit
/// mekanizmasından hangisinde olduğu tahmin değil GÖZLEM ile belirlenir.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class AdminSetPasswordThenCitizenLoginTests : IAsyncLifetime
{
    private readonly NexoraApiFactory _factory;
    private HttpClient _admin = null!;
    private HttpClient _anon = null!;

    public AdminSetPasswordThenCitizenLoginTests(ApiTestHost host) => _factory = host.Factory;

    public async Task InitializeAsync()
    {
        _admin = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), $"sp-{Guid.NewGuid():N}@nexora.local"));
        _anon = _factory.CreateClient();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static string NewValidTckn(Random rnd)
    {
        while (true)
        {
            var d = new int[11];
            d[0] = rnd.Next(1, 10);
            for (var i = 1; i < 9; i++) d[i] = rnd.Next(0, 10);
            var oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
            var evenSum = d[1] + d[3] + d[5] + d[7];
            d[9] = ((oddSum * 7) - evenSum) % 10;
            if (d[9] < 0) d[9] += 10;
            d[10] = d.Take(10).Sum() % 10;
            var s = string.Concat(d);
            if (Nexora.Application.Common.TcKimlikValidator.IsValid(s)) return s;
        }
    }

    private async Task<(Guid Id, string Tckn)> SeedActiveParticipantAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var tckn = NewValidTckn(new Random());
        var p = Participant.Create(
            tckn, "Sifre Testi", new DateTime(1990, 1, 1), Gender.Male, isMinor: false,
            passwordHash: BCrypt.Net.BCrypt.HashPassword("EskiSifre1"),
            email: null, phone: "05321119988",
            guardianPhone: null, guardianEmail: null, address: null);
        p.MarkVerified();
        await db.Set<Participant>().AddAsync(p);
        await db.SaveChangesAsync();
        return (p.Id, tckn);
    }

    [Fact]
    public async Task Admin_set_password_without_force_change_then_citizen_can_login_with_tckn()
    {
        var (id, tckn) = await SeedActiveParticipantAsync();
        const string newPassword = "YeniSifre1";

        var set = await _admin.PostAsJsonAsync($"/api/v1/participants/{id}/set-password",
            new { newPassword, mustChangeOnFirstLogin = false });
        set.IsSuccessStatusCode.Should().BeTrue(await set.Content.ReadAsStringAsync());

        var login = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password = newPassword });

        login.IsSuccessStatusCode.Should().BeTrue(
            "admin'in belirlediği şifreyle TCKN üzerinden giriş yapılabilmeli. Yanıt: "
            + await login.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Admin_set_password_with_force_change_then_citizen_can_still_login()
    {
        // "İlk girişte değiştirmek zorunda" seçeneği girişi ENGELLEMEMELİ; yalnızca
        // giriş sonrası şifre değiştirme ekranına yönlendirmeli.
        var (id, tckn) = await SeedActiveParticipantAsync();
        const string newPassword = "YeniSifre2";

        var set = await _admin.PostAsJsonAsync($"/api/v1/participants/{id}/set-password",
            new { newPassword, mustChangeOnFirstLogin = true });
        set.IsSuccessStatusCode.Should().BeTrue(await set.Content.ReadAsStringAsync());

        var login = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password = newPassword });

        login.IsSuccessStatusCode.Should().BeTrue(
            "zorunlu şifre değişimi bayrağı girişi engellememeli. Yanıt: "
            + await login.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Admin_set_password_then_old_password_is_rejected()
    {
        var (id, tckn) = await SeedActiveParticipantAsync();

        var set = await _admin.PostAsJsonAsync($"/api/v1/participants/{id}/set-password",
            new { newPassword = "YeniSifre3", mustChangeOnFirstLogin = false });
        set.IsSuccessStatusCode.Should().BeTrue();

        var login = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password = "EskiSifre1" });

        login.IsSuccessStatusCode.Should().BeFalse("eski şifre artık kabul edilmemeli");
    }

    [Fact]
    public async Task Admin_set_password_clears_the_failed_login_lockout()
    {
        // KULLANICI SENARYOSU (2026-09-23): vatandaş şifresini hatırlamayıp arka arkaya
        // yanlış denemeler yapar -> hesap kilitlenir (LockoutSettings:MaxFailedAttempts,
        // varsayılan 5). Yönetici "doğru" şifreyi elle belirler ve vatandaşa söyler, ama
        // giriş yine reddedilir. Yönetici müdahalesi kilidi TEMİZLEMELİDİR; aksi hâlde
        // admin panelde şifre değiştirmek görünürde hiçbir işe yaramaz.
        var (id, tckn) = await SeedActiveParticipantAsync();

        // Hesabı gerçek giriş uçları üzerinden kilitle (mock/DB kısayolu değil).
        for (var i = 0; i < 6; i++)
        {
            await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
                new { identifier = tckn, password = "KesinlikleYanlis9" });
        }

        var lockedAttempt = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password = "KesinlikleYanlis9" });
        (await lockedAttempt.Content.ReadAsStringAsync()).Should().Contain("ACCOUNT_LOCKED",
            "önce hesabın gerçekten kilitlendiğini doğrula");

        // Yönetici yeni şifreyi belirler.
        var set = await _admin.PostAsJsonAsync($"/api/v1/participants/{id}/set-password",
            new { newPassword = "YeniSifre4", mustChangeOnFirstLogin = false });
        set.IsSuccessStatusCode.Should().BeTrue(await set.Content.ReadAsStringAsync());

        // Vatandaş yöneticinin verdiği şifreyle giriş yapabilmeli.
        var login = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password = "YeniSifre4" });

        login.IsSuccessStatusCode.Should().BeTrue(
            "yönetici şifre belirlediğinde kilit de temizlenmeli, aksi hâlde doğru şifreyle "
            + "bile giriş yapılamaz. Yanıt: " + await login.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Send_temporary_password_also_clears_the_failed_login_lockout()
    {
        // İKİNCİ YÖNETİCİ YOLU: "Geçici Şifre Gönder" (SMS/e-posta). Bu yol da kilidi
        // temizlemezse, gönderilen geçici şifreyle de giriş yapılamaz — elle şifre
        // belirlemedeki aynı sorun. Bu test o yolu doğrudan doğrular.
        var (id, tckn) = await SeedActiveParticipantAsync();

        for (var i = 0; i < 6; i++)
        {
            await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
                new { identifier = tckn, password = "KesinlikleYanlis9" });
        }

        var lockedBefore = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password = "KesinlikleYanlis9" });
        (await lockedBefore.Content.ReadAsStringAsync()).Should().Contain("ACCOUNT_LOCKED",
            "önce hesabın gerçekten kilitlendiğini doğrula");

        var send = await _admin.PostAsJsonAsync($"/api/v1/participants/{id}/send-password-reset",
            new { channel = "Sms" });
        send.IsSuccessStatusCode.Should().BeTrue(await send.Content.ReadAsStringAsync());

        // Geçici şifreyi bilmiyoruz (SMS ile gidiyor), ama kilidin kalktığını
        // gözlemleyebiliriz: artık ACCOUNT_LOCKED değil INVALID_CREDENTIALS dönmeli.
        var afterSend = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password = "BaskaBirYanlis9" });
        var body = await afterSend.Content.ReadAsStringAsync();

        body.Should().NotContain("ACCOUNT_LOCKED",
            "geçici şifre gönderimi kilidi temizlemeli; aksi hâlde gönderilen şifre işe yaramaz");
        body.Should().Contain("INVALID_CREDENTIALS",
            "kilit kalktığı için artık normal 'şifre hatalı' yanıtı beklenir");
    }

    /// <summary>
    /// Kullanıcı 2026-09-23'te düzeltmelerden SONRA da "TC ve şifre doğru ama giremiyorum"
    /// diyor. Bu test kalan en güçlü açıklamayı sınar: kayıt YUMUŞAK SİLİNMİŞ (IsDeleted)
    /// olabilir. Participant üzerinde global sorgu filtresi (!IsDeleted) olduğu için
    /// giriş araması kaydı HİÇ göremez ve "şifre hatalı" döner — oysa yönetici panelinde
    /// kayıt görünüp şifresi başarıyla değiştirilebiliyor olabilir. Yani yönetici
    /// "şifreyi değiştirdim" derken vatandaş giremez: tam olarak bildirilen tablo.
    /// </summary>
    [Fact]
    public async Task Soft_deleted_participant_cannot_login_even_with_the_correct_password()
    {
        var (id, tckn) = await SeedActiveParticipantAsync();
        const string password = "DogruSifre1";

        var set = await _admin.PostAsJsonAsync($"/api/v1/participants/{id}/set-password",
            new { newPassword = password, mustChangeOnFirstLogin = false });
        set.IsSuccessStatusCode.Should().BeTrue(await set.Content.ReadAsStringAsync());

        // Önce sağlıklı hâlde girişin ÇALIŞTIĞINI kanıtla (kontrol grubu).
        var before = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password });
        before.IsSuccessStatusCode.Should().BeTrue(
            "silinmeden önce bu şifreyle giriş yapılabiliyor olmalı ki aşağıdaki fark anlamlı olsun");

        // Şimdi kaydı yumuşak sil (yönetici panelindeki "sil" eylemiyle aynı etki).
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var p = await db.Set<Participant>().IgnoreQueryFilters().FirstAsync(x => x.Id == id);
            p.IsDeleted = true;
            await db.SaveChangesAsync();
        }

        var after = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password });

        after.IsSuccessStatusCode.Should().BeFalse();
        var body = await after.Content.ReadAsStringAsync();
        body.Should().Contain("INVALID_CREDENTIALS",
            "silinmiş kayıt bulunamadığı için kullanıcı, şifresi DOĞRU olmasına rağmen " +
            "ayırt edilemeyen 'TC veya şifre hatalı' mesajını görür — bildirilen şikâyetin " +
            "birebir aynısı. Bu yüzden sunucu günlüğüne Reason=ParticipantNotFound izi eklendi.");

        // ÖNEMLİ SINIRLAMA (dürüstlük notu): Yönetici tarafı da aynı global filtreyi
        // kullandığı için silinmiş kayda şifre belirlenemez — aşağıda kanıtlanıyor.
        // Dolayısıyla "yönetici şifreyi BAŞARIYLA değiştirdim" diyorsa kayıt silinmiş
        // DEĞİLDİR ve bu senaryo o vakayı açıklamaz. Senaryo yalnızca şu sırayla
        // gerçekleşmiş olabilir: önce şifre değiştirildi, SONRA kayıt silindi.
        var afterDeleteSet = await _admin.PostAsJsonAsync($"/api/v1/participants/{id}/set-password",
            new { newPassword = "BaskaSifre1", mustChangeOnFirstLogin = false });
        afterDeleteSet.IsSuccessStatusCode.Should().BeFalse(
            "silinmiş kayda yönetici de erişemez; bu, teorinin kapsamını daraltan kritik gözlemdir");
    }

    /// <summary>
    /// SORUN (2026-09-23): Türkçe karakter içeren şifreler Unicode'da iki farklı
    /// biçimde kodlanabilir — NFC (tek kod noktası "ş") ve NFD (taban "s" + birleşik
    /// aksan). Ekranda birebir aynı görünürler ama bayt dizileri farklıdır ve BCrypt
    /// baytlar üzerinde çalışır. Farklı cihaz/klavye/şifre yöneticisi kombinasyonları
    /// farklı biçim üretebildiği için kullanıcı şifresini bir yerde belirleyip başka
    /// bir yerde giremez ve "TC veya şifre hatalı" görür.
    ///
    /// Bu test GERÇEK API üzerinden tam zinciri koşar: yönetici şifreyi NFC biçiminde
    /// belirler, vatandaş NFD biçiminde giriş yapar. Normalizasyon olmadan bu istek
    /// başarısız olur.
    /// </summary>
    [Fact]
    public async Task Turkish_password_works_regardless_of_unicode_normalization_form()
    {
        var (id, tckn) = await SeedActiveParticipantAsync();

        const string raw = "Şifreüğı1";
        var nfc = raw.Normalize(NormalizationForm.FormC);
        var nfd = raw.Normalize(NormalizationForm.FormD);

        // Önce bu senaryonun gerçekten ayırt edici olduğunu doğrula: iki biçim
        // string olarak FARKLI olmalı, yoksa test hiçbir şey kanıtlamaz.
        nfc.Should().NotBe(nfd, "aksi hâlde bu test tuzağı yakalayamaz");

        var set = await _admin.PostAsJsonAsync($"/api/v1/participants/{id}/set-password",
            new { newPassword = nfc, mustChangeOnFirstLogin = false });
        set.IsSuccessStatusCode.Should().BeTrue(await set.Content.ReadAsStringAsync());

        // Kullanıcı aynı şifreyi farklı bir cihazdan (NFD üreten klavye) giriyor.
        var login = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password = nfd });

        login.IsSuccessStatusCode.Should().BeTrue(
            "görsel olarak aynı olan şifre, farklı Unicode biçiminde yazıldığı için " +
            "reddedilmemeli. Yanıt: " + await login.Content.ReadAsStringAsync());
    }

    /// <summary>
    /// Normalizasyon güvenliği zayıflatmamalı: FARKLI şifreler hâlâ reddedilmeli.
    /// </summary>
    [Fact]
    public async Task Normalization_does_not_accept_a_genuinely_wrong_password()
    {
        var (id, tckn) = await SeedActiveParticipantAsync();

        var set = await _admin.PostAsJsonAsync($"/api/v1/participants/{id}/set-password",
            new { newPassword = "Şifreüğı1", mustChangeOnFirstLogin = false });
        set.IsSuccessStatusCode.Should().BeTrue();

        var login = await _anon.PostAsJsonAsync("/api/v1/auth/citizen/login",
            new { identifier = tckn, password = "Sifreugi1" }); // aksansız: FARKLI şifre

        login.IsSuccessStatusCode.Should().BeFalse(
            "aksanları kaldırılmış hâli farklı bir şifredir ve kabul edilmemelidir");
    }
}
