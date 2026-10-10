using System.Net.Http.Json;
using System.Text.Json;

namespace Nexora.Api.IntegrationTests.Facilities;

// Task 7 (Ruling B): every scenario seeds a real Facility -> Branch -> Group through the REAL
// public admin API (POST /{module}/facilities, /branches, /groups) against the real hosted API
// and real PostgreSQL, not by reaching into EF/DbContext directly. This helper is the single
// creation path both matrix test files (Application and Attendance) build on, so the shared rule
// chain is exercised identically regardless of which test file drives it.
//
// Facility/Branch are created ONCE per module (CreateBaseAsync) and reused across many Group
// creations (CreateGroupAsync) within the same test run — the thing that actually varies per
// scenario (capacity, gender, age range, application window, documents, schedule...) is the
// Group, so re-creating the Facility/Branch per case would be pure real-HTTP overhead with no
// coverage benefit.
internal static class FacilityScenario
{
    public sealed record ScheduleSlot(string Day, string StartTime, string EndTime);

    public sealed record Base(Guid ServiceFacilityId, Guid FacilityId, Guid BranchId, string Module);

    public sealed record GroupOptions
    {
        public string Gender { get; init; } = "mixed";
        public string Type { get; init; } = "kurs";
        public int Capacity { get; init; } = 20;
        public int ReserveCapacity { get; init; } = 5;
        public int AgeMin { get; init; }
        public int AgeMax { get; init; }
        public DateTime? ApplicationStartDate { get; init; }
        public DateTime? ApplicationEndDate { get; init; }
        public DateTime? PeriodStart { get; init; }
        public DateTime? PeriodEnd { get; init; }
        public bool AutoApprove { get; init; } = true;
        public bool LateTrackingEnabled { get; init; } = true;
        public int EntryGraceMinutes { get; init; }
        public string ResidencyMode { get; init; } = "anyone";
        public List<ScheduleSlot>? Schedule { get; init; }
        public string PeriodType { get; init; } = "date_range";
        public int PeriodMonths { get; init; } = 3;
        public bool AttendanceLimitOverride { get; init; }
        public string AttendanceLimitType { get; init; } = "unlimited";
        public int AttendanceLimitCount { get; init; }
    }

    // Real, checksum-free TCKN generator matching the real validator applied to facility
    // application create (CreateFacilityApplicationRequestValidator.Tckn: NotEmpty + Length(11),
    // no checksum-digit check on this specific endpoint — confirmed by reading the validator
    // before relying on this) so RED/GREEN cases never collide on TCKN across parallel cases.
    public static string NewTckn(Random random)
    {
        var digits = new char[11];
        digits[0] = (char)('1' + random.Next(9));
        for (var i = 1; i < 11; i++) digits[i] = (char)('0' + random.Next(10));
        return new string(digits);
    }

