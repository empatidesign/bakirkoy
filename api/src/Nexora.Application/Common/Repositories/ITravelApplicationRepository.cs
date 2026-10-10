using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Application.Common.Repositories;

public interface ITravelApplicationRepository : IRepository<TravelApplication>
{
    Task<PagedResult<TravelApplication>> GetPagedAsync(TravelApplicationListParams p, CancellationToken ct);
    Task<TravelApplication?> GetWithPassengersAsync(Guid id, CancellationToken ct);
    Task<(int Total, int Approved, int Reviewing, int Rejected, int Waitlist)> GetSummaryAsync(Guid? travelId, CancellationToken ct);
    Task<Dictionary<Guid, (int Approved, int Waitlist)>> CountByTravelsAsync(IReadOnlyCollection<Guid> travelIds, CancellationToken ct);
    Task<int> CountByTravelAndStatusAsync(Guid travelId, string status, CancellationToken ct);
    Task<TravelApplication?> GetOldestWaitlistAsync(Guid travelId, CancellationToken ct);
    Task<List<TravelApplication>> GetWaitlistOrderedAsync(Guid travelId, CancellationToken ct);
    Task<int> CountActiveByParticipantInTravelWindowAsync(Guid participantId, DateTime start, DateTime end, Guid? excludeTravelId, CancellationToken ct);
    Task<int> CountActiveByGuestTcknInTravelWindowAsync(string tckn, DateTime start, DateTime end, Guid? excludeTravelId, CancellationToken ct);
    Task<int> NextCodeNumberAsync(CancellationToken ct);
    Task<List<TravelApplication>> GetActiveByParticipantAsync(Guid participantId, CancellationToken ct);
    Task<List<TravelApplication>> GetActiveByGuestTcknAsync(string tckn, CancellationToken ct);
    Task<PagedResult<TravelApplication>> GetByParticipantsAsync(List<Guid> participantIds, string? status, string? period, int page, int limit, CancellationToken ct, string? search = null);
    Task<List<Guid>> GetParticipantIdsByTravelsAsync(IReadOnlyCollection<Guid> travelIds, CancellationToken ct);
    Task<List<TravelApplication>> GetActiveByParticipantsAndTravelAsync(List<Guid> participantIds, Guid travelId, CancellationToken ct);
    Task<int> CountActiveChildrenOnTravelAsync(Guid travelId, IReadOnlyCollection<Guid> childParticipantIds, IReadOnlyCollection<Guid> excludeApplicationIds, CancellationToken ct);
    Task<List<TravelApplicationPassenger>> GetPassengersByBusAsync(Guid busId, CancellationToken ct);
    Task<List<TravelApplicationPassenger>> GetSeatedPassengersAsync(Guid travelId, Guid busId, CancellationToken ct);
    Task<List<SeatedPassengerNameDto>> GetSeatedPassengerNamesAsync(Guid travelId, Guid busId, CancellationToken ct);
    Task<bool> IsSeatTakenAsync(Guid busId, string seatNumber, Guid? excludePassengerId, CancellationToken ct);
    Task<bool> AnyApprovedByParticipantAsync(Guid participantId, CancellationToken ct);
    Task<List<TravelApplication>> GetForExportAsync(TravelApplicationListParams p, CancellationToken ct);
    Task<List<TravelApplicationPassenger>> GetActivePassengersByBusAsync(Guid travelId, Guid busId, CancellationToken ct);
    Task<List<string>> GetDistinctNeighborhoodsAsync(Guid? travelId, CancellationToken ct);
}
