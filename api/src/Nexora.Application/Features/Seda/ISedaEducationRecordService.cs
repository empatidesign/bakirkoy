using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda;

public interface ISedaEducationRecordService
{
    Task<PagedResult<SedaEducationRecordDto>> GetPagedAsync(SedaEducationRecordListParams p, CancellationToken ct);
    Task<List<string>> GetYearsAsync(CancellationToken ct);
    Task<SedaEducationImportResultDto> ImportAsync(Stream excel, string academicYear, Guid? periodId, DateTime? periodStartDate, DateTime? periodEndDate, CancellationToken ct);
    Task<SedaEducationRecordDto> UpdateResultAsync(Guid id, decimal? score, string? resultNote, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<(byte[] Bytes, string FileName)> ExportExcelAsync(SedaEducationRecordListParams p, CancellationToken ct);
}
