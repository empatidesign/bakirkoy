using Nexora.Domain.Entities.Companies;

namespace Nexora.Application.Common.Repositories;

public interface ICompanyStaffRepository : IRepository<CompanyStaff>
{
    Task<List<CompanyStaff>> GetByCompanyIdAsync(Guid companyId, CancellationToken ct);
    Task<CompanyStaff?> GetByPhoneAsync(Guid companyId, string phone, CancellationToken ct);
    Task<CompanyStaff?> GetByPhoneAnyCompanyAsync(string phone, CancellationToken ct);
    Task<int> CountByPhoneAsync(string phone, CancellationToken ct);
    Task<bool> ExistsByPhoneAsync(Guid companyId, string phone, Guid? excludeId, CancellationToken ct);
}
