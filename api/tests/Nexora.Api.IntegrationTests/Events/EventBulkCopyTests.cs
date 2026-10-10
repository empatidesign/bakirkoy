using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Events;

// Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme kopyalama" özelliğinin Etkinlik tarafı —
// gerçek HTTP + gerçek PostgreSQL üzerinden doğrulanır (compile-only tsc/dotnet build kontrolünün
// ötesinde, asıl kabul yolu: POST /api/v1/events/{id}/bulk-copy). EventScenario'nun gerçek
// kategori/etkinlik oluşturma yardımcılarını kullanır; mock/stub/doğrudan DbContext seed yok.
[Collection(ApiCollection.Name)]
public sealed class EventBulkCopyTests(ApiTestHost host)
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private sealed record Envelope<T>(bool Success, int StatusCode, string? Message, string? ErrorCode, T? Data);
    private sealed record BulkCopyItem(int Index, bool Success, Guid? EventId, string? Code, string? Error);
    private sealed record BulkCopyBody(List<BulkCopyItem> Results);

    private async Task<HttpClient> AdminAsync() =>
        await host.Factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"ebulkcopy-{Guid.NewGuid():N}@nexora.local"));

    private async Task<(HttpClient Admin, Guid SourceId, DateTime BaseStart)> SetupAsync(string tagPrefix)
    {
        var admin = await AdminAsync();
        var tag = $"{tagPrefix}{Guid.NewGuid():N}"[..Math.Min(12, tagPrefix.Length + 10)];
        var catId = await EventScenario.CreateCategoryAsync(admin, tag);
        var baseStart = DateTime.UtcNow.Date.AddDays(10);
        var sourceId = await EventScenario.CreateEventAsync(admin, new EventScenario.CreateEventOptions
        {
            CategoryId = catId,
            Tag = tag,
            HasSessions = false,
            RegistrationMode = "none",
            Capacity = 15,
            StartDate = baseStart,
            EndDate = baseStart.AddDays(1),
        });
        return (admin, sourceId, baseStart);
    }

    [Fact]
    public async Task BulkCopy_with_three_targets_creates_three_independent_passive_events()
    {
        var (admin, sourceId, baseStart) = await SetupAsync("EBC");

        var targets = new[]
        {
            new { startDate = baseStart.AddDays(20), endDate = baseStart.AddDays(21), applicationStartDate = (DateTime?)null, applicationEndDate = (DateTime?)null },
            new { startDate = baseStart.AddDays(30), endDate = baseStart.AddDays(31), applicationStartDate = (DateTime?)null, applicationEndDate = (DateTime?)null },
            new { startDate = baseStart.AddDays(40), endDate = baseStart.AddDays(41), applicationStartDate = (DateTime?)null, applicationEndDate = (DateTime?)null },
        };

        var response = await admin.PostAsJsonAsync($"/api/v1/events/{sourceId}/bulk-copy", new { targets });
        response.StatusCode.Should().Be(HttpStatusCode.OK, $"bulk-copy must succeed; body: {await response.Content.ReadAsStringAsync()}");

        var body = JsonSerializer.Deserialize<Envelope<BulkCopyBody>>(await response.Content.ReadAsStringAsync(), Web);
        body!.Success.Should().BeTrue();
        body.Data!.Results.Should().HaveCount(3);
        body.Data.Results.Should().OnlyContain(r => r.Success && r.EventId != null && r.EventId != sourceId);
        body.Data.Results.Select(r => r.EventId).Distinct().Should().HaveCount(3, "each target must create its own independent event row");
        body.Data.Results.Select(r => r.Code).Distinct().Should().HaveCount(3, "each copy must get its own unique sequential code");

        for (var i = 0; i < body.Data.Results.Count; i++)
        {
            var item = body.Data.Results[i];
            var getRes = await admin.GetAsync($"/api/v1/events/{item.EventId}");
            getRes.StatusCode.Should().Be(HttpStatusCode.OK);
            var ev = JsonSerializer.Deserialize<Envelope<JsonElement>>(await getRes.Content.ReadAsStringAsync(), Web)!.Data!;
            ev.GetProperty("isActive").GetBoolean().Should().BeFalse("bulk-copy'den gelen kayıtlar her zaman pasif oluşmalı");
            ev.GetProperty("startDate").GetDateTime().Date.Should().Be(targets[i].startDate.Date);
            ev.GetProperty("name").GetString().Should().Contain("(Kopya)");
        }
    }

    [Fact]
    public async Task BulkCopy_with_empty_targets_returns_conflict()
    {
        var (admin, sourceId, _) = await SetupAsync("EBCE");

        var response = await admin.PostAsJsonAsync($"/api/v1/events/{sourceId}/bulk-copy", new { targets = Array.Empty<object>() });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict,
            $"empty targets list must be rejected with a real 409, not silently succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<JsonElement>>(await response.Content.ReadAsStringAsync(), Web);
        body!.ErrorCode.Should().Be("COPY_TARGETS_EMPTY");
    }

    [Fact]
    public async Task BulkCopy_partial_failure_reports_per_target_without_aborting_the_batch()
    {
        var (admin, sourceId, baseStart) = await SetupAsync("EBCP");

        // İkinci hedef kasıtlı olarak geçersiz: bitiş tarihi başlangıçtan önce.
        var targets = new[]
        {
            new { startDate = baseStart.AddDays(20), endDate = baseStart.AddDays(21), applicationStartDate = (DateTime?)null, applicationEndDate = (DateTime?)null },
            new { startDate = baseStart.AddDays(31), endDate = baseStart.AddDays(30), applicationStartDate = (DateTime?)null, applicationEndDate = (DateTime?)null },
            new { startDate = baseStart.AddDays(40), endDate = baseStart.AddDays(41), applicationStartDate = (DateTime?)null, applicationEndDate = (DateTime?)null },
        };

        var response = await admin.PostAsJsonAsync($"/api/v1/events/{sourceId}/bulk-copy", new { targets });
        response.StatusCode.Should().Be(HttpStatusCode.OK, "a partial failure inside the batch must not fail the whole HTTP call");

        var body = JsonSerializer.Deserialize<Envelope<BulkCopyBody>>(await response.Content.ReadAsStringAsync(), Web);
        body!.Data!.Results.Should().HaveCount(3);
        body.Data.Results[0].Success.Should().BeTrue();
        body.Data.Results[1].Success.Should().BeFalse("end date before start date must be rejected for that one target");
        body.Data.Results[1].Error.Should().NotBeNullOrWhiteSpace();
        body.Data.Results[2].Success.Should().BeTrue("a failure in one target must not block the remaining valid targets");
    }
}
