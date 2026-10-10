using Nexora.Domain.Common;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenIdentity;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Scan;

namespace Nexora.Infrastructure.Services;

public class FacilityEntryScanService(
    IUnitOfWork uow,
    ICitizenIdentityQrService cidQr,
    IFacilityAttendanceService attendance,
    Microsoft.Extensions.Configuration.IConfiguration config) : IFacilityEntryScanService
{
    private int EntryWindowMinutes => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "FacilityScan:EntryWindowMinutes", 30);

    public async Task<FacilityEntryScanResultDto> ScanEntryAsync(FacilityEntryScanRequest req, CancellationToken ct)
    {
        var (verified, participantId) = await cidQr.TryVerifyAsync(req.Token, ct);
        if (!verified)
            throw new ConflictException("Geçersiz veya süresi dolmuş QR kodu. Lütfen yenileyin.", "INVALID_QR");

        var facility = await uow.ServiceFacilities.GetByIdAsync(req.ServiceFacilityId, ct)
            ?? throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");

        Nexora.Application.Common.LocationAccessGuard.EnsureInside(facility.Latitude, facility.Longitude,
            Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LocationValidation:DefaultRadiusMeters", Nexora.Application.Common.LocationAccessGuard.DefaultRadiusMeters), req.Latitude, req.Longitude);

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var facilityMembership = await CheckFacilityMembershipAsync(participantId, req.ServiceFacilityId, ct);
        if (facilityMembership is not null)
        {
            // Kullanıcı bulgusu (2026-08-04): tesis üyeliği (onaylı başvuru) tek başına giriş için
            // yeterli sayılıyordu — kişinin bugün/şu an eşleşen bir seansı olup olmadığına
            // bakılmadan "Granted: true" dönülüp turnike/kapı açılıyordu. Yani üyeliği olan biri
            // günün/saatin hiçbir önemi olmadan (seans başlamadan veya bittikten çok sonra bile)
            // içeri alınabiliyordu. RecordQrEntryAsync artık gerçekten eşleşen açık bir seans
            // bulunup bulunmadığını bildiriyor; bulunamazsa giriş reddedilir.
            var entered = await attendance.RecordQrEntryAsync(facilityMembership, req.ServiceFacilityId, participantId, ct);
            if (entered)
                return new FacilityEntryScanResultDto(true, $"{participant.FullName} için tesis üyeliği doğrulandı.", facilityMembership, participant.FullName);
        }

        var eventAccess = await CheckEventSessionAsync(participantId, req.ServiceFacilityId, ct);
        if (eventAccess is not null)
            return new FacilityEntryScanResultDto(true, $"{participant.FullName} için etkinlik girişi doğrulandı.", eventAccess, participant.FullName);

        return new FacilityEntryScanResultDto(false, "Bu tesise erişim hakkınız bulunmuyor.", null, participant.FullName);
    }

    private async Task<string?> CheckFacilityMembershipAsync(Guid participantId, Guid serviceFacilityId, CancellationToken ct)
    {
        var facilities = await uow.Facilities.FindAsync(f => f.ServiceFacilityId == serviceFacilityId, ct);
        if (facilities.Count == 0) return null;

        var facilityIds = facilities.Select(f => f.Id).ToHashSet();
        var apps = await uow.FacilityApplications.FindAsync(
            a => a.ParticipantId == participantId && a.Status == "approved" && facilityIds.Contains(a.FacilityId), ct);

        if (apps.Count == 0) return null;

        var matchedFacility = facilities.FirstOrDefault(f => apps.Any(a => a.FacilityId == f.Id));
        return matchedFacility?.Module;
    }

    private async Task<string?> CheckEventSessionAsync(Guid participantId, Guid serviceFacilityId, CancellationToken ct)
    {
        var halls = await uow.Halls.FindAsync(h => h.FacilityId == serviceFacilityId, ct);
        if (halls.Count == 0) return null;

        var hallIds = halls.Select(h => h.Id).ToHashSet();
        var apps = await uow.EventApplications.FindAsync(
            a => a.ParticipantId == participantId && a.Status == "approved", ct);

        var now = TurkeyTime.NowWallClock();
        var window = TimeSpan.FromMinutes(EntryWindowMinutes);

        foreach (var app in apps)
        {
            var ev = await uow.Events.GetByIdAsync(app.EventId, ct);
            if (ev is null || ev.HallId is null || !hallIds.Contains(ev.HallId.Value)) continue;

            if (app.SessionId.HasValue)
            {
                var session = await uow.Sessions.GetByIdAsync(app.SessionId.Value, ct);
                if (session is null || session.Date.Date != now.Date) continue;
                if (!TimeSpan.TryParse(session.StartTime, out var startTs)) continue;
                var sessionStart = session.Date.Date.Add(startTs);
                if (now >= sessionStart.Subtract(window) && now <= sessionStart.Add(window))
                    return "event";
            }
            else
            {
                if (now >= ev.StartDate.Subtract(window) && now <= ev.StartDate.Add(window))
                    return "event";
            }
        }

        return null;
    }
}
