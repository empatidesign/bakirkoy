using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels;

public interface ITravelApplicationService
{
    Task<PagedResult<TravelApplicationDto>> GetPagedAsync(TravelApplicationListParams p, CancellationToken ct);
    Task<TravelApplicationSummaryDto> GetSummaryAsync(Guid? travelId, CancellationToken ct);
    Task<TravelApplicationDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<TravelApplicationDto> CreateAsync(TravelApplicationFormRequest req, CancellationToken ct);
    Task<TravelApplicationDto> UpdateAsync(Guid id, TravelApplicationFormRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<TravelApplicationDto> SetStatusAsync(Guid id, string status, string? reason, CancellationToken ct);
    // Z03/RZ02-RZ04: yedek terfisinde aday kimlik kilidi geçici meşguliyeti sonrası, arka plan job'ından
    // çağrılan hedefli (tek aday + boşalan koltuk) + idempotent yeniden deneme (kapasite/sıra/kimlik/koltuk/
    // limit yeniden doğrulanır; aday artık waitlist değilse veya koltuk alındıysa no-op).
    Task RetryWaitlistPromotionAsync(Guid travelId, Guid candidateId, Guid? freedBusId, string? freedSeat, int attempt, CancellationToken ct);
    Task PromoteWaitlistAfterFreeAsync(Guid travelId, Guid? freedBusId, string? freedSeat, CancellationToken ct);
    Task SyncCountsAsync(Guid travelId, CancellationToken ct);
    Task<List<string>> GetNeighborhoodOptionsAsync(Guid? travelId, CancellationToken ct);
    Task<(byte[] Content, string FileName)> ExportAsync(TravelApplicationListParams p, CancellationToken ct);
    Task<TravelBulkTcknResult> BulkAddByTcknAsync(TravelBulkTcknRequest req, CancellationToken ct);
    Task<TravelManualMessageResultDto> SendManualMessageAsync(TravelManualMessageRequest req, CancellationToken ct);
}
