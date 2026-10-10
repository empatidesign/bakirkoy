using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Application.Features.Facilities;
using Xunit;

namespace Nexora.Api.IntegrationTests.Facilities;

// Task 7 (Ruling A): ONE parametrized Theory over the 8 real FacilityModuleRegistry module keys,
// exercising the shared rule chain that FacilityModuleEndpoints.MapFacilityModuleEndpoints /
// FacilityApplicationService.CreateAsync+ApproveAsync run identically for every module, against
// the real hosted API + real PostgreSQL. Module-specific assertions (documents) are layered in
// only where FacilityModuleRegistry.Rules genuinely differs (accessible-life).
[Collection(ApiCollection.Name)]
public sealed class FacilityModuleApplicationMatrixTests : IAsyncLifetime
{
    private readonly NexoraApiFactory _factory;
    private HttpClient _admin = null!;
    private readonly Random _random = new();

    public FacilityModuleApplicationMatrixTests(ApiTestHost host) => _factory = host.Factory;

    public async Task InitializeAsync()
        => _admin = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t7-app-{Guid.NewGuid():N}@nexora.local"));

    public Task DisposeAsync() => Task.CompletedTask;

    public static IEnumerable<object[]> ModuleKeys => FacilityModuleRegistry.All.Select(m => new object[] { m });

    private sealed record Envelope(bool Success, int StatusCode, string? Message, string? ErrorCode, JsonElement Data);

    private static async Task<Envelope> ReadAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        var doc = JsonSerializer.Deserialize<JsonElement>(body, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return new Envelope(
            doc.GetProperty("success").GetBoolean(),
            doc.GetProperty("statusCode").GetInt32(),
            doc.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null,
            doc.TryGetProperty("errorCode", out var e) && e.ValueKind == JsonValueKind.String ? e.GetString() : null,
            doc.TryGetProperty("data", out var d) ? d : default);
    }

    private async Task<FacilityScenario.Base> BaseFor(string module)
        => await FacilityScenario.CreateBaseAsync(_admin, module, $"am{Guid.NewGuid():N}"[..12]);

    private async Task<HttpResponseMessage> ApplyAsync(string module, object payload)
        => await _admin.PostAsJsonAsync($"/api/v1/{module}/applications", payload);

    private object ApplicationPayload(FacilityScenario.Base b, Guid groupId, string tckn, string? gender = null, Guid? participantId = null, object? documents = null, string? guardianPhone = null, DateTime? birthDate = null)
        => new
        {
            facilityId = b.FacilityId,
            branchId = b.BranchId,
            groupId,
            participantId,
            fullName = $"T7 Test Kişi {tckn[..4]}",
            tckn,
            phone = "5" + tckn[..9],
            email = (string?)null,
            birthDate,
            guardianPhone,
            // Default: the real required documents for accessible-life (the only module with a
            // FacilityModuleRegistry.Rules entry), empty array elsewhere. Shared Theory cases
            // that are not specifically about the document rule must not incidentally fail on
            // accessible-life's DOCUMENTS_REQUIRED just because they used a generic payload —
            // the document rule itself is exercised separately by the dedicated
            // Accessible_life_* facts below.
            documents = documents ?? (b.Module == "accessible-life"
                ? new object[]
                {
                    new { type = "disability_report", objectName = "disability.pdf" },
                    new { type = "health_report", objectName = "health.pdf" },
                }
                : Array.Empty<object>()),
            gender,
        };

