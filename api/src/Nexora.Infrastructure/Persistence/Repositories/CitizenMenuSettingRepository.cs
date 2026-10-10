using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.CitizenMenu;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class CitizenMenuSettingRepository(AppDbContext context)
    : Repository<CitizenMenuSetting>(context), ICitizenMenuSettingRepository
{
    public async Task<CitizenMenuSetting?> GetSingletonAsync(CancellationToken ct)
        => await DbSet.OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
}
