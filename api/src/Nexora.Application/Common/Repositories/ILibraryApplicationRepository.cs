using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Application.Common.Repositories;

public interface ILibraryApplicationRepository
{
    Task<PagedResult<LibraryApplication>> GetPagedAsync(LibraryApplicationListParams p, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct);
    Task<LibraryApplication?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<(int Total, int Pending, int Approved, int Rejected)> GetSummaryAsync(IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct);
    Task AddAsync(LibraryApplication app, CancellationToken ct);
    void Update(LibraryApplication app);
    void Delete(LibraryApplication app);
}
