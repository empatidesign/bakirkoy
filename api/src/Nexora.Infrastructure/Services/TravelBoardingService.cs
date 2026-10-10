using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Infrastructure.Services;

public class TravelBoardingService(IUnitOfWork uow, ICurrentUser currentUser, IUserScopeService userScope) : ITravelBoardingService
{
    public async Task<List<TravelBoardingBusDto>> GetBoardingManifestAsync(Guid travelId, CancellationToken ct)
    {
        if (currentUser.Id is Guid uid)
        {
            var scopedIds = await userScope.GetScopedRefIdsAsync(uid, "travels", ct);
            if (scopedIds is not null && !scopedIds.Contains(travelId))
                throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
        }

        if (await uow.Travels.GetByIdAsync(travelId, ct) is null)
            throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        var assignments = await uow.TravelBuses.GetAssignmentsByTravelAsync(travelId, ct);
        var allApps = await uow.TravelApplications.FindAsync(
            a => a.TravelId == travelId && a.Status == "approved", ct);

        var partIds = allApps.Select(a => a.ParticipantId).Distinct().ToList();
        var participants = (await uow.Participants.FindAsync(p => partIds.Contains(p.Id), ct)).ToDictionary(p => p.Id);

        var result = new List<TravelBoardingBusDto>();

        if (assignments.Count == 0)
        {
            result.Add(BuildBusGroup(Guid.Empty, "Otobüssüz", "", allApps.ToList(), participants));
        }
        else
        {
            foreach (var a in assignments)
            {
                var bus = await uow.TravelBuses.GetByIdAsync(a.BusId, ct);
                if (bus is null) continue;
                var busApps = allApps.Where(ap => ap.BusId == a.BusId).ToList();
                result.Add(BuildBusGroup(bus.Id, bus.Name, bus.PlateNumber, busApps, participants));
            }
        }

        return result;
    }

    private static TravelBoardingBusDto BuildBusGroup(
        Guid busId, string busName, string plate,
        List<Domain.Entities.Travels.TravelApplication> apps,
        Dictionary<Guid, Domain.Entities.Participants.Participant> participants)
    {
        var passengers = apps.Select(a =>
        {
            var personName = a.IsGuest
                ? $"{a.GuestFullName ?? "Misafir"} (Misafir)"
                : participants.GetValueOrDefault(a.ParticipantId)?.FullName ?? "";
            return new TravelBoardingPassengerDto(
                a.Id, a.Code, personName, a.SeatNumber,
                busId == Guid.Empty ? null : busName,
                a.Status);
        }).OrderBy(p => p.SeatNumber).ThenBy(p => p.PersonName).ToList();

        return new TravelBoardingBusDto(busId, busName, plate, passengers.Count, passengers);
    }
}
