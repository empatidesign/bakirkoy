using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class CompanyStaffRepository(AppDbContext context)
    : Repository<CompanyStaff>(context), ICompanyStaffRepository
{
    public async Task<List<CompanyStaff>> GetByCompanyIdAsync(Guid companyId, CancellationToken ct)
        => await DbSet.Where(x => x.CompanyId == companyId).OrderBy(x => x.FullName).ToListAsync(ct);

    public async Task<CompanyStaff?> GetByPhoneAsync(Guid companyId, string phone, CancellationToken ct)
    {
        var normalized = phone.Trim();
        return await DbSet.FirstOrDefaultAsync(x => x.CompanyId == companyId && x.Phone == normalized, ct);
    }

    public async Task<CompanyStaff?> GetByPhoneAnyCompanyAsync(string phone, CancellationToken ct)
    {
        // Eski kayıtlar normalize edilmeden (boşluklu vb.) saklanmış olabilir: ham değer de denenir.
        var raw = phone.Trim();
        var normalized = Nexora.Application.Common.Security.LoginIdentifier.NormalizeTrPhone(raw);
        return await DbSet.Include(x => x.Company)
            .Where(x => x.Phone == normalized || x.Phone == raw)
            .OrderBy(x => x.Phone == normalized ? 0 : 1)
            .FirstOrDefaultAsync(ct);
    }

    // F24: aynı telefon birden fazla firmada personel olabilir; login firma bağlamı almadan
    // seçim yaparsa yanlış hesaba gidebilir. Belirsizliği tespit için eşleşen kayıt sayısı.
    public async Task<int> CountByPhoneAsync(string phone, CancellationToken ct)
    {
        var raw = phone.Trim();
        var normalized = Nexora.Application.Common.Security.LoginIdentifier.NormalizeTrPhone(raw);
        return await DbSet.CountAsync(x => x.Phone == normalized || x.Phone == raw, ct);
    }

    public async Task<bool> ExistsByPhoneAsync(Guid companyId, string phone, Guid? excludeId, CancellationToken ct)
    {
        var raw = phone.Trim();
        var normalized = Nexora.Application.Common.Security.LoginIdentifier.NormalizeTrPhone(raw);
        return await DbSet.AnyAsync(x => x.CompanyId == companyId && (x.Phone == normalized || x.Phone == raw) && (excludeId == null || x.Id != excludeId), ct);
    }
}
