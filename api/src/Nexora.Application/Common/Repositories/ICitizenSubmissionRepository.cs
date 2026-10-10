using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.CitizenSubmissions.Dtos;
using Nexora.Domain.Entities.CitizenSubmissions;

namespace Nexora.Application.Common.Repositories;

public interface ICitizenSubmissionRepository : IRepository<CitizenSubmission>
{
    Task<PagedResult<CitizenSubmission>> GetPagedAsync(CitizenSubmissionListParams p, IReadOnlyList<string>? scopedNeighborhoods, CancellationToken ct);
    Task<SubmissionSummaryDto> GetSummaryAsync(CitizenSubmissionListParams p, IReadOnlyList<string>? scopedNeighborhoods, CancellationToken ct);
    Task<List<CitizenSubmission>> GetMapPointsAsync(CitizenSubmissionListParams p, IReadOnlyList<string>? scopedNeighborhoods, CancellationToken ct);
    Task<List<CitizenSubmission>> GetForReportsAsync(CancellationToken ct);

    // ULAK-03 fencing: sonuç/reset yazımları atomik koşullu UPDATE ile, yalnız beklenen deneme kimliğine
    // uygulanır. Redis kilidi kaybolup araya reset/yeni deneme girse bile bayat yazım yeni kararı ezemez.
    // Değiştirilen satır sayısı 1 ise uygulandı, 0 ise deneme geçersizleşmiş (reset/yeni deneme) demektir.
    Task<Guid?> TryBeginForwardAttemptAsync(Guid id, CancellationToken ct);
    Task<bool> TryApplyForwardDeliveredAsync(Guid id, Guid attemptId, string unit, string trackingNo, CancellationToken ct);
    Task<bool> TryApplyForwardUnknownAsync(Guid id, Guid attemptId, CancellationToken ct);
    Task<bool> TryClearForwardSendingAsync(Guid id, Guid attemptId, CancellationToken ct);
    Task<bool> TryResetForwardStateAsync(Guid id, Guid? expectedAttemptId, CancellationToken ct);
    Task<CitizenSubmission?> GetByIdFreshAsync(Guid id, CancellationToken ct);

    // ULAK-03 (A): SLA bildirim işaretleri de dar/kolonsal ExecuteUpdate ile yazılır — tam-satır Update()
    // eşzamanlı gönderimin iletim alanlarını ezmesin. Idempotent (yalnız işaret null ise yazar).
    Task MarkSlaWarningNotifiedAsync(Guid id, CancellationToken ct);
    Task MarkSlaBreachNotifiedAsync(Guid id, CancellationToken ct);
}
