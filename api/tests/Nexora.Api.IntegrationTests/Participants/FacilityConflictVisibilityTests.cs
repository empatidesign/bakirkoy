using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Facilities;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Participants;

/// <summary>
/// docs/hata.md #5 / #7 / #8 (Spor Tesisleri, Gençlik Kampı, İzcilik Kampı) KABUL testi.
///
/// Rapordaki şikayet: sistem "... günü başvuru yapıldığı için başvuru yapılamıyor" diyor,
/// ama engellediğini söylediği kayıt "Başvurularım" ekranında GÖRÜNMÜYOR. Kullanıcı ne
/// başvurabiliyor ne de engeli kaldırabiliyor — kilitleniyor.
///
/// Bu test tam da o kilidi gerçek uçlarla kurar:
///   1) gerçek admin uçlarıyla iki farklı modülde (spor + gençlik kampı) aynı gün/saatte
///      çakışan iki program oluşturur,
///   2) vatandaş gerçek başvuru ucuyla birincisine başvurur,
///   3) ikincisine başvurmayı dener ve 409 ile engellenir,
///   4) ENGELLEYEN kaydın GET /me/facilities/applications çıktısında gerçekten göründüğünü
///      doğrular — raporun asıl şikayeti buydu,
///   5) kaydı iptal edip ikinci programa artık başvurulabildiğini gösterir (kilit açılıyor).
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class FacilityConflictVisibilityTests : IAsyncLifetime
{
    private readonly NexoraApiFactory _factory;
    private HttpClient _admin = null!;
    private HttpClient _citizen = null!;
    private CitizenTestIdentity _identity = null!;

    private FacilityScenario.Base _sports = null!;
    private FacilityScenario.Base _camp = null!;

    // Rapordaki modüller: spor (#5), gençlik kampı (#7), izcilik kampı (#8). Anahtarlar
    // FacilityModuleRegistry.Prefix ile birebir aynı olmak zorunda.
    private const string SportsModule = "sports";
    private const string YouthCampModule = "youth-camp";

    public FacilityConflictVisibilityTests(ApiTestHost host) => _factory = host.Factory;

    public async Task InitializeAsync()
    {
        _admin = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), $"fcv-{Guid.NewGuid():N}@nexora.local"));

        _identity = CitizenTestIdentity.Adult(
            Random.Shared.Next(1, int.MaxValue),
            address: "Cumhuriyet Mah. Test Cad. No:5 Sultangazi/İstanbul");
        _citizen = await _factory.CreateCitizenClientAsync(_identity);

        var tag = Guid.NewGuid().ToString("N")[..6];
        _sports = await FacilityScenario.CreateBaseAsync(_admin, SportsModule, tag);
        _camp = await FacilityScenario.CreateBaseAsync(_admin, YouthCampModule, $"{tag}b");
    }

    public async Task DisposeAsync()
    {
        await FacilityScenario.CleanupAsync(_admin, _sports);
        await FacilityScenario.CleanupAsync(_admin, _camp);
    }

    /// <summary>Aynı gün/saatte çakışan, aynı dönemde açık bir program.</summary>
    private static FacilityScenario.GroupOptions OverlappingOptions() => new()
    {
        AutoApprove = true,
        PeriodStart = DateTime.UtcNow.Date.AddDays(1),
        PeriodEnd = DateTime.UtcNow.Date.AddDays(60),
        ApplicationStartDate = DateTime.UtcNow.Date,
        ApplicationEndDate = DateTime.UtcNow.Date.AddDays(30),
        Schedule = [new FacilityScenario.ScheduleSlot("monday", "09:00", "10:00")],
    };

    private async Task<HttpResponseMessage> ApplyAsync(string module, Guid groupId)
        => await _citizen.PostAsJsonAsync(
            $"/api/v1/me/facilities/{module}/groups/{groupId}/apply",
            new { participantId = (Guid?)null, documents = Array.Empty<object>() });

    private async Task<List<JsonElement>> MyApplicationsAsync()
    {
        var response = await _citizen.GetAsync("/api/v1/me/facilities/applications?scope=family&page=1&limit=50");
        response.StatusCode.Should().Be(HttpStatusCode.OK, because: await response.Content.ReadAsStringAsync());
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload.GetProperty("data").GetProperty("items").EnumerateArray().ToList();
    }

    [Fact]
    public async Task Cakisma_engeli_veren_kayit_basvurularim_ekraninda_gorunur()
    {
        var sportsGroup = await FacilityScenario.CreateGroupAsync(_admin, _sports, "conf-a", OverlappingOptions());
        var campGroup = await FacilityScenario.CreateGroupAsync(_admin, _camp, "conf-b", OverlappingOptions());

        // 1) İlk başvuru kabul edilir.
        var first = await ApplyAsync(SportsModule, sportsGroup);
        first.StatusCode.Should().Be(HttpStatusCode.Created, because: await first.Content.ReadAsStringAsync());

        // 2) Aynı gün/saatteki ikinci programa başvuru engellenir.
        var second = await ApplyAsync(YouthCampModule, campGroup);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var error = await second.Content.ReadFromJsonAsync<JsonElement>();
        error.GetProperty("errorCode").GetString().Should().Be("SCHEDULE_CONFLICT");

        var message = error.GetProperty("message").GetString() ?? "";
        // Raporda mesajın hangi kaydı kastettiği anlaşılmıyordu; artık hizmet türünü ve
        // kaydın nerede görüneceğini söylemeli.
        message.Should().Contain("Pazartesi");
        message.Should().Contain("Spor");
        message.Should().Contain("Başvurularım");

        // 3) ASIL DOĞRULAMA: engelleyen kayıt gerçekten Başvurularım listesinde görünüyor mu?
        var applications = await MyApplicationsAsync();
        applications.Should().Contain(
            x => x.GetProperty("groupId").GetGuid() == sportsGroup,
            because: "engelleyen kayıt kullanıcıya görünmezse kullanıcı kilitlenir (docs/hata.md #5/#7/#8)");
    }

    [Fact]
    public async Task Engelleyen_kayit_iptal_edilince_yeniden_basvurulabilir()
    {
        var sportsGroup = await FacilityScenario.CreateGroupAsync(_admin, _sports, "cancel-a", OverlappingOptions());
        var campGroup = await FacilityScenario.CreateGroupAsync(_admin, _camp, "cancel-b", OverlappingOptions());

        var first = await ApplyAsync(SportsModule, sportsGroup);
        first.StatusCode.Should().Be(HttpStatusCode.Created, because: await first.Content.ReadAsStringAsync());

        (await ApplyAsync(YouthCampModule, campGroup)).StatusCode.Should().Be(HttpStatusCode.Conflict);

        // Kullanıcı listede gördüğü kaydı iptal eder (rapordaki "çıkış yolu").
        var blocking = (await MyApplicationsAsync())
            .Single(x => x.GetProperty("groupId").GetGuid() == sportsGroup);
        var blockingId = blocking.GetProperty("id").GetGuid();

        var cancel = await _citizen.DeleteAsync($"/api/v1/me/facilities/applications/{blockingId}");
        cancel.StatusCode.Should().Be(HttpStatusCode.OK, because: await cancel.Content.ReadAsStringAsync());

        // Engel kalkmalı: iptal edilmiş bir kayıt artık ne engeller ne de listede görünür.
        var retry = await ApplyAsync(YouthCampModule, campGroup);
        retry.StatusCode.Should().Be(HttpStatusCode.Created, because: await retry.Content.ReadAsStringAsync());

        var after = await MyApplicationsAsync();
        after.Should().NotContain(x => x.GetProperty("id").GetGuid() == blockingId,
            because: "iptal edilen kayıt listede kalmamalı");
        after.Should().Contain(x => x.GetProperty("groupId").GetGuid() == campGroup);
    }

    [Fact]
    public async Task Ayni_gruba_mukerrer_basvuru_engellenir_ve_kayit_listede_durur()
    {
        var group = await FacilityScenario.CreateGroupAsync(_admin, _sports, "dup", OverlappingOptions());

        (await ApplyAsync(SportsModule, group)).StatusCode.Should().Be(HttpStatusCode.Created);

        var duplicate = await ApplyAsync(SportsModule, group);
        duplicate.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await duplicate.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("errorCode").GetString().Should().Be("ALREADY_APPLIED");

        // ALREADY_APPLIED diyen kayıt da listede görünmek zorunda — aynı tutarlılık kuralı.
        (await MyApplicationsAsync()).Should().Contain(x => x.GetProperty("groupId").GetGuid() == group);
    }

    /// <summary>
    /// Raporun asıl kök nedeninin doğrudan kanıtı: kayıt vatandaş adına TCKN ile açılmışsa
    /// (ParticipantId boş — admin panelden ya da eski aktarımdan gelen kayıtlar böyle),
    /// engelleme kontrolü kişiyi TANIYOR ama Başvurularım listesi TANIMIYORDU. Kullanıcı
    /// "başvurum yok ama sistem engelliyor" durumunda kilitleniyordu.
    ///
    /// Düzeltmeden ÖNCE bu test kırmızıydı: engel (409) geliyor, liste boş dönüyordu.
    /// </summary>
    [Fact]
    public async Task Tckn_ile_acilmis_kayit_hem_engeller_hem_listede_gorunur()
    {
        var sportsGroup = await FacilityScenario.CreateGroupAsync(_admin, _sports, "tckn-a", OverlappingOptions());
        var campGroup = await FacilityScenario.CreateGroupAsync(_admin, _camp, "tckn-b", OverlappingOptions());

        // Admin, vatandaş adına YALNIZCA TCKN ile başvuru açar (gerçek admin ucu).
        var adminApply = await _admin.PostAsJsonAsync($"/api/v1/{SportsModule}/applications", new
        {
            facilityId = _sports.FacilityId,
            branchId = _sports.BranchId,
            groupId = sportsGroup,
            fullName = _identity.FullName,
            tckn = _identity.Tckn,
            phone = "05320000000",
            email = (string?)null,
            birthDate = _identity.BirthDate,
            guardianPhone = (string?)null,
            documents = Array.Empty<object>(),
        });
        adminApply.StatusCode.Should().Be(HttpStatusCode.Created,
            because: await adminApply.Content.ReadAsStringAsync());

        // Bu kayıt vatandaşın yeni başvurusunu engelliyor mu?
        var blocked = await ApplyAsync(YouthCampModule, campGroup);
        blocked.StatusCode.Should().Be(HttpStatusCode.Conflict,
            because: "TCKN ile açılmış aktif kayıt aynı saatteki yeni başvuruyu engellemeli");

        // ASIL NOKTA: engelleyen bu kayıt vatandaşın kendi listesinde de görünmeli.
        var applications = await MyApplicationsAsync();
        applications.Should().Contain(
            x => x.GetProperty("groupId").GetGuid() == sportsGroup,
            because: "engelleme TCKN ile çalışırken liste yalnızca ParticipantId'ye bakarsa "
                   + "kullanıcı engeli görüp kaldıramaz (docs/hata.md #5/#7/#8 kök nedeni)");
    }

    [Fact]
    public async Task Cakismayan_saatteki_programa_basvuru_engellenmez()
    {
        var morning = await FacilityScenario.CreateGroupAsync(_admin, _sports, "am", OverlappingOptions());
        var evening = await FacilityScenario.CreateGroupAsync(_admin, _camp, "pm", OverlappingOptions() with
        {
            Schedule = [new FacilityScenario.ScheduleSlot("monday", "20:00", "21:00")],
        });

        (await ApplyAsync(SportsModule, morning)).StatusCode.Should().Be(HttpStatusCode.Created);

        // Kural fiziksel bir kısıt: aynı gün ama farklı saat çakışma değildir.
        var second = await ApplyAsync(YouthCampModule, evening);
        second.StatusCode.Should().Be(HttpStatusCode.Created, because: await second.Content.ReadAsStringAsync());

        var applications = await MyApplicationsAsync();
        applications.Should().Contain(x => x.GetProperty("groupId").GetGuid() == morning);
        applications.Should().Contain(x => x.GetProperty("groupId").GetGuid() == evening);
    }
}
