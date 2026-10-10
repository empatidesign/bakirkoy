using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies;

public interface ICompanyService
{
    Task<PagedResult<CompanyDto>> GetPagedAsync(CompanyListParams p, CancellationToken ct);
    Task<CompanySummaryDto> GetSummaryAsync(CompanyListParams p, CancellationToken ct);
    Task<CompanyDashboardDto> GetDashboardAsync(CancellationToken ct);
    Task<IReadOnlyList<CompanyOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<CompanyDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<CompanyDto> CreateAsync(CreateCompanyRequest req, CancellationToken ct);
    Task<CompanyDto> UpdateAsync(Guid id, UpdateCompanyRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<CompanyDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<CompanyDto> UnlockAsync(Guid id, CancellationToken ct);
    Task<CompanyDto> ApproveAsync(Guid id, CancellationToken ct);
    Task<CompanyDto> RejectAsync(Guid id, RejectCompanyRequest req, CancellationToken ct);
    Task<CompanyDto> RevertApprovalAsync(Guid id, CancellationToken ct);
    Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
    Task<CompanyImportResultDto> ImportAsync(Stream excelStream, CancellationToken ct);

    Task SendPasswordResetAsync(Guid id, CompanySendPasswordResetRequest req, CancellationToken ct);
    Task SetManualPasswordAsync(Guid id, CompanySetManualPasswordRequest req, CancellationToken ct);
}
