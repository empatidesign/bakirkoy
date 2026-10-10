using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Facilities;

// Scout Camp (İzcilik Kampı) module audit — same characterization pattern as
// SportsCreationAuditTests/PoolCreationAuditTests/KasifCreationAuditTests/
// YouthCampCreationAuditTests, confirming whether SP-01..SP-11 findings reproduce identically
// in the "scout-camp" module. Differs in moduleConfig.ts: outdoor-only facility kind,
// supportsSections: true, age range 8-18, "İzci Grubu" terminology.
// Real current API + disposable PostgreSQL database. No participants or messages created.
[Collection(ApiCollection.Name)]
public sealed class ScoutCampCreationAuditTests(ApiTestHost host)
{
    private const string Module = "scout-camp";

    private async Task<(HttpClient Client, FacilityScenario.Base Base)> Setup()
    {
        var client = await host.Factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"scoutcamp-audit-{Guid.NewGuid():N}@nexora.local"));
        var b = await FacilityScenario.CreateBaseAsync(client, Module, $"audit-{Guid.NewGuid():N}");
        return (client, b);
    }

    private static JsonObject Payload(FacilityScenario.Base b) => new()
    {
        ["facilityId"] = b.FacilityId.ToString(), ["branchId"] = b.BranchId.ToString(),
        ["name"] = $"ScoutCamp audit {Guid.NewGuid():N}", ["type"] = "kurs", ["gender"] = "mixed",
        ["capacity"] = 20, ["reserveCapacity"] = 5, ["ageMin"] = 8, ["ageMax"] = 18,
        ["attendanceMode"] = "full", ["isActive"] = true, ["autoApprove"] = true,
        ["periodType"] = "date_range", ["periodUnit"] = "month", ["periodMonths"] = 0,
        ["residencyMode"] = "anyone", ["fee"] = new JsonObject { ["isPaid"] = false },
        ["conditions"] = new JsonObject(), ["schedule"] = new JsonArray(),
    };

    private static async Task<JsonNode> Read(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"HTTP {(int)response.StatusCode}: {body}");
        return JsonNode.Parse(body)!["data"]!;
    }
    private static async Task<string> Create(HttpClient c, JsonObject p, string? parent = null)
        => (await Read(await c.PostAsJsonAsync(parent is null ? $"/api/v1/{Module}/groups" : $"/api/v1/{Module}/groups/{parent}/sub-groups", p)))["id"]!.GetValue<string>();
    private static async Task<JsonArray> Sessions(HttpClient c, string id)
        => (await Read(await c.GetAsync($"/api/v1/{Module}/sessions/by-group?groupId={id}"))).AsArray();
    private static string Future(int days) => DateTime.UtcNow.AddDays(days).ToString("yyyy-MM-dd");
    private static JsonArray AllDays() => new(new[] { "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday" }
        .Select(day => (JsonNode)new JsonObject { ["day"] = day, ["startTime"] = "09:00", ["endTime"] = "10:00" }).ToArray());

    [Fact]
    public async Task Main_group_with_complete_schedule_has_no_generated_sessions()
    {
        var (c, b) = await Setup(); var p = Payload(b);
        p["periodStart"] = Future(20); p["periodEnd"] = Future(23); p["schedule"] = AllDays();
        var id = await Create(c, p);
        Assert.Empty(await Sessions(c, id));
    }

    [Fact]
    public async Task Subgroup_date_only_period_generates_previous_day()
    {
        var (c, b) = await Setup(); var parent = await Create(c, Payload(b)); var p = Payload(b);
        p["periodStart"] = Future(20); p["periodEnd"] = Future(23); p["schedule"] = AllDays();
        var id = await Create(c, p, parent);
        var sessions = await Sessions(c, id);
        Assert.Equal(4, sessions.Count);
        var dates = sessions.Select(s => s!["date"]!.GetValue<string>()[..10]).Order().ToArray();
        Assert.Equal(Future(19), dates.First());
        Assert.Equal(Future(22), dates.Last());
    }

    [Fact]
    public async Task Same_group_overlapping_manual_sessions_are_accepted()
    {
        var (c, b) = await Setup(); var id = await Create(c, Payload(b));
        foreach (var slot in new[] { ("09:00", "10:00"), ("09:30", "10:30") })
            await Read(await c.PostAsJsonAsync($"/api/v1/{Module}/sessions", new { facilityId = b.FacilityId, groupId = id, date = Future(10), startTime = slot.Item1, endTime = slot.Item2 }));
        Assert.Equal(2, (await Sessions(c, id)).Count);
    }

    [Fact]
    public async Task Manual_session_before_period_start_is_accepted()
    {
        var (c, b) = await Setup(); var p = Payload(b);
        p["periodStart"] = Future(20); p["periodEnd"] = Future(30); var id = await Create(c, p);
        await Read(await c.PostAsJsonAsync($"/api/v1/{Module}/sessions", new { facilityId = b.FacilityId, groupId = id, date = Future(10), startTime = "09:00", endTime = "10:00" }));
        Assert.Single(await Sessions(c, id));
    }

    [Fact]
    public async Task Reversed_period_is_persisted()
    {
        var (c, b) = await Setup(); var p = Payload(b);
        p["periodStart"] = Future(30); p["periodEnd"] = Future(20); var id = await Create(c, p);
        var saved = await Read(await c.GetAsync($"/api/v1/{Module}/groups/{id}"));
        Assert.True(DateTimeOffset.Parse(saved["periodEnd"]!.GetValue<string>()) < DateTimeOffset.Parse(saved["periodStart"]!.GetValue<string>()));
    }

    [Fact]
    public async Task Zero_age_bounds_from_blank_UI_are_accepted()
    {
        var (c, b) = await Setup(); var parent = await Create(c, Payload(b)); var p = Payload(b);
        p["ageMin"] = 0; p["ageMax"] = 0;
        var id = await Create(c, p, parent);
        var saved = await Read(await c.GetAsync($"/api/v1/{Module}/groups/{id}"));
        Assert.Equal(0, saved["ageMin"]!.GetValue<int>()); Assert.Equal(0, saved["ageMax"]!.GetValue<int>());
    }

    [Fact]
    public async Task Capacity_above_facility_is_rejected()
    {
        var (c, b) = await Setup(); var p = Payload(b); p["capacity"] = 101;
        var response = await c.PostAsJsonAsync($"/api/v1/{Module}/groups", p);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("CAPACITY_EXCEEDS_FACILITY", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Invalid_age_schedule_and_fee_are_rejected_by_API()
    {
        var (c, b) = await Setup();
        foreach (var kind in new[] { "age", "schedule", "fee" })
        {
            var p = Payload(b);
            if (kind == "age") { p["ageMin"] = 30; p["ageMax"] = 10; }
            if (kind == "schedule") p["schedule"] = new JsonArray(new JsonObject { ["day"] = "monday", ["startTime"] = "11:00", ["endTime"] = "10:00" });
            if (kind == "fee") p["fee"] = new JsonObject { ["isPaid"] = true, ["amount"] = 0, ["feeType"] = "monthly" };
            var response = await c.PostAsJsonAsync($"/api/v1/{Module}/groups", p);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }
    [Fact]
    public async Task Copy_parent_does_not_copy_its_child_sessions()
    {
        var (c, b) = await Setup(); var parent = await Create(c, Payload(b));
        await Create(c, Payload(b), parent);
        var target = await FacilityScenario.CreateBaseAsync(c, Module, $"target-{Guid.NewGuid():N}");
        var result = await Read(await c.PostAsJsonAsync($"/api/v1/{Module}/groups/{parent}/copy", new { targetFacilityIds = new[] { target.FacilityId } }));
        var item = result["results"]!.AsArray().Single()!;
        Assert.True(item["success"]!.GetValue<bool>());
        var copy = await Read(await c.GetAsync($"/api/v1/{Module}/groups/{item["groupId"]!.GetValue<string>()}"));
        Assert.False(copy["isActive"]!.GetValue<bool>());
        Assert.Equal(0, copy["subGroupCount"]!.GetValue<int>());
    }

    [Fact]
    public async Task Duplicate_branch_name_is_rejected()
    {
        var (c, b) = await Setup();
        var name = $"Duplicate audit {Guid.NewGuid():N}";
        await Read(await c.PostAsJsonAsync($"/api/v1/{Module}/branches", new { name, isActive = true }));
        var response = await c.PostAsJsonAsync($"/api/v1/{Module}/branches", new { name, isActive = true });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("DUPLICATE_BRANCH", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Other_group_overlap_in_same_facility_is_rejected()
    {
        var (c, b) = await Setup(); var first = await Create(c, Payload(b)); var second = await Create(c, Payload(b));
        await Read(await c.PostAsJsonAsync($"/api/v1/{Module}/sessions", new { facilityId = b.FacilityId, groupId = first, date = Future(10), startTime = "09:00", endTime = "10:00" }));
        var response = await c.PostAsJsonAsync($"/api/v1/{Module}/sessions", new { facilityId = b.FacilityId, groupId = second, date = Future(10), startTime = "09:30", endTime = "10:30" });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("SESSION_FACILITY_CONFLICT", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Past_date_and_reversed_time_manual_sessions_are_rejected()
    {
        var (c, b) = await Setup(); var id = await Create(c, Payload(b));
        foreach (var input in new[] { (Future(-2), "09:00", "10:00"), (Future(10), "11:00", "10:00") })
        {
            var response = await c.PostAsJsonAsync($"/api/v1/{Module}/sessions", new { facilityId = b.FacilityId, groupId = id, date = input.Item1, startTime = input.Item2, endTime = input.Item3 });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }

    [Fact]
    public async Task Paid_group_fields_survive_create_and_update()
    {
        var (c, b) = await Setup(); var p = Payload(b);
        p["fee"] = new JsonObject { ["isPaid"] = true, ["amount"] = 125, ["feeType"] = "monthly", ["siblingDiscount"] = true };
        p["description"] = "audit description"; p["residencyMode"] = "outside_only";
        var id = await Create(c, p);
        p["name"] = "Updated audit"; p["capacity"] = 30;
        await Read(await c.PutAsJsonAsync($"/api/v1/{Module}/groups/{id}", p));
        var saved = await Read(await c.GetAsync($"/api/v1/{Module}/groups/{id}"));
        Assert.Equal("Updated audit", saved["name"]!.GetValue<string>());
        Assert.Equal(30, saved["capacity"]!.GetValue<int>());
        Assert.Equal("outside_only", saved["residencyMode"]!.GetValue<string>());
        Assert.Equal(125, saved["fee"]!["amount"]!.GetValue<int>());
    }
}
