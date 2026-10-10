using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Companies;

// IDN-İşletme (2026-09-11): mobil businessService.ts'in çağırdığı 8 endpoint'i
// (hizmet CRUD 6 + katılımcı arama/doğrulama 2) gerçek hosted API + gerçek
// PostgreSQL'e karşı doğrular. Öncesinde /api/v1/business/me/* grubu hiç
// yoktu (404) — BusinessServiceFormScreen ve BusinessValidateScreen tamamen
// işlevsizdi.
[Collection(ApiCollection.Name)]
public sealed class BusinessOfferingsAndValidationTests : IAsyncLifetime
{
    private NexoraApiFactory _factory = null!;

    // NOT: CompanyMeService constructor'ı (ICompanyStaffAuthService üzerinden, OtpService'e
    // kadar) IRedisService'e bağımlıdır. Infrastructure bu servisi yalnızca
    // ConnectionStrings:Redis doluyken register eder; ApiTestHost.Factory'nin varsayılan
    // (Redis'siz) host'unda /api/v1/business/me/* dahil hiçbir CompanyMeService endpoint'i
    // DI hatası (500) vermeden çalışmaz — bu benim eklediğim koddan kaynaklanmıyor, mevcut
    // RedeemManualAsync/CreateCampaignAsync gibi uçlar için de aynı kısıt geçerli
    // (NexoraApiFactory.cs L138-146'daki Task 6 yorumunda zaten belgelenmiş, CompanyMatrixTests
    // aynı deseni kullanıyor). Bu yüzden CreateForCollectionWithRedis() kullanılır.
    public BusinessOfferingsAndValidationTests(ApiTestHost host)
    {
    }

