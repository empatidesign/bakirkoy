using Nexora.Domain.Entities.Libraries;
namespace Nexora.Application.Common.Repositories;

public interface ILibraryDeviceRepository : IRepository<LibraryDevice>
{
    Task<List<LibraryDevice>> GetByLibraryAsync(Guid libraryId, CancellationToken ct);
    Task<bool> ExistsByCodeAsync(string code, CancellationToken ct);
    Task<LibraryDevice?> GetByDeviceIdAsync(string deviceId, CancellationToken ct);
    Task<bool> ExistsByDeviceIdAsync(string deviceId, Guid? excludeId, CancellationToken ct);
}
