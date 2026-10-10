using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Application.Features.ParticipantLibraries.Dtos;

namespace Nexora.Application.Features.ParticipantLibraries;

public interface IParticipantLibraryService
{
    Task<PagedResult<CitizenLibraryDto>> DiscoverAsync(CitizenLibraryDiscoverParams p, CancellationToken ct);
    Task<CitizenLibraryFiltersDto> GetFiltersAsync(CitizenLibraryDiscoverParams p, CancellationToken ct);
    Task<CitizenLibraryDetailDto> GetDetailAsync(Guid libraryId, CancellationToken ct);
    Task<CitizenLibrarySeatPlanDto> GetSeatPlanAsync(Guid libraryId, DateTime? date, CancellationToken ct);
    Task<CitizenLibraryReservationDto> ReserveAsync(Guid libraryId, CitizenLibraryReserveRequest req, CancellationToken ct);
    Task<PagedResult<CitizenLibraryReservationDto>> GetReservationsAsync(CitizenLibraryReservationListParams p, CancellationToken ct);
    Task CancelReservationAsync(Guid reservationId, CancellationToken ct);

    Task<PendingExitResultDto> RegisterExitIntentAsync(CancellationToken ct);
    Task<PendingExitResultDto> RegisterBreakIntentAsync(string? type, CancellationToken ct);
    Task<CitizenLibraryStatusDto> GetStatusAsync(Guid libraryId, CancellationToken ct);
    Task<CitizenLibraryStatsDto> GetStatsAsync(Guid libraryId, DateTime? date, CancellationToken ct);
    Task<CitizenLibraryReservationDto> WalkInAsync(Guid libraryId, string? seat, CancellationToken ct);
    Task<CitizenQueueJoinResultDto> JoinQueueAsync(Guid libraryId, CancellationToken ct);
    Task LeaveQueueAsync(Guid libraryId, CancellationToken ct);
    Task<CitizenSessionDto?> GetActiveSessionAsync(CancellationToken ct);
    Task<Dtos.CitizenMyQueueDto?> GetMyQueueAsync(CancellationToken ct);
    Task<List<CitizenLibraryMovementDto>> GetHistoryAsync(DateTime? date, string? range, CancellationToken ct);
    Task<CitizenLibraryMyStatsDto> GetMyStatsAsync(CancellationToken ct);
    Task<CitizenSessionDto> CheckInAsync(Guid libraryId, double? latitude, double? longitude, CancellationToken ct);
    Task<CitizenSessionDto> StartBreakAsync(string? type, CancellationToken ct);
    Task<CitizenSessionDto> EndBreakAsync(CancellationToken ct);
    Task ExitAsync(CancellationToken ct, double? latitude = null, double? longitude = null);
    Task<Libraries.Dtos.EmanetOverdueResult> GetMyOverdueBooksAsync(CancellationToken ct);
}
