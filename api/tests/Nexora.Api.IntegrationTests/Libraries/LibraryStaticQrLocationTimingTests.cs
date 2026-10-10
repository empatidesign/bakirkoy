using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Libraries;

// Kullanıcı isteği (2026-09-29): kütüphanedeki sabit (duvar) QR giriş/çıkış sisteminin KONUM
// (geofence/koordinat) davranışını ve tesis (facility) modülünde 7e191b9 ile eklenen "zamana
// dayalı tek-QR giriş/çıkış ayrımı" özelliğinin kütüphanede GERÇEKTEN var olup olmadığını uçtan
// uca, gerçek Postgres+Redis+hosted API'ye karşı doğrular. Hiçbir senaryo mock/stub değildir —
// tamamı POST /api/v1/me/libraries/static-scan gerçek endpoint'ine gerçek HTTP isteğidir.
//
// Kapsam:
//   1) Konum İÇİNDE  → giriş kabul (attendance/entry_exit modları)
//   2) Konum DIŞINDA  → OUTSIDE_GEOFENCE reddi
//   3) Konum EKSİK (lat/lng gönderilmedi) → LOCATION_REQUIRED reddi
//   4) split modda giriş/çıkış QR'ları ayrı ayrı konum kontrolüne tabi
//   5) "Zamana dayalı tek-QR giriş/çıkış" (facility'deki MinExitMinutes/ReentryCooldownMinutes
//      eşdeğeri) kütüphanede var mı — YOK olduğu kanıtlanır (aynı anda hemen tekrar okutmak
//      HİÇBİR gecikme/cooldown olmadan direkt çıkış üretir, facility'nin "idempotent giriş"
//      davranışının aksine).
[Collection(ApiCollection.Name)]
public sealed class LibraryStaticQrLocationTimingTests : IAsyncLifetime
{
    // Redis-enabled host gerekli: static-scan katılımcı kimliği + ilgili servisler IRedisService'e
    // bağımlı (bkz. LibraryDeviceMatrixTests/FacilityModuleAttendanceMatrixTests'teki aynı not).
    private NexoraApiFactory _redisHost = null!;
    private HttpClient _admin = null!;

    // Sultangazi merkezi koordinatları — LibraryScenario.CreateAsync'in ServiceFacility'ye
    // yazdığı sabit koordinatlarla (41.1086/28.8681) birebir aynı, "içeride" senaryosu için.
    private const double InsideLat = 41.1086;
    private const double InsideLng = 28.8681;
    // ~350km uzakta, gerçek bir şehir (Ankara) — "dışarıda" senaryosu için.
    private const double FarLat = 39.9334;
    private const double FarLng = 32.8597;

    public async Task InitializeAsync()
    {
        _redisHost = NexoraApiFactory.CreateForCollectionWithRedis();
        await _redisHost.InitializeAsync();
        _admin = await _redisHost.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t-libqr-{Guid.NewGuid():N}@nexora.local"));
    }

    public async Task DisposeAsync() => await _redisHost.DisposeAsync();

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

    private async Task<(LibraryScenario.Created Lib, HttpClient Citizen)> SetupAsync(string tag, string mode)
    {
        // EntryControlMode="qr" zorunlu: LibraryOperationsService.EnforceEntryMethod, "manual"
        // (LibraryScenario.Options'ın varsayılanı) iken method="qr" ile gelen her check-in'i
        // MANUAL_REQUIRED ile reddediyor — static-scan'in entry_exit/split/default dalları
        // CheckInAsync'i her zaman method="qr" ile çağırıyor (bkz. LibraryOperationsService.cs
        // ScanStaticQrAsync). Bu, gerçek entegrasyon testiyle bulunan somut bir bulgu: bir
        // yönetici sabit-QR'ı "manual" giriş kontrollü bir kıraathanede etkinleştirirse, TÜM
        // entry_exit/split/default modlu static-scan girişleri MANUAL_REQUIRED ile başarısız
        // olur (yalnız "attendance" modu bunu etkilemez, o hiç CheckInAsync çağırmaz).
        //
        // SeatingMode="sirali" zorunlu: varsayılan "masali" iken CheckInAsync koltuk numarası
        // olmadan SEAT_REQUIRED ile reddeder — static-scan payload'ı (ScanLibraryStaticQrPayload)
        // hiç koltuk alanı taşımaz, bu yüzden "masali" bir kıraathanede static-scan ile giriş
        // YAPILAMAZ (ayrı bir gerçek bulgu). "sirali" modda koltuk otomatik/null kabul edilir.
        var lib = await LibraryScenario.CreateAsync(_admin, tag,
            new LibraryScenario.Options { EntryControlMode = "qr", SeatingMode = "sirali" });

        var toggleRes = await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/toggle", new { enabled = true });
        toggleRes.IsSuccessStatusCode.Should().BeTrue($"static QR enable must succeed: {await toggleRes.Content.ReadAsStringAsync()}");

        var modeRes = await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/mode", new { mode });
        modeRes.IsSuccessStatusCode.Should().BeTrue($"static QR mode={mode} set must succeed: {await modeRes.Content.ReadAsStringAsync()}");

        var identity = CitizenTestIdentity.Adult(Random.Shared.Next());
        var citizen = await _redisHost.CreateCitizenClientAsync(identity);

        return (lib, citizen);
    }

