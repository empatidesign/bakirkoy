using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenIdentity;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Loyalty.Requests;
using Nexora.Domain.Entities.Events;

namespace Nexora.Infrastructure.Services;

public class EventAttendanceService(IUnitOfWork uow, IActivityLogger log, ICitizenIdentityQrService cidQr, IParticipantNotificationService participantNotify, IExcelService excelService, ILoyaltyService loyalty, IEventSettingsService eventSettings, ICurrentUser currentUser, IUserScopeService userScope) : IEventAttendanceService
{
    // DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR export/import denetimi, madde #4): diğer tüm kardeş
    // modüllerle (EventApplicationService.EnsureEventInScopeAsync) aynı kapsam kontrolü —
    // önceden bu servis kapsam filtresi hiç uygulamıyordu, sessions.view iznine sahip ama
    // belirli bir etkinliğe atanmış (superadmin olmayan) bir admin, eventId filtresi vermeden
    // TÜM etkinliklerin TC kimlik no + ad-soyad içeren check-in kayıtlarını export edebiliyordu.
    private async Task<IReadOnlyCollection<Guid>?> GetScopedEventIdsAsync(CancellationToken ct)
        => currentUser.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, "events", ct) : null;

    public async Task<PagedResult<ActivityDto>> GetActivityAsync(ActivityListParams p, CancellationToken ct)
    {
        var scopedIds = await GetScopedEventIdsAsync(ct);
        var paged = await uow.EventActivities.GetPagedAsync(p, scopedIds, ct);
        return new PagedResult<ActivityDto>
        {
            Items = await MapActivitiesAsync(paged.Items, ct),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<ActivitySummaryDto> GetActivitySummaryAsync(ActivityListParams p, CancellationToken ct)
    {
        var scopedIds = await GetScopedEventIdsAsync(ct);
        var (checkIn, checkOut, kiosk, walkIn) = await uow.EventActivities.GetSummaryAsync(p, scopedIds, ct);
        return new ActivitySummaryDto(checkIn, checkOut, kiosk, walkIn);
    }

    public async Task<(byte[] Content, string FileName)> ExportAsync(ActivityListParams p, CancellationToken ct)
    {
        var exportParams = p with { Page = "1", Limit = "10000" };
        var paged = await GetActivityAsync(exportParams, ct);

        string eventName;
        DateTime? eventDate = null;

        if (p.EventId.HasValue)
        {
            var ev = await uow.Events.GetByIdAsync(p.EventId.Value, ct);
            eventName = ev?.Name ?? paged.Items.FirstOrDefault()?.EventName ?? "Etkinlik";
            eventDate = ev?.StartDate;
        }
        else
        {
            eventName = "tum-etkinlikler";
        }

        var bytes = excelService.BuildEventAttendanceExport(paged.Items, eventName);
        var safeName = string.Concat(eventName.Where(c => !Path.GetInvalidFileNameChars().Contains(c))).Trim();
        var datePart = p.Date.HasValue
            ? $"-{p.Date.Value:yyyyMMdd}"
            : (eventDate.HasValue ? $"-{eventDate.Value:yyyyMMdd}" : $"-{DateTime.UtcNow:yyyyMMdd}");
        return (bytes, $"{safeName}-etkinlik-katilim{datePart}.xlsx");
    }

    public async Task<ActivityDto> CheckInAsync(CheckInRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CheckInAsync), new { req.QrCode, req.EventId, req.Kind });

        Guid eventId;
        Guid? sessionId;
        Guid? participantId;
        string name;
        string tckn;
        var walkIn = req.WalkIn;

        if (!string.IsNullOrWhiteSpace(req.QrCode))
        {
            var (qrVerified, subjectId) = await cidQr.TryVerifyAsync(req.QrCode, ct);
            if (!qrVerified)
                throw new ConflictException("Geçersiz veya süresi dolmuş QR kod. Lütfen yenileyin.", "QR_INVALID");

            if (!req.EventId.HasValue)
                throw new ConflictException("Etkinlik seçilmeden QR ile giriş yapılamaz.", "EVENT_REQUIRED");

            var appList = await uow.EventApplications.FindAsync(
                a => a.ParticipantId == subjectId && a.EventId == req.EventId.Value, ct);
            var app = PickApplication(appList, req.SessionId)
                ?? throw new NotFoundException("Bu etkinlik için onaylı başvurunuz bulunamadı.", "APPLICATION_NOT_FOUND");

            eventId = app.EventId;
            sessionId = app.SessionId ?? req.SessionId;
            participantId = subjectId;
            walkIn = false;
            var part2 = await uow.Participants.GetByIdAsync(subjectId, ct);
            name = part2?.FullName ?? "";
            tckn = part2?.Tckn ?? "";
        }
        else
        {
            if (!req.EventId.HasValue)
                throw new ConflictException("Etkinlik veya QR kod gereklidir.", "CHECKIN_TARGET_REQUIRED");

            eventId = req.EventId.Value;
            sessionId = req.SessionId;
            participantId = req.ParticipantId;

            if (req.ParticipantId.HasValue)
            {
                if (!walkIn)
                {
                    var appList = await uow.EventApplications.FindAsync(
                        a => a.ParticipantId == req.ParticipantId.Value && a.EventId == req.EventId.Value, ct);
                    var app = PickApplication(appList, req.SessionId)
                        ?? throw new ConflictException("Bu katılımcının bu etkinlik için onaylı başvurusu bulunmuyor.", "APPLICATION_NOT_APPROVED");
                    sessionId = app.SessionId ?? req.SessionId;
                }

                var part = await uow.Participants.GetByIdAsync(req.ParticipantId.Value, ct);
                name = part?.FullName ?? req.ParticipantName ?? "";
                tckn = part?.Tckn ?? req.Tckn ?? "";
            }
            else
            {
                name = string.IsNullOrWhiteSpace(req.ParticipantName) ? "Misafir" : req.ParticipantName!;
                tckn = req.Tckn ?? "";
                walkIn = true;
            }
        }

        var ev = await uow.Events.GetByIdAsync(eventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var kind = req.Kind == "check_out" ? "check_out" : "check_in";
        var method = string.IsNullOrWhiteSpace(req.Method) ? "Manuel" : req.Method;

        var access = ReadAccess(ev.AccessJson);

        if (kind == "check_in" && !access.AttendanceEnabled)
            throw new ConflictException("Bu etkinlikte yoklama alınmıyor.", "ATTENDANCE_DISABLED");

        if (string.Equals(method, "QR", StringComparison.OrdinalIgnoreCase) && !access.QrEnabled)
            throw new ConflictException("Bu etkinlikte QR ile giriş kapalı.", "QR_DISABLED");

        if (string.Equals(method, "Kiosk", StringComparison.OrdinalIgnoreCase) && !access.KioskEnabled)
            throw new ConflictException("Bu etkinlikte kiosk girişi kapalı.", "KIOSK_DISABLED");

        if (string.Equals(method, "Turnike", StringComparison.OrdinalIgnoreCase) && !access.TurnstileEnabled)
            throw new ConflictException("Bu etkinlikte turnike girişi kapalı.", "TURNSTILE_DISABLED");

        if (kind == "check_out" && access.EntryMethod != "checkin-checkout")
            throw new ConflictException("Bu etkinlikte çıkış kaydı alınmıyor.", "CHECKOUT_DISABLED");

        // Denetim bulgusu (2026-09-05, canlı test): giriş/çıkış birbirini takip etmiyordu —
        // aynı katılımcı check-out yapmadan art arda sınırsız "check_in" atabiliyordu (her
        // deneme ayrı bir EventActivity kaydı oluşturuyor, admin panelindeki "Giriş" sayacı
        // gerçek kişi sayısından fazla görünüyordu) ve hiç check-in yapmamış biri doğrudan
        // "check_out" kaydı oluşturabiliyordu. Bilinen (anonim olmayan) katılımcılar için
        // giriş/çıkışın alternate etmesi zorlanır; anonim walk-in (participantId yok) için
        // takip edilecek bir kimlik olmadığından bu kontrol atlanır.
        if (participantId.HasValue)
        {
            var lastKind = await uow.EventActivities.GetLastKindAsync(eventId, sessionId, participantId.Value, ct);
            if (kind == "check_in" && lastKind == "check_in")
                throw new ConflictException("Bu katılımcı için zaten açık bir giriş kaydı var. Önce çıkış yapılmalı.", "ALREADY_CHECKED_IN");
            if (kind == "check_out" && lastKind != "check_in")
                throw new ConflictException("Bu katılımcı için giriş kaydı bulunmuyor, çıkış yapılamaz.", "NOT_CHECKED_IN");
        }

        if ((!walkIn && participantId.HasValue) || string.Equals(method, "QR", StringComparison.OrdinalIgnoreCase))
            await EnforceEventGeofenceAsync(ev, access, req.Latitude, req.Longitude, ct);

        string? lateStatusOverride = null;
        var startAt = await ResolveStartAtAsync(ev, sessionId, ct);
        if (startAt is not null)
        {
            var attendanceSettings = (await eventSettings.GetAsync(ct)).Attendance;
            var minutesSinceStart = (DateTime.UtcNow - startAt.Value).TotalMinutes;

            if (kind == "check_in")
            {
                if (attendanceSettings.OpenBeforeMinutes > 0 && minutesSinceStart < -attendanceSettings.OpenBeforeMinutes)
                    throw new ConflictException(
                        $"Bu etkinlik için giriş henüz açılmadı. Giriş, başlangıçtan {attendanceSettings.OpenBeforeMinutes} dakika önce açılır.",
                        "ATTENDANCE_NOT_OPEN");

                if (attendanceSettings.CloseAfterMinutes > 0 && minutesSinceStart > attendanceSettings.CloseAfterMinutes)
                    throw new ConflictException(
                        $"Bu etkinlik için yoklama süresi doldu (başlangıçtan {attendanceSettings.CloseAfterMinutes} dakika sonra kapanır).",
                        "ATTENDANCE_CLOSED");

                if (attendanceSettings.LateThresholdMinutes > 0 && minutesSinceStart > attendanceSettings.LateThresholdMinutes)
                    lateStatusOverride = "Geç Kaldı";
            }
            else
            {
                if (minutesSinceStart < 0)
                    throw new ConflictException(
                        "Etkinlik henüz başlamadı, çıkış kaydı alınamaz.",
                        "CHECKOUT_NOT_OPEN");

                if (attendanceSettings.CheckOutCloseAfterMinutes > 0 && minutesSinceStart > attendanceSettings.CheckOutCloseAfterMinutes)
                    throw new ConflictException(
                        $"Bu etkinlik için çıkış kaydı süresi doldu (başlangıçtan {attendanceSettings.CheckOutCloseAfterMinutes} dakika sonra kapanır).",
                        "CHECKOUT_CLOSED");
            }
        }

        var points = kind == "check_in" && method == "QR" ? ComputePoints(ev.PointsJson, walkIn) : 0;
        var status = lateStatusOverride ?? (walkIn ? "Başvurusuz" : "Katıldı");

        var activity = EventActivity.Create(kind, DateTime.UtcNow, eventId, sessionId, participantId, name, tckn, method, status, walkIn, points);
        await uow.EventActivities.AddAsync(activity, ct);

        await uow.SaveChangesAsync(ct);

        if (points > 0 && kind == "check_in" && !walkIn && participantId is Guid awardPid)
        {
            var already = await uow.LoyaltyTransactions.ExistsAsync(awardPid, "event_attendance", eventId.ToString(), ct);
            if (!already)
                await loyalty.AwardPointsAsync(new AwardPointsRequest(awardPid, "event_attendance", eventId.ToString(), points), ct);
        }

        if (!walkIn && participantId.HasValue && participantId.Value != Guid.Empty)
        {
            var notice = kind == "check_in"
                ? $"{ev.Name} etkinliğine giriş kaydınız alındı." + (points > 0 ? $" {points} puan kazandınız." : "")
                : $"{ev.Name} etkinliğinden çıkış kaydınız alındı.";
            await participantNotify.NotifyAsync([participantId.Value], notice, ct);
        }

        return (await MapActivitiesAsync([activity], ct)).First();
    }

    private static readonly TimeZoneInfo TurkeyTz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    private async Task<DateTime?> ResolveStartAtAsync(Event ev, Guid? sessionId, CancellationToken ct)
    {
        if (sessionId.HasValue)
        {
            var session = await uow.Sessions.GetByIdAsync(sessionId.Value, ct);
            if (session is not null)
                return CombineDateAndTime(session.Date, session.StartTime);
        }
        return CombineDateAndTime(ev.StartDate, ev.StartTime ?? "");
    }

    /// <summary>
    /// Yoklama için kullanılacak onaylı başvuruyu seçer.
    /// BULGU (2026-09-06, aile senaryosu canlı testi): eskiden koşulsuz
    /// <c>FirstOrDefault(a =&gt; a.Status == "approved")</c> kullanılıyordu; istekte gelen
    /// <paramref name="requestedSessionId"/> tamamen yok sayılıyordu. Aynı etkinliğin birden çok
    /// seansına başvuran bir katılımcı, bugünkü seansına giriş yapmak istediğinde gelecekteki
    /// başvurusu seçiliyor ve haksız yere <c>ATTENDANCE_NOT_OPEN</c> alıyordu (canlı kanıt:
    /// 13 Eylül 20:00 + bugün 23:45 başvurusu olan katılımcı bugünkü seansa giriş yapamadı;
    /// gelecekteki başvuru iptal edilince giriş 200 döndü).
    /// Düzeltme: seans belirtilmişse önce o seansın onaylı başvurusu aranır; yoksa seans bağımsız
    /// (SessionId = null) başvuruya düşülür; hiçbiri yoksa eski davranış (ilk onaylı) korunur.
    /// </summary>
    internal static EventApplication? PickApplication(
        IEnumerable<EventApplication> applications,
        Guid? requestedSessionId)
    {
        var approved = applications.Where(a => a.Status == "approved").ToList();
        if (requestedSessionId.HasValue)
        {
            var exact = approved.FirstOrDefault(a => a.SessionId == requestedSessionId.Value);
            if (exact is not null) return exact;

            var sessionless = approved.FirstOrDefault(a => a.SessionId is null);
            if (sessionless is not null) return sessionless;
        }
        return approved.FirstOrDefault();
    }

    internal static DateTime CombineDateAndTime(DateTime date, string time)
    {
        if (TimeSpan.TryParse(time, out var parsed))
        {
            // DÜZELTME (2026-10-02, QR check-in zaman penceresi canlı testiyle bulundu):
            // `date` (ev.StartDate) DB'den DAİMA UTC olarak gelir (bkz. TurkeyDateTimeConverter —
            // admin panelin gönderdiği yerel "2026-10-02T00:00" TR saati UTC'ye çevrilip saklanır,
            // örn. 2026-10-01T21:00:00Z). Eskiden burada doğrudan `date.Date` alınıyordu — bu,
            // UTC'nin TAKVİM GÜNÜNÜ (1 Ekim) döndürür, TR takvim gününü (2 Ekim) DEĞİL. O yanlış
            // güne StartTime (TR saati niyetinde, örn. 17:13) eklenip tekrar TR→UTC çevrilince,
            // sonuç gerçek başlangıçtan ~1 gün (saat dilimi farkına göre) geriye kayıyordu — bu da
            // yeni oluşturulmuş, ŞU AN başlayan bir etkinlikte anında "ATTENDANCE_CLOSED (60 dakika
            // önce kapandı)" hatasına yol açıyordu (canlı API testiyle doğrulandı: UTC 21:00-23:59
            // aralığındaki her gece saati bu hataya düşürüyordu). Düzeltme: önce UTC `date`'i TR
            // yerel saatine çevirip ORADAN takvim gününü al, StartTime'ı o doğru güne ekle.
            var turkeyDate = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(date, DateTimeKind.Utc), TurkeyTz).Date;
            var local = DateTime.SpecifyKind(turkeyDate.Add(parsed), DateTimeKind.Unspecified);
            return TimeZoneInfo.ConvertTimeToUtc(local, TurkeyTz);
        }
        return date;
    }

    private async Task EnforceEventGeofenceAsync(Event ev, EventAccessConfigDto access, double? latitude, double? longitude, CancellationToken ct)
    {
        var (targetLat, targetLon) = await ResolveEventCoordinatesAsync(ev, ct);
        Nexora.Application.Common.LocationAccessGuard.EnsureInside(targetLat, targetLon, access.GeofenceRadiusMeters, latitude, longitude);
    }

    private async Task<(double? Lat, double? Lon)> ResolveEventCoordinatesAsync(Event ev, CancellationToken ct)
    {
        if (ev.HallId.HasValue)
        {
            var hall = await uow.Halls.GetByIdAsync(ev.HallId.Value, ct);
            if (hall is not null)
            {
                var facility = await uow.ServiceFacilities.GetByIdAsync(hall.FacilityId, ct);
                if (facility?.Latitude is not null && facility.Longitude is not null)
                    return (facility.Latitude, facility.Longitude);
            }
        }

        if (ev.FacilityId.HasValue)
        {
            var facility = await uow.ServiceFacilities.GetByIdAsync(ev.FacilityId.Value, ct);
            if (facility?.Latitude is not null && facility.Longitude is not null)
                return (facility.Latitude, facility.Longitude);
        }

        if (!string.IsNullOrWhiteSpace(ev.LocationJson))
        {
            try
            {
                var loc = System.Text.Json.JsonSerializer.Deserialize<EventLocationDto>(ev.LocationJson, JsonOpts);
                if (loc?.Latitude is not null && loc.Longitude is not null)
                    return (loc.Latitude, loc.Longitude);
            }
            catch (System.Text.Json.JsonException) {  }
        }

        return (null, null);
    }

    private async Task<List<ActivityDto>> MapActivitiesAsync(List<EventActivity> items, CancellationToken ct)
    {
        if (items.Count == 0) return [];

        var eventIds = items.Select(a => a.EventId).Distinct().ToList();
        var events = (await uow.Events.FindAsync(e => eventIds.Contains(e.Id), ct)).ToDictionary(e => e.Id);
        var sessionIds = items.Where(a => a.SessionId.HasValue).Select(a => a.SessionId!.Value).Distinct().ToList();
        var sessions = sessionIds.Count == 0
            ? new Dictionary<Guid, Session>()
            : (await uow.Sessions.FindAsync(s => sessionIds.Contains(s.Id), ct)).ToDictionary(s => s.Id);

        return items.Select(a =>
        {
            var session = a.SessionId.HasValue ? sessions.GetValueOrDefault(a.SessionId.Value) : null;
            var sessionLabel = session is not null ? $"{session.Date:dd.MM.yyyy} · {session.StartTime}-{session.EndTime}" : null;
            return new ActivityDto(
                a.Id, a.Kind, a.At, a.EventId, events.GetValueOrDefault(a.EventId)?.Name ?? "",
                sessionLabel, a.ParticipantName, a.Tckn, a.Method, a.Status, a.WalkIn);
        }).ToList();
    }

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private static EventAccessConfigDto ReadAccess(string accessJson)
    {
        try
        {
            return JsonSerializer.Deserialize<EventAccessConfigDto>(accessJson, JsonOpts)
                ?? new EventAccessConfigDto(false, false, "none", "manual", true, "checkin", true, "rotating", 30, false, false, false, false, []);
        }
        catch
        {
            return new EventAccessConfigDto(false, false, "none", "manual", true, "checkin", true, "rotating", 30, false, false, false, false, []);
        }
    }

    private static int ComputePoints(string pointsJson, bool walkIn)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(pointsJson) ? "{}" : pointsJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return 0;

            if (!(root.TryGetProperty("enabled", out var enabled) && enabled.ValueKind == JsonValueKind.True))
                return 0;

            if (walkIn && !(root.TryGetProperty("walkInEarnsPoints", out var w) && w.ValueKind == JsonValueKind.True))
                return 0;

            var basePoints = root.TryGetProperty("basePoints", out var b) && b.TryGetInt32(out var bp) ? bp : 0;
            return basePoints < 0 ? 0 : basePoints;
        }
        catch
        {
            return 0;
        }
    }

    // Kullanıcı isteği (2026-10-06): "QR okutma kütüphane/tesislerde olduğu gibi cihazlı veya
    // cihazsız çalışsın, aynı mantık her yerde geçerli olsun" — cihazlı turnike zaten
    // FacilityDevice (Scope=Event, Hall'a bağlı) ile çalışıyordu (apiKey maskeleme dahil aynı
    // altyapı); eksik olan Facility/Library'deki "sabit (duvar) QR'ı vatandaş kendi telefonuyla
    // okutur" akışının etkinlik karşılığıydı. Aşağıdaki metodlar FacilityAttendanceService'teki
    // GetStaticQrAsync/.../ScanStaticQrAsync ile BİREBİR aynı sözleşme ve davranışı uygular;
    // tek fark Event'in Facility'den daha basit veri modeli (bir başvuru en fazla BİR seansa
    // bağlıdır, Facility'deki "bugünün hangi tekrarlayan seansı" aramasına gerek yoktur).
    private const string StaticQrEntrySuffix = "-giris";
    private const string StaticQrExitSuffix = "-cikis";

    private static (string BaseCode, string? Direction) ParseStaticQrCode(string code)
    {
        foreach (var suffix in new[] { StaticQrEntrySuffix, StaticQrExitSuffix })
            if (code.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                return (code[..^suffix.Length], suffix);
        return (code, null);
    }

    private async Task<Event> GetEventOrThrowAsync(Guid eventId, CancellationToken ct)
        => await uow.Events.GetByIdAsync(eventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

    private static EventStaticQrDto ToStaticQrDto(Event ev)
    {
        var code = ev.StaticQrEnabled ? ev.StaticQrCode : null;
        var split = code is not null && ev.StaticQrMode == "split";
        return new(ev.StaticQrEnabled, ev.StaticQrMode, code,
            split ? code + StaticQrEntrySuffix : null,
            split ? code + StaticQrExitSuffix : null,
            ev.StaticQrMinExitSeconds,
            ev.StaticQrReentryCooldownSeconds);
    }

    private async Task<string> GenerateStaticQrCodeAsync(CancellationToken ct)
    {
        string code;
        do { code = "nxr-evt_" + Guid.NewGuid().ToString("N"); }
        while (await uow.Events.ExistsByStaticQrCodeAsync(code, ct));
        return code;
    }

    public async Task<EventStaticQrDto> GetStaticQrAsync(Guid eventId, CancellationToken ct)
        => ToStaticQrDto(await GetEventOrThrowAsync(eventId, ct));

    public async Task<EventStaticQrDto> ToggleStaticQrAsync(Guid eventId, bool enabled, CancellationToken ct)
    {
        var ev = await GetEventOrThrowAsync(eventId, ct);
        if (enabled && string.IsNullOrWhiteSpace(ev.StaticQrCode))
            ev.RotateStaticQrCode(await GenerateStaticQrCodeAsync(ct));
        ev.SetStaticQrEnabled(enabled);
        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);
        return ToStaticQrDto(ev);
    }

    public async Task<EventStaticQrDto> SetStaticQrModeAsync(Guid eventId, string mode, CancellationToken ct)
    {
        var ev = await GetEventOrThrowAsync(eventId, ct);
        ev.SetStaticQrMode(mode);
        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);
        return ToStaticQrDto(ev);
    }

    public async Task<EventStaticQrDto> SetStaticQrTimingAsync(Guid eventId, int minExitSeconds, int reentryCooldownSeconds, CancellationToken ct)
    {
        var ev = await GetEventOrThrowAsync(eventId, ct);
        ev.SetStaticQrTiming(minExitSeconds, reentryCooldownSeconds);
        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);
        return ToStaticQrDto(ev);
    }

    public async Task<EventStaticQrDto> RotateStaticQrAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await GetEventOrThrowAsync(eventId, ct);
        ev.RotateStaticQrCode(await GenerateStaticQrCodeAsync(ct));
        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);
        return ToStaticQrDto(ev);
    }

    public async Task<EventStaticQrScanResultDto> ScanStaticQrAsync(string staticCode, Guid participantId, CancellationToken ct, double? latitude = null, double? longitude = null)
    {
        static EventStaticQrScanResultDto Deny(string msg, string? errorCode = null) => new(false, msg, null, null, null, errorCode);

        if (string.IsNullOrWhiteSpace(staticCode))
            return Deny("Geçersiz QR kodu.", "INVALID_QR");

        var (baseCode, direction) = ParseStaticQrCode(staticCode.Trim());
        var ev = await uow.Events.GetByStaticQrCodeAsync(baseCode, ct);
        if (ev is null || !ev.StaticQrEnabled)
            return Deny("Geçersiz veya devre dışı QR kodu.", "INVALID_QR");

        if (!ev.IsActive)
            return Deny("Bu etkinlik şu anda kapalı.", "EVENT_INACTIVE");

        var access = ReadAccess(ev.AccessJson);
        // Denetim bulgusu 2026-10-06: Facility.ScanStaticQrAsync'teki aynı desen — konum
        // yüzünden reddedilen bir tarama "QR kodu geçersiz" gibi görünmemeli, frontend'in
        // "Konumu Aç" aksiyonu gösterebilmesi için özel hata kodu ile anlamlı mesaj dönülür.
        try
        {
            await EnforceEventGeofenceAsync(ev, access, latitude, longitude, ct);
        }
        catch (ConflictException ex) when (ex.ErrorCode == "OUTSIDE_GEOFENCE")
        {
            return Deny($"Şu an {ev.Name} konumunda değilsiniz, giriş/çıkış yapamazsınız. Etkinlik alanının yakınına gelip tekrar deneyin.", "OUTSIDE_GEOFENCE");
        }
        catch (ConflictException ex) when (ex.ErrorCode == "LOCATION_REQUIRED")
        {
            return Deny("Konumunuz alınamadı, işlem yapılamadı. Telefonunuzun konum servisini açın ve uygulamaya konum izni verin.", "LOCATION_REQUIRED");
        }
        catch (ConflictException ex) when (ex.ErrorCode == "LOCATION_NOT_CONFIGURED")
        {
            return Deny(ex.Message, "LOCATION_NOT_CONFIGURED");
        }

        var participant = await uow.Participants.GetByIdAsync(participantId, ct);
        if (participant is null)
            return Deny("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var apps = await uow.EventApplications.FindAsync(a => a.ParticipantId == participantId && a.EventId == ev.Id, ct);
        var app = PickApplication(apps, null);
        if (app is null)
            return Deny("Bu etkinlik için onaylı başvurunuz bulunamadı.", "NO_APPLICATION");

        var sessionId = app.SessionId;
        if (sessionId.HasValue && await uow.Sessions.GetByIdAsync(sessionId.Value, ct) is null)
            return Deny("Seans bulunamadı.", "SESSION_NOT_FOUND");

        var startAt = await ResolveStartAtAsync(ev, sessionId, ct);
        if (startAt is not null)
        {
            var attendanceSettings = (await eventSettings.GetAsync(ct)).Attendance;
            var minutesSinceStart = (DateTime.UtcNow - startAt.Value).TotalMinutes;
            if (attendanceSettings.OpenBeforeMinutes > 0 && minutesSinceStart < -attendanceSettings.OpenBeforeMinutes)
                return Deny($"Bu etkinlik için giriş henüz açılmadı. Giriş, başlangıçtan {attendanceSettings.OpenBeforeMinutes} dakika önce açılır.", "ATTENDANCE_NOT_OPEN");
            if (attendanceSettings.CloseAfterMinutes > 0 && minutesSinceStart > attendanceSettings.CloseAfterMinutes)
                return Deny($"Bu etkinlik için yoklama süresi doldu (başlangıçtan {attendanceSettings.CloseAfterMinutes} dakika sonra kapanır).", "ATTENDANCE_CLOSED");
        }

        var mode = ev.StaticQrMode;
        // Güvenlik (Facility.ScanStaticQrAsync'teki aynı not): sabit/duvar QR'ı fotoğraflanıp
        // paylaşılabilen, kişiye özel olmayan statik bir koddur — hiçbir modda fiziksel kapı/
        // turnike TETİKLEMEZ. Yalnızca giriş/çıkış KAYDI düşer.
        if (mode == "split" && direction is null)
            return Deny("Bu etkinlikte giriş ve çıkış için ayrı QR kodları kullanılır. Kapıdaki Giriş veya Çıkış QR'ını okutun.", "INVALID_QR");

        var last = await uow.EventActivities.GetLastAsync(ev.Id, sessionId, participantId, ct);
        var hasOpenCheckIn = last is not null && last.Kind == "check_in";

        var wantExit = (mode is "attendance" or "entry_exit" && hasOpenCheckIn)
            || (mode == "split" && direction == StaticQrExitSuffix);

        if (wantExit && hasOpenCheckIn)
        {
            var secondsSinceEntry = (DateTime.UtcNow - last!.At).TotalSeconds;
            if (secondsSinceEntry < ev.StaticQrMinExitSeconds)
            {
                var remain = Math.Max(1, (int)Math.Ceiling(ev.StaticQrMinExitSeconds - secondsSinceEntry));
                return new EventStaticQrScanResultDto(true,
                    $"Giriş zaten kaydedildi. Çıkış için en az {ev.StaticQrMinExitSeconds} sn sonra tekrar okutun (yaklaşık {remain} sn kaldı).",
                    participant.FullName, ev.Name, "entry");
            }
        }

        if (wantExit)
        {
            if (!hasOpenCheckIn)
                return Deny("İçeride aktif bir kaydınız bulunmuyor. Giriş için Giriş QR'ını okutun.", "NO_ACTIVE_SESSION");
            var checkout = EventActivity.Create("check_out", DateTime.UtcNow, ev.Id, sessionId, participantId,
                participant.FullName, participant.Tckn, "StaticQR", "Katıldı", false, 0);
            await uow.EventActivities.AddAsync(checkout, ct);
            await uow.SaveChangesAsync(ct);
            return new EventStaticQrScanResultDto(true, "Çıkış onaylandı.", participant.FullName, ev.Name, "exit");
        }

        if (mode == "split" && direction == StaticQrEntrySuffix && hasOpenCheckIn)
            return new EventStaticQrScanResultDto(false, "Zaten içeride aktif bir kaydınız var.", participant.FullName, ev.Name, null);

        if (hasOpenCheckIn)
            return new EventStaticQrScanResultDto(false, "Bu etkinlik için giriş zaten yapılmış.", participant.FullName, ev.Name, null);

        if (ev.StaticQrReentryCooldownSeconds > 0 && last is not null && last.Kind == "check_out")
        {
            var secondsSinceExit = (DateTime.UtcNow - last.At).TotalSeconds;
            if (secondsSinceExit < ev.StaticQrReentryCooldownSeconds)
            {
                var remain = Math.Max(1, (int)Math.Ceiling(ev.StaticQrReentryCooldownSeconds - secondsSinceExit));
                return Deny($"Çok yakın zamanda çıkış yaptınız. Tekrar giriş için {remain} sn daha bekleyin.", "REENTRY_COOLDOWN_ACTIVE");
            }
        }

        var points = ComputePoints(ev.PointsJson, false);
        var checkin = EventActivity.Create("check_in", DateTime.UtcNow, ev.Id, sessionId, participantId,
            participant.FullName, participant.Tckn, "StaticQR", "Katıldı", false, points);
        await uow.EventActivities.AddAsync(checkin, ct);
        await uow.SaveChangesAsync(ct);

        if (points > 0)
        {
            var already = await uow.LoyaltyTransactions.ExistsAsync(participantId, "event_attendance", ev.Id.ToString(), ct);
            if (!already)
                await loyalty.AwardPointsAsync(new AwardPointsRequest(participantId, "event_attendance", ev.Id.ToString(), points), ct);
        }

        return new EventStaticQrScanResultDto(true, "Giriş onaylandı.", participant.FullName, ev.Name, "entry");
    }
}
