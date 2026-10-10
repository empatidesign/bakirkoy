using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Kullanıcı isteği (2026-09-07): doğum günü olan kişilere saat 10:00'da otomatik kutlama.
// Bu testler mesaj kişiselleştirmesini ve yaş hesabını doğrular — yanlış yaş/isim binlerce
// vatandaşa yanlış SMS gitmesi demektir, bu yüzden saf mantık ayrı ayrı test edilir.
public class BirthdayGreetingServiceTests
{
    private static Participant P(string fullName, DateTime birthDate)
        => Participant.Create("11111111111", fullName, birthDate, Gender.Male, false,
            "hash", null, "5551112233", null, null, null);

    [Theory]
    [InlineData("Mehmet Yılmaz", "Mehmet", "Yılmaz")]
    [InlineData("Ayşe Nur Kaya", "Ayşe Nur", "Kaya")]   // çok adlı: son kelime soyad
    [InlineData("Cher", "Cher", "")]                      // tek kelime: ad olarak alınır
    public void SablondakiDegiskenlerKisiyeGoreDoldurulur(string fullName, string ad, string soyad)
    {
        var p = P(fullName, new DateTime(1990, 5, 10));

        var text = BirthdayGreetingService.Render(
            "Sayın {{adsoyad}} ({{ad}}|{{soyad}}) {{yas}} yaşındasınız", p, 35);

        Assert.Equal($"Sayın {fullName} ({ad}|{soyad}) 35 yaşındasınız", text);
    }

    [Fact]
    public void DegiskenYoksaSablonAynenKalir()
    {
        var p = P("Mehmet Yılmaz", new DateTime(1990, 5, 10));
        Assert.Equal("Doğum gününüz kutlu olsun", BirthdayGreetingService.Render("Doğum gününüz kutlu olsun", p, 35));
    }

    [Fact]
    public void DogumGunuGelmisseYasDogruHesaplanir()
    {
        // 10 Mayıs doğumlu, bugün 10 Mayıs → tam yaşını doldurdu
        var age = BirthdayGreetingService.CalculateAge(new DateTime(1990, 5, 10), new DateOnly(2026, 5, 10));
        Assert.Equal(36, age);
    }

    [Fact]
    public void DogumGunuGelmemisseYasBirEksiktir()
    {
        // 10 Aralık doğumlu, bugün 10 Mayıs → henüz doğum günü olmadı
        var age = BirthdayGreetingService.CalculateAge(new DateTime(1990, 12, 10), new DateOnly(2026, 5, 10));
        Assert.Equal(35, age);
    }

    [Fact]
    public void GelecekTarihliDogumTarihiNegatifYasUretmez()
    {
        var age = BirthdayGreetingService.CalculateAge(new DateTime(2030, 1, 1), new DateOnly(2026, 5, 10));
        Assert.Equal(0, age);
    }

    // --- Gönderim saati kontrolü (job saat başı tetiklenir, gönderim yalnız ayarlanan saatte) ---

    [Fact]
    public void AyarlananSaatteGonderimYapilir()
    {
        var s = new BirthdaySettingsDto { SendHour = 10, SendMinute = 0 };
        Assert.True(BirthdayGreetingService.IsSendTime(new DateTime(2026, 5, 10, 10, 0, 0), s));
        Assert.True(BirthdayGreetingService.IsSendTime(new DateTime(2026, 5, 10, 10, 45, 0), s));
    }

    [Fact]
    public void SaatGelmedenGonderimYapilmaz()
    {
        var s = new BirthdaySettingsDto { SendHour = 10, SendMinute = 0 };
        Assert.False(BirthdayGreetingService.IsSendTime(new DateTime(2026, 5, 10, 9, 59, 0), s));
        Assert.False(BirthdayGreetingService.IsSendTime(new DateTime(2026, 5, 10, 11, 0, 0), s));
    }

    [Fact]
    public void DakikaAyariDaDikkateAlinir()
    {
        var s = new BirthdaySettingsDto { SendHour = 10, SendMinute = 30 };
        Assert.False(BirthdayGreetingService.IsSendTime(new DateTime(2026, 5, 10, 10, 15, 0), s));
        Assert.True(BirthdayGreetingService.IsSendTime(new DateTime(2026, 5, 10, 10, 30, 0), s));
    }

    // --- Ekran uyarısı: "gönderilmeyi bekleyen X mesaj var" (kullanıcı isteği 2026-09-07) ---

    [Fact]
    public void GonderimSurerkenBekleyenMesajSayisiUyarida()
    {
        var w = BirthdayGreetingService.BuildWarningText(
            "running", processed: 40, total: 363, pending: 323,
            new BirthdaySettingsDto(), sentToday: false, candidates: 363);

        Assert.Contains("40/363", w);
        Assert.Contains("bekleyen 323 mesaj", w);
    }

    [Fact]
    public void IptalEdilirkenKacMesajinGitmeyecegiYazar()
    {
        var w = BirthdayGreetingService.BuildWarningText(
            "cancelling", 40, 363, 323, new BirthdaySettingsDto(), false, 363);

        Assert.Contains("durduruluyor", w);
        Assert.Contains("323 mesaj gönderilmeyecek", w);
    }

    [Fact]
    public void IptalSonrasiGonderilmeyenSayisiGosterilir()
    {
        var w = BirthdayGreetingService.BuildWarningText(
            "cancelled", 40, 363, 323, new BirthdaySettingsDto(), false, 363);

        Assert.Contains("iptal edildi", w);
        Assert.Contains("323 mesaj gönderilmedi", w);
    }

    [Fact]
    public void OtomatikGonderimKapaliykaKacKisiyeGitmeyecegiUyarilir()
    {
        var w = BirthdayGreetingService.BuildWarningText(
            "idle", 0, 0, 0, new BirthdaySettingsDto { Enabled = false }, false, 363);

        Assert.Contains("KAPALI", w);
        Assert.Contains("363 kişiye mesaj gitmeyecek", w);
    }

    [Fact]
    public void BostaykenGonderilecekKisiSayisiVeSaatiGosterilir()
    {
        var w = BirthdayGreetingService.BuildWarningText(
            "idle", 0, 0, 0, new BirthdaySettingsDto { SendHour = 10, SendMinute = 0 }, false, 363);

        Assert.Contains("363 kişiye", w);
        Assert.Contains("10:00", w);
    }

    [Fact]
    public void BugunGonderildiyseUyariGosterilmez()
        => Assert.Null(BirthdayGreetingService.BuildWarningText(
            "idle", 0, 0, 0, new BirthdaySettingsDto(), sentToday: true, candidates: 363));

    [Fact]
    public void BugunDogumGunuYoksaUyariGosterilmez()
        => Assert.Null(BirthdayGreetingService.BuildWarningText(
            "idle", 0, 0, 0, new BirthdaySettingsDto(), sentToday: false, candidates: 0));

    [Theory]
    [InlineData("5551112233", "******2233")]
    [InlineData("123", "123")]          // çok kısa: maskelenmez
    [InlineData(null, null)]
    public void TelefonOnizlemedeMaskelenir(string? phone, string? expected)
        => Assert.Equal(expected, BirthdayGreetingService.MaskPhone(phone));
}
