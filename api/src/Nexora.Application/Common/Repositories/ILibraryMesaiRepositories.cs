using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Application.Common.Repositories;

public interface ILibraryStaffRepository : IRepository<LibraryStaff>
{
    Task<PagedResult<LibraryStaff>> GetPagedAsync(LibraryStaffListParams p, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct);
    Task<List<LibraryStaff>> GetEligibleAsync(Guid libraryId, CancellationToken ct);
    Task<bool> ExistsByAdminUserAsync(Guid adminUserId, Guid? excludeId, CancellationToken ct);
    Task<LibraryStaff?> GetByAdminUserAsync(Guid adminUserId, CancellationToken ct);
    Task<bool> ExistsByParticipantAsync(Guid participantId, Guid? excludeId, CancellationToken ct);
    Task<LibraryStaff?> GetByParticipantAsync(Guid participantId, CancellationToken ct);
}

public interface ILibraryShiftRepository : IRepository<LibraryShift>
{
    Task<List<LibraryShift>> GetActiveByLibraryAsync(Guid libraryId, CancellationToken ct);
    Task<LibraryShift?> GetActiveByStaffAsync(Guid staffId, CancellationToken ct);
    Task<LibraryShift?> GetActiveByIpAsync(string ipAddress, Guid excludeStaffId, CancellationToken ct);
    Task<List<LibraryShift>> GetAllActiveAsync(CancellationToken ct);
    Task<List<LibraryShift>> GetByStaffAsync(Guid staffId, CancellationToken ct);
    Task<PagedResult<LibraryShift>> GetPagedByLibraryAsync(Guid libraryId, LibraryShiftListParams p, CancellationToken ct);
    Task<int> CountActiveByLibraryAsync(Guid libraryId, CancellationToken ct);
    Task<int> CountTodayByLibraryAsync(Guid libraryId, DateTime dayStart, CancellationToken ct);
    Task<int> CountTodayAsync(DateTime dayStart, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct);

    Task<PagedResult<LibraryShift>> GetPagedOverviewAsync(LibraryShiftListParams p, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct);

    Task<List<LibraryShift>> GetForStaffInRangeAsync(Guid staffId, DateTime startUtc, DateTime endUtc, CancellationToken ct);

    Task<List<LibraryShift>> GetInRangeAsync(DateTime startUtc, DateTime endUtc, Guid? libraryId, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct);

    Task<List<LibraryShift>> GetAllOpenAsync(CancellationToken ct);
}
