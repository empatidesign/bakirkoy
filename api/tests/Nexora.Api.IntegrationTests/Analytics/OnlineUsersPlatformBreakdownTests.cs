using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Analytics;

// Kullanıcı isteği (2026-10-04): "mobil uygulamada giriş yapmış toplam kullanıcıları
// [...] gerçekte kaç kişi online kaç iOS kaç Android kullanıcısı bunun takibi mümkün mü".
// Gerçek HTTP + gerçek Redis üzerinden doğrulanır (NexoraApiFactory.CreateForCollectionWithRedis,
// Task 6'nın kurduğu desen — online takibi tamamen Redis'e dayalı). Hiçbir Redis/online-tracker
// mock'u kullanılmaz: gerçek citizen JWT ile gerçek bir korumalı uca (GET /auth/citizen/me)
// X-Client-Platform header'ıyla istek atılır, OnlineTrackingMiddleware bunu gerçekten işler,
// ardından admin gerçek GET /analytics/online-users ile kırılımı okur.
[Collection(ApiCollection.Name)]
public sealed class OnlineUsersPlatformBreakdownTests : IAsyncLifetime
{
    private NexoraApiFactory _factory = null!;
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public async Task InitializeAsync()
    {
        _factory = NexoraApiFactory.CreateForCollectionWithRedis();
        await _factory.InitializeAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private sealed record Envelope<T>(bool Success, int StatusCode, T? Data, string? ErrorCode, string? Message);

    private static async Task<Envelope<JsonElement>> ReadAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<Envelope<JsonElement>>(body, Web)
            ?? throw new InvalidOperationException($"Could not parse envelope: {body}");
    }

    private async Task<HttpClient> AdminAsync() =>
        await _factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t-online-{Guid.NewGuid():N}@nexora.local"));

    private async Task TouchAsCitizenAsync(string platformHeaderValue, int seed)
    {
        var identity = CitizenTestIdentity.Adult(seed);
        var client = await _factory.CreateCitizenClientAsync(identity);
        if (!string.IsNullOrEmpty(platformHeaderValue))
            client.DefaultRequestHeaders.Add("X-Client-Platform", platformHeaderValue);

        // Gerçek korumalı bir vatandaş ucu — OnlineTrackingMiddleware her kimliği
        // doğrulanmış istekte gerçekten tetiklenir (middleware pipeline'da gerçekten kayıtlı).
        var meRes = await client.GetAsync("/api/v1/auth/citizen/me");
        meRes.StatusCode.Should().Be(HttpStatusCode.OK, $"citizen /me must succeed for the touch to register; body: {await meRes.Content.ReadAsStringAsync()}");
    }

    [Fact]
    public async Task Ios_ve_Android_vatandas_istekleri_online_users_kirilimina_gercekten_yansir()
    {
        var baseline = await (await AdminAsync()).GetAsync("/api/v1/analytics/online-users");
        var baselineData = (await ReadAsync(baseline)).Data!;
        var baseIos = baselineData.GetProperty("citizenIos").GetInt32();
        var baseAndroid = baselineData.GetProperty("citizenAndroid").GetInt32();
        var baseWeb = baselineData.GetProperty("citizenWeb").GetInt32();
        var baseCitizen = baselineData.GetProperty("citizen").GetInt32();

        await TouchAsCitizenAsync("ios", 9001);
        await TouchAsCitizenAsync("ios", 9002);
        await TouchAsCitizenAsync("android", 9003);
        await TouchAsCitizenAsync("web", 9004);

        var admin = await AdminAsync();
        var res = await admin.GetAsync("/api/v1/analytics/online-users");
        res.StatusCode.Should().Be(HttpStatusCode.OK, $"online-users GET must succeed; body: {await res.Content.ReadAsStringAsync()}");

        var data = (await ReadAsync(res)).Data!;
        data.GetProperty("citizenIos").GetInt32().Should().Be(baseIos + 2, "two distinct iOS citizens touched the API");
        data.GetProperty("citizenAndroid").GetInt32().Should().Be(baseAndroid + 1, "one distinct Android citizen touched the API");
        data.GetProperty("citizenWeb").GetInt32().Should().Be(baseWeb + 1, "one distinct web citizen touched the API");
        data.GetProperty("citizen").GetInt32().Should().Be(baseCitizen + 4, "total citizen count must include all 4, regardless of platform");
    }

    [Fact]
    public async Task Platform_header_gonderilmeyen_vatandas_istegi_web_sayilir()
    {
        var baseline = await (await AdminAsync()).GetAsync("/api/v1/analytics/online-users");
        var baseWeb = (await ReadAsync(baseline)).Data!.GetProperty("citizenWeb").GetInt32();

        await TouchAsCitizenAsync(platformHeaderValue: "", seed: 9101);

        var res = await (await AdminAsync()).GetAsync("/api/v1/analytics/online-users");
        var data = (await ReadAsync(res)).Data!;
        data.GetProperty("citizenWeb").GetInt32().Should().Be(baseWeb + 1, "no X-Client-Platform header must default to web, not be dropped");
    }

    [Fact]
    public async Task Ayni_vatandas_ayni_platformdan_tekrar_istek_atsa_bile_bir_kez_sayilir()
    {
        var baseline = await (await AdminAsync()).GetAsync("/api/v1/analytics/online-users");
        var baseIos = (await ReadAsync(baseline)).Data!.GetProperty("citizenIos").GetInt32();

        var identity = CitizenTestIdentity.Adult(9201);
        var client = await _factory.CreateCitizenClientAsync(identity);
        client.DefaultRequestHeaders.Add("X-Client-Platform", "ios");

        // Aynı kullanıcı aynı dakikada art arda birden çok gerçek istek atar.
        for (var i = 0; i < 3; i++)
        {
            var meRes = await client.GetAsync("/api/v1/auth/citizen/me");
            meRes.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        var res = await (await AdminAsync()).GetAsync("/api/v1/analytics/online-users");
        var data = (await ReadAsync(res)).Data!;
        data.GetProperty("citizenIos").GetInt32().Should().Be(baseIos + 1, "the same citizen hitting the API repeatedly must still count once");
    }
}
