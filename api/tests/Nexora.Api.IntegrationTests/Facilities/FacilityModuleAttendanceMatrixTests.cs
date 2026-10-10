using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Application.Features.Facilities;
using Xunit;

namespace Nexora.Api.IntegrationTests.Facilities;

// Task 7 (Ruling A/F): ONE parametrized Theory over the 8 real FacilityModuleRegistry module keys
// for the attendance rule chain (manual/QR/static-QR/kiosk-device entry, CheckedInAt, late-status
// non-overwrite), against the real hosted API + real PostgreSQL.
[Collection(ApiCollection.Name)]
public sealed class FacilityModuleAttendanceMatrixTests : IAsyncLifetime
{
    // Redis-enabled host (Task 6's established pattern, NexoraApiFactory.CreateForCollectionWithRedis):
    // several real attendance code paths this class exercises (QR/static-QR check-in via
    // CitizenIdentityQrService, area-device check-in via FacilityDeviceService) take a constructor
    // dependency on IRedisService, which Infrastructure's DI only registers when
    // ConnectionStrings:Redis is non-empty. The Testing host's default Redis-disabled
    // ApiTestHost.Factory throws a DI InvalidOperationException (masked as a 500) before any of
    // those handlers run — a real finding hit while running this suite, not assumed up front.
    private NexoraApiFactory _redisHost = null!;
    private HttpClient _admin = null!;
    private readonly Random _random = new();

    public async Task InitializeAsync()
    {
        _redisHost = NexoraApiFactory.CreateForCollectionWithRedis();
        await _redisHost.InitializeAsync();
        _admin = await _redisHost.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t7-att-{Guid.NewGuid():N}@nexora.local"));
    }

    public async Task DisposeAsync() => await _redisHost.DisposeAsync();

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

    // Today's real weekday name in the schedule's day vocabulary (FacilityScheduleHelper.DayMap),
    // computed at run time (Ruling E) — a session/group scheduled for "today" must use today's
    // real weekday, never a hardcoded day literal.
    // The server's LocalNow() (Turkey UTC+3) day-of-week, not UtcNow's — matters near midnight UTC
    // where the two can disagree on which calendar day "today" is.
    private static string TodayDayName() => DateTime.UtcNow.AddMinutes(180).DayOfWeek switch
    {
        DayOfWeek.Monday => "monday",
        DayOfWeek.Tuesday => "tuesday",
        DayOfWeek.Wednesday => "wednesday",
        DayOfWeek.Thursday => "thursday",
        DayOfWeek.Friday => "friday",
        DayOfWeek.Saturday => "saturday",
        _ => "sunday",
    };

    private sealed record AttendanceScenario(FacilityScenario.Base Base, Guid GroupId, Guid RegistrationId, string Tckn, Guid SessionId, string StartTime, string EndTime);

    // Builds a real Group scheduled TODAY with a wide-enough session window
    // ([-2h now, +2h now]) that "now" always falls inside it regardless of what wall-clock time
    // this test happens to run at, a real manual Session for today via the real POST /sessions
    // endpoint, and a real active "main" Registration via POST /registrations (ParticipantId
    // null — free-form TCKN, exactly like the citizen-less admin manual-registration path).
    private async Task<AttendanceScenario> BuildAsync(string module, string tag, bool lateTrackingEnabled = true, int entryGraceMinutes = 5)
    {
        var b = await FacilityScenario.CreateBaseAsync(_admin, module, $"at{Guid.NewGuid():N}"[..12]);

        // FacilityAttendanceService.LocalNow() = DateTime.UtcNow + FacilitySettings:LocalTimeZoneOffsetMinutes
        // (default 180 = Turkey UTC+3), and the entry-window check compares session start/end
        // TIME-OF-DAY strings against that local wall clock — a real finding hit while running
        // this suite, not assumed. Computing startTime/endTime directly from DateTime.UtcNow (as
        // originally written) put the session ~3h outside its own claimed window from the
        // server's perspective. Use the same Turkey-local wall clock the server uses.
        var localNow = DateTime.UtcNow.AddMinutes(180);
        var now = DateTime.UtcNow;
        // Session window: started 1 minute ago (well within the default 0-minute
        // EntryGraceMinutes tolerance used by BuildAsync's callers below, so a check-in right now
        // computes "present" not "late" — FacilityAttendanceService.CheckInByFacilityAsync's real
        // entryStatus decision now genuinely flows into the HTTP response (previously masked by a
        // hardcoded "present" literal, a real bug fixed alongside this test), so tests asserting
        // "present" must construct a session that is REALLY still within its grace window, not
        // just within the wider open/close attendance window.
        var start = localNow.AddMinutes(-1);
        var end = localNow.AddHours(2);
        var startTime = $"{start.Hour:D2}:{start.Minute:D2}";
        var endTime = $"{end.Hour:D2}:{end.Minute:D2}";

        var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, tag, new FacilityScenario.GroupOptions
        {
            Schedule = [new(TodayDayName(), startTime, endTime)],
            PeriodStart = localNow.Date,
            PeriodEnd = localNow.Date.AddDays(90),
            AutoApprove = true,
            LateTrackingEnabled = lateTrackingEnabled,
            EntryGraceMinutes = entryGraceMinutes,
        });

