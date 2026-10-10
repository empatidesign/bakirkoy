using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels;

public interface ITravelBusService
{
    Task<PagedResult<TravelBusDto>> GetPagedAsync(TravelBusListParams p, CancellationToken ct);
    Task<List<TravelBusDto>> GetByTravelAsync(Guid travelId, CancellationToken ct);
    Task<List<TravelBusDto>> GetAvailableAsync(Guid? forTravelId, DateTime? startDate, DateTime? endDate, CancellationToken ct);
    Task<TravelBusSummaryDto> GetSummaryAsync(Guid? travelId, CancellationToken ct);
    Task<TravelBusDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<TravelBusDto> CreateAsync(TravelBusFormRequest req, CancellationToken ct);
    Task<TravelBusDto> UpdateAsync(Guid id, TravelBusFormRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<TravelBusDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<TravelBusDto> CloneAsync(Guid id, CancellationToken ct);
    Task<TravelBusUsageHistoryDto> GetUsageHistoryAsync(Guid id, CancellationToken ct);
    Task<List<TravelBusSeatingDto>> GetTravelSeatingAsync(Guid travelId, CancellationToken ct);
    Task SaveTravelBusSeatingAsync(Guid travelId, Guid busId, SaveTravelSeatingRequest req, CancellationToken ct);
    Task<BusSeatChangeImpactDto> PropagateBusSeatChangeAsync(Guid busId, CancellationToken ct);
    Task<(byte[] Bytes, string FileName)> ExportSeatPlanWordAsync(Guid travelId, CancellationToken ct);
}
