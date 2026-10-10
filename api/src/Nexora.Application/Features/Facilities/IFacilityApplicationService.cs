using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities;

public interface IFacilityApplicationService
{
    Task<PagedResult<FacilityApplicationDto>> GetPagedAsync(string module, FacilityApplicationListParams p, CancellationToken ct);
    Task<FacilityApplicationStatsDto> GetStatsAsync(string module, Guid facilityId, CancellationToken ct);
    Task<FacilityApplicationDto> GetByIdAsync(string module, Guid id, CancellationToken ct);
    Task<FacilityApplicationDto> CreateAsync(string module, CreateFacilityApplicationRequest req, CancellationToken ct);
    Task<FacilityApplicationDto> ApproveAsync(string module, Guid id, ApproveFacilityApplicationRequest? req, CancellationToken ct);
    Task<FacilityBulkApproveResultDto> BulkApproveAsync(string module, FacilityBulkApproveRequest req, CancellationToken ct);
    Task<FacilityApplicationDto> RejectAsync(string module, Guid id, string? reason, CancellationToken ct);
    Task DeleteAsync(string module, Guid id, CancellationToken ct);
    Task<Guid?> GetRegistrationIdAsync(string module, Guid id, CancellationToken ct);
    Task<(byte[] Content, string FileName)> ExportAsync(string module, FacilityApplicationListParams p, CancellationToken ct);

    // Kullanıcı isteği (2026-08-11): gezi ("Sultangazi gezi listesindeki sms şablon gönderim
    // sistemi") ile aynı şablon-bazlı toplu mesaj gönderme yeteneği. Bkz. FacilityManualMessageDtos.cs.
    Task<FacilityManualMessageResultDto> SendManualMessageAsync(string module, FacilityManualMessageRequest req, CancellationToken ct);
}
