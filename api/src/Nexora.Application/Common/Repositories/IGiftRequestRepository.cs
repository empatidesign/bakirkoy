using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Entities.Wheels;

namespace Nexora.Application.Common.Repositories;

public interface IGiftRequestRepository : IRepository<GiftRequest>
{
    Task<PagedResult<GiftRequest>> GetPagedAsync(GiftRequestListParams p, CancellationToken ct);
    Task<GiftRequestSummaryDto> GetSummaryAsync(GiftRequestListParams p, CancellationToken ct);

    Task<List<Guid>> GetParticipantIdsByRequestsAsync(IReadOnlyCollection<Guid> requestIds, CancellationToken ct);

    /// <summary>
    /// Sadece GiftId'yi (advisory lock anahtarı türetmek için) EF Core change tracker'a hiç
    /// almadan okur. Approve/Reject akışında bu, kilit alınmadan ÖNCE bir "peek" için kullanılır —
    /// aksi halde normal (tracking) GetByIdAsync ile önceden okunan entity, kilit alındıktan
    /// SONRA tekrar GetByIdAsync çağrılsa bile EF Core identity map'inden AYNI (bayat) instance
    /// olarak geri döner ve DB'ye ikinci kez gitmez — bu da kilidin hiçbir işe yaramamasına yol
    /// açar (bkz. swarm gift-audit-2026-08-04, double-reject/double-approve ikinci bulgusu).
    /// </summary>
    Task<Guid?> GetGiftIdNoTrackingAsync(Guid requestId, CancellationToken ct);
}