    public async Task InitializeAsync()
    {
        _factory = NexoraApiFactory.CreateForCollectionWithRedis();
        await _factory.InitializeAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private sealed record Envelope(bool Success, JsonElement Data, string? ErrorCode);

    private static async Task<Envelope> ReadAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        var doc = JsonSerializer.Deserialize<JsonElement>(body, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return new Envelope(
            doc.GetProperty("success").GetBoolean(),
            doc.TryGetProperty("data", out var d) ? d : default,
            doc.TryGetProperty("errorCode", out var e) ? e.GetString() : null);
    }

    [Fact]
    public async Task CreateOffering_ThenGetAndList_ReflectsSubmittedValues()
    {
        var (companyId, client) = await _factory.CreateCompanyClientAsync($"T-OFF-{Guid.NewGuid():N}"[..20]);

        var create = await client.PostAsJsonAsync("/api/v1/business/me/services", new
        {
            name = "Saç Kesimi",
            description = "Klasik saç kesimi",
            category = "Kuaför",
            minPrice = 100,
            maxPrice = 250,
            minDurationMinutes = 30,
            maxDurationMinutes = 60,
            imageUrl = (string?)null,
            isPopular = true,
        });
        create.StatusCode.Should().Be(HttpStatusCode.OK);
        var createdEnv = await ReadAsync(create);
        var offeringId = createdEnv.Data.GetProperty("id").GetGuid();
        createdEnv.Data.GetProperty("companyId").GetGuid().Should().Be(companyId);
        createdEnv.Data.GetProperty("name").GetString().Should().Be("Saç Kesimi");
        createdEnv.Data.GetProperty("isActive").GetBoolean().Should().BeTrue("yeni oluşturulan hizmet varsayılan olarak aktif olmalı");

        var get = await client.GetAsync($"/api/v1/business/me/services/{offeringId}");
        get.StatusCode.Should().Be(HttpStatusCode.OK);

        var list = await client.GetAsync("/api/v1/business/me/services");
        list.StatusCode.Should().Be(HttpStatusCode.OK);
        var listEnv = await ReadAsync(list);
        listEnv.Data.GetArrayLength().Should().Be(1);

        var stats = await ReadAsync(await client.GetAsync("/api/v1/business/me/services/stats"));
        stats.Data.GetProperty("total").GetInt32().Should().Be(1);
        stats.Data.GetProperty("popular").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task UpdateOffering_PersistsChanges()
    {
        var (_, client) = await _factory.CreateCompanyClientAsync($"T-OFFU-{Guid.NewGuid():N}"[..20]);

        var create = await client.PostAsJsonAsync("/api/v1/business/me/services", new
        {
            name = "Sakal Tıraşı", category = "Kuaför", minPrice = 50m, maxPrice = 80m,
            minDurationMinutes = 15, maxDurationMinutes = 20, isPopular = false,
        });
        var offeringId = (await ReadAsync(create)).Data.GetProperty("id").GetGuid();

        var update = await client.PutAsJsonAsync($"/api/v1/business/me/services/{offeringId}", new
        {
            name = "Sakal Tıraşı (Güncel)", category = "Kuaför", minPrice = 60m, maxPrice = 90m,
            minDurationMinutes = 15, maxDurationMinutes = 25, isPopular = true, isActive = false,
        });
        update.StatusCode.Should().Be(HttpStatusCode.OK);
        var env = await ReadAsync(update);
        env.Data.GetProperty("name").GetString().Should().Be("Sakal Tıraşı (Güncel)");
        env.Data.GetProperty("isActive").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task DeleteOffering_RemovesFromList()
    {
        var (_, client) = await _factory.CreateCompanyClientAsync($"T-OFFD-{Guid.NewGuid():N}"[..20]);

        var create = await client.PostAsJsonAsync("/api/v1/business/me/services", new
        {
            name = "Silinecek Hizmet", category = "Diğer", minPrice = 10m, maxPrice = 20m,
            minDurationMinutes = 5, maxDurationMinutes = 10, isPopular = false,
        });
        var offeringId = (await ReadAsync(create)).Data.GetProperty("id").GetGuid();

        var delete = await client.DeleteAsync($"/api/v1/business/me/services/{offeringId}");
        delete.StatusCode.Should().Be(HttpStatusCode.OK);

        var getAfterDelete = await client.GetAsync($"/api/v1/business/me/services/{offeringId}");
        getAfterDelete.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetOffering_ForAnotherCompany_Returns403()
    {
        var (_, ownerClient) = await _factory.CreateCompanyClientAsync($"T-OFFO-{Guid.NewGuid():N}"[..20]);
        var create = await ownerClient.PostAsJsonAsync("/api/v1/business/me/services", new
        {
            name = "Gizli Hizmet", category = "Diğer", minPrice = 1m, maxPrice = 2m,
            minDurationMinutes = 1, maxDurationMinutes = 2, isPopular = false,
        });
        var offeringId = (await ReadAsync(create)).Data.GetProperty("id").GetGuid();

        var (_, otherClient) = await _factory.CreateCompanyClientAsync($"T-OFFX-{Guid.NewGuid():N}"[..20]);
        var res = await otherClient.GetAsync($"/api/v1/business/me/services/{offeringId}");
        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SearchParticipant_ThenValidate_CreatesRedemption()
    {
        var tag = $"T-VAL-{Guid.NewGuid():N}"[..20];
        var (companyId, ownerClient) = await _factory.CreateCompanyClientAsync(tag);

        // Admin ile gerçek bir kampanya oluştur (CompanyScenario zaten bu akışı sağlıyor).
        var admin = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"{tag}@nexora.local"));
        var campaignId = await CompanyScenario.CreateCampaignAsync(admin, new CompanyScenario.CreateCampaignOptions
        {
            CompanyId = companyId,
            Tag = tag,
        });

        // Gerçek bir vatandaş (Participant) oluştur — RedeemManualAsync bunu TCKN/telefonla arar.
        var (citizenClient, participantId, _) = await CreateCitizenAsync();
        _ = citizenClient; // yalnızca DB'de Participant satırı oluşturmak için kullanıldı

        var tckn = await GetParticipantTcknAsync(participantId);

        var search = await ownerClient.PostAsJsonAsync(
            $"/api/v1/business/me/campaigns/{campaignId}/search", new { tckn });
        search.StatusCode.Should().Be(HttpStatusCode.OK);
        var searchEnv = await ReadAsync(search);
        var participationId = searchEnv.Data.GetProperty("participationId").GetGuid();
        searchEnv.Data.GetProperty("participantName").GetString().Should().NotBeNullOrEmpty();

        var validate = await ownerClient.PostAsync(
            $"/api/v1/business/me/campaigns/{campaignId}/validate/{participationId}?method=0", null);
        validate.StatusCode.Should().Be(HttpStatusCode.OK);
        var validateEnv = await ReadAsync(validate);
        validateEnv.Data.GetProperty("campaignId").GetGuid().Should().Be(campaignId);
    }

    [Fact]
    public async Task SearchParticipant_UnknownIdentifier_Returns404()
    {
        var tag = $"T-VALN-{Guid.NewGuid():N}"[..20];
        var (companyId, ownerClient) = await _factory.CreateCompanyClientAsync(tag);
        var admin = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"{tag}@nexora.local"));
        var campaignId = await CompanyScenario.CreateCampaignAsync(admin, new CompanyScenario.CreateCampaignOptions
        {
            CompanyId = companyId,
            Tag = tag,
        });

        var search = await ownerClient.PostAsJsonAsync(
            $"/api/v1/business/me/campaigns/{campaignId}/search", new { tckn = "99999999999" });
        search.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var env = await ReadAsync(search);
        env.ErrorCode.Should().Be("PARTICIPATION_NOT_FOUND");
    }

    // Facilities/MeAccessibleEndpointsTests.cs'teki CitizenTestIdentity ile aynı yaklaşım:
    // gerçek bir Participant satırı doğrudan EF ile oluşturulur.
    private async Task<(HttpClient Client, Guid ParticipantId, string Tckn)> CreateCitizenAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<Nexora.Infrastructure.Persistence.AppDbContext>();
        var tckn = CitizenTestIdentity.GenerateValidTckn(Random.Shared.Next());
        var participant = Nexora.Domain.Entities.Participants.Participant.Create(
            tckn, $"Test Katılımcı {Guid.NewGuid():N}"[..20], new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            Nexora.Domain.Enums.Gender.Female, isMinor: false, passwordHash: "x", email: null, phone: "5551112233",
            guardianPhone: null, guardianEmail: null, address: null);
        await db.Participants.AddAsync(participant);
        await db.SaveChangesAsync();
        return (_factory.CreateClient(), participant.Id, tckn);
    }

    private async Task<string> GetParticipantTcknAsync(Guid participantId)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<Nexora.Infrastructure.Persistence.AppDbContext>();
        var participant = await db.Participants.FindAsync(participantId);
        return participant!.Tckn;
    }
}
