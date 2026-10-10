using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class CompanySettingsRepository(AppDbContext context)
    : Repository<CompanySettingsRecord>(context), ICompanySettingsRepository
{
    public async Task<CompanySettingsRecord?> GetCurrentAsync(CancellationToken ct)
        => await DbSet.OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
}
