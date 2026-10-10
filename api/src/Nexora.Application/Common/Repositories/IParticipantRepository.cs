using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Participants.Dtos;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Application.Common.Repositories;

public interface IParticipantRepository : IRepository<Participant>
{
    Task<PagedResult<Participant>> GetPagedAsync(ParticipantListParams p, IReadOnlyCollection<Guid>? scopedParticipantIds, CancellationToken ct);
    Task<ParticipantSummaryDto> GetSummaryAsync(ParticipantListParams p, IReadOnlyCollection<Guid>? scopedParticipantIds, CancellationToken ct);
    Task<Participant?> GetByIdWithRelationsAsync(Guid id, CancellationToken ct);
    Task<bool> ExistsByTcknAsync(string tckn, CancellationToken ct);
    Task<Participant?> GetByTcknAsync(string tckn, CancellationToken ct);
    Task<Participant?> GetByTcknIncludingDeletedAsync(string tckn, CancellationToken ct);
    Task<Participant?> GetByPhoneAsync(string phone, CancellationToken ct);
    Task<int> CountByPhoneCandidatesAsync(IReadOnlyCollection<string> candidates, CancellationToken ct);
    Task<List<Participant>> GetChildrenAsync(Guid guardianId, CancellationToken ct);
    Task<List<ParticipantGuardian>> GetGuardianLinksAsync(Guid childId, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountChildrenForAsync(IReadOnlyList<Guid> guardianIds, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountGuardiansForAsync(IReadOnlyList<Guid> childIds, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountActivitiesForAsync(IReadOnlyDictionary<Guid, string> participantIdsWithTckn, CancellationToken ct);
}
