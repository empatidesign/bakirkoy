using Nexora.Domain.Entities.Companies;

namespace Nexora.Application.Common.Repositories;

public interface ICompanyQrRepository : IRepository<CompanyQrCode>
{
    Task<CompanyQrCode?> GetByStaticCodeAsync(string staticCode, CancellationToken ct);
    Task<List<CompanyQrCode>> GetByCompanyIdAsync(Guid companyId, CancellationToken ct);
    Task<CompanyQrCode?> GetActiveByCompanyIdAsync(Guid companyId, CancellationToken ct);
}