        var sessionPayload = new
        {
            facilityId = b.FacilityId,
            groupId,
            date = localNow.Date.ToString("yyyy-MM-dd"),
            startTime,
            endTime,
        };
        var sessionResponse = await _admin.PostAsJsonAsync($"/api/v1/{module}/sessions", sessionPayload);
        var sessionBody = await ReadAsync(sessionResponse);
        sessionResponse.IsSuccessStatusCode.Should().BeTrue($"[{module}] manual session create must succeed: {sessionBody.Message}");
        var sessionId = sessionBody.Data.GetProperty("id").GetGuid();

        var tckn = FacilityScenario.NewTckn(_random);
        var regPayload = new
        {
            groupId,
            applicationId = (Guid?)null,
            participantId = (Guid?)null,
            fullName = $"T7 Attendance {tckn[..4]}",
            tckn,
            phone = "5" + tckn[..9],
            birthDate = (DateTime?)null,
            guardianPhone = (string?)null,
        };
        var regResponse = await _admin.PostAsJsonAsync($"/api/v1/{module}/registrations", regPayload);
        var regBody = await ReadAsync(regResponse);
        regResponse.IsSuccessStatusCode.Should().BeTrue($"[{module}] real registration create must succeed: {regBody.Message}");
        var registrationId = regBody.Data.GetProperty("id").GetGuid();

