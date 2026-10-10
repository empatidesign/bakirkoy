using Nexora.Domain.Entities.Companies;

namespace Nexora.Application.Common.Repositories;

public interface ICompanySettingsRepository : IRepository<CompanySettingsRecord>
{
    Task<CompanySettingsRecord?> GetCurrentAsync(CancellationToken ct);
}
