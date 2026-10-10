using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.ParticipantCampaigns.Dtos;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Application.Common.Repositories;

public interface ICompanyRepository : IRepository<Company>
{
    Task<PagedResult<Company>> GetPagedAsync(CompanyListParams p, CancellationToken ct);
    Task<CompanySummaryDto> GetSummaryAsync(CompanyListParams p, CancellationToken ct);
    Task<Company?> GetByIdWithCampaignsAsync(Guid id, CancellationToken ct);
    Task<Company?> GetByIdWithServiceCategoryAsync(Guid id, CancellationToken ct);
    Task<Company?> GetByEmailAsync(string email, CancellationToken ct);
    Task<Company?> GetByPhoneAsync(string phone, CancellationToken ct);
    Task<Company?> GetByTaxNumberAsync(string taxNumber, CancellationToken ct);
    Task<bool> ExistsByEmailAsync(string email, Guid? excludeId, CancellationToken ct);
    Task<bool> ExistsByPhoneAsync(string phone, Guid? excludeId, CancellationToken ct);
    Task<bool> ExistsByTaxNumberAsync(string taxNumber, Guid? excludeId, CancellationToken ct);
    Task<CompanyDashboardDto> GetDashboardAsync(CancellationToken ct);
    Task<List<Company>> GetActiveOptionsAsync(CancellationToken ct);
    Task<int> CountCampaignTotalsAsync(Guid companyId, CancellationToken ct);
    Task<int> CountUsageTotalsAsync(Guid companyId, CancellationToken ct);
    Task<PagedResult<Company>> GetApprovedDirectoryPagedAsync(CitizenDirectoryCompanyListParams p, CancellationToken ct);
    Task<List<string>> GetApprovedDistrictsAsync(CancellationToken ct);
}
