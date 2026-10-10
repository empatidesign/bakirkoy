using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Persistence;
using Xunit;

namespace Nexora.Api.IntegrationTests.Facilities;

// Kullanıcı isteği (2026-10-06): Kadın-Aile (ve diğer) gruplara TC ile tek/toplu üye aktarımı,
// yedek listeye de aynı şekilde. Gerçek API + gerçek PostgreSQL üzerinden hedef liste
// (auto/main/reserve) davranışını uçtan uca doğrular.
[Collection(ApiCollection.Name)]
public sealed class FacilityBulkTcTransferTargetTests : IAsyncLifetime
{
    private const string Module = "women-family";
    private readonly NexoraApiFactory _factory;
    private HttpClient _admin = null!;
    private FacilityScenario.Base _base = null!;

    public FacilityBulkTcTransferTargetTests(ApiTestHost host) => _factory = host.Factory;

    public async Task InitializeAsync()
    {
        _admin = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), $"tctransfer-{Guid.NewGuid():N}@nexora.local"));
        _base = await FacilityScenario.CreateBaseAsync(_admin, Module, Guid.NewGuid().ToString("N")[..6]);
    }

    public async Task DisposeAsync() => await FacilityScenario.CleanupAsync(_admin, _base);

    private Task<Guid> GroupAsync(string tag, int capacity, int reserveCapacity) =>
        FacilityScenario.CreateGroupAsync(_admin, _base, tag, new FacilityScenario.GroupOptions
        {
            Capacity = capacity,
            ReserveCapacity = reserveCapacity,
            PeriodStart = DateTime.UtcNow.Date.AddDays(1),
            PeriodEnd = DateTime.UtcNow.Date.AddMonths(3),
            ApplicationStartDate = DateTime.UtcNow.Date,
            ApplicationEndDate = DateTime.UtcNow.Date.AddDays(30),
            Schedule = [new FacilityScenario.ScheduleSlot("tuesday", "10:00", "11:00")],
        });

    private async Task<string> SeedParticipantAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var tckn = FacilityScenario.NewTckn(Random.Shared);
        var p = Participant.Create(tckn, "Aktarim Kisi", new DateTime(1990, 1, 1), Gender.Female,
            isMinor: false, passwordHash: "x", email: $"{tckn}@example.com", phone: "05321112233",
            guardianPhone: null, guardianEmail: null, address: null);
        await db.Set<Participant>().AddAsync(p);
        await db.SaveChangesAsync();
        return tckn;
    }

    private async Task<JsonElement> BulkAsync(Guid groupId, IEnumerable<string> tckns, string? target)
    {
        var res = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/bulk-pre-register",
            new { groupId, tckns = tckns.ToList(), target });
        var raw = await res.Content.ReadAsStringAsync();
        res.StatusCode.Should().Be(HttpStatusCode.OK, raw);
        return JsonDocument.Parse(raw).RootElement.GetProperty("data");
    }

    private async Task<List<FacilityRegistration>> RosterAsync(Guid groupId)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Set<FacilityRegistration>().AsNoTracking()
            .Where(r => r.GroupId == groupId && r.Status == "active").OrderBy(r => r.WaitlistOrder).ToListAsync();
    }

    [Fact]
    public async Task Reserve_hedefi_asil_bos_olsa_da_toplu_tc_yi_sirali_yedege_yazar()
    {
        var group = await GroupAsync("rsv", capacity: 10, reserveCapacity: 5);
        var t1 = await SeedParticipantAsync();
        var t2 = await SeedParticipantAsync();

        var data = await BulkAsync(group, [t1, t2], "reserve");

        data.GetProperty("waitlisted").GetInt32().Should().Be(2);
        data.GetProperty("registered").GetInt32().Should().Be(0);
        var roster = await RosterAsync(group);
        roster.Should().HaveCount(2);
        roster.Should().OnlyContain(r => r.Kind == "reserve");
        roster.Select(r => r.WaitlistOrder).Should().Equal(1, 2);
        roster.Select(r => r.Tckn).Should().Equal(t1, t2);
    }

    [Fact]
    public async Task Auto_hedefi_asil_dolunca_yedege_main_hedefi_doluysa_eklemez()
    {
        var group = await GroupAsync("auto", capacity: 1, reserveCapacity: 5);
        var t1 = await SeedParticipantAsync();
        var t2 = await SeedParticipantAsync();
        var t3 = await SeedParticipantAsync();

        var auto = await BulkAsync(group, [t1, t2], null);
        auto.GetProperty("registered").GetInt32().Should().Be(1);
        auto.GetProperty("waitlisted").GetInt32().Should().Be(1);

        var main = await BulkAsync(group, [t3], "main");
        main.GetProperty("registered").GetInt32().Should().Be(0);
        main.GetProperty("failed").GetInt32().Should().Be(1);
        main.GetProperty("rows")[0].GetProperty("reason").GetString().Should().Be("Asıl kontenjan dolu.");

        var roster = await RosterAsync(group);
        roster.Count(r => r.Kind == "main").Should().Be(1);
        roster.Count(r => r.Kind == "reserve").Should().Be(1);
        roster.Should().NotContain(r => r.Tckn == t3);
    }

    [Fact]
    public async Task Reserve_hedefi_yedek_kontenjani_sifirsa_reddeder()
    {
        var group = await GroupAsync("zero", capacity: 10, reserveCapacity: 0);
        var t1 = await SeedParticipantAsync();

        var data = await BulkAsync(group, [t1], "reserve");

        data.GetProperty("failed").GetInt32().Should().Be(1);
        (await RosterAsync(group)).Should().BeEmpty();
    }
}
