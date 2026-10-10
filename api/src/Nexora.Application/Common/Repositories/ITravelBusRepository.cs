using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Application.Common.Repositories;

public interface ITravelBusRepository : IRepository<TravelBus>
{
    Task<PagedResult<TravelBus>> GetPagedAsync(TravelBusListParams p, CancellationToken ct);
    Task<List<TravelBus>> GetByTravelAsync(Guid travelId, CancellationToken ct);
    Task<List<TravelBus>> GetAvailableAsync(Guid? forTravelId, DateTime? startDate, DateTime? endDate, CancellationToken ct);
    Task<int> CountByTravelAsync(Guid travelId, CancellationToken ct);
    Task<(int TotalBuses, int TotalCapacity, int TotalOccupied, int ActiveTravels)> GetSummaryAsync(Guid? travelId, CancellationToken ct);
    Task<List<TravelBusAssignment>> GetAssignmentsByTravelAsync(Guid travelId, CancellationToken ct);
    Task<TravelBusAssignment?> GetAssignmentAsync(Guid travelId, Guid busId, CancellationToken ct);
    Task AddAssignmentAsync(Guid travelId, Guid busId, string? seatStatesJson, CancellationToken ct);
    Task RemoveAssignmentsByBusForTravelAsync(Guid travelId, List<Guid> busIds, CancellationToken ct);
    Task<List<TravelBusAssignment>> GetUpcomingAssignmentsForBusAsync(Guid busId, DateTime fromDateUtc, CancellationToken ct);
    Task<List<TravelBusAssignment>> GetAllAssignmentsForBusesAsync(List<Guid> busIds, CancellationToken ct);
    Task<List<TravelBus>> GetBySourceBusIdAsync(Guid sourceBusId, CancellationToken ct);
    Task<Dictionary<Guid, string?>> GetNearestTravelNamesAsync(IEnumerable<Guid> busIds, CancellationToken ct);
    Task RemoveAssignmentsForBusAsync(Guid busId, CancellationToken ct);
}
