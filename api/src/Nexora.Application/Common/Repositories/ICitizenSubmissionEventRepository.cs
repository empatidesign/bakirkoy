using Nexora.Domain.Entities.CitizenSubmissions;

namespace Nexora.Application.Common.Repositories;

public interface ICitizenSubmissionEventRepository : IRepository<CitizenSubmissionEvent>
{
    Task<List<CitizenSubmissionEvent>> GetBySubmissionAsync(Guid submissionId, CancellationToken ct);
    Task<List<CitizenSubmissionEvent>> GetBySubmissionsAsync(IReadOnlyList<Guid> submissionIds, CancellationToken ct);
}
