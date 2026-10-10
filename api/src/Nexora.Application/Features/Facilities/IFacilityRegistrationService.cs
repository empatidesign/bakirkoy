using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities;

public interface IFacilityRegistrationService
{
    Task<FacilityRegistrationDto> RegisterAsync(string module, RegisterParticipantRequest req, CancellationToken ct);
    Task EnsureCapacityAvailableAsync(string module, Guid groupId, DateTime? membershipDate, CancellationToken ct);
    Task<List<FacilityRegistrationDto>> GetRosterAsync(string module, Guid groupId, CancellationToken ct);
    Task<(byte[] Content, string FileName)> ExportRosterAsync(string module, Guid groupId, CancellationToken ct);
    Task<List<FacilityRegistrationDto>> GetWaitlistAsync(string module, Guid groupId, CancellationToken ct);
    Task RemoveAsync(string module, Guid registrationId, string? reason, CancellationToken ct);
    Task<IReadOnlyList<FacilityDeferredNoticeDto>> RemoveForBatchAsync(string module, Guid registrationId, string? reason, CancellationToken ct);
    Task SendDeferredNoticesAsync(IEnumerable<FacilityDeferredNoticeDto> notices, CancellationToken ct);
    Task FillVacanciesAsync(Guid groupId, CancellationToken ct);
    Task<FacilityRegistrationDto> PromoteAsync(string module, Guid registrationId, CancellationToken ct);
    Task<FacilityRegistrationDto> DemoteAsync(string module, Guid registrationId, CancellationToken ct);
    Task ReorderWaitlistAsync(string module, Guid groupId, IReadOnlyList<Guid> orderedIds, CancellationToken ct);
    Task<int> RebalanceAsync(string module, Guid? groupId, CancellationToken ct);
    Task<int> ReconcileGroupCountsAsync(string? module, CancellationToken ct);
    Task<BulkPreRegisterResultDto> BulkPreRegisterAsync(string module, BulkPreRegisterRequest req, CancellationToken ct);
    Task<BulkPreRegisterResultDto> BulkImportRegistrationAsync(string module, BulkImportRegistrationRequest req, CancellationToken ct);
}