    public static async Task<Base> CreateBaseAsync(HttpClient adminClient, string module, string tag, CancellationToken ct = default)
    {
        var sfPayload = new
        {
            name = $"T7 {module} SF {tag}",
            type = module,
            locationType = "Indoor",
            city = "İstanbul",
            district = "Sultangazi",
            address = "Test Mah. No:1",
            // ServiceFacility validator koordinatları zorunlu kılıyor ("Tesisin geçerli
            // enlem ve boylam koordinatlarını giriniz") — bu alanlar eklenmeden önce
            // fixture her modülde 400 ile düşüyordu (test drift, 2026-09-23 gerçek
            // entegrasyon koşusunda tespit edildi). Sultangazi merkez koordinatları.
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
        var sfResponse = await adminClient.PostAsJsonAsync("/api/v1/service-facilities", sfPayload, ct);
        var sfId = await ExtractIdAsync(sfResponse, "service-facilities", ct);

        var facPayload = new
        {
            name = $"T7 {module} Tesis {tag}",
            kind = "indoor",
            serviceFacilityId = sfId,
            capacity = 100,
            isActive = true,
            grantAccess = false,
        };
        var facResponse = await adminClient.PostAsJsonAsync($"/api/v1/{module}/facilities", facPayload, ct);
        var facId = await ExtractIdAsync(facResponse, $"{module}/facilities", ct);

        var brPayload = new
        {
            name = $"T7 {module} Program {tag}",
            description = "task7",
            periodMonths = 3,
            absenceLimit = 5,
            consecutiveAbsenceLimit = 3,
            isActive = true,
        };
        var brResponse = await adminClient.PostAsJsonAsync($"/api/v1/{module}/branches", brPayload, ct);
        var brId = await ExtractIdAsync(brResponse, $"{module}/branches", ct);

        return new Base(sfId, facId, brId, module);
    }

    public static async Task<Guid> CreateGroupAsync(HttpClient adminClient, Base b, string tag, GroupOptions? options = null, CancellationToken ct = default)
    {
        options ??= new GroupOptions();
        var slots = options.Schedule ?? [new ScheduleSlot("monday", "09:00", "10:00")];

        var grpPayload = new
        {
            facilityId = b.FacilityId,
            branchId = b.BranchId,
            parentGroupId = (Guid?)null,
            name = $"T7 {b.Module} Grup {tag} {Guid.NewGuid():N}",
            description = "task7",
            type = options.Type,
            gender = options.Gender,
            capacity = options.Capacity,
            reserveCapacity = options.ReserveCapacity,
            ageMin = options.AgeMin,
            ageMax = options.AgeMax,
            schedule = slots.Select(s => new { day = s.Day, startTime = s.StartTime, endTime = s.EndTime }).ToList(),
            attendanceMode = "full",
            fee = new { isPaid = false, feeType = "monthly", amount = 0 },
            conditions = new { },
            periodStart = options.PeriodStart,
            periodEnd = options.PeriodEnd,
            periodMonths = options.PeriodMonths,
            periodType = options.PeriodType,
            periodCount = 1,
            applicationStartDate = options.ApplicationStartDate,
            applicationEndDate = options.ApplicationEndDate,
            academyWhitelistEnabled = false,
            absenceLimit = 5,
            consecutiveAbsenceLimit = 3,
            entryGraceMinutes = options.EntryGraceMinutes,
            instructorId = (Guid?)null,
            isActive = true,
            autoApprove = options.AutoApprove,
            attendanceLimitOverride = false,
            attendanceLimitType = "unlimited",
            attendanceLimitCount = 0,
            residencyMode = options.ResidencyMode,
            lateTrackingEnabled = options.LateTrackingEnabled,
        };
        var grpResponse = await adminClient.PostAsJsonAsync($"/api/v1/{b.Module}/groups", grpPayload, ct);
        return await ExtractIdAsync(grpResponse, $"{b.Module}/groups", ct);
    }

    // CreateFacilityGroupRequestValidator forbids a PAST PeriodStart/ApplicationStartDate on
    // create (GreaterThanOrEqualTo(TurkeyTime.TodayStartUtc())) — by design, an admin cannot
    // originally schedule a program that already started in the past. But
    // UpdateFacilityGroupRequestValidator has NO such restriction (mirrors the real admin panel
    // workflow: a group that legitimately ran its course and whose period/window has since
    // elapsed). To exercise real APPLICATION_CLOSED / PERIOD_ENDED rejections without ever
    // hand-writing a fixed calendar date literal (Global Constraint), this creates the group with
    // valid future dates first, then PUTs it back with the SAME real dates shifted into the past
    // relative to DateTime.UtcNow at call time — the real "backdate an existing program" admin
    // workflow, not a database bypass.
    public static async Task BackdateAsync(HttpClient adminClient, Base b, Guid groupId, DateTime? applicationStartDate, DateTime? applicationEndDate, DateTime? periodStart, DateTime? periodEnd, CancellationToken ct = default)
    {
        var getResponse = await adminClient.GetAsync($"/api/v1/{b.Module}/groups/{groupId}", ct);
        var getBody = await getResponse.Content.ReadAsStringAsync(ct);
        if (!getResponse.IsSuccessStatusCode)
            throw new InvalidOperationException($"group fetch before backdate failed: {(int)getResponse.StatusCode} {getBody}");
        using var doc = JsonDocument.Parse(getBody);
        var g = doc.RootElement.GetProperty("data");

        var putPayload = new
        {
            facilityId = b.FacilityId,
            branchId = b.BranchId,
            parentGroupId = (Guid?)null,
            name = g.GetProperty("name").GetString(),
            description = g.TryGetProperty("description", out var d) && d.ValueKind == JsonValueKind.String ? d.GetString() : "task7",
            type = g.GetProperty("type").GetString(),
            gender = g.GetProperty("gender").GetString(),
            capacity = g.GetProperty("capacity").GetInt32(),
            reserveCapacity = g.GetProperty("reserveCapacity").GetInt32(),
            ageMin = g.GetProperty("ageMin").GetInt32(),
            ageMax = g.GetProperty("ageMax").GetInt32(),
            schedule = g.GetProperty("schedule"),
            attendanceMode = g.GetProperty("attendanceMode").GetString(),
            fee = g.GetProperty("fee"),
            conditions = g.GetProperty("conditions"),
            periodStart,
            periodEnd,
            periodMonths = g.GetProperty("periodMonths").GetInt32(),
            periodType = g.GetProperty("periodType").GetString(),
            periodCount = g.GetProperty("periodCount").GetInt32(),
            applicationStartDate,
            applicationEndDate,
            academyWhitelistEnabled = g.GetProperty("academyWhitelistEnabled").GetBoolean(),
            absenceLimit = g.GetProperty("absenceLimit").GetInt32(),
            consecutiveAbsenceLimit = g.GetProperty("consecutiveAbsenceLimit").GetInt32(),
            entryGraceMinutes = g.GetProperty("entryGraceMinutes").GetInt32(),
            instructorId = (Guid?)null,
            isActive = g.GetProperty("isActive").GetBoolean(),
            autoApprove = g.GetProperty("autoApprove").GetBoolean(),
            attendanceLimitOverride = g.GetProperty("attendanceLimitOverride").GetBoolean(),
            attendanceLimitType = g.GetProperty("attendanceLimitType").GetString(),
            attendanceLimitCount = g.GetProperty("attendanceLimitCount").GetInt32(),
            periodUnit = g.GetProperty("periodUnit").GetString(),
            periodDays = g.GetProperty("periodDays").GetInt32(),
            residencyMode = g.GetProperty("residencyMode").GetString(),
            lateTrackingEnabled = g.GetProperty("lateTrackingEnabled").GetBoolean(),
        };

        var putResponse = await adminClient.PutAsJsonAsync($"/api/v1/{b.Module}/groups/{groupId}", putPayload, ct);
        var putBody = await putResponse.Content.ReadAsStringAsync(ct);
        if (!putResponse.IsSuccessStatusCode)
            throw new InvalidOperationException($"group backdate PUT failed: {(int)putResponse.StatusCode} {putBody}");
    }

    private static async Task<Guid> ExtractIdAsync(HttpResponseMessage response, string label, CancellationToken ct)
    {
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"{label} create failed: {(int)response.StatusCode} {body}");
        using var doc = JsonDocument.Parse(body);
        var data = doc.RootElement.GetProperty("data");
        if (data.ValueKind == JsonValueKind.String) return Guid.Parse(data.GetString()!);
        return data.GetProperty("id").GetGuid();
    }

    public static async Task CleanupAsync(HttpClient adminClient, Base b, CancellationToken ct = default)
    {
        await adminClient.DeleteAsync($"/api/v1/{b.Module}/facilities/{b.FacilityId}", ct);
        await adminClient.DeleteAsync($"/api/v1/service-facilities/{b.ServiceFacilityId}", ct);
    }
}
