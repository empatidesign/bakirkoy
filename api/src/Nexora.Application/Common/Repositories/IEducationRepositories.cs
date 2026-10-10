using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Education.Dtos;
using Nexora.Domain.Entities.Education;

namespace Nexora.Application.Common.Repositories;

public interface IEducationInstitutionRepository : IRepository<EducationInstitution>
{
    Task<PagedResult<EducationInstitution>> GetPagedAsync(EducationInstitutionListParams p, CancellationToken ct);
    Task<List<EducationInstitution>> GetActiveAsync(CancellationToken ct);
}

public interface IEducationHistoryRepository : IRepository<EducationHistory>
{
    Task<List<EducationHistory>> GetByParticipantAsync(Guid participantId, CancellationToken ct);
}
