using System.Text.Json;
using FluentValidation.TestHelper;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Events.Validators;
using Xunit;

namespace Nexora.UnitTests.Application;

// 2026-08-02 kullanıcı bildirimi: seanssız (tek günlük) etkinlik oluştururken bitiş
// saati başlangıç saatinden önce/eşit seçilebiliyordu (örn. başlangıç 13:00, bitiş
// 12:00), hiçbir doğrulama yoktu. Ayrıca tek günlük etkinlikte bitiş tarihi zorunlu
// olmamalı (başlangıçla aynı gündür).
public class EventFormRequestValidatorTests
{
    private readonly EventFormRequestValidator validator = new();

    private static EventAccessConfigDto ValidAccess() => new(
        HasSessions: false,
        HasSeating: false,
        ReservationType: "none",
        RegistrationMode: "none",
        AttendanceEnabled: false,
        EntryMethod: "manual",
        QrEnabled: false,
        QrType: "static",
        QrRotationSeconds: 0,
        KioskEnabled: false,
        TurnstileEnabled: false,
        PublicLinkEnabled: false,
        PublicLinkRequiresPin: false,
        StaffIds: []);

    private static EventFormRequest ValidRequest(
        bool isSingleDay = true,
        DateTime? startDate = null,
        DateTime? endDate = null,
        string? startTime = "13:00",
        string? endTime = "15:00",
        string name = "Test Etkinlik")
    {
        var start = startDate ?? DateTime.UtcNow.Date.AddDays(1);
        return new EventFormRequest(
            Name: name,
            CategoryId: Guid.NewGuid(),
            VenueType: "indoor",
            FacilityId: null,
            HallId: null,
            Location: null,
            StartDate: start,
            EndDate: endDate ?? start,
            IsSingleDay: isSingleDay,
            Gender: "mixed",
            Capacity: 10,
            ReserveCapacity: 2,
            MinAge: 0,
            MaxAge: 0,
            ParticipationPeriod: "none",
            ParticipationLimit: 0,
            Description: "",
            InternalNote: "",
            Images: JsonDocument.Parse("{}").RootElement,
            Access: ValidAccess(),
            Pricing: JsonDocument.Parse("{}").RootElement,
            Points: JsonDocument.Parse("{}").RootElement,
            IsActive: true,
            StartTime: startTime,
            EndTime: endTime);
    }

    [Fact]
    public void Tek_gunluk_etkinlikte_bitis_saati_baslangictan_once_ise_hata_verir()
    {
        var req = ValidRequest(isSingleDay: true, startTime: "13:00", endTime: "12:00");
        var result = validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.EndTime)
            .WithErrorMessage("Bitiş saati başlangıç saatinden sonra olmalıdır.");
    }

    [Fact]
    public void Tek_gunluk_etkinlikte_bitis_saati_baslangica_esit_ise_hata_verir()
    {
        var req = ValidRequest(isSingleDay: true, startTime: "13:00", endTime: "13:00");
        var result = validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.EndTime);
    }

    [Fact]
    public void Tek_gunluk_etkinlikte_bitis_saati_baslangictan_sonra_ise_gecerlidir()
    {
        var req = ValidRequest(isSingleDay: true, startTime: "13:00", endTime: "15:00");
        var result = validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.EndTime);
    }

    [Fact]
    public void Seansli_cok_gunluk_etkinlikte_saat_alanlari_bos_olsa_da_hata_vermez()
    {
        var req = ValidRequest(isSingleDay: false, startDate: DateTime.UtcNow.Date.AddDays(1),
            endDate: DateTime.UtcNow.Date.AddDays(5), startTime: null, endTime: null);
        var result = validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.EndTime);
    }

    [Fact]
    public void Cok_gunluk_etkinlikte_bitis_tarihi_bos_ise_hata_verir()
    {
        var start = DateTime.UtcNow.Date.AddDays(1);
        var req = ValidRequest(isSingleDay: false, startDate: start, endDate: start.AddDays(-1));
        var result = validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.EndDate);
    }

    // 2026-08-04 kullanıcı bildirimi: eski MySQL dump'ından (sultanga_genclik) aktarılacak
    // etkinlik/gezi/grup isimlerinde HTML entity kaçışları ham haliyle görünüyordu, örn.
    // "DR. FARUK ÖNDAĞ İLE &#39;&#39;1 İnsan 2 Mucize&#39;&#39;". Bu artık isim alanında reddedilir.
    [Theory]
    [InlineData("DR. FARUK ÖNDAĞ İLE &#39;&#39;1 İnsan 2 Mucize&#39;&#39;")]
    [InlineData("Deneme &amp; Etkinlik")]
    [InlineData("Bir &quot;Alıntı&quot; İçeren Başlık")]
    [InlineData("Köşeli <b>Etiket</b> İçeren")]
    [InlineData("Çift Tırnak \" İçeren")]
    public void Etkinlik_adinda_html_artefakti_varsa_hata_verir(string name)
    {
        var req = ValidRequest(name: name);
        var result = validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    // Parantez ve eğik çizgi gerçek veride yaygın kullanılıyor (ör. "[SENARYO] ...",
    // "10:15 Seansı | Masal Sınıfı") — bunlara izin verilmeye devam etmeli.
    [Theory]
    [InlineData("Masal Sınıfı - Kurabiye Etkinliği (10:15 Seansı)")]
    [InlineData("[SENARYO] Kadınlara Özel El Sanatları Atölye Gezisi")]
    [InlineData("29 ARALIK PAZARTESİ · Masal Sınıfı - ... Etkinliği | 10:15 Seansı")]
    public void Etkinlik_adinda_parantez_ve_egik_cizgiye_izin_verilir(string name)
    {
        var req = ValidRequest(name: name);
        var result = validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Cok_gunluk_etkinlikte_basvuru_bitisi_etkinlik_bitisine_kadar_secilebilir()
    {
        var start = DateTime.UtcNow.Date.AddDays(1);
        var req = ValidRequest(isSingleDay: false, startDate: start, endDate: start.AddDays(30))
            with { ApplicationEndDate = start.AddDays(30) };
        validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.ApplicationEndDate);
    }

    [Fact]
    public void Basvuru_bitisi_etkinlik_bitisinden_sonra_ise_hata_verir()
    {
        var start = DateTime.UtcNow.Date.AddDays(1);
        var req = ValidRequest(isSingleDay: false, startDate: start, endDate: start.AddDays(30))
            with { ApplicationEndDate = start.AddDays(31) };
        validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.ApplicationEndDate)
            .WithErrorMessage("Başvuru bitişi, etkinlik bitiş tarihinden sonra olamaz.");
    }
}
