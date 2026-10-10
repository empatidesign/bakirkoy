using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;

namespace Nexora.Application.Features.Events;

public interface IEventApplicationService
{
    Task<PagedResult<ApplicationDto>> GetPagedAsync(ApplicationListParams p, CancellationToken ct);
    Task<ApplicationSummaryDto> GetSummaryAsync(Guid? eventId, Guid? sessionId, CancellationToken ct);
    Task<ApplicationDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ApplicationDto> CreateAsync(ApplicationFormRequest req, CancellationToken ct);
    Task<ApplicationDto> UpdateAsync(Guid id, ApplicationFormRequest req, CancellationToken ct);
    Task<ApplicationDto> SetStatusAsync(Guid id, string status, string? reason, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task PromoteWaitlistAsync(Guid eventId, Guid? sessionId, string? freedSeat, CancellationToken ct);
    Task<SeatMapDto> GetSeatMapAsync(Guid eventId, Guid? sessionId, CancellationToken ct);
    Task<(byte[] Content, string FileName)> ExportAsync(ApplicationListParams p, CancellationToken ct);
}
