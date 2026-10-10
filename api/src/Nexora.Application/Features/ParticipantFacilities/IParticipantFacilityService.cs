using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantFacilities.Dtos;

namespace Nexora.Application.Features.ParticipantFacilities;

public interface IParticipantFacilityService
{
    Task<CitizenFacilityDiscoverResultDto> DiscoverAsync(string module, CitizenFacilityDiscoverParams p, CancellationToken ct);
    Task<List<CitizenFacilityBranchDto>> GetBranchesAsync(string module, Guid? participantId, CancellationToken ct);
    Task<CitizenFacilityFiltersDto> GetFiltersAsync(string module, CitizenFacilityDiscoverParams p, CancellationToken ct);
    Task<CitizenFacilityGroupDetailDto> GetDetailAsync(string module, Guid groupId, CancellationToken ct);
    Task<CitizenFacilityApplicationDto> ApplyAsync(string module, Guid groupId, CitizenFacilityApplyRequest req, CancellationToken ct);
    Task<CitizenFacilityDocumentUploadResult> UploadDocumentAsync(string module, Guid? groupId, Stream stream, string fileName, string contentType, CancellationToken ct, string? documentType = null);

    Task<PagedResult<CitizenFacilityApplicationDto>> GetApplicationsAsync(CitizenFacilityApplicationListParams p, CancellationToken ct);
    Task CancelApplicationAsync(Guid applicationId, CancellationToken ct);
    Task<List<CitizenTurnstileQrDto>> GetTurnstileQrAsync(string? module, CancellationToken ct);
}
