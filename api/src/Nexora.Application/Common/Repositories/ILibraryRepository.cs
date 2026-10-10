using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Application.Features.ParticipantLibraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Application.Common.Repositories;

public interface ILibraryRepository : IRepository<Library>
{
    Task<PagedResult<Library>> GetPagedAsync(LibraryListParams p, IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct);
    Task<List<Library>> GetActiveAsync(CancellationToken ct);
    Task<PagedResult<Library>> DiscoverPagedAsync(CitizenLibraryDiscoverParams p, CancellationToken ct);
    Task<LibraryOverviewSummaryDto> GetOverviewSummaryAsync(CancellationToken ct);
    Task<Library?> GetByStaticQrCodeAsync(string code, CancellationToken ct);
    Task<bool> ExistsByStaticQrCodeAsync(string code, CancellationToken ct);
}

public interface ILibrarySettingsRepository : IRepository<LibrarySettings>
{
    Task<LibrarySettings?> GetForLibraryAsync(Guid? libraryId, CancellationToken ct);
    Task<List<LibrarySettings>> GetSettingsForLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct);
}

public interface ILibrarySettingsHistoryRepository : IRepository<LibrarySettingsHistory>
{
    Task<List<LibrarySettingsHistory>> GetForLibraryAsync(Guid? libraryId, int limit, CancellationToken ct);
}
