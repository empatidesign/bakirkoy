using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class CompanyQrRepository(AppDbContext context)
    : Repository<CompanyQrCode>(context), ICompanyQrRepository
{
    public async Task<CompanyQrCode?> GetByStaticCodeAsync(string staticCode, CancellationToken ct)
        => await DbSet
            .Include(q => q.Company)
            .FirstOrDefaultAsync(q => q.StaticCode == staticCode, ct);

    public async Task<List<CompanyQrCode>> GetByCompanyIdAsync(Guid companyId, CancellationToken ct)
        => await DbSet
            .Where(q => q.CompanyId == companyId)
            .OrderByDescending(q => q.CreatedAt)
            .ToListAsync(ct);

    public async Task<CompanyQrCode?> GetActiveByCompanyIdAsync(Guid companyId, CancellationToken ct)
        => await DbSet
            .Where(q => q.CompanyId == companyId && q.IsActive)
            .OrderByDescending(q => q.CreatedAt)
            .FirstOrDefaultAsync(ct);
}
