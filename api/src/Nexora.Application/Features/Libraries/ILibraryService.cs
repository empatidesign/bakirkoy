using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Application.Features.Libraries;

public interface ILibraryService
{
    Task<PagedResult<LibraryDto>> GetPagedAsync(LibraryListParams p, CancellationToken ct);
    Task<IReadOnlyList<LibraryOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<LibraryOverviewSummaryDto> GetOverviewSummaryAsync(CancellationToken ct);
    Task<LibraryDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<LibraryDetailSummaryDto> GetDetailSummaryAsync(Guid id, CancellationToken ct);
    Task<LibraryDto> CreateAsync(LibraryRequest req, CancellationToken ct);
    Task<LibraryDto> UpdateAsync(Guid id, LibraryRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<LibraryDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<string> UploadKrokiAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
    Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
    Task<LibraryAnalyticsDto> GetAnalyticsAsync(LibraryAnalyticsParams p, CancellationToken ct);
}

public interface ILibrarySettingsService
{
    Task<LibrarySettingsDto> GetAsync(Guid? libraryId, CancellationToken ct);
    Task<IReadOnlyDictionary<Guid, LibrarySettingsDto>> GetForLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct);
    Task<LibrarySettingsDto> SaveAsync(Guid? libraryId, LibrarySettingsDto dto, CancellationToken ct);
    Task ApplyLibraryOperationalAsync(Guid libraryId, LibraryRequest req, CancellationToken ct);
    Task<List<LibrarySettingsHistoryDto>> GetHistoryAsync(Guid? libraryId, int limit, CancellationToken ct);
}

public interface IOperationTemplateClassifier
{
    Task<string> ClassifyAsync(Guid libraryId, CancellationToken ct);
    Task<int> ClassifyAllAsync(CancellationToken ct);
    Task<string> ComputeAsync(Guid libraryId, CancellationToken ct);
}

public interface ITemplateShadowAuditService
{
    Task<Dtos.TemplateShadowAuditDto> AuditAsync(Guid libraryId, CancellationToken ct);
    Task<List<Dtos.TemplateShadowAuditDto>> AuditAllAsync(CancellationToken ct);
}

public interface ITemplateRuleEngine
{
    Task<bool> IsBreakSystemEnabledAsync(Guid libraryId, CancellationToken ct);
}

public interface IHardwareVerificationService
{
    Dtos.HardwareVerificationResultDto Verify(Dtos.HardwareVerificationRequest req);
}
