using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Education.Dtos;
using Nexora.Application.Features.Education.Requests;

namespace Nexora.Application.Features.Education;

public interface IEducationService
{
    Task<PagedResult<EducationInstitutionDto>> GetInstitutionsAsync(EducationInstitutionListParams p, CancellationToken ct);
    Task<List<EducationInstitutionOptionDto>> GetInstitutionOptionsAsync(CancellationToken ct);
    Task<EducationInstitutionDto> CreateInstitutionAsync(CreateEducationInstitutionRequest req, CancellationToken ct);
    Task<EducationInstitutionDto> UpdateInstitutionAsync(Guid id, UpdateEducationInstitutionRequest req, CancellationToken ct);
    Task DeleteInstitutionAsync(Guid id, CancellationToken ct);
    Task<EducationInstitutionDto> ToggleInstitutionStatusAsync(Guid id, CancellationToken ct);

    Task<List<EducationHistoryDto>> GetHistoriesAsync(Guid participantId, CancellationToken ct);
    Task<EducationHistoryDto> CreateHistoryAsync(Guid participantId, CreateEducationHistoryRequest req, CancellationToken ct);
    Task<EducationHistoryDto> UpdateHistoryAsync(Guid participantId, Guid id, UpdateEducationHistoryRequest req, CancellationToken ct);
    Task DeleteHistoryAsync(Guid participantId, Guid id, CancellationToken ct);
}
