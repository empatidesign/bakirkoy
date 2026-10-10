using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Loyalty.Requests;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class TravelAttendanceService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IAuditService audit,
    IExcelService excelService,
    ILoyaltyService loyalty,
    IUserScopeService userScope,
    IConfiguration config) : ITravelAttendanceService
{
    private const string Module = "Travels";

    // TravelService.EnsureInScopeAsync ile ayni desen (Spor Salonu Madde 13 sinifi).
    private async Task EnsureInScopeAsync(Guid travelId, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedIds = await userScope.GetScopedRefIdsAsync(uid, "travels", ct);
        if (scopedIds is not null && !scopedIds.Contains(travelId))
            throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
    }

    // UAT 2026-09-24: Travel.StartDate/EndDate UTC saklanır (TurkeyDateTimeConverter). Önceden
    // burada UTC+3 duvar saati kullanılıyordu; yoklama penceresi 3 saat erken açılıp 3 saat erken
    // kapanıyordu (12:00-17:00 gezide 14:00'ten sonra "gezi bitti" hatası). Karşılaştırmalar UTC.
    private static DateTime LocalNow() => DateTime.UtcNow;

    public async Task<TravelAttendanceRosterDto> GetRosterAsync(Guid travelId, CancellationToken ct)
    {
        await EnsureInScopeAsync(travelId, ct);
        var travel = await uow.Travels.GetByIdAsync(travelId, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        var now = LocalNow();
        var started = now >= travel.StartDate;
        var ended = now >= travel.EndDate;
        var taken = travel.AttendanceTakenAt is not null;

        var items = await BuildRosterAsync(travelId, ct);

        return new TravelAttendanceRosterDto(
            travel.Id,
            travel.Name,
            travel.StartDate,
            travel.EndDate,
            started,
            ended,
            taken,
            travel.AttendanceTakenAt,
            travel.AttendanceReminderSentAt,
            ended && !taken,
            items);
    }

    public async Task<(byte[] Content, string FileName)> ExportAsync(Guid travelId, CancellationToken ct)
    {
        var roster = await GetRosterAsync(travelId, ct);
        var bytes = excelService.BuildTravelAttendanceExport(roster);
        var safeName = string.Concat(roster.TravelName.Where(c => !Path.GetInvalidFileNameChars().Contains(c))).Trim();
        return (bytes, $"{safeName} - Yoklama - {roster.StartDate:dd.MM.yyyy}.xlsx");
    }

    public async Task<SaveTravelAttendanceResultDto> SaveAsync(Guid travelId, SaveTravelAttendanceRequest req, CancellationToken ct)
    {
        await EnsureInScopeAsync(travelId, ct);
        var travel = await uow.Travels.GetByIdAsync(travelId, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        var now = LocalNow();
        if (now < travel.StartDate)
            throw new ConflictException("Gezi henüz başlamadı, yoklama alınamaz.", "TRAVEL_NOT_STARTED");

        if (now >= travel.EndDate)
            throw new ConflictException("Yoklama süresi doldu (gezi bitti); değişiklik yapılamaz.", "ATTENDANCE_WINDOW_CLOSED");

        if (travel.AttendanceTakenAt is not null)
            throw new ConflictException("Bu gezinin yoklaması zaten alınmış. Değiştirmek için yeniden açın.", "ATTENDANCE_ALREADY_TAKEN");

        var apps = (await uow.TravelApplications.FindAsync(a => a.TravelId == travelId && a.Status == "approved", ct))
            .ToDictionary(a => a.Id);
        var partIds = apps.Values.Where(a => !a.IsGuest).Select(a => a.ParticipantId).Distinct().ToList();
        var participants = (await uow.Participants.FindAsync(p => partIds.Contains(p.Id), ct)).ToDictionary(p => p.Id);
        var existing = (await uow.TravelAttendances.GetByTravelAsync(travelId, ct)).ToDictionary(x => x.ApplicationId);

        var marked = 0;
        var awardCandidates = new List<Guid>();
        foreach (var mark in req.Marks)
        {
            if (!apps.TryGetValue(mark.PassengerId, out var app)) continue;
            var status = NormalizeStatus(mark.Status);

            if (existing.TryGetValue(app.Id, out var record))
            {
                var wasPresent = record.Status is "present" or "late";
                record.SetStatus(status, "roster", currentUser.Name);
                uow.TravelAttendances.Update(record);
                if (!wasPresent && status is "present" or "late" && !app.IsGuest)
                    awardCandidates.Add(app.ParticipantId);
            }
            else
            {
                var (fullName, tckn) = ResolvePerson(app, participants);
                var entity = TravelAttendance.Create(travelId, app.Id, app.IsGuest ? null : app.ParticipantId,
                    fullName, tckn, status, "roster", currentUser.Name);
                await uow.TravelAttendances.AddAsync(entity, ct);
                if (status is "present" or "late" && !app.IsGuest)
                    awardCandidates.Add(app.ParticipantId);
            }
            marked++;
        }

        travel.MarkAttendanceTaken();
        uow.Travels.Update(travel);
        await uow.SaveChangesAsync(ct);

        // travel_join sadakat puanı: gezi başvurusu anında değil, yoklamada gerçekten
        // "geldi/geç geldi" işaretlenen kayıtlı (misafir olmayan) katılımcılara verilir.
        // Bu hem "başvur-hemen iptal et" sömürüsünü hem no-show'a puan verilmesini önler.
        // ReferenceId=travelId olduğu için aynı gezi için yoklama tekrar alınsa/değiştirilse
        // bile bir katılımcıya birden fazla travel_join transaction'ı oluşmaz (üstteki
        // wasPresent kontrolü zaten yeni present olanları filtreliyor, ayrıca DB'de bu
        // gezi+kişi için var olan transaction kontrolü ek güvenlik katmanıdır).
        //
        // Puan MİKTARI: admin panelde rota bazında "Puan Ver" (enabled) ve "Katılım Puanı"
        // (basePoints) alanları var (RouteForm.tsx) ve Travel.PointsJson'a yazılıyor, ama bu
        // alan önceden HİÇ okunmuyordu — her zaman sabit global travel_join kural puanı
        // veriliyordu, admin "Puan Ver"i kapatsa/farklı bir tutar girse bile hiçbir etkisi
        // olmuyordu (canlı test: basePoints=999 girildi, katılımcı yine sabit 25 aldı).
        // ComputeTravelPointsOverride: "enabled" alanı hiç yoksa (bu özellik eklenmeden
        // önce oluşturulmuş ~109 canlı rota "{}" taşıyor) geriye dönük uyumluluk için
        // eski davranış korunur (global kural puanı, override yok — mevcut vatandaşların
        // puan akışı bozulmaz). "enabled" alanı açıkça varsa artık gerçekten uygulanır:
        // false ise hiç puan verilmez, true ise basePoints override edilir.
        var travelPointsOverride = ComputeTravelPointsOverride(travel.PointsJson, out var travelPointsDisabled);
        if (!travelPointsDisabled)
        {
            foreach (var participantId in awardCandidates.Distinct())
            {
                var already = await uow.LoyaltyTransactions.ExistsAsync(participantId, "travel_join", travelId.ToString(), ct);
                if (!already)
                    await loyalty.AwardPointsAsync(new AwardPointsRequest(participantId, "travel_join", travelId.ToString(), travelPointsOverride), ct);
            }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Attendance,
            EntityType = "Travel",
            EntityId = travel.Id,
            Module = Module,
            Description = $"Gezi yoklaması alındı: {travel.Name} ({marked} yolcu)",
        }, ct);

        return new SaveTravelAttendanceResultDto(marked);
    }

    public async Task ReopenAsync(Guid travelId, CancellationToken ct)
    {
        await EnsureInScopeAsync(travelId, ct);
        var travel = await uow.Travels.GetByIdAsync(travelId, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        if (LocalNow() >= travel.EndDate)
            throw new ConflictException("Yoklama süresi doldu (gezi bitti); yeniden açılamaz.", "ATTENDANCE_WINDOW_CLOSED");

        travel.ReopenAttendance();
        uow.Travels.Update(travel);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Travel",
            EntityId = travel.Id,
            Module = Module,
            Description = $"Gezi yoklaması yeniden açıldı: {travel.Name}",
        }, ct);
    }

    private async Task<List<TravelAttendanceRosterItemDto>> BuildRosterAsync(Guid travelId, CancellationToken ct)
    {
        var apps = (await uow.TravelApplications.FindAsync(a => a.TravelId == travelId && a.Status == "approved", ct)).ToList();
        if (apps.Count == 0) return [];

        var partIds = apps.Where(a => !a.IsGuest).Select(a => a.ParticipantId).Distinct().ToList();
        var participants = (await uow.Participants.FindAsync(p => partIds.Contains(p.Id), ct)).ToDictionary(p => p.Id);

        var busIds = apps.Where(a => a.BusId.HasValue).Select(a => a.BusId!.Value).Distinct().ToList();
        var buses = busIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await uow.TravelBuses.FindAsync(b => busIds.Contains(b.Id), ct)).ToDictionary(b => b.Id, b => b.Name);

        var existing = (await uow.TravelAttendances.GetByTravelAsync(travelId, ct)).ToDictionary(x => x.ApplicationId);

        return apps.Select(a =>
        {
            var (fullName, tckn) = ResolvePerson(a, participants);
            var busName = a.BusId.HasValue ? buses.GetValueOrDefault(a.BusId.Value) : null;
            var status = existing.TryGetValue(a.Id, out var rec) ? rec.Status : "none";
            return new TravelAttendanceRosterItemDto(
                a.Id, a.Id, a.IsGuest ? null : a.ParticipantId,
                fullName, tckn, busName, a.SeatNumber, status);
        })
        .OrderBy(x => x.BusName).ThenBy(x => x.SeatNumber).ThenBy(x => x.FullName)
        .ToList();
    }

    private static (string FullName, string Tckn) ResolvePerson(
        TravelApplication app,
        Dictionary<Guid, Nexora.Domain.Entities.Participants.Participant> participants)
    {
        if (app.IsGuest)
            return ($"{app.GuestFullName ?? "Misafir"} (Misafir)", app.GuestTckn ?? "");
        var p = participants.GetValueOrDefault(app.ParticipantId);
        return (p?.FullName ?? "", p?.Tckn ?? "");
    }

    /// <summary>
    /// Travel.PointsJson'daki rota bazlı "Puan Ver" (enabled) / "Katılım Puanı" (basePoints)
    /// ayarını okur. "enabled" alanı JSON'da hiç yoksa (özellik eklenmeden önce oluşturulmuş
    /// eski rotalar, "{}") geriye dönük uyumluluk için disabled=false, override=null döner
    /// (global LoyaltyRules puanı kullanılır, mevcut davranış korunur). "enabled":false ise
    /// disabled=true (hiç puan verilmez). "enabled":true ise basePoints (negatifse/yoksa 0)
    /// PointsOverride olarak döner.
    /// </summary>
    private static int? ComputeTravelPointsOverride(string pointsJson, out bool disabled)
    {
        disabled = false;
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(pointsJson) ? "{}" : pointsJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;

            if (!root.TryGetProperty("enabled", out var enabled)) return null;

            if (enabled.ValueKind != JsonValueKind.True)
            {
                disabled = true;
                return null;
            }

            var basePoints = root.TryGetProperty("basePoints", out var b) && b.TryGetInt32(out var bp) ? bp : 0;
            return basePoints < 0 ? 0 : basePoints;
        }
        catch
        {
            return null;
        }
    }

    private static string NormalizeStatus(string? status) => (status ?? "").Trim().ToLowerInvariant() switch
    {
        "present" or "katıldı" or "geldi" => "present",
        "late" or "geç" => "late",
        _ => "absent",
    };
}
