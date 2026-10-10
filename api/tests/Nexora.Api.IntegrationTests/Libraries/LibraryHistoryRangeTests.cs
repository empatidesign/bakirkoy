using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Infrastructure.Persistence;
using Xunit;

namespace Nexora.Api.IntegrationTests.Libraries;

// Kullanıcı isteği (2026-09-30): mobil "Bugünkü Hareketlerim" listesi günlük/haftalık/aylık
// sekmelere ayrıldı — GET /api/v1/me/libraries/history?range=week|month gerçek Postgres'e karşı
// doğrulanır. `range` verilmezse (eski istemciler dahil) geriye dönük uyumlu tek-gün davranışı
// (varsayılan "day") korunmalı.
[Collection(ApiCollection.Name)]
public sealed class LibraryHistoryRangeTests : IAsyncLifetime
{
    private NexoraApiFactory _redisHost = null!;
    private System.Net.Http.HttpClient _admin = null!;

    public async Task InitializeAsync()
    {
        _redisHost = NexoraApiFactory.CreateForCollectionWithRedis();
        await _redisHost.InitializeAsync();
        _admin = await _redisHost.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t-hist-{Guid.NewGuid():N}@nexora.local"));
    }

    public async Task DisposeAsync() => await _redisHost.DisposeAsync();

    private sealed record Envelope(bool Success, JsonElement Data);

    private static async Task<Envelope> ReadAsync(System.Net.Http.HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        var doc = JsonSerializer.Deserialize<JsonElement>(body, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return new Envelope(doc.GetProperty("success").GetBoolean(), doc.TryGetProperty("data", out var d) ? d : default);
    }

    // -----------------------------------------------------------------------------------------
    // Bugünkü giriş: range=day (varsayılan), range=week ve range=month'un HEPSİNDE görünmeli
    // (aynı gün hem güncel haftanın hem güncel ayın içinde). range=day (belirtilmemiş) eski
    // istemcilerle geriye dönük uyumluluğu doğrular.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task TodaysEntry_AppearsInDayWeekAndMonthRanges()
    {
        var scenario = await LibraryScenario.CreateAsync(_admin, $"histr{Guid.NewGuid():N}"[..20],
            new LibraryScenario.Options { EntryControlMode = "qr", SeatingMode = "sirali" });
        var identity = CitizenTestIdentity.Adult(Random.Shared.Next());
        var citizen = await _redisHost.CreateCitizenClientAsync(identity);
        try
        {
            var walkIn = await citizen.PostAsJsonAsync($"/api/v1/me/libraries/{scenario.LibraryId}/walk-in", new { });
            walkIn.EnsureSuccessStatusCode();
            var checkIn = await citizen.PostAsJsonAsync($"/api/v1/me/libraries/{scenario.LibraryId}/check-in",
                new { latitude = 41.1086, longitude = 28.8681 });
            checkIn.EnsureSuccessStatusCode();

            // range verilmezse (eski istemci davranışı) bugünkü giriş görünmeli.
            var noRange = await ReadAsync(await citizen.GetAsync("/api/v1/me/libraries/history"));
            noRange.Data.GetProperty("items").GetArrayLength().Should().BeGreaterThan(0, "bugünkü giriş range=day varsayılanında görünmeli");

            var dayRes = await ReadAsync(await citizen.GetAsync("/api/v1/me/libraries/history?range=day"));
            dayRes.Data.GetProperty("items").GetArrayLength().Should().BeGreaterThan(0, "bugünkü giriş range=day'de görünmeli");

            var weekRes = await ReadAsync(await citizen.GetAsync("/api/v1/me/libraries/history?range=week"));
            weekRes.Data.GetProperty("items").GetArrayLength().Should().BeGreaterThan(0, "bugünkü giriş range=week'te görünmeli");

            var monthRes = await ReadAsync(await citizen.GetAsync("/api/v1/me/libraries/history?range=month"));
            monthRes.Data.GetProperty("items").GetArrayLength().Should().BeGreaterThan(0, "bugünkü giriş range=month'ta görünmeli");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, scenario); }
    }

    // -----------------------------------------------------------------------------------------
    // SINIR DOĞRULAMASI (derin doğrulama, 2026-09-30): önceki test yalnız "bugünkü giriş her
    // aralıkta görünür" (pozitif) kontrolü yapıyordu — aralık dışındaki bir kaydın GÖRÜNMEMESİ
    // hiç kanıtlanmamıştı. Gerçek bir oturum HTTP ile açılır, sonra EntryTime EF Core üzerinden
    // gerçek Postgres'te 40 gün öncesine taşınır (hem içinde bulunulan haftanın hem ayın kesin
    // dışında kalması için) — bu kayıt artık range=week VE range=month'ta GÖRÜNMEMELİ, yalnızca
    // hiçbir sınır koymayan "tüm zamanlar" senaryosu yoktur; GetHistoryAsync'in from/to filtresinin
    // gerçekten uygulandığını (yalnızca "en azından bir şey dönüyor" değil) kanıtlar.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task EntryOutsideRange_DoesNotAppearInWeekOrMonth()
    {
        var scenario = await LibraryScenario.CreateAsync(_admin, $"histb{Guid.NewGuid():N}"[..20],
            new LibraryScenario.Options { EntryControlMode = "qr", SeatingMode = "sirali" });
        var identity = CitizenTestIdentity.Adult(Random.Shared.Next());
        var citizen = await _redisHost.CreateCitizenClientAsync(identity);
        try
        {
            (await citizen.PostAsJsonAsync($"/api/v1/me/libraries/{scenario.LibraryId}/walk-in", new { })).EnsureSuccessStatusCode();
            var checkIn = await citizen.PostAsJsonAsync($"/api/v1/me/libraries/{scenario.LibraryId}/check-in",
                new { latitude = 41.1086, longitude = 28.8681 });
            checkIn.EnsureSuccessStatusCode();

            // Gerçek Postgres'te EntryTime'ı 40 gün öncesine taşı (güncel haftanın VE ayın
            // kesin dışında) — EF Core ExecuteUpdateAsync, ham SQL değil, aynı entity mapping'i
            // kullanır.
            await using (var scope = _redisHost.Services.CreateAsyncScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var oldEntry = DateTime.UtcNow.AddDays(-40);
                var updated = await db.LibrarySessions
                    .Where(s => s.ParticipantId == identity.ParticipantId)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(s => s.EntryTime, oldEntry));
                updated.Should().Be(1, "test kurulumunda tam olarak bir oturum kaydı olmalı");
            }

            var weekRes = await ReadAsync(await citizen.GetAsync("/api/v1/me/libraries/history?range=week"));
            weekRes.Data.GetProperty("items").GetArrayLength().Should().Be(0,
                "40 gün önceki giriş güncel haftanın kesinlikle dışında, range=week'te GÖRÜNMEMELİ");

            var monthRes = await ReadAsync(await citizen.GetAsync("/api/v1/me/libraries/history?range=month"));
            monthRes.Data.GetProperty("items").GetArrayLength().Should().Be(0,
                "40 gün önceki giriş güncel ayın kesinlikle dışında, range=month'ta GÖRÜNMEMELİ");

            var dayRes = await ReadAsync(await citizen.GetAsync("/api/v1/me/libraries/history?range=day"));
            dayRes.Data.GetProperty("items").GetArrayLength().Should().Be(0,
                "40 gün önceki giriş bugün DEĞİL, range=day'de GÖRÜNMEMELİ");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, scenario); }
    }
}
