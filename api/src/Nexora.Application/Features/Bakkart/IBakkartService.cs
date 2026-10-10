using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Bakkart.Dtos;

namespace Nexora.Application.Features.Bakkart;

public interface IBakkartService
{
    Task<PagedResult<BakkartApplicationDto>> GetPagedAsync(BakkartApplicationListParams p, CancellationToken ct);
    Task<BakkartApplicationSummaryDto> GetSummaryAsync(CancellationToken ct);
    Task<BakkartApplicationDto> GetByIdAsync(Guid id, CancellationToken ct);

    Task<BakkartApplicationDto> AdminCreateAsync(AdminCreateBakkartApplicationRequest req, CancellationToken ct);
    Task<BakkartApplicationDto> ApproveAsync(Guid id, CancellationToken ct);
    Task<BakkartApplicationDto> RejectAsync(Guid id, RejectBakkartApplicationRequest req, CancellationToken ct);
    Task<BakkartApplicationDto> UpdateDocumentsAsync(Guid id, UpdateBakkartDocumentsRequest req, CancellationToken ct);

    Task<BakkartCardDto> AdjustCardAsync(Guid cardId, AdjustBakkartCardRequest req, CancellationToken ct);
    Task<List<BakkartTransactionDto>> GetCardTransactionsAsync(Guid cardId, CancellationToken ct);
    Task<BakkartCardStatsDto> GetCardStatsAsync(Guid cardId, CancellationToken ct);

    Task<BakkartApplicationDto> CitizenApplyAsync(CreateBakkartApplicationRequest req, CancellationToken ct);
    Task<BakkartDocumentDto> UploadMyDocumentAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
    Task<MyBakkartStatusDto> GetMyStatusAsync(CancellationToken ct);
    Task<BakkartCardStatsDto?> GetMyStatsAsync(CancellationToken ct);
    Task<List<BakkartTransactionDto>> GetMyTransactionsAsync(CancellationToken ct);
    Task CancelMyApplicationAsync(Guid id, CancellationToken ct);
}
