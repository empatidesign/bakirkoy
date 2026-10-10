using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Bakkart.Dtos;
using Nexora.Domain.Entities.Bakkart;

namespace Nexora.Application.Common.Repositories;

public interface IBakkartApplicationRepository : IRepository<BakkartApplication>
{
    Task<PagedResult<BakkartApplication>> GetPagedAsync(BakkartApplicationListParams p, CancellationToken ct);
    Task<BakkartApplicationSummaryDto> GetSummaryAsync(CancellationToken ct);
    Task<int> NextTrackingNumberAsync(CancellationToken ct);
    Task<bool> ExistsActiveByTcknHashAsync(string tcknHash, CancellationToken ct);
    Task<BakkartApplication?> GetByTcknHashAsync(string tcknHash, CancellationToken ct);
    Task<List<BakkartApplication>> GetByParticipantIdAsync(Guid participantId, CancellationToken ct);
}

public interface IBakkartCardRepository : IRepository<BakkartCard>
{
    Task<int> NextCardNumberAsync(CancellationToken ct);
    Task<BakkartCard?> GetByApplicationIdAsync(Guid applicationId, CancellationToken ct);
    Task<List<BakkartCard>> GetByApplicationIdsAsync(IEnumerable<Guid> applicationIds, CancellationToken ct);
    Task<BakkartCard?> GetByParticipantIdAsync(Guid participantId, CancellationToken ct);
    Task<BakkartCard?> GetByCardNoAsync(string cardNo, CancellationToken ct);
    Task<int> CountActiveAsync(CancellationToken ct);
}

public interface IBakkartTransactionRepository : IRepository<BakkartTransaction>
{
    Task<List<BakkartTransaction>> GetByCardIdAsync(Guid cardId, int limit, CancellationToken ct);
    Task<BakkartCardStatsDto> GetStatsAsync(Guid cardId, CancellationToken ct);
}
