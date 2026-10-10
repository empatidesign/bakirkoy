using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Travels;

// Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme kopyalama" özelliğinin Gezi (Travel)
// tarafı — gerçek HTTP + gerçek PostgreSQL üzerinden doğrulanır (compile-only tsc/dotnet build
// kontrolünün ötesinde, asıl kabul yolu: POST /api/v1/travels/{id}/bulk-copy). Hiçbir mock/stub/
// doğrudan DbContext seed kullanılmaz; kategori/rota/sefer gerçek admin HTTP uçlarından oluşturulur
// (SportsCreationAuditTests ile aynı ApiCollection/ApiTestHost deseni).
[Collection(ApiCollection.Name)]
public sealed class TravelBulkCopyTests(ApiTestHost host)
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private sealed record Envelope<T>(bool Success, int StatusCode, string? Message, string? ErrorCode, T? Data);
    private sealed record IdOnly(Guid Id);
    private sealed record BulkCopyItem(int Index, bool Success, Guid? TravelId, string? Code, string? Error);
    private sealed record BulkCopyBody(List<BulkCopyItem> Results);

    private async Task<HttpClient> AdminAsync() =>
        await host.Factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"tbulkcopy-{Guid.NewGuid():N}@nexora.local"));

    private static async Task<Guid> CreateCategoryAsync(HttpClient admin, string tag)
    {
        var payload = new { name = $"{tag} Kategori", description = "", color = "#3B82F6", isActive = true };
        var res = await admin.PostAsJsonAsync("/api/v1/travel-categories", payload);
        res.StatusCode.Should().Be(HttpStatusCode.Created, $"category create must succeed; body: {await res.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await res.Content.ReadAsStringAsync(), Web);
        return body!.Data!.Id;
    }

    private static async Task<Guid> CreateRouteAsync(HttpClient admin, Guid categoryId, string tag)
    {
        var payload = new
        {
            name = $"{tag} Gezisi",
            categoryId,
            destination = "Test Hedef",
            latitude = (double?)null,
            longitude = (double?)null,
            description = "bulk-copy integration fixture",
            conditions = "",
            internalNote = "",
            gender = "mixed",
            minAge = 0,
            maxAge = 99,
            restrictions = new { },
            images = new { },
            pricing = new { },
            points = new { },
            isActive = true,
            sultangaziResidentOnly = false,
            departurePoint = (string?)null,
        };
        var res = await admin.PostAsJsonAsync("/api/v1/travel-routes", payload);
        res.StatusCode.Should().Be(HttpStatusCode.Created, $"route create must succeed; body: {await res.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await res.Content.ReadAsStringAsync(), Web);
        return body!.Data!.Id;
    }

    private static async Task<Guid> CreateTravelAsync(HttpClient admin, Guid routeId, DateTime start, DateTime end)
    {
        var payload = new
        {
            routeId,
            startDate = start,
            endDate = end,
            registrationStartDate = start,
            registrationEndDate = end,
            capacity = 20,
            reserveCapacity = 5,
            participationPeriod = "none",
            participationLimit = 0,
            exemptFromParticipationLimit = false,
            cancellationDeadlineHours = 24,
            crew = new { },
            busIds = Array.Empty<Guid>(),
            isActive = false,
        };
        var res = await admin.PostAsJsonAsync("/api/v1/travels", payload);
        res.StatusCode.Should().Be(HttpStatusCode.Created, $"travel create must succeed; body: {await res.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await res.Content.ReadAsStringAsync(), Web);
        return body!.Data!.Id;
    }

    private async Task<(HttpClient Admin, Guid SourceId, DateTime BaseStart)> SetupAsync(string tagPrefix)
    {
        var admin = await AdminAsync();
        var tag = $"{tagPrefix}{Guid.NewGuid():N}"[..Math.Min(12, tagPrefix.Length + 10)];
        var catId = await CreateCategoryAsync(admin, tag);
        var routeId = await CreateRouteAsync(admin, catId, tag);
        var baseStart = DateTime.UtcNow.Date.AddDays(10);
        var sourceId = await CreateTravelAsync(admin, routeId, baseStart, baseStart.AddDays(1));
        return (admin, sourceId, baseStart);
    }

    [Fact]
    public async Task BulkCopy_with_three_targets_creates_three_independent_passive_travels()
    {
        var (admin, sourceId, baseStart) = await SetupAsync("TBC");

        var targets = new[]
        {
            new { startDate = baseStart.AddDays(20), endDate = baseStart.AddDays(21), registrationStartDate = baseStart.AddDays(5), registrationEndDate = baseStart.AddDays(19), cloneBuses = false },
            new { startDate = baseStart.AddDays(30), endDate = baseStart.AddDays(31), registrationStartDate = baseStart.AddDays(5), registrationEndDate = baseStart.AddDays(29), cloneBuses = false },
            new { startDate = baseStart.AddDays(40), endDate = baseStart.AddDays(41), registrationStartDate = baseStart.AddDays(5), registrationEndDate = baseStart.AddDays(39), cloneBuses = false },
        };

        var response = await admin.PostAsJsonAsync($"/api/v1/travels/{sourceId}/bulk-copy", new { targets });
        response.StatusCode.Should().Be(HttpStatusCode.OK, $"bulk-copy must succeed; body: {await response.Content.ReadAsStringAsync()}");

        var body = JsonSerializer.Deserialize<Envelope<BulkCopyBody>>(await response.Content.ReadAsStringAsync(), Web);
        body!.Success.Should().BeTrue();
        body.Data!.Results.Should().HaveCount(3);
        body.Data.Results.Should().OnlyContain(r => r.Success && r.TravelId != null && r.TravelId != sourceId);
        body.Data.Results.Select(r => r.TravelId).Distinct().Should().HaveCount(3, "each target must create its own independent travel row");
        body.Data.Results.Select(r => r.Code).Distinct().Should().HaveCount(3, "each copy must get its own unique sequential code");

        // Gerçek kabul yolu: her yeni kopyayı GET ile tekrar oku, pasif oluştuğunu ve
        // hedefin kendi tarihlerini taşıdığını (kaynağın değil) doğrula.
        for (var i = 0; i < body.Data.Results.Count; i++)
        {
            var item = body.Data.Results[i];
            var getRes = await admin.GetAsync($"/api/v1/travels/{item.TravelId}");
            getRes.StatusCode.Should().Be(HttpStatusCode.OK);
            var travel = JsonSerializer.Deserialize<Envelope<JsonElement>>(await getRes.Content.ReadAsStringAsync(), Web)!.Data!;
            travel.GetProperty("isActive").GetBoolean().Should().BeFalse("bulk-copy'den gelen kayıtlar her zaman pasif oluşmalı");
            travel.GetProperty("startDate").GetDateTime().Date.Should().Be(targets[i].startDate.Date);
        }
    }

    [Fact]
    public async Task BulkCopy_with_empty_targets_returns_conflict()
    {
        var (admin, sourceId, _) = await SetupAsync("TBCE");

        var response = await admin.PostAsJsonAsync($"/api/v1/travels/{sourceId}/bulk-copy", new { targets = Array.Empty<object>() });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict,
            $"empty targets list must be rejected with a real 409, not silently succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<JsonElement>>(await response.Content.ReadAsStringAsync(), Web);
        body!.ErrorCode.Should().Be("COPY_TARGETS_EMPTY");
    }

    [Fact]
    public async Task BulkCopy_partial_failure_reports_per_target_without_aborting_the_batch()
    {
        var (admin, sourceId, baseStart) = await SetupAsync("TBCP");

        // İkinci hedef kasıtlı olarak geçersiz: dönüş tarihi gidiş tarihinden önce.
        var targets = new[]
        {
            new { startDate = baseStart.AddDays(20), endDate = baseStart.AddDays(21), registrationStartDate = baseStart.AddDays(5), registrationEndDate = baseStart.AddDays(19), cloneBuses = false },
            new { startDate = baseStart.AddDays(31), endDate = baseStart.AddDays(30), registrationStartDate = baseStart.AddDays(5), registrationEndDate = baseStart.AddDays(29), cloneBuses = false },
            new { startDate = baseStart.AddDays(40), endDate = baseStart.AddDays(41), registrationStartDate = baseStart.AddDays(5), registrationEndDate = baseStart.AddDays(39), cloneBuses = false },
        };

        var response = await admin.PostAsJsonAsync($"/api/v1/travels/{sourceId}/bulk-copy", new { targets });
        response.StatusCode.Should().Be(HttpStatusCode.OK, "a partial failure inside the batch must not fail the whole HTTP call");

        var body = JsonSerializer.Deserialize<Envelope<BulkCopyBody>>(await response.Content.ReadAsStringAsync(), Web);
        body!.Data!.Results.Should().HaveCount(3);
        body.Data.Results[0].Success.Should().BeTrue();
        body.Data.Results[1].Success.Should().BeFalse("end date before start date must be rejected for that one target");
        body.Data.Results[1].Error.Should().NotBeNullOrWhiteSpace();
        body.Data.Results[2].Success.Should().BeTrue("a failure in one target must not block the remaining valid targets");
    }
}