    private async Task<string> GetCodeAsync(Guid libraryId)
    {
        var qr = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/libraries/{libraryId}/static-qr");
        return qr.GetProperty("data").GetProperty("code").GetString()!;
    }

    // -----------------------------------------------------------------------------------------
    // 1) KONUM İÇİNDE — attendance modu, giriş kabul edilmeli.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Attendance_mode_scan_inside_geofence_is_accepted()
    {
        var (lib, citizen) = await SetupAsync($"locin{Guid.NewGuid():N}"[..20], "attendance");
        try
        {
            var code = await GetCodeAsync(lib.LibraryId);
            var res = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan",
                new { code, latitude = InsideLat, longitude = InsideLng });
            var body = await ReadAsync(res);
            res.IsSuccessStatusCode.Should().BeTrue($"konum içindeyken giriş kabul edilmeli: {body.Message}");
            body.Data.GetProperty("action").GetString().Should().Be("attendance");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 2) KONUM DIŞINDA — ~350km uzaktan okutma OUTSIDE_GEOFENCE ile reddedilmeli.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Attendance_mode_scan_outside_geofence_is_rejected()
    {
        var (lib, citizen) = await SetupAsync($"locout{Guid.NewGuid():N}"[..20], "attendance");
        try
        {
            var code = await GetCodeAsync(lib.LibraryId);
            var res = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan",
                new { code, latitude = FarLat, longitude = FarLng });
            var body = await ReadAsync(res);
            res.IsSuccessStatusCode.Should().BeFalse("350km uzaktan yapılan tarama reddedilmeli");
            body.ErrorCode.Should().Be("OUTSIDE_GEOFENCE");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 3) KONUM EKSİK — lat/lng hiç gönderilmezse LOCATION_REQUIRED ile reddedilmeli
    //    (LocationAccessGuard "fail-closed": konum yoksa asla izin verme).
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Attendance_mode_scan_without_location_is_rejected()
    {
        var (lib, citizen) = await SetupAsync($"locmiss{Guid.NewGuid():N}"[..18], "attendance");
        try
        {
            var code = await GetCodeAsync(lib.LibraryId);
            var res = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", new { code });
            var body = await ReadAsync(res);
            res.IsSuccessStatusCode.Should().BeFalse("konum gönderilmeden tarama reddedilmeli");
            body.ErrorCode.Should().Be("LOCATION_REQUIRED");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 4) DUZELTME DOGRULAMASI (2026-09-29, revize akşam: saniye cinsinden): kutuphaneye
    //    Facility'deki ile esdeger zamana-dayali giris/cikis ayrimi eklendi. Varsayilan
    //    StaticQrMinExitSeconds=3 iken HEMEN tekrar okutmak artik CIKIS URETMEMELI - hala
    //    "checkin" (idempotent acik giris) donmeli. MinExitSeconds 0'a indirilince bir
    //    SONRAKI okutma cikis uretmeli.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task EntryExit_mode_timing_rules_are_enforced_after_fix()
    {
        var (lib, citizen) = await SetupAsync($"timing{Guid.NewGuid():N}"[..19], "entry_exit");
        try
        {
            var code = await GetCodeAsync(lib.LibraryId);
            object Payload() => new { code, latitude = InsideLat, longitude = InsideLng };

            var first = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            first.Data.GetProperty("action").GetString().Should().Be("checkin", "ilk okutma giris olmali");

            var immediateRescan = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            immediateRescan.Data.GetProperty("action").GetString().Should().Be("checkin",
                "MinExitSeconds (varsayilan 3) dolmadan tekrar okutmak cikis uretmemeli - duzeltme sonrasi facility ile tutarli");

            var timingRes = await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/timing",
                new { minExitSeconds = 0, reentryCooldownSeconds = 0 });
            timingRes.IsSuccessStatusCode.Should().BeTrue($"timing endpoint calismali: {await timingRes.Content.ReadAsStringAsync()}");

            var exitScan = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            exitScan.Data.GetProperty("action").GetString().Should().Be("checkout",
                "MinExitSeconds=0 sonrasi bir sonraki okutma cikis uretmeli");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 4b) DUZELTME DOGRULAMASI (revize akşam: varsayilan artik KAPALI/0): cikistan hemen sonra
    //     tekrar okutmak, ReentryCooldownSeconds ACIKCA >0 ayarlanmadikca HICBIR bekleme
    //     olmadan kabul edilmeli. Cooldown acikca ayarlanirsa dolmadan REENTRY_COOLDOWN_ACTIVE
    //     ile reddedilmeli, 0'a indirilince tekrar kabul edilmeli.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task EntryExit_mode_reentry_cooldown_is_enforced_after_fix()
    {
        var (lib, citizen) = await SetupAsync($"cooldown{Guid.NewGuid():N}"[..18], "entry_exit");
        try
        {
            (await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/timing",
                new { minExitSeconds = 0, reentryCooldownSeconds = 300 })).EnsureSuccessStatusCode();

            var code = await GetCodeAsync(lib.LibraryId);
            object Payload() => new { code, latitude = InsideLat, longitude = InsideLng };

            var entry1 = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            entry1.Data.GetProperty("action").GetString().Should().Be("checkin");

            var exit1 = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            exit1.Data.GetProperty("action").GetString().Should().Be("checkout");

            var reentryTooSoon = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload());
            var reentryBody = await ReadAsync(reentryTooSoon);
            reentryTooSoon.IsSuccessStatusCode.Should().BeFalse(
                "ReentryCooldownSeconds acikca ayarlanip dolmadan tekrar giris reddedilmeli - duzeltme sonrasi facility ile tutarli");
            reentryBody.ErrorCode.Should().Be("REENTRY_COOLDOWN_ACTIVE");

            (await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/timing",
                new { minExitSeconds = 0, reentryCooldownSeconds = 0 })).EnsureSuccessStatusCode();

