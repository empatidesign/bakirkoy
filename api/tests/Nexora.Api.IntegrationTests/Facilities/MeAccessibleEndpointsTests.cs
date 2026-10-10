using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Persistence;
using Xunit;

namespace Nexora.Api.IntegrationTests.Facilities;

// IDN-Engelsiz (2026-09-11): mobil AccessibleApplicationDetailScreen'in
// çağırdığı 5 yeni endpoint'i (POST/GET /api/v1/me/accessible/...) gerçek
// hosted API + gerçek PostgreSQL'e karşı uçtan uca doğrular. Bu endpoint'ler
// öncesinde hiç yoktu (404); bu test hem var olduklarını hem de temel iş
// mantığının (sahiplik kontrolü, KVKK tek-seferlik rıza, özet hesaplama)
// doğru çalıştığını kanıtlar.
[Collection(ApiCollection.Name)]
public sealed class MeAccessibleEndpointsTests : IAsyncLifetime
{
    private readonly NexoraApiFactory _factory;

    public MeAccessibleEndpointsTests(ApiTestHost host) => _factory = host.Factory;

    public Task InitializeAsync() => Task.CompletedTask;
    public Task DisposeAsync() => Task.CompletedTask;

    private const string JwtSecret = "nexora-integration-test-secret-key-min-32-chars-long!!";
    private const string JwtIssuer = "nexora";
    private const string JwtAudience = "nexora-client";

