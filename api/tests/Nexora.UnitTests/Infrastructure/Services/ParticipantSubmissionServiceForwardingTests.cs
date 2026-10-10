using Microsoft.Extensions.Configuration;
using Moq;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.ParticipantSubmissions.Dtos;
using Nexora.Domain.Entities.CitizenSubmissions;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

/// <summary>
/// GÜNCELLEME (2026-09-01, denetim): 31 Ağustos'taki "otomatik denetim" güncellemesi bu dosyayı
/// derlenir hale getirmek için ISubmissionContentAnalyzer'ı testten TAMAMEN çıkarmıştı — ama bu,
/// 762feb4'ün (yenigelistirmeler) YANLIŞLIKLA sildiği `analyzer.Analyze()`/`ApplyAnalysis()`
/// çağrısının BİR DAHA HİÇ geri gelmeyeceği anlamına geliyordu. Canlı DB'de kanıtlandı: bu satır
/// silindiğinden beri (310/310 kayıt) `ContainsPersonReference` HER ZAMAN false — muhtar
/// panelindeki "kişi adı geçen başvurunun başlığı/açıklaması gizlenir" kuralı (bkz.
/// MuhtarDashboardService.ToAnonymousItem, contentVisible = !ContainsPersonReference) fiilen
/// hiç çalışmıyordu. `ParticipantSubmissionService.CreateAsync`'e analyzer GERİ EKLENDİ (yalnız
/// analiz — otomatik Ulakbel iletimi kasıtlı kaldırılmış davranış olarak KALDI, geri eklenmedi).
/// Bu dosya artık hem "iletim otomatik değil" hem "analiz çalışıyor" davranışlarının ikisini de kilitler.
/// </summary>
public class ParticipantSubmissionServiceForwardingTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICitizenSubmissionRepository> _submissions = new();
    private readonly Mock<ICitizenSubmissionEventRepository> _events = new();
    private readonly Mock<IParticipantRepository> _participants = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IFileStorageService> _storage = new();
    private readonly Mock<IMuhtarNotifier> _muhtarNotifier = new();
    private readonly Mock<ISubmissionContentAnalyzer> _analyzer = new();
    private readonly ParticipantSubmissionService _service;
    private readonly Participant _participant;
    private readonly Guid _participantId = Guid.NewGuid();

    public ParticipantSubmissionServiceForwardingTests()
    {
        var participant = Participant.Create(
            "12345678901", "Test Vatandaş", new DateTime(1990, 1, 1), Gender.Male,
            isMinor: false, passwordHash: "hash", email: null, phone: "5550000000",
            guardianPhone: null, guardianEmail: null, address: "Test Adres");
        _participant = participant;
        participant.ApplyStructuredAddress("Habibler Mahallesi Sultangazi/İstanbul", "İstanbul", "Sultangazi", "Habibler Mahallesi", null);
        typeof(Nexora.Domain.Common.BaseEntity).GetProperty("Id")!.SetValue(participant, _participantId);

        _uow.SetupGet(x => x.CitizenSubmissions).Returns(_submissions.Object);
        _uow.SetupGet(x => x.CitizenSubmissionEvents).Returns(_events.Object);
        _uow.SetupGet(x => x.Participants).Returns(_participants.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _participants.Setup(x => x.GetByIdAsync(_participantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _currentUser.SetupGet(x => x.Id).Returns(_participantId);

        // Duplicate-kontrolü boş liste bekliyor.
        _submissions.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<CitizenSubmission, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        _events.Setup(x => x.GetBySubmissionAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        // Gerçek analyzer davranışını taklit eder: metinde kişi referansı varsa true döner.
        _analyzer.Setup(x => x.Analyze(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string>()))
            .Returns((string title, string desc, string? fallback, string type) =>
            {
                var containsPerson = (title + " " + desc).Contains("Mehmet Kaya", StringComparison.Ordinal);
                return new SubmissionAnalysisResult(
                    fallback ?? "other", "Genel Yazı İşleri Müdürlüğü", 0.5, [], containsPerson, "test-analiz");
            });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["MuhtarlikSettings:DuplicateWindowMinutes"] = "10" })
            .Build();

        _service = new ParticipantSubmissionService(
            _uow.Object, _currentUser.Object, _storage.Object, _muhtarNotifier.Object, _analyzer.Object, config);
    }

    [Fact]
    public async Task CreateAsync_KisiyeYonelikSikayetOlsaBileKaydedilirVeUlakbeleOtomatikIletilmez()
    {
        var req = new CreateCitizenSubmissionMeRequest(
            Title: "Komşum çöpleri kaldırıma atıyor",
            Description: "Alt kattaki komşum Mehmet Kaya her gün çöplerini kaldırıma bırakıyor.",
            CategoryId: "other",
            SubmissionType: "complaint",
            Priority: "normal",
            Neighborhood: "Habibler Mahallesi",
            Address: "Habibler Mah. 5. Sk.",
            Latitude: null,
            Longitude: null,
            NotifyMuhtar: true,
            ComplaintReason: "health_hygiene",
            MediaUrls: null,
            AddressType: "residence",
            Scope: "neighborhood");

        var result = await _service.CreateAsync(req, CancellationToken.None);

        // Mevcut davranış: iletim artık otomatik değil, admin/muhtar CitizenSubmissionService.
        // ForwardAsync ile manuel tetikliyor. Kayıt "new" olarak kalır.
        Assert.Equal("new", result.Status);
        Assert.NotNull(result.TrackingNo);
        Assert.Null(result.UlakbelTrackingNo);
    }

    [Fact]
    public async Task CreateAsync_KisiReferansiOlmayanTalepDeAyniSekildeKaydedilir()
    {
        var req = new CreateCitizenSubmissionMeRequest(
            Title: "Sokak lambası yanmıyor",
            Description: "Üç gündür sokak lambaları yanmıyor.",
            CategoryId: "lighting",
            SubmissionType: "complaint",
            Priority: "high",
            Neighborhood: "Cebeci Mahallesi",
            Address: "Cebeci Mah. 12. Sk.",
            Latitude: null,
            Longitude: null,
            NotifyMuhtar: true,
            ComplaintReason: "public_safety",
            MediaUrls: null,
            AddressType: "other",
            Scope: "neighborhood");

        var result = await _service.CreateAsync(req, CancellationToken.None);

        Assert.Equal("new", result.Status);
        Assert.NotNull(result.TrackingNo);
    }

    [Fact]
    public async Task CreateAsync_TekrarliBasvuruEngellenir()
    {
        var existing = CitizenSubmission.Create(
            "Test Vatandaş", "5550000000", "12345678901", "Gazi Mahallesi", "Gazi Mah. Park",
            "park_garden", "request", "normal", "Park bakımsız", "Çocuk parkı bakımsız durumda.");
        _submissions.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<CitizenSubmission, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([existing]);

        var req = new CreateCitizenSubmissionMeRequest(
            "Park bakımsız", "Çocuk parkı bakımsız durumda.", "park_garden", "request", "normal",
            "Gazi Mahallesi", "Gazi Mah. Park", null, null, false, null, null, "residence", "neighborhood");

        await Assert.ThrowsAsync<Nexora.Application.Common.Exceptions.ConflictException>(
            () => _service.CreateAsync(req, CancellationToken.None));
    }

    /// <summary>
    /// Denetim düzeltmesi (2026-09-01, YÜKSEK-KVKK) regresyon testi: içerik analizinin
    /// gerçekten çağrıldığını ve sonucunun kaydedilen entity'ye (ApplyAnalysis üzerinden)
    /// yansıdığını doğrudan kanıtlar — bu, muhtar panelinin kişi-adı-gizleme kuralının çalışıp
    /// çalışmadığını belirleyen TEK kaynaktır.
    /// </summary>
    [Fact]
    public async Task CreateAsync_IcerikAnaliziCagrilirVeSonucKaydaYansir()
    {
        CitizenSubmission? added = null;
        _submissions.Setup(x => x.AddAsync(It.IsAny<CitizenSubmission>(), It.IsAny<CancellationToken>()))
            .Callback<CitizenSubmission, CancellationToken>((s, _) => added = s)
            .Returns(Task.CompletedTask);

        var req = new CreateCitizenSubmissionMeRequest(
            Title: "Komşum gürültü yapıyor",
            Description: "Üst kattaki komşum Mehmet Kaya gece geç saatte gürültü yapıyor.",
            CategoryId: "noise",
            SubmissionType: "complaint",
            Priority: "normal",
            Neighborhood: "Habibler Mahallesi",
            Address: "Habibler Mah. 5. Sk.",
            Latitude: null,
            Longitude: null,
            NotifyMuhtar: false,
            ComplaintReason: "noise",
            MediaUrls: null,
            AddressType: "residence",
            Scope: "neighborhood");

        await _service.CreateAsync(req, CancellationToken.None);

        _analyzer.Verify(x => x.Analyze(req.Title, req.Description, req.CategoryId, req.SubmissionType), Times.Once);
        Assert.NotNull(added);
        Assert.True(added!.ContainsPersonReference, "Metinde 'Mehmet Kaya' geçtiği için ContainsPersonReference true olmalı.");
        Assert.Equal("Genel Yazı İşleri Müdürlüğü", added.RoutedUnit);
    }
    private static CreateCitizenSubmissionMeRequest ResidenceRequest() => new(
        "Sokak aydınlatması kontrolü", "Sokağımızdaki aydınlatmanın kontrol edilmesini istiyorum.",
        "lighting", "request", "normal", "Cebeci Mahallesi", "İstemcinin gönderdiği farklı adres",
        null, null, false, null, null, "residence", "neighborhood");

    [Fact]
    public async Task Residence_uses_registered_address_instead_of_client_neighborhood()
    {
        var result = await _service.CreateAsync(ResidenceRequest(), CancellationToken.None);
        Assert.Equal("Habibler Mahallesi", result.Neighborhood);
        Assert.Equal(_participant.Address, result.Address);
        Assert.Equal("new", result.Status);
        Assert.Null(result.UlakbelTrackingNo);
    }

    [Fact]
    public async Task Other_district_neighborhood_does_not_match_local_muhtar_scope()
    {
        _participant.ApplyStructuredAddress("Cumhuriyet Mahallesi Beylikdüzü/İstanbul", "İstanbul",
            "Beylikdüzü", "Cumhuriyet Mahallesi", null);
        var options = await _service.GetFormOptionsAsync(CancellationToken.None);
        var result = await _service.CreateAsync(ResidenceRequest(), CancellationToken.None);
        Assert.Equal("Beylikdüzü", options.ResidenceDistrict);
        Assert.Equal("Beylikdüzü / Cumhuriyet Mahallesi", result.Neighborhood);
        Assert.Equal(result.Neighborhood, options.ResidenceNeighborhood);
        Assert.DoesNotContain(result.Neighborhood, MuhtarlikReference.Neighborhoods);
        Assert.Null(result.UlakbelTrackingNo);
    }

    [Fact]
    public async Task Missing_registered_address_does_not_silently_use_client_address()
    {
        _participant.ApplyStructuredAddress(null, null, null, null, null);
        await Assert.ThrowsAsync<Nexora.Application.Common.Exceptions.ConflictException>(
            () => _service.CreateAsync(ResidenceRequest(), CancellationToken.None));
        _submissions.Verify(x => x.AddAsync(It.IsAny<CitizenSubmission>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public void Residence_validator_accepts_server_resolved_address_but_other_address_still_requires_valid_neighborhood()
    {
        var validator = new Nexora.Application.Features.ParticipantSubmissions.Validators.CreateCitizenSubmissionMeRequestValidator();
        var req = ResidenceRequest() with { Neighborhood = "", Address = "" };
        Assert.True(validator.Validate(req).IsValid);
        Assert.False(validator.Validate(req with { AddressType = "other" }).IsValid);
    }

}