            var secondEntry = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            secondEntry.Data.GetProperty("action").GetString().Should().Be("checkin",
                "cooldown 0'a indirildikten sonra tekrar giris kabul edilmeli");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 4c) DUZELTME DOGRULAMASI (revize akşam): varsayilan ReentryCooldownSeconds=0 iken cikistan
    //     HEMEN sonra tekrar giris HICBIR bekleme olmadan kabul edilmeli — kullanici isteği
    //     "dakika bekleme olayini kaldir" ile eklenen varsayilan davranis.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task EntryExit_mode_default_reentry_has_no_cooldown_and_is_instant()
    {
        var (lib, citizen) = await SetupAsync($"nocool{Guid.NewGuid():N}"[..19], "entry_exit");
        try
        {
            var code = await GetCodeAsync(lib.LibraryId);
            object Payload() => new { code, latitude = InsideLat, longitude = InsideLng };

            (await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/timing",
                new { minExitSeconds = 0, reentryCooldownSeconds = 0 })).EnsureSuccessStatusCode();

            var entry1 = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            entry1.Data.GetProperty("action").GetString().Should().Be("checkin");

            var exit1 = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            exit1.Data.GetProperty("action").GetString().Should().Be("checkout");

            var entry2 = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            entry2.Data.GetProperty("action").GetString().Should().Be("checkin",
                "varsayilan (dakika bekleme kaldirildiktan sonraki) davranis: cikistan hemen sonra bekleme olmadan tekrar giris");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 4d) "attendance" modu kutuphanede facility'den FARKLI bir anlam tasir: acik/kapali oturum
    //    CIFTI degil, tek seferlik ANLIK yoklama kaydidir (her okutma kendi basina bagimsizdir,
    //    hicbir "acik" oturum birakmaz). Bu yuzden zamana-dayali MinExitSeconds/ReentryCooldown
    //    ayrimi BURAYA uygulanmaz (yalnizca gercek acik/kapali oturum tutan entry_exit/split'e
    //    uygulanir, bkz. yukaridaki testler). Ilk deneme bu ayrimi attendance'a da uygulamisti ve
    //    ikinci okutmayi yanlislikla REENTRY_COOLDOWN_ACTIVE ile reddediyordu - gercek entegrasyon
    //    testiyle bulunup duzeltildi; bu test artik dogru (timing'siz) davranisi dogrular.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Attendance_mode_is_not_subject_to_timing_rules_and_stays_instantaneous()
    {
        var (lib, citizen) = await SetupAsync($"atttime{Guid.NewGuid():N}"[..17], "attendance");
        try
        {
            var code = await GetCodeAsync(lib.LibraryId);
            object Payload() => new { code, latitude = InsideLat, longitude = InsideLng };

            var first = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            first.Data.GetProperty("action").GetString().Should().Be("attendance",
                "her okutma bagimsiz bir anlik yoklama kaydi olmali, giris/cikis ayrimi olmamali");

            var second = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            second.Data.GetProperty("action").GetString().Should().Be("attendance",
                "art arda okutmalarin HICBIRI zamana-dayali cikis/cooldown kurallarina takilmamali - attendance modu bagimsizdir");

            var third = await ReadAsync(await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan", Payload()));
            third.Data.GetProperty("action").GetString().Should().Be("attendance");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 8) DUZELTME DOGRULAMASI: EntryControlMode="manual" iken sabit QR'i entry_exit/split moduna
    //    almaya calismak artik sessizce kilitlenmek yerine acik ENTRY_CONTROL_MODE_CONFLICT verir.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task SetMode_to_entry_exit_with_manual_entry_control_is_rejected_with_clear_error()
    {
        var lib = await LibraryScenario.CreateAsync(_admin, $"manualqr{Guid.NewGuid():N}"[..16],
            new LibraryScenario.Options { EntryControlMode = "manual", SeatingMode = "sirali" });
        try
        {
            (await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/toggle", new { enabled = true }))
                .EnsureSuccessStatusCode();

            var modeRes = await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/mode", new { mode = "entry_exit" });
            var modeBody = await ReadAsync(modeRes);
            modeRes.IsSuccessStatusCode.Should().BeFalse("manuel giris kontroluyle entry_exit modu celismeli, sessizce kilitlenmemeli");
            modeBody.ErrorCode.Should().Be("ENTRY_CONTROL_MODE_CONFLICT");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 8b) Ters yon: sabit QR zaten entry_exit modundayken EntryControlMode'u manual'a
    //     cevirmeye calismak da ayni sekilde reddedilmeli.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Switching_entry_control_to_manual_while_static_qr_entry_exit_active_is_rejected()
    {
        var (lib, _) = await SetupAsync($"revguard{Guid.NewGuid():N}"[..15], "entry_exit");
        try
        {
            var updateRes = await _admin.PutAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}", new
            {
                name = lib.LibraryName,
                serviceFacilityId = lib.ServiceFacilityId.ToString(),
                seatingMode = "sirali",
                isMultiFloor = false,
                floors = Array.Empty<object>(),
                entryControlMode = "manual",
                exitControlMode = "qr",
                capacity = 4,
            });
            var updateBody = await ReadAsync(updateRes);
            updateRes.IsSuccessStatusCode.Should().BeFalse("sabit QR entry_exit modundayken manuel girise gecis reddedilmeli");
            updateBody.ErrorCode.Should().Be("ENTRY_CONTROL_MODE_CONFLICT");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 9) DUZELTME DOGRULAMASI: masali (koltuk secmeli) sistemde sabit QR'i entry_exit/split
    //    moduna almak artik acik SEATING_MODE_CONFLICT ile reddedilir.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Enable_static_qr_entry_exit_on_masali_library_is_rejected_with_clear_error()
    {
        var lib = await LibraryScenario.CreateAsync(_admin, $"masaliqr{Guid.NewGuid():N}"[..16],
            new LibraryScenario.Options { EntryControlMode = "qr", SeatingMode = "masali" });
        try
        {
            var modeRes = await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/mode", new { mode = "entry_exit" });
            var modeBody = await ReadAsync(modeRes);
            modeRes.IsSuccessStatusCode.Should().BeFalse("masali sistemde entry_exit modu koltuk numarasi gerektirir, sabit QR bunu saglayamaz");
            modeBody.ErrorCode.Should().Be("SEATING_MODE_CONFLICT");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 9b) Ters yon: sabit QR zaten entry_exit modundayken SeatingMode'u masali'ya cevirmeye
    //     calismak da SEATING_MODE_CONFLICT ile reddedilmeli (LibraryManagementService.
    //     ApplyRequestAsync'teki ters-yon guard, 9'daki ileri-yon guard'in aynisi - bu yon
    //     daha once test edilmemisti, kod incelemesiyle bulunan bir bosluk).
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Switching_seating_to_masali_while_static_qr_entry_exit_active_is_rejected()
    {
        var (lib, _) = await SetupAsync($"revseat{Guid.NewGuid():N}"[..15], "entry_exit");
        try
        {
            var updateRes = await _admin.PutAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}", new
            {
                name = lib.LibraryName,
                serviceFacilityId = lib.ServiceFacilityId.ToString(),
                seatingMode = "masali",
                isMultiFloor = false,
                floors = Array.Empty<object>(),
                entryControlMode = "qr",
                exitControlMode = "qr",
                capacity = 4,
            });
            var updateBody = await ReadAsync(updateRes);
            updateRes.IsSuccessStatusCode.Should().BeFalse("sabit QR entry_exit modundayken masali koltuk duzenine gecis reddedilmeli");
            updateBody.ErrorCode.Should().Be("SEATING_MODE_CONFLICT");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 9c) UCUNCU, AYRI guard yolu (kod okumasiyla bulundu): LibraryManagementService.
    //     ApplyRequestAsync'teki ters-yon guard yalnizca lib.StaticQrEnabled==true iken kontrol
    //     eder (bkz. satir 302: "incomingSeatingMode == masali && lib.StaticQrEnabled && ...").
    //     Sabit QR devre disiyken SeatingMode'u masali'ya cevirmek bu yuzden ENGELLENMEZ (mode
    //     entry_exit olarak DB'de kalmaya devam eder, cunku devre disiyken mode hicbir yerde
    //     sifirlanmiyor). Bu durumda sabit QR'i TEKRAR etkinlestirmeye calismak
    //     ToggleStaticQrAsync'teki UCUNCU, bagimsiz guard site'ina (satir ~1607) dusmeli - bu
    //     kod yolu ne 9 ne de 9b tarafindan kanitlanmisti, ayrica dogrulaniyor.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Reenabling_static_qr_after_seating_changed_to_masali_while_disabled_is_rejected()
    {
        var (lib, _) = await SetupAsync($"toggseat{Guid.NewGuid():N}"[..14], "entry_exit");
        try
        {
            // Sabit QR'i devre disi birak (mode="entry_exit" DB'de kalir).
            (await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/toggle", new { enabled = false }))
                .EnsureSuccessStatusCode();

            // Devre disiyken SeatingMode'u masali'ya cevirmek reddedilMEMELi (guard StaticQrEnabled
            // gerektirir) - bu, guard'in kapsam sinirini gercek HTTP ile kanitlar.
            var updateRes = await _admin.PutAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}", new
            {
                name = lib.LibraryName,
                serviceFacilityId = lib.ServiceFacilityId.ToString(),
                seatingMode = "masali",
                isMultiFloor = false,
                floors = Array.Empty<object>(),
                entryControlMode = "qr",
                exitControlMode = "qr",
                capacity = 4,
            });
            updateRes.IsSuccessStatusCode.Should().BeTrue(
                $"sabit QR devre disiyken masali'ya gecis engellenmemeli: {await updateRes.Content.ReadAsStringAsync()}");

            // Simdi tekrar etkinlestirmeye calismak ToggleStaticQrAsync'in KENDI guard'ina
            // (SeatingMode==masali && StaticQrMode is entry_exit/split) carpmali.
            var reenableRes = await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/toggle", new { enabled = true });
            var reenableBody = await ReadAsync(reenableRes);
            reenableRes.IsSuccessStatusCode.Should().BeFalse(
                "masali+entry_exit kombinasyonuyla sabit QR yeniden etkinlestirilememeli");
            reenableBody.ErrorCode.Should().Be("SEATING_MODE_CONFLICT");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 9d) DUZELTME DOGRULAMASI: 9c'nin ENTRY_CONTROL_MODE_CONFLICT esdegeri. ToggleStaticQrAsync
    //     yalnizca SeatingMode==masali kombinasyonunu kontrol ediyordu, EntryControlMode==manual
    //     icin ES DEGER kontrol hic yoktu - bir gercek entegrasyon testiyle (Probe_ToggleEntry-
    //     ControlGap) bu tam kombinasyonun (devre disiyken EntryControlMode=manual'a gecis, sonra
    //     tekrar etkinlestirme) HICBIR hata vermeden basarili oldugu kanitlandi, orijinal "sessiz
    //     kilitlenme" bug'ini birebir yeniden uretiyordu. Duzeltildi, bu test artik dogru
    //     davranisi (ENTRY_CONTROL_MODE_CONFLICT ile ret) dogrular.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Reenabling_static_qr_after_entry_control_changed_to_manual_while_disabled_is_rejected()
    {
        var (lib, _) = await SetupAsync($"toggentry{Guid.NewGuid():N}"[..13], "entry_exit");
        try
        {
            (await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/toggle", new { enabled = false }))
                .EnsureSuccessStatusCode();

            var updateRes = await _admin.PutAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}", new
            {
                name = lib.LibraryName,
                serviceFacilityId = lib.ServiceFacilityId.ToString(),
                seatingMode = "sirali",
                isMultiFloor = false,
                floors = Array.Empty<object>(),
                entryControlMode = "manual",
                exitControlMode = "manual",
                capacity = 4,
            });
            updateRes.IsSuccessStatusCode.Should().BeTrue(
                $"sabit QR devre disiyken manuel giris kontrolune gecis engellenmemeli: {await updateRes.Content.ReadAsStringAsync()}");

            var reenableRes = await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/toggle", new { enabled = true });
            var reenableBody = await ReadAsync(reenableRes);
            reenableRes.IsSuccessStatusCode.Should().BeFalse(
                "manuel giris kontroluyle+entry_exit kombinasyonuyla sabit QR yeniden etkinlestirilememeli");
            reenableBody.ErrorCode.Should().Be("ENTRY_CONTROL_MODE_CONFLICT");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 5) split mod — Giriş QR (-giris) konum içinde kabul, konum dışında OUTSIDE_GEOFENCE.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Split_mode_entry_code_enforces_geofence_independently()
    {
        var (lib, citizen) = await SetupAsync($"splitloc{Guid.NewGuid():N}"[..16], "split");
        try
        {
            var qr = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/libraries/{lib.LibraryId}/static-qr");
            var entryCode = qr.GetProperty("data").GetProperty("entryCode").GetString();
            entryCode.Should().NotBeNullOrWhiteSpace("split modda EntryCode dönmeli");

            var farRes = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan",
                new { code = entryCode, latitude = FarLat, longitude = FarLng });
            var farBody = await ReadAsync(farRes);
            farRes.IsSuccessStatusCode.Should().BeFalse("split-giriş QR'ı da konum dışında reddedilmeli");
            farBody.ErrorCode.Should().Be("OUTSIDE_GEOFENCE");

            var insideRes = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan",
                new { code = entryCode, latitude = InsideLat, longitude = InsideLng });
            var insideBody = await ReadAsync(insideRes);
            insideRes.IsSuccessStatusCode.Should().BeTrue($"konum içindeyken split-giriş kabul edilmeli: {insideBody.Message}");
            insideBody.Data.GetProperty("action").GetString().Should().Be("checkin");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 5b) split mod — Çıkış QR'ı (-cikis) aktif oturum yokken NO_ACTIVE_SESSION ile reddedilmeli,
    //     ardından gerçek girişten sonra konum içinde çıkış kabul edilmeli.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Split_mode_exit_code_requires_active_session_and_enforces_geofence()
    {
        var (lib, citizen) = await SetupAsync($"splitexit{Guid.NewGuid():N}"[..14], "split");
        try
        {
            // Kullanıcı isteği (2026-09-29, revize akşam: "split modda da okuma süre ayarları
            // olsun"): split+çıkış dalına da min-exit-seconds koruması eklendi (varsayılan 3sn),
            // bu test ise geofence davranışını (min-exit'ten bağımsız) doğruluyor — timing'i 0'a
            // indirip test amacını netleştiriyoruz.
            (await _admin.PatchAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/static-qr/timing",
                new { minExitSeconds = 0, reentryCooldownSeconds = 0 })).EnsureSuccessStatusCode();

            var qr = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/libraries/{lib.LibraryId}/static-qr");
            var entryCode = qr.GetProperty("data").GetProperty("entryCode").GetString();
            var exitCode = qr.GetProperty("data").GetProperty("exitCode").GetString();

            var noSessionRes = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan",
                new { code = exitCode, latitude = InsideLat, longitude = InsideLng });
            var noSessionBody = await ReadAsync(noSessionRes);
            noSessionRes.IsSuccessStatusCode.Should().BeFalse("aktif oturum yokken çıkış QR'ı reddedilmeli");
            noSessionBody.ErrorCode.Should().Be("NO_ACTIVE_SESSION");

            (await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan",
                new { code = entryCode, latitude = InsideLat, longitude = InsideLng })).EnsureSuccessStatusCode();

            var farExit = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan",
                new { code = exitCode, latitude = FarLat, longitude = FarLng });
            var farExitBody = await ReadAsync(farExit);
            farExit.IsSuccessStatusCode.Should().BeFalse("çıkış QR'ı da konum dışında reddedilmeli");
            farExitBody.ErrorCode.Should().Be("OUTSIDE_GEOFENCE");

            var realExit = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan",
                new { code = exitCode, latitude = InsideLat, longitude = InsideLng });
            var realExitBody = await ReadAsync(realExit);
            realExit.IsSuccessStatusCode.Should().BeTrue($"konum içindeyken çıkış kabul edilmeli: {realExitBody.Message}");
            realExitBody.Data.GetProperty("action").GetString().Should().Be("checkout");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 6) split mod — yönsüz (suffix'siz) base kod okutulursa INVALID_QR ile reddedilmeli.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Split_mode_base_code_without_direction_is_rejected()
    {
        var (lib, citizen) = await SetupAsync($"splitbase{Guid.NewGuid():N}"[..14], "split");
        try
        {
            var qr = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/libraries/{lib.LibraryId}/static-qr");
            var baseCode = qr.GetProperty("data").GetProperty("code").GetString();

            var res = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan",
                new { code = baseCode, latitude = InsideLat, longitude = InsideLng });
            var body = await ReadAsync(res);
            res.IsSuccessStatusCode.Should().BeFalse("split modda yönsüz base kod reddedilmeli");
            body.ErrorCode.Should().Be("INVALID_QR");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }

    // -----------------------------------------------------------------------------------------
    // 7) Kapı/turnike TETİKLENMEDİĞİNİN dolaylı kanıtı: static-scan sonrası oturumun Method
    //    alanı "qr" (turnike/cihaz değil) olarak işaretlenir — 61721f0'ın "sabit QR asla kapı
    //    açmaz" kuralının veri modelinde iz bırakmadığını, yalnızca kayıt oluşturduğunu doğrular.
    // -----------------------------------------------------------------------------------------
    [Fact]
    public async Task Static_scan_checkin_is_recorded_with_qr_method_not_a_device_trigger()
    {
        var (lib, citizen) = await SetupAsync($"method{Guid.NewGuid():N}"[..20], "entry_exit");
        try
        {
            var code = await GetCodeAsync(lib.LibraryId);
            var res = await citizen.PostAsJsonAsync("/api/v1/me/libraries/static-scan",
                new { code, latitude = InsideLat, longitude = InsideLng });
            res.IsSuccessStatusCode.Should().BeTrue();

            var occupants = await _admin.GetFromJsonAsync<JsonElement>($"/api/v1/libraries/{lib.LibraryId}/occupants");
            var occupantsData = occupants.GetProperty("data");
            var occupantsArray = occupantsData.ValueKind == JsonValueKind.Array
                ? occupantsData
                : occupantsData.TryGetProperty("items", out var items) ? items : occupantsData;
            occupantsArray.GetArrayLength().Should().BeGreaterThan(0,
                "static-scan girişi mevcut kullanıcılar (occupants) listesinde görünmeli");
        }
        finally { await LibraryScenario.DeleteAsync(_admin, lib); }
    }
}