    private static string MintCitizenToken(Guid participantId, string fullName)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, participantId.ToString()),
            new Claim(ClaimTypes.Name, fullName),
            new Claim("user_type", "citizen"),
            new Claim("sessionId", Guid.NewGuid().ToString()),
            new Claim("must_change_password", "false"),
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: JwtIssuer, audience: JwtAudience, claims: claims,
            notBefore: now, expires: now.AddMinutes(30), signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<(HttpClient Client, Guid ParticipantId, Guid ApplicationId)> CreateOwnedApplicationAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var tckn = CitizenTestIdentity.GenerateValidTckn(Random.Shared.Next());
        var participant = Participant.Create(
            tckn, $"Test Engelsiz {Guid.NewGuid():N}"[..24], new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            Gender.Male, isMinor: false, passwordHash: "x", email: null, phone: "5000000000",
            guardianPhone: null, guardianEmail: null, address: null);
        await db.Participants.AddAsync(participant);

        var app = FacilityApplication.Create(new FacilityApplicationData(
            Module: "accessible-life",
            FacilityId: Guid.NewGuid(),
            BranchId: Guid.NewGuid(),
            GroupId: null,
            ParticipantId: participant.Id,
            FullName: participant.FullName,
            Tckn: tckn,
            Phone: "5000000000",
            Email: null,
            BirthDate: participant.BirthDate,
            GuardianPhone: null,
            DocumentsJson: "[]"));
        await db.FacilityApplications.AddAsync(app);
        await db.SaveChangesAsync();

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", MintCitizenToken(participant.Id, participant.FullName));
        return (client, participant.Id, app.Id);
    }

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
    public async Task GetSummary_ForOwnApplication_ReturnsDefaultsBeforeAnyDataSubmitted()
    {
        var (client, _, appId) = await CreateOwnedApplicationAsync();

        var res = await client.GetAsync($"/api/v1/me/accessible/applications/{appId}");
        res.StatusCode.Should().Be(HttpStatusCode.OK);
        var env = await ReadAsync(res);
        env.Success.Should().BeTrue();
        env.Data.GetProperty("applicationId").GetGuid().Should().Be(appId);
        env.Data.GetProperty("status").GetString().Should().Be("pending");
        env.Data.GetProperty("requiresMedicalDocument").GetBoolean().Should().BeTrue("accessible-life modülü kuralı belge zorunlu kılar");
        env.Data.GetProperty("medicalDocumentVerified").GetBoolean().Should().BeFalse("DocumentsJson boş []");
        env.Data.GetProperty("requiresGuardianConsent").GetBoolean().Should().BeTrue();
        env.Data.GetProperty("guardianConsentRecorded").GetBoolean().Should().BeFalse("henüz KVKK onayı verilmedi");
        env.Data.GetProperty("isEligibleForApproval").GetBoolean().Should().BeFalse();
        env.Data.GetProperty("hasCaregiver").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task GetSummary_ForSomeoneElsesApplication_Returns403()
    {
        var (_, _, appId) = await CreateOwnedApplicationAsync();
        var (otherClient, _, _) = await CreateOwnedApplicationAsync();

        var res = await otherClient.GetAsync($"/api/v1/me/accessible/applications/{appId}");
        res.StatusCode.Should().Be(HttpStatusCode.Forbidden, "başkasının başvurusuna erişim engellenmeli");
    }

    [Fact]
    public async Task SubmitDisabilityInfo_ThenGetSummary_ReflectsSubmittedValues()
    {
        var (client, _, appId) = await CreateOwnedApplicationAsync();

        var submit = await client.PostAsJsonAsync(
            $"/api/v1/me/accessible/applications/{appId}/disability-info",
            new
            {
                primaryDisabilityType = "Physical",
                disabilityRate = 45,
                emergencyContactName = "Ayşe Yılmaz",
                emergencyContactPhone = "5551234567",
                requiresWheelchairAccess = true,
                requiresSignLanguage = false,
                requiresBraille = false,
            });
        submit.StatusCode.Should().Be(HttpStatusCode.OK);

        var res = await client.GetAsync($"/api/v1/me/accessible/applications/{appId}");
        var env = await ReadAsync(res);
        env.Data.GetProperty("primaryDisabilityType").GetString().Should().Be("Physical");
        env.Data.GetProperty("disabilityRate").GetInt32().Should().Be(45);
    }

    [Fact]
    public async Task GiveKvkkConsent_Twice_SecondCallConflicts()
    {
        var (client, _, appId) = await CreateOwnedApplicationAsync();

        var first = await client.PostAsJsonAsync(
            $"/api/v1/me/accessible/applications/{appId}/kvkk-consent", new { version = "v1" });
        first.StatusCode.Should().Be(HttpStatusCode.OK);

        var summary = await ReadAsync(await client.GetAsync($"/api/v1/me/accessible/applications/{appId}"));
        summary.Data.GetProperty("guardianConsentRecorded").GetBoolean().Should().BeTrue();

        var second = await client.PostAsJsonAsync(
            $"/api/v1/me/accessible/applications/{appId}/kvkk-consent", new { version = "v1" });
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var env = await ReadAsync(second);
        env.ErrorCode.Should().Be("KVKK_ALREADY_CONSENTED");
    }

    [Fact]
    public async Task GetProgressNotes_ForOwnApplication_ReturnsEmptyListInitially()
    {
        var (client, _, appId) = await CreateOwnedApplicationAsync();

        var res = await client.GetAsync($"/api/v1/me/accessible/applications/{appId}/progress-notes");
        res.StatusCode.Should().Be(HttpStatusCode.OK);
        var env = await ReadAsync(res);
        env.Data.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task DefineCaregiver_Succeeds_AndReflectsInSummaryHasCaregiver()
    {
        var (client, _, appId) = await CreateOwnedApplicationAsync();

        var res = await client.PostAsJsonAsync("/api/v1/me/accessible/caregivers", new
        {
            name = "Fatma Demir",
            tc = CitizenTestIdentity.GenerateValidTckn(999),
            phone = "5559876543",
            relation = "Mother",
            isAuthorizedPickup = true,
        });
        res.StatusCode.Should().Be(HttpStatusCode.OK);

        var summary = await ReadAsync(await client.GetAsync($"/api/v1/me/accessible/applications/{appId}"));
        summary.Data.GetProperty("hasCaregiver").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task AllFiveEndpoints_WithoutAuth_Return401()
    {
        var anon = _factory.CreateClient();
        var appId = Guid.NewGuid();

        (await anon.GetAsync($"/api/v1/me/accessible/applications/{appId}")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await anon.PostAsJsonAsync($"/api/v1/me/accessible/applications/{appId}/disability-info", new { })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await anon.PostAsJsonAsync($"/api/v1/me/accessible/applications/{appId}/kvkk-consent", new { })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await anon.GetAsync($"/api/v1/me/accessible/applications/{appId}/progress-notes")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await anon.PostAsJsonAsync("/api/v1/me/accessible/caregivers", new { })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
