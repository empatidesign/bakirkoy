using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda;

public interface ISedaApplicationService
{
    Task<PagedResult<SedaApplicationDto>> GetPagedAsync(SedaApplicationListParams p, CancellationToken ct);
    Task<SedaApplicationSummaryDto> GetSummaryAsync(string? schoolName, CancellationToken ct);
    Task<SedaApplicationDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SedaApplicationDto> CreateAsync(SedaApplicationFormRequest req, CancellationToken ct);
    Task<SedaApplicationDto> UpdateAsync(Guid id, SedaApplicationFormRequest req, CancellationToken ct);
    Task<SedaApplicationDto> SetStatusAsync(Guid id, string status, string? reason, CancellationToken ct);
    Task<SedaManualMessageResultDto> SendManualMessageAsync(SedaManualMessageRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<(byte[] Bytes, string FileName)> ExportExcelAsync(SedaApplicationListParams p, CancellationToken ct);
    Task<SedaYearlyReportDto> GetYearlyReportAsync(SedaYearlyReportParams p, CancellationToken ct);
}