        return new AttendanceScenario(b, groupId, registrationId, tckn, sessionId, startTime, endTime);
    }

    // ---- Step 4: attendance cases across all 8 modules ------------------------------------------

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Manual_roster_save_sets_present_status_and_CheckedInAt(string module)
    {
        var s = await BuildAsync(module, "save");
        try
        {
            var savePayload = new { sessionId = s.SessionId, marks = new[] { new { registrationId = s.RegistrationId, status = "present" } }, confirm = false };
            var response = await _admin.PostAsJsonAsync($"/api/v1/{module}/attendance/save", savePayload);
            var body = await ReadAsync(response);
            response.IsSuccessStatusCode.Should().BeTrue($"[{module}] roster save: {body.Message}");
            body.Data.GetProperty("marked").GetInt32().Should().Be(1);

            var roster = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/attendance/roster?sessionId={s.SessionId}");
            var item = roster.GetProperty("data").EnumerateArray().First(r => r.GetProperty("registrationId").GetGuid() == s.RegistrationId);
            item.GetProperty("status").GetString().Should().Be("present");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, s.Base); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Manual_TCKN_checkin_sets_present_status_and_real_CheckedInAt(string module)
    {
        var s = await BuildAsync(module, "manual");
        try
        {
            var response = await _admin.PostAsJsonAsync($"/api/v1/{module}/attendance/manual",
                new { facilityId = s.Base.FacilityId, tckn = s.Tckn });
            var body = await ReadAsync(response);
            response.IsSuccessStatusCode.Should().BeTrue($"[{module}] manual check-in: {body.Message}");
            body.Data.GetProperty("found").GetBoolean().Should().BeTrue();
            body.Data.GetProperty("status").GetString().Should().Be("present");

            // CheckedInAt must be a real timestamp (Ruling F context): verified via the history
            // endpoint's checkedInViaQr-equivalent flag (CheckedInViaQr is set from
            // CheckedInAt.HasValue for ANY device/manual/QR entry method, not only QR — see
            // AttendanceHistoryItemDto mapping in FacilityAttendanceService.GetHistoryByRegistrationAsync).
            var history = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/attendance/registrations/{s.RegistrationId}/history");
            var historyItems = history.GetProperty("data").EnumerateArray().ToList();
            historyItems.Should().NotBeEmpty();
            historyItems[0].GetProperty("checkedInViaQr").GetBoolean().Should().BeTrue("SetCheckedInAt must have been called for a real manual check-in");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, s.Base); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task QR_checkin_via_facility_endpoint_sets_present_status_and_real_CheckedInAt(string module)
    {
        var s = await BuildAsync(module, "qr");
        try
        {
            // /attendance/qr resolves candidates the same way /attendance/manual does when given
            // a real 11-digit TCKN code (CheckInByFacilityAsync's non-rotating-token branch) —
            // this is the real kiosk/QR-scanner-typed-as-TCKN path, not a fabricated shortcut.
            var response = await _admin.PostAsJsonAsync($"/api/v1/{module}/attendance/qr",
                new { facilityId = s.Base.FacilityId, code = s.Tckn });
            var body = await ReadAsync(response);
            response.IsSuccessStatusCode.Should().BeTrue($"[{module}] QR check-in: {body.Message}");
            body.Data.GetProperty("found").GetBoolean().Should().BeTrue();
            body.Data.GetProperty("status").GetString().Should().Be("present");

            var history = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/attendance/registrations/{s.RegistrationId}/history");
            var historyItems = history.GetProperty("data").EnumerateArray().ToList();
            historyItems[0].GetProperty("checkedInViaQr").GetBoolean().Should().BeTrue();
            historyItems[0].GetProperty("method").GetString().Should().Be("qr");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, s.Base); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Static_QR_scan_sets_present_status_and_real_CheckedInAt(string module)
    {
        var s = await BuildAsync(module, "static");
        try
        {
            // Enable static QR on the facility and read back the real generated code.
            var enableResponse = await _admin.PatchAsJsonAsync($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr/toggle", new { enabled = true });
            enableResponse.IsSuccessStatusCode.Should().BeTrue($"[{module}] static QR enable must succeed");
            var staticQr = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr");
            var code = staticQr.GetProperty("data").GetProperty("code").GetString();
            code.Should().NotBeNullOrWhiteSpace();

            // The static-QR scan endpoint (POST /me/facilities/static-scan) requires the "Citizen"
            // policy (RequireAuthorization("Citizen") on MeFacilityEndpoints), a different
            // identity class from the AdminOrAbove SuperAdmin client used everywhere else in this
            // matrix. A real citizen JWT is minted here with the exact production claim shape
            // (JwtService.GenerateCitizenAccessToken) for the ParticipantId already bound to the
            // real active registration created in BuildAsync, over the real hosted auth pipeline —
            // not a mocked identity.
            using var citizenClient = _redisHost.CreateClient();
            citizenClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", await _redisHost.CreateCitizenTokenForRegistrationAsync(s.RegistrationId));

            // Requester location must be inside the ServiceFacility's geofence (FacilityScenario.
            // CreateBaseAsync seeds Sultangazi center coordinates 41.1086/28.8681 with the default
            // 150m radius) — LocationAccessGuard.EnsureInside fails closed without it.
            var scanResponse = await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan",
                new { code, latitude = 41.1086, longitude = 28.8681 });
            var scanBody = await ReadAsync(scanResponse);
            scanResponse.IsSuccessStatusCode.Should().BeTrue($"[{module}] static QR scan: {scanBody.Message}");
            scanBody.Data.GetProperty("allowed").GetBoolean().Should().BeTrue();

            var history = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/attendance/registrations/{s.RegistrationId}/history");
            var historyItems = history.GetProperty("data").EnumerateArray().ToList();
            historyItems.Should().NotBeEmpty();
            historyItems[0].GetProperty("checkedInViaQr").GetBoolean().Should().BeTrue();
            historyItems[0].GetProperty("method").GetString().Should().Be("static-qr");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, s.Base); }
    }

    // Kullanıcı isteği (2026-09-29, revize akşam: "dakika bekleme olayını kaldır, saniye
    // cinsinden olsun"): "attendance" (tek QR) modunda giriş/çıkış zamana dayalı ayrılmalı —
    // MinExitSeconds dolmadan tekrar okutmak çıkış üretmemeli (idempotent, hâlâ "entry" döner),
    // ReentryCooldownSeconds ACIKCA >0 ayarlanmadıkça (varsayılan 0/kapalı) yapılan giriş
    // denemesi reddedilmemeli. Gerçek zaman akışını dakikalarca beklemeden test edebilmek için
    // MinExitSeconds=0 ve ReentryCooldownSeconds=0/>0 ile "anında izinli"/"reddedilir" davranış
    // doğrulanır — ikisi birlikte zaman kuralının hem "geç" hem "erken" ucunu kanıtlar.
    [Fact]
    public async Task Static_QR_attendance_mode_timing_rules_are_enforced()
    {
        const string module = "sports";
        var s = await BuildAsync(module, "timing");
        try
        {
            var enableResponse = await _admin.PatchAsJsonAsync($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr/toggle", new { enabled = true });
            enableResponse.IsSuccessStatusCode.Should().BeTrue();
            var staticQr = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr");
            var code = staticQr.GetProperty("data").GetProperty("code").GetString();

            using var citizenClient = _redisHost.CreateClient();
            citizenClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", await _redisHost.CreateCitizenTokenForRegistrationAsync(s.RegistrationId));

            object Payload() => new { code, latitude = 41.1086, longitude = 28.8681 };

            // Önce dar bir pencere açalım ki "erken uç" testini yavaşlatmadan doğrulayabilelim
            // (varsayılan 3sn'yi beklemek yerine yönetici ayarıyla 10sn'ye çıkarıp hemen tekrar
            // okutuyoruz — bu, gerçek zamanlamayı canlı test ederken yarış koşuluna düşmez).
            var widen = await _admin.PatchAsJsonAsync($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr/timing",
                new { minExitSeconds = 10, reentryCooldownSeconds = 0 });
            widen.IsSuccessStatusCode.Should().BeTrue();

            // 1) İlk okutma: giriş.
            var first = await ReadAsync(await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan", Payload()));
            first.Data.GetProperty("action").GetString().Should().Be("entry");

            // 2) MinExitSeconds=10 iken HEMEN tekrar okutmak ÇIKIŞ ÜRETMEMELİ — hâlâ
            // "entry" (idempotent açık giriş) dönmeli, üretim/ürün kuralının "erken" ucu budur.
            var immediateRescan = await ReadAsync(await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan", Payload()));
            immediateRescan.Data.GetProperty("action").GetString().Should().Be("entry",
                "MinExitSeconds dolmadan tekrar okutmak çıkış üretmemeli");
            immediateRescan.Data.GetProperty("allowed").GetBoolean().Should().BeTrue();

            // 3) MinExitSeconds'ı 0'a indir (yönetici ayarı) — artık bir sonraki okutma anında
            // çıkış sayılmalı ("geç" uç: süre dolduktan sonraki ilk okutma çıkıştır).
            var timingResponse = await _admin.PatchAsJsonAsync($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr/timing",
                new { minExitSeconds = 0, reentryCooldownSeconds = 300 });
            timingResponse.IsSuccessStatusCode.Should().BeTrue();

            var exitScan = await ReadAsync(await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan", Payload()));
            exitScan.Data.GetProperty("action").GetString().Should().Be("exit");

            // 4) Çıkıştan hemen sonra tekrar okutmak — ReentryCooldownSeconds=300 ACIKCA ayarlı
            // ve hâlâ yürürlükte, GİRİŞ reddedilmeli (bekleme mesajı).
            var reentryTooSoon = await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan", Payload());
            var reentryBody = await ReadAsync(reentryTooSoon);
            reentryBody.Data.GetProperty("allowed").GetBoolean().Should().BeFalse(
                "ReentryCooldownSeconds acikca ayarlanip dolmadan tekrar giriş reddedilmeli");
            reentryBody.Data.GetProperty("message").GetString().Should().Contain("bekle");

            // 5) Cooldown'u 0'a indirip tekrar dene — artık giriş kabul edilmeli.
            var timing2 = await _admin.PatchAsJsonAsync($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr/timing",
                new { minExitSeconds = 0, reentryCooldownSeconds = 0 });
            timing2.IsSuccessStatusCode.Should().BeTrue();

            var secondEntry = await ReadAsync(await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan", Payload()));
            secondEntry.Data.GetProperty("action").GetString().Should().Be("entry",
                "cooldown 0'a indirildikten sonra tekrar giriş kabul edilmeli");
            secondEntry.Data.GetProperty("allowed").GetBoolean().Should().BeTrue();
        }
        finally { await FacilityScenario.CleanupAsync(_admin, s.Base); }
    }

    // Kullanıcı isteği (2026-09-29, revize akşam): varsayılan ReentryCooldownSeconds=0 iken
    // (yönetici hiçbir cooldown ayarlamamışsa) çıkıştan HEMEN sonra tekrar giriş HİÇBİR bekleme
    // olmadan kabul edilmeli — "dakika bekleme olayını kaldır" isteğiyle eklenen yeni varsayılan.
    [Fact]
    public async Task Static_QR_attendance_mode_default_reentry_has_no_cooldown_and_is_instant()
    {
        const string module = "sports";
        var s = await BuildAsync(module, "nocooldown");
        try
        {
            var enableResponse = await _admin.PatchAsJsonAsync($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr/toggle", new { enabled = true });
            enableResponse.IsSuccessStatusCode.Should().BeTrue();
            var staticQr = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr");
            var code = staticQr.GetProperty("data").GetProperty("code").GetString();

            using var citizenClient = _redisHost.CreateClient();
            citizenClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", await _redisHost.CreateCitizenTokenForRegistrationAsync(s.RegistrationId));

            object Payload() => new { code, latitude = 41.1086, longitude = 28.8681 };

            var timing = await _admin.PatchAsJsonAsync($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr/timing",
                new { minExitSeconds = 0, reentryCooldownSeconds = 0 });
            timing.IsSuccessStatusCode.Should().BeTrue();

            var entry1 = await ReadAsync(await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan", Payload()));
            entry1.Data.GetProperty("action").GetString().Should().Be("entry");

            var exit1 = await ReadAsync(await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan", Payload()));
            exit1.Data.GetProperty("action").GetString().Should().Be("exit");

            var entry2 = await ReadAsync(await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan", Payload()));
            entry2.Data.GetProperty("action").GetString().Should().Be("entry",
                "varsayilan (dakika bekleme kaldirildiktan sonraki) davranis: cikistan hemen sonra bekleme olmadan tekrar giris");
            entry2.Data.GetProperty("allowed").GetBoolean().Should().BeTrue();
        }
        finally { await FacilityScenario.CleanupAsync(_admin, s.Base); }
    }

    // Kullanıcı isteği (2026-09-30): "giriş ve çıkış da konumda değilsek QR kod geçersiz
    // demeyecek, konumdaysanız giriş yapamazsınız gibi daha mantıklı bir mesaj versin,
    // ayrıca konum kapalıysa ayarlara gidebilsin" — Facility.ScanStaticQrAsync'in konum
    // reddi artık "Geçersiz QR kodu" DEĞİL, tesis adını içeren anlamlı bir mesaj VE
    // StaticQrScanResultDto.ErrorCode="OUTSIDE_GEOFENCE"/"LOCATION_REQUIRED" döndürmeli
    // (frontend bu koda göre "Konumu Aç" aksiyonu gösterir).
    [Fact]
    public async Task Static_QR_scan_far_from_facility_returns_location_specific_message_and_error_code()
    {
        const string module = "sports";
        var s = await BuildAsync(module, "farloc");
        try
        {
            var enableResponse = await _admin.PatchAsJsonAsync($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr/toggle", new { enabled = true });
            enableResponse.IsSuccessStatusCode.Should().BeTrue();
            var staticQr = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/facilities/{s.Base.FacilityId}/static-qr");
            var code = staticQr.GetProperty("data").GetProperty("code").GetString();

            using var citizenClient = _redisHost.CreateClient();
            citizenClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", await _redisHost.CreateCitizenTokenForRegistrationAsync(s.RegistrationId));

            // ~350km uzakta, gerçek bir şehir (Ankara) — "dışarıda" senaryosu.
            var farRes = await ReadAsync(await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan",
                new { code, latitude = 39.9334, longitude = 32.8597 }));
            farRes.Data.GetProperty("allowed").GetBoolean().Should().BeFalse("350km uzaktan yapılan tarama reddedilmeli");
            farRes.Data.GetProperty("message").GetString().Should().Contain("konumunda değilsiniz",
                "mesaj 'Geçersiz QR kodu' DEĞİL, konum-özel ve tesis adını içeren bir mesaj olmalı");
            farRes.Data.GetProperty("errorCode").GetString().Should().Be("OUTSIDE_GEOFENCE",
                "frontend bu koda göre LocationHelp/'Konumu Aç' aksiyonunu göstermeli");

            // Konum hiç gönderilmezse (konum servisleri kapalı) LOCATION_REQUIRED dönmeli.
            var noLocRes = await ReadAsync(await citizenClient.PostAsJsonAsync("/api/v1/me/facilities/static-scan", new { code }));
            noLocRes.Data.GetProperty("allowed").GetBoolean().Should().BeFalse("konum gönderilmeden tarama reddedilmeli");
            noLocRes.Data.GetProperty("errorCode").GetString().Should().Be("LOCATION_REQUIRED",
                "frontend bu koda göre 'Konumu Aç' butonunu (tarayıcı izin diyaloğu) göstermeli");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, s.Base); }
    }

    [Theory]
    [MemberData(nameof(ModuleKeys))]
    public async Task Device_checkin_via_area_device_sets_present_status_and_real_CheckedInAt(string module)
    {
        var s = await BuildAsync(module, "device");
        try
        {
            var devicePayload = new
            {
                name = $"T7 Device {module}",
                direction = "entry",
                scope = "area",
                serviceFacilityId = (Guid?)null,
                facilityId = s.Base.FacilityId,
                hallId = (Guid?)null,
                deviceId = (string?)null,
                ipAddress = (string?)null,
                triggerLockOnSuccess = false,
            };
            var deviceResponse = await _admin.PostAsJsonAsync($"/api/v1/{module}/devices", devicePayload);
            var deviceBody = await ReadAsync(deviceResponse);
            deviceResponse.IsSuccessStatusCode.Should().BeTrue($"[{module}] device create: {deviceBody.Message}");
            var deviceCode = deviceBody.Data.GetProperty("deviceCode").GetString();
            var apiKey = deviceBody.Data.GetProperty("apiKey").GetString();

            using var anonymousClient = _redisHost.CreateClient();
            var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/{module}/devices/checkin")
            {
                Content = JsonContent.Create(new { deviceCode, code = s.Tckn }),
            };
            req.Headers.Add("X-Device-Key", apiKey);
            var realResponse = await anonymousClient.SendAsync(req);
            var realBody = await ReadAsync(realResponse);
            realResponse.IsSuccessStatusCode.Should().BeTrue($"[{module}] real device checkin: {realBody.Message}");
            realBody.Data.GetProperty("allowed").GetBoolean().Should().BeTrue($"[{module}] device checkin denied: {realBody.Data.GetProperty("message").GetString()}");

            var history = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/attendance/registrations/{s.RegistrationId}/history");
            var historyItems = history.GetProperty("data").EnumerateArray().ToList();
            historyItems.Should().NotBeEmpty();
            historyItems[0].GetProperty("checkedInViaQr").GetBoolean().Should().BeTrue("physical device/kiosk entry must set CheckedInAt exactly like QR/manual do");
            // Real server value is the literal string "device" (FacilityAttendanceService.cs
            // RunDeviceCheckInAsync, main-registration entry branch), not "device:"-prefixed —
            // a real finding, not an assumption.
            historyItems[0].GetProperty("method").GetString().Should().Be("device");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, s.Base); }
    }

    [Fact]
    public async Task Late_status_computed_by_device_checkin_is_not_overwritten_by_a_subsequent_QR_checkin()
    {
        // Ruling F: a real prior "late" condition, then a subsequent check-in call must not
        // silently overwrite it back to "present". The real late/present decision in
        // CheckInByFacilityAsync compares LocalNow() against the session's own start time (plus
        // EntryGraceMinutes) — so a session whose window START is set in the recent past (already
        // more than EntryGraceMinutes behind "now", but window END still safely ahead) makes the
        // FIRST entry attempt compute "late" for real, entirely from the real clock, never a
        // hand-picked status string.
        const string module = "sports";
        var b = await FacilityScenario.CreateBaseAsync(_admin, module, $"late{Guid.NewGuid():N}"[..10]);
        try
        {
            var now = DateTime.UtcNow;
            var localNow = now.AddMinutes(180);
            var start = localNow.AddMinutes(-30); // 30 minutes into the session already
            var end = localNow.AddHours(2);
            var startTime = $"{start.Hour:D2}:{start.Minute:D2}";
            var endTime = $"{end.Hour:D2}:{end.Minute:D2}";

            var groupId = await FacilityScenario.CreateGroupAsync(_admin, b, "late", new FacilityScenario.GroupOptions
            {
                Schedule = [new(TodayDayName(), startTime, endTime)],
                PeriodStart = localNow.Date,
                PeriodEnd = localNow.Date.AddDays(90),
                AutoApprove = true,
                LateTrackingEnabled = true,
                EntryGraceMinutes = 5, // 30 real minutes elapsed >> 5 minute grace -> real "late"
            });

            var sessionResponse = await _admin.PostAsJsonAsync($"/api/v1/{module}/sessions", new
            {
                facilityId = b.FacilityId,
                groupId,
                date = localNow.Date.ToString("yyyy-MM-dd"),
                startTime,
                endTime,
            });
            var sessionBody = await ReadAsync(sessionResponse);
            sessionResponse.IsSuccessStatusCode.Should().BeTrue($"session create: {sessionBody.Message}");
            var sessionId = sessionBody.Data.GetProperty("id").GetGuid();

            var tckn = FacilityScenario.NewTckn(_random);
            var regResponse = await _admin.PostAsJsonAsync($"/api/v1/{module}/registrations", new
            {
                groupId,
                applicationId = (Guid?)null,
                participantId = (Guid?)null,
                fullName = "T7 Late Kişi",
                tckn,
                phone = "5" + tckn[..9],
                birthDate = (DateTime?)null,
                guardianPhone = (string?)null,
            });
            var regBody = await ReadAsync(regResponse);
            regResponse.IsSuccessStatusCode.Should().BeTrue($"registration create: {regBody.Message}");
            var registrationId = regBody.Data.GetProperty("id").GetGuid();

            // First entry: manual TCKN check-in via the facility endpoint, which computes
            // entryStatus="late" for real (30 real minutes past session start > 5 minute grace).
            var firstCheckin = await _admin.PostAsJsonAsync($"/api/v1/{module}/attendance/manual",
                new { facilityId = b.FacilityId, tckn });
            var firstBody = await ReadAsync(firstCheckin);
            firstCheckin.IsSuccessStatusCode.Should().BeTrue($"first (late) check-in: {firstBody.Message}");
            firstBody.Data.GetProperty("status").GetString().Should().Be("late",
                "30 real minutes past session start with a 5 minute grace must compute as late, not present");

            // Second entry for the SAME session/registration via the QR endpoint. If this used
            // FacilityAttendance.MarkCheckedIn (the historical bug), Status would be forced back
            // to "present", silently erasing the real late record — the real
            // CheckInByFacilityAsync path re-runs its own present/late window comparison with the
            // SAME real clock and grace settings, so it independently arrives at "late" again and
            // calls SetStatus(entryStatus,...) + SetCheckedInAt() (not MarkCheckedIn), preserving it.
            var secondCheckin = await _admin.PostAsJsonAsync($"/api/v1/{module}/attendance/qr",
                new { facilityId = b.FacilityId, code = tckn });
            var secondBody = await ReadAsync(secondCheckin);
            secondCheckin.IsSuccessStatusCode.Should().BeTrue($"second (re-scan) check-in: {secondBody.Message}");
            secondBody.Data.GetProperty("status").GetString().Should().Be("late",
                "REGRESSION: a subsequent check-in call must not silently overwrite a real prior late status back to present");

            var history = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/{module}/attendance/registrations/{registrationId}/history");
            var historyItems = history.GetProperty("data").EnumerateArray().ToList();
            historyItems.Should().NotBeEmpty();
            historyItems[0].GetProperty("status").GetString().Should().Be("late");
            historyItems[0].GetProperty("checkedInViaQr").GetBoolean().Should().BeTrue();
        }
        finally { await FacilityScenario.CleanupAsync(_admin, b); }
    }

    [Fact]
    public async Task Late_tracking_disabled_group_rejects_late_mark_via_roster_save()
    {
        const string module = "sports";
        var s = await BuildAsync(module, "notrack", lateTrackingEnabled: false);
        try
        {
            var savePayload = new { sessionId = s.SessionId, marks = new[] { new { registrationId = s.RegistrationId, status = "late" } }, confirm = false };
            var response = await _admin.PostAsJsonAsync($"/api/v1/{module}/attendance/save", savePayload);
            var body = await ReadAsync(response);

            ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400);
            body.ErrorCode.Should().Be("LATE_TRACKING_DISABLED");
        }
        finally { await FacilityScenario.CleanupAsync(_admin, s.Base); }
    }
}