    // ---- Step 1: shared rule chain across all 8 modules -------------------------------------

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Application_to_open_group_within_capacity_is_approved_or_pending(string module)
    {
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "cap", new FacilityScenario.GroupOptions { AutoApprove = true });
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn));
            var body = await ReadAsync(response);

            response.StatusCode.Should().Be(HttpStatusCode.Created, $"[{module}] real capacity is available so the application must be accepted: {body.Message}");
            body.Data.GetProperty("status").GetString().Should().BeOneOf("approved", "pending");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Application_outside_age_range_is_rejected_with_AGE_NOT_ELIGIBLE(string module)
    {
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "age", new FacilityScenario.GroupOptions { AgeMin = 7, AgeMax = 14 });
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn, birthDate: DateTime.UtcNow.AddYears(-40)));
            var body = await ReadAsync(response);

            ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400, $"[{module}]");
            body.ErrorCode.Should().Be("AGE_NOT_ELIGIBLE");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Application_wrong_gender_is_rejected_with_GENDER_NOT_ELIGIBLE(string module)
    {
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "gen", new FacilityScenario.GroupOptions { Gender = "female" });
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn, gender: "male"));
            var body = await ReadAsync(response);

            ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400, $"[{module}]");
            body.ErrorCode.Should().Be("GENDER_NOT_ELIGIBLE");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Duplicate_application_to_same_group_is_rejected_with_ALREADY_APPLIED(string module)
    {
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "dup");
            var tckn = FacilityScenario.NewTckn(_random);

            var first = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn));
            first.IsSuccessStatusCode.Should().BeTrue($"[{module}] first application should succeed");

            var second = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn));
            var body = await ReadAsync(second);

            ((int)second.StatusCode).Should().BeGreaterThanOrEqualTo(400, $"[{module}]");
            body.ErrorCode.Should().Be("ALREADY_APPLIED");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Application_before_window_opens_is_rejected_with_APPLICATION_NOT_OPEN(string module)
    {
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "win", new FacilityScenario.GroupOptions
            {
                ApplicationStartDate = DateTime.UtcNow.AddDays(5),
                ApplicationEndDate = DateTime.UtcNow.AddDays(30),
            });
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn));
            var body = await ReadAsync(response);

            ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400, $"[{module}]");
            body.ErrorCode.Should().Be("APPLICATION_NOT_OPEN");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Application_after_window_closes_is_rejected_with_APPLICATION_CLOSED(string module)
    {
        var b = await BaseFor(module);
        try
        {
            // Group must be creatable (CreateFacilityGroupRequestValidator forbids past
            // ApplicationStartDate on create), so it is created with a valid future window then
            // backdated via the real PUT /groups/{id} admin workflow (see
            // FacilityScenario.BackdateAsync) so both dates land in the past relative to
            // DateTime.UtcNow at run time (Ruling E — never a fixed calendar literal).
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "closed", new FacilityScenario.GroupOptions
            {
                ApplicationStartDate = DateTime.UtcNow.AddDays(1),
                ApplicationEndDate = DateTime.UtcNow.AddDays(5),
            });
            await FacilityScenario.BackdateAsync(_admin, b, groupId,
                applicationStartDate: DateTime.UtcNow.AddDays(-20),
                applicationEndDate: DateTime.UtcNow.AddDays(-10),
                periodStart: null, periodEnd: null);
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn));
            var body = await ReadAsync(response);

            ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400, $"[{module}]");
            body.ErrorCode.Should().Be("APPLICATION_CLOSED");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Full_capacity_group_puts_second_applicant_on_waitlist(string module)
    {
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "full", new FacilityScenario.GroupOptions
            {
                Capacity = 1,
                ReserveCapacity = 1,
                AutoApprove = true,
            });

            var first = await ApplyAsync(module, ApplicationPayload(b, groupId, FacilityScenario.NewTckn(_random)));
            var firstBody = await ReadAsync(first);
            firstBody.Data.GetProperty("status").GetString().Should().Be("approved", $"[{module}] first applicant fills the only main slot");

            var second = await ApplyAsync(module, ApplicationPayload(b, groupId, FacilityScenario.NewTckn(_random)));
            var secondBody = await ReadAsync(second);
            secondBody.Data.GetProperty("status").GetString().Should().Be("waitlist", $"[{module}] second applicant must land on the reserve list");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Full_capacity_and_full_reserve_is_rejected_with_QUOTA_FULL(string module)
    {
        var b = await BaseFor(module);
        try
        {
            // 2026-09-23 düzeltmesi öncesi ReserveCapacity=0 yanlışlıkla "sınırsız yedek"
            // sayılıyordu (bkz. FacilityRegistrationService.cs satır ~141) — QA madde 74'te
            // kanıtlanan canlı capacity-bypass bug'ı. Bu test gerçek pozitif bir
            // ReserveCapacity ile QUOTA_FULL'a ulaşmayı doğrular: Capacity=1/ReserveCapacity=1,
            // asıl koltuğu doldur, tek yedek koltuğu doldur, sonra ÜÇÜNCÜ başvuru gerçek
            // QUOTA_FULL korumasına çarpmalı.
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "quota", new FacilityScenario.GroupOptions
            {
                Capacity = 1,
                ReserveCapacity = 1,
                AutoApprove = true,
            });

            var first = await ApplyAsync(module, ApplicationPayload(b, groupId, FacilityScenario.NewTckn(_random)));
            first.IsSuccessStatusCode.Should().BeTrue($"[{module}]");

            var second = await ApplyAsync(module, ApplicationPayload(b, groupId, FacilityScenario.NewTckn(_random)));
            second.IsSuccessStatusCode.Should().BeTrue($"[{module}] second applicant fills the one reserve slot");

            var third = await ApplyAsync(module, ApplicationPayload(b, groupId, FacilityScenario.NewTckn(_random)));
            var body = await ReadAsync(third);

            ((int)third.StatusCode).Should().BeGreaterThanOrEqualTo(400, $"[{module}]");
            body.ErrorCode.Should().Be("QUOTA_FULL");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Full_capacity_with_zero_reserve_capacity_is_rejected_not_unlimited(string module)
    {
        // QA madde 74 regresyon testi (2026-09-23): ReserveCapacity=0 gerçek sıfırdır,
        // "sınırsız yedek" değildir. Asıl kontenjan (Capacity=1) dolduktan sonra
        // ReserveCapacity=0 olan bir grupta ikinci başvuru QUOTA_FULL ile reddedilmeli —
        // eskiden bu sonsuza dek "waitlist" statüsüyle kabul ediliyordu.
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "zeroreserve", new FacilityScenario.GroupOptions
            {
                Capacity = 1,
                ReserveCapacity = 0,
                AutoApprove = true,
            });

            var first = await ApplyAsync(module, ApplicationPayload(b, groupId, FacilityScenario.NewTckn(_random)));
            first.IsSuccessStatusCode.Should().BeTrue($"[{module}] first applicant fills the only main slot");

            var second = await ApplyAsync(module, ApplicationPayload(b, groupId, FacilityScenario.NewTckn(_random)));
            var secondBody = await ReadAsync(second);

            ((int)second.StatusCode).Should().BeGreaterThanOrEqualTo(400, $"[{module}] ReserveCapacity=0 must reject, not accept as unlimited waitlist");
            secondBody.ErrorCode.Should().Be("QUOTA_FULL");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    // ---- Module-specific document assertions (Ruling A: only where the rule genuinely differs) --

    [Fact]
    public async Task Accessible_life_application_missing_required_documents_is_rejected_with_DOCUMENTS_REQUIRED()
    {
        const string module = "accessible-life";
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "doc");
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn, documents: Array.Empty<object>()));
            var body = await ReadAsync(response);

            ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
            body.ErrorCode.Should().Be("DOCUMENTS_REQUIRED");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task Accessible_life_application_with_required_documents_is_accepted()
    {
        const string module = "accessible-life";
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "doc-ok");
            var tckn = FacilityScenario.NewTckn(_random);
            var documents = new object[]
            {
                new { type = "disability_report", objectName = "disability.pdf" },
                new { type = "health_report", objectName = "health.pdf" },
            };

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn, documents: documents));
            var body = await ReadAsync(response);

            response.StatusCode.Should().Be(HttpStatusCode.Created, $"required documents were provided: {body.Message}");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Modules_without_required_documents_accept_application_with_zero_documents(string module)
    {
        if (module == "accessible-life") return; // negative counterpart lives in the dedicated Accessible_life_* facts above.
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "nodoc");
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn, documents: Array.Empty<object>()));
            var body = await ReadAsync(response);

            response.StatusCode.Should().Be(HttpStatusCode.Created, $"[{module}] has no FacilityModuleRegistry.Rules entry so no document requirement should fire: {body.Message}");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    // ---- Step 2: boundary cases ---------------------------------------------------------------

    [Theory]
    [InlineData(0)]  // exactly the minimum eligible age
    [InlineData(1)]  // birthday is one day later than the exact-minimum mark -> still one day
                      // short of turning the minimum age today -> must be rejected
    public async Task Age_boundary_at_minimum_is_enforced_to_the_day(int dayOffsetFromMinBirthdate)
    {
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            const int ageMin = 10;
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "ageday", new FacilityScenario.GroupOptions { AgeMin = ageMin, AgeMax = 60 });

            // Birthdate exactly ageMin years ago (turns ageMin today, offset=0) vs one day
            // LATER than that mark (offset=1) — a birthdate one calendar day closer to today
            // means the applicant's ageMin-th birthday has not happened yet, so they are still
            // ageMin-1 today. Both computed relative to DateTime.UtcNow at run time (Ruling E),
            // never a fixed calendar date.
            var birthDate = DateTime.UtcNow.AddYears(-ageMin).AddDays(dayOffsetFromMinBirthdate);
            var tckn = FacilityScenario.NewTckn(_random);

            // A 10-year-old applicant is a minor: CreateFacilityApplicationRequestValidator
            // requires GuardianPhone whenever BirthDate implies age < 18, independent of the
            // AGE_NOT_ELIGIBLE business rule this case exercises.
            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn, birthDate: birthDate, guardianPhone: "5551234567"));
            var body = await ReadAsync(response);

            if (dayOffsetFromMinBirthdate == 0)
                response.IsSuccessStatusCode.Should().BeTrue($"exactly {ageMin} years old must be eligible: {body.Message}");
            else
            {
                ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400, "one day younger than the minimum must be rejected");
                body.ErrorCode.Should().Be("AGE_NOT_ELIGIBLE");
            }
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task ParticipantId_null_gender_restricted_group_with_matching_gender_is_accepted()
    {
        // Regression case REQUIRED by the brief (2026-08-05 live-tested bug): ParticipantId-null
        // (free-form TCKN/name) application against a gender-restricted group, matching gender.
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "gnull-match", new FacilityScenario.GroupOptions { Gender = "female" });
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn, gender: "female", participantId: null));
            var body = await ReadAsync(response);

            response.StatusCode.Should().Be(HttpStatusCode.Created, $"matching gender with ParticipantId null must be accepted: {body.Message}");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task ParticipantId_null_gender_restricted_group_with_mismatched_gender_is_rejected()
    {
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "gnull-mismatch", new FacilityScenario.GroupOptions { Gender = "female" });
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn, gender: "male", participantId: null));
            var body = await ReadAsync(response);

            ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
            body.ErrorCode.Should().Be("GENDER_NOT_ELIGIBLE");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task ParticipantId_null_gender_restricted_group_with_Gender_omitted_is_rejected()
    {
        // This is the EXACT documented production bug shape: ParticipantId null, group
        // gender-restricted, Gender omitted entirely. Old behavior: skipped the check completely
        // and accepted a male applicant into a girls-only group with no error. Real regression
        // test for the fix — REQUIRED per the brief, not optional.
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "gnull-omitted", new FacilityScenario.GroupOptions { Gender = "female" });
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn, gender: null, participantId: null));
            var body = await ReadAsync(response);

            ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400,
                "REGRESSION: Gender omitted with ParticipantId null against a gender-restricted group must be rejected, not silently accepted");
            body.ErrorCode.Should().Be("GENDER_NOT_ELIGIBLE");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task Application_opening_first_second_is_accepted()
    {
        // Real-clock-relative (Ruling E): applicationStartDate = "today" (UtcNow.Date), which the
        // real FacilityApplicationWindow.Check compares against TurkeyTime.TodayDate() — the
        // window is open the instant the start date's calendar day begins, never a fixed literal.
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "open-now", new FacilityScenario.GroupOptions
            {
                ApplicationStartDate = DateTime.UtcNow.Date,
                ApplicationEndDate = DateTime.UtcNow.Date.AddDays(30),
            });
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn));
            var body = await ReadAsync(response);

            response.StatusCode.Should().Be(HttpStatusCode.Created, $"application window opened today: {body.Message}");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task Application_on_closing_day_is_still_accepted_until_end_of_day()
    {
        // Real-clock-relative (Ruling E): applicationEndDate = "today" — FacilityApplicationWindow
        // treats the entire end-date calendar day as still open (Date comparison, not time-of-day),
        // so an application submitted "now" on the closing day must still be accepted.
        // ApplicationStartDate is left null (no restriction) since
        // CreateFacilityGroupRequestValidator forbids a past start date on create; the window
        // check only needs the end date to be "today" to exercise this boundary.
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "closing-today", new FacilityScenario.GroupOptions
            {
                ApplicationStartDate = null,
                ApplicationEndDate = DateTime.UtcNow.Date,
            });
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn));
            var body = await ReadAsync(response);

            response.StatusCode.Should().Be(HttpStatusCode.Created, $"still within the closing calendar day: {body.Message}");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task Application_to_group_with_ended_period_is_rejected_with_PERIOD_ENDED()
    {
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            // See Application_after_window_closes_is_rejected_with_APPLICATION_CLOSED: create
            // with a valid future period, then backdate via the real PUT workflow.
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "period-ended", new FacilityScenario.GroupOptions
            {
                PeriodStart = DateTime.UtcNow.AddDays(1),
                PeriodEnd = DateTime.UtcNow.AddDays(30),
                ApplicationStartDate = null,
                ApplicationEndDate = null,
            });
            await FacilityScenario.BackdateAsync(_admin, b, groupId,
                applicationStartDate: null, applicationEndDate: null,
                periodStart: DateTime.UtcNow.AddDays(-40),
                periodEnd: DateTime.UtcNow.AddDays(-1));
            var tckn = FacilityScenario.NewTckn(_random);

            var response = await ApplyAsync(module, ApplicationPayload(b, groupId, tckn));
            var body = await ReadAsync(response);

            ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
            body.ErrorCode.Should().Be("PERIOD_ENDED");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task Same_day_same_time_overlap_across_different_groups_is_rejected_with_SAME_DAY_CONFLICT()
    {
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            var sharedSlots = new List<FacilityScenario.ScheduleSlot> { new("monday", "09:00", "10:00") };
            var groupA = await FacilityScenario.CreateGroupAsync(_admin, b, "overlap-a", new FacilityScenario.GroupOptions
            {
                Schedule = sharedSlots,
                PeriodStart = DateTime.UtcNow.AddDays(1),
                PeriodEnd = DateTime.UtcNow.AddDays(90),
                AutoApprove = true,
            });
            var groupB = await FacilityScenario.CreateGroupAsync(_admin, b, "overlap-b", new FacilityScenario.GroupOptions
            {
                Schedule = sharedSlots,
                PeriodStart = DateTime.UtcNow.AddDays(1),
                PeriodEnd = DateTime.UtcNow.AddDays(90),
                AutoApprove = true,
            });
            var tckn = FacilityScenario.NewTckn(_random);

            var first = await ApplyAsync(module, ApplicationPayload(b, groupA, tckn));
            first.IsSuccessStatusCode.Should().BeTrue();

            var second = await ApplyAsync(module, ApplicationPayload(b, groupB, tckn));
            var body = await ReadAsync(second);

            // The real conflict is enforced inside FacilityRegistrationService.RegisterAsync at
            // real-registration time; with AutoApprove=true the application create path calls
            // ApproveAsync -> RegisterAsync synchronously, so the same-day conflict surfaces as
            // the application create response itself.
            ((int)second.StatusCode).Should().BeGreaterThanOrEqualTo(400);
            body.ErrorCode.Should().Be("SAME_DAY_CONFLICT");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task Same_day_different_time_across_different_groups_does_not_conflict()
    {
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            var groupA = await FacilityScenario.CreateGroupAsync(_admin, b, "diff-time-a", new FacilityScenario.GroupOptions
            {
                Schedule = [new("monday", "09:00", "10:00")],
                PeriodStart = DateTime.UtcNow.AddDays(1),
                PeriodEnd = DateTime.UtcNow.AddDays(90),
                AutoApprove = true,
            });
            var groupB = await FacilityScenario.CreateGroupAsync(_admin, b, "diff-time-b", new FacilityScenario.GroupOptions
            {
                Schedule = [new("monday", "18:00", "19:00")],
                PeriodStart = DateTime.UtcNow.AddDays(1),
                PeriodEnd = DateTime.UtcNow.AddDays(90),
                AutoApprove = true,
            });
            var tckn = FacilityScenario.NewTckn(_random);

            var first = await ApplyAsync(module, ApplicationPayload(b, groupA, tckn));
            first.IsSuccessStatusCode.Should().BeTrue();

            var second = await ApplyAsync(module, ApplicationPayload(b, groupB, tckn));
            second.IsSuccessStatusCode.Should().BeTrue("different times on the same day physically do not conflict");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    // ---- Step 3: transition and concurrency cases ----------------------------------------------

    [Fact]
    public async Task Approve_reject_waitlist_promote_demote_status_lifecycle_is_consistent()
    {
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            // ReserveCapacity=3 (not 1) so that after the demote+promote steps below fill the
            // group back to capacity=1/reserve=1, there is still real headroom left for the
            // final reject-target application to be created without hitting the real QUOTA_FULL
            // guard in FacilityApplicationService.CreateAsync — this test drives the transition
            // surface (pending/approved/waitlist/rejected/promoted/demoted), not the capacity
            // boundary itself (that is covered separately above).
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "lifecycle", new FacilityScenario.GroupOptions
            {
                Capacity = 1,
                ReserveCapacity = 3,
                AutoApprove = false,
            });

            var mainTckn = FacilityScenario.NewTckn(_random);
            var mainApp = await ApplyAsync(module, ApplicationPayload(b, groupId, mainTckn));
            var mainBody = await ReadAsync(mainApp);
            mainBody.Data.GetProperty("status").GetString().Should().Be("pending");
            var mainAppId = mainBody.Data.GetProperty("id").GetGuid();

            var approveRes = await _admin.PostAsJsonAsync($"/api/v1/{module}/applications/{mainAppId}/approve", new { });
            var approveBody = await ReadAsync(approveRes);
            approveBody.Data.GetProperty("status").GetString().Should().Be("approved");

            var reserveTckn = FacilityScenario.NewTckn(_random);
            var reserveApp = await ApplyAsync(module, ApplicationPayload(b, groupId, reserveTckn));
            var reserveBody = await ReadAsync(reserveApp);
            // Unlike the first applicant, the main slot is already taken by the time this create
            // runs (registeredCount >= Capacity in FacilityApplicationService.CreateAsync), so the
            // real create path itself returns status="waitlist" directly — there is no separate
            // pending->approve step to drive here (a real registration was already opened as
            // Kind=reserve inside CreateAsync's own waitlist branch).
            reserveBody.Data.GetProperty("status").GetString().Should().Be("waitlist", "capacity is already full so the create itself must land on the reserve list");

            // Roster to get real registration ids for promote/demote.
            var roster = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/registrations/roster?groupId={groupId}");
            var rosterItems = roster.GetProperty("data").EnumerateArray().ToList();
            var mainRegId = rosterItems.First(r => r.GetProperty("tckn").GetString() == mainTckn).GetProperty("id").GetGuid();

            var demote = await _admin.PostAsJsonAsync($"/api/v1/{module}/registrations/{mainRegId}/demote", new { });
            demote.IsSuccessStatusCode.Should().BeTrue();

            var waitlist = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/registrations/waitlist?groupId={groupId}");
            var waitlistItems = waitlist.GetProperty("data").EnumerateArray().ToList();
            var reserveRegId = waitlistItems.First(r => r.GetProperty("tckn").GetString() == reserveTckn).GetProperty("id").GetGuid();

            var promote = await _admin.PostAsJsonAsync($"/api/v1/{module}/registrations/{reserveRegId}/promote", new { });
            promote.IsSuccessStatusCode.Should().BeTrue();

            var rejectTckn = FacilityScenario.NewTckn(_random);
            var rejectAppRes = await ApplyAsync(module, ApplicationPayload(b, groupId, rejectTckn));
            var rejectAppBody = await ReadAsync(rejectAppRes);
            rejectAppRes.IsSuccessStatusCode.Should().BeTrue($"reserve headroom remains: {rejectAppBody.Message}");
            var rejectAppId = rejectAppBody.Data.GetProperty("id").GetGuid();
            var reject = await _admin.PostAsJsonAsync($"/api/v1/{module}/applications/{rejectAppId}/reject?reason=test", new { });
            var rejectBody = await ReadAsync(reject);
            rejectBody.Data.GetProperty("status").GetString().Should().Be("rejected");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task Concurrent_applications_for_the_final_capacity_slot_grant_exactly_one_main_slot()
    {
        // Ruling D: a REAL concurrent race against real Postgres. Capacity=1/ReserveCapacity=1
        // (sharp boundary), two real concurrent POST /applications calls via Task.WhenAll, not
        // sequential awaits. The real DB-level guarantee that prevents double-booking is a
        // Postgres session-level transaction advisory lock taken per-group
        // (pg_advisory_xact_lock, IUnitOfWork.AcquireAdvisoryLockAsync, keyed by
        // FacilityRegistrationService.GroupLockKey(groupId)) inside RegisterCoreAsync, which
        // serializes concurrent RegisterAsync calls for the SAME group so the
        // count-then-insert capacity decision can never race.
        const string module = "sports";
        var b = await BaseFor(module);
        try
        {
            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "race", new FacilityScenario.GroupOptions
            {
                Capacity = 1,
                ReserveCapacity = 1,
                AutoApprove = true,
            });

            var tcknA = FacilityScenario.NewTckn(_random);
            var tcknB = FacilityScenario.NewTckn(_random);

            var taskA = ApplyAsync(module, ApplicationPayload(b, groupId, tcknA));
            var taskB = ApplyAsync(module, ApplicationPayload(b, groupId, tcknB));
            var responses = await Task.WhenAll(taskA, taskB);

            var bodies = await Task.WhenAll(responses.Select(ReadAsync));
            var statuses = bodies.Select(x => x.Data.GetProperty("status").GetString()).ToList();

            statuses.Should().Contain("approved").And.HaveCount(2);
            statuses.Count(s => s == "approved").Should().Be(1, "exactly one of the two real concurrent applications must win the single main slot");
            statuses.Count(s => s == "waitlist").Should().Be(1, "the other concurrent application must land on the reserve list, not be silently dropped or double-approved");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }
}
