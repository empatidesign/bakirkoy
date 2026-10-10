using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Libraries;
namespace Nexora.Infrastructure.Persistence.Repositories;

public class LibraryDeviceRepository(AppDbContext context)
    : Repository<LibraryDevice>(context), ILibraryDeviceRepository
{
    public async Task<List<LibraryDevice>> GetByLibraryAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.Where(d => d.LibraryId == libraryId).OrderBy(d => d.Name).ToListAsync(ct);

    public async Task<bool> ExistsByCodeAsync(string code, CancellationToken ct)
        => await DbSet.AnyAsync(d => d.DeviceCode == code, ct);

    public async Task<LibraryDevice?> GetByDeviceIdAsync(string deviceId, CancellationToken ct)
        => await DbSet.Where(d => d.DeviceId == deviceId && d.IsActive)
            .OrderBy(d => d.CreatedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<bool> ExistsByDeviceIdAsync(string deviceId, Guid? excludeId, CancellationToken ct)
        => await DbSet.AnyAsync(d => d.DeviceId == deviceId && (excludeId == null || d.Id != excludeId), ct);
}
