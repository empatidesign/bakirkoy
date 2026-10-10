using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.ServiceFacilities;

// Kullanıcı isteği (2026-10-04): "Özdemir Bayraktar gibi bir hizmet tesisi birden çok program
// modülünde (Spor, Havuz, Kaşif Çocuk vb.) kullanılabilsin, toplu atama yapılsın" — gerçek HTTP +
// gerçek PostgreSQL üzerinden doğrulanır (compile-only tsc/dotnet build kontrolünün ötesinde,
// asıl kabul yolu: GET/POST /api/v1/service-facilities/{id}/module-usage). Hiçbir mock/stub/
// doğrudan DbContext seed kullanılmaz.
[Collection(ApiCollection.Name)]
public sealed class ServiceFacilityModuleAssignmentTests(ApiTestHost host)
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private sealed record Envelope<T>(bool Success, int StatusCode, string? Message, string? ErrorCode, T? Data);
    private sealed record IdOnly(Guid Id);
    private sealed record ModuleUsageItem(string Module, bool Assigned, Guid? FacilityId, string? FacilityName, bool? FacilityIsActive);
    private sealed record AssignResult(int Assigned, int AlreadyAssigned, List<string> Failed);

    private async Task<HttpClient> AdminAsync() =>
        await host.Factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"sfassign-{Guid.NewGuid():N}@nexora.local"));

    private static async Task<Guid> CreateServiceFacilityAsync(HttpClient admin, string tag)
    {
        var payload = new
        {
            name = $"SFA {tag}",
            type = "sports",
            locationType = "Indoor",
            city = "İstanbul",
            district = "Sultangazi",
            address = "Test Mah. No:1",
            latitude = 41.1086,
            longitude = 28.8681,
            weekdayOpen = "08:00",
            weekdayClose = "22:00",
            weekendOpen = "09:00",
            weekendClose = "20:00",
            parkingCapacity = 0,
            parkingType = "Free",
            capacity = 200,
        };
        var res = await admin.PostAsJsonAsync("/api/v1/service-facilities", payload);
        res.StatusCode.Should().Be(HttpStatusCode.Created, $"service-facility create must succeed; body: {await res.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await res.Content.ReadAsStringAsync(), Web);
        return body!.Data!.Id;
    }

    [Fact]
    public async Task GetModuleUsage_for_a_fresh_service_facility_reports_all_modules_unassigned()
    {
        var admin = await AdminAsync();
        var sfId = await CreateServiceFacilityAsync(admin, $"fresh{Guid.NewGuid():N}");

        var res = await admin.GetAsync($"/api/v1/service-facilities/{sfId}/module-usage");
        res.StatusCode.Should().Be(HttpStatusCode.OK, $"module-usage GET must succeed; body: {await res.Content.ReadAsStringAsync()}");

        var body = JsonSerializer.Deserialize<Envelope<List<ModuleUsageItem>>>(await res.Content.ReadAsStringAsync(), Web);
        body!.Data.Should().NotBeNullOrEmpty();
        var items = body.Data!;
        items.Should().OnlyContain(m => !m.Assigned && m.FacilityId == null, "a brand new service facility must not be assigned to any module yet");
        items.Select(m => m.Module).Should().Contain(new[] { "sports", "pool", "kasif" }, "real module registry keys (sports/pool/kasif) must appear");
    }

    [Fact]
    public async Task AssignModules_with_two_modules_creates_two_independent_facility_rows()
    {
        var admin = await AdminAsync();
        var sfId = await CreateServiceFacilityAsync(admin, $"assign{Guid.NewGuid():N}");

        var res = await admin.PostAsJsonAsync($"/api/v1/service-facilities/{sfId}/module-usage", new { modules = new[] { "sports", "pool" } });
        res.StatusCode.Should().Be(HttpStatusCode.OK, $"assign must succeed; body: {await res.Content.ReadAsStringAsync()}");

        var body = JsonSerializer.Deserialize<Envelope<AssignResult>>(await res.Content.ReadAsStringAsync(), Web);
        body!.Data!.Assigned.Should().Be(2);
        body.Data.AlreadyAssigned.Should().Be(0);
        body.Data.Failed.Should().BeEmpty();

        // Gerçek kabul yolu: module-usage'ı tekrar GET ederek her iki modülün de gerçekten
        // Facility kaydına sahip olduğunu ve diğer modüllerin hâlâ atanmamış kaldığını doğrula.
        var verifyRes = await admin.GetAsync($"/api/v1/service-facilities/{sfId}/module-usage");
        var verify = JsonSerializer.Deserialize<Envelope<List<ModuleUsageItem>>>(await verifyRes.Content.ReadAsStringAsync(), Web)!.Data!;
        var sports = verify.Single(m => m.Module == "sports");
        var pool = verify.Single(m => m.Module == "pool");
        var kasif = verify.Single(m => m.Module == "kasif");

        sports.Assigned.Should().BeTrue();
        sports.FacilityId.Should().NotBeNull();
        sports.FacilityIsActive.Should().BeTrue();
        pool.Assigned.Should().BeTrue();
        pool.FacilityId.Should().NotBeNull();
        kasif.Assigned.Should().BeFalse("a module that was not in the assign request must remain unassigned");

        // Facility kaydının gerçekten o modülün /facilities uç noktasından okunabildiğini ve
        // hizmet tesisi adını taşıdığını doğrula (yüzeysel module-usage yanıtına güvenmek yerine).
        var facRes = await admin.GetAsync($"/api/v1/sports/facilities/{sports.FacilityId}");
        facRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var fac = JsonSerializer.Deserialize<Envelope<JsonElement>>(await facRes.Content.ReadAsStringAsync(), Web)!.Data!;
        fac.GetProperty("serviceFacilityId").GetGuid().Should().Be(sfId);
        fac.GetProperty("isActive").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task AssignModules_called_twice_with_same_module_does_not_duplicate_and_reports_already_assigned()
    {
        var admin = await AdminAsync();
        var sfId = await CreateServiceFacilityAsync(admin, $"dup{Guid.NewGuid():N}");

        var first = await admin.PostAsJsonAsync($"/api/v1/service-facilities/{sfId}/module-usage", new { modules = new[] { "sports" } });
        first.StatusCode.Should().Be(HttpStatusCode.OK);
        var firstBody = JsonSerializer.Deserialize<Envelope<AssignResult>>(await first.Content.ReadAsStringAsync(), Web);
        firstBody!.Data!.Assigned.Should().Be(1);

        // Aynı modülü ikinci kez atamaya çalış — gerçek kabul kriteri: tekrar Facility
        // oluşturulmaz (alreadyAssigned=1, assigned=0), ve o modülde HÂLÂ tek bir kayıt var.
        var second = await admin.PostAsJsonAsync($"/api/v1/service-facilities/{sfId}/module-usage", new { modules = new[] { "sports" } });
        second.StatusCode.Should().Be(HttpStatusCode.OK);
        var secondBody = JsonSerializer.Deserialize<Envelope<AssignResult>>(await second.Content.ReadAsStringAsync(), Web);
        secondBody!.Data!.Assigned.Should().Be(0, "re-assigning an already-assigned module must not create a duplicate Facility row");
        secondBody.Data.AlreadyAssigned.Should().Be(1);

        var listRes = await admin.GetAsync($"/api/v1/sports/facilities");
        var listBody = JsonSerializer.Deserialize<Envelope<JsonElement>>(await listRes.Content.ReadAsStringAsync(), Web)!.Data!;
        var items = listBody.GetProperty("items").EnumerateArray()
            .Where(i => i.GetProperty("serviceFacilityId").GetGuid() == sfId)
            .ToList();
        items.Should().HaveCount(1, "exactly one Facility row must exist for this (module, serviceFacility) pair after calling assign twice");
    }

    [Fact]
    public async Task AssignModules_with_unknown_module_key_reports_it_as_failed()
    {
        var admin = await AdminAsync();
        var sfId = await CreateServiceFacilityAsync(admin, $"bad{Guid.NewGuid():N}");

        var res = await admin.PostAsJsonAsync($"/api/v1/service-facilities/{sfId}/module-usage", new { modules = new[] { "not-a-real-module" } });
        res.StatusCode.Should().Be(HttpStatusCode.OK, "an invalid module key inside the batch must not fail the whole HTTP call");

        var body = JsonSerializer.Deserialize<Envelope<AssignResult>>(await res.Content.ReadAsStringAsync(), Web);
        body!.Data!.Assigned.Should().Be(0);
        body.Data.Failed.Should().ContainSingle().Which.Should().Be("not-a-real-module");
    }
}
