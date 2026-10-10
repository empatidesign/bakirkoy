using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Application.Common.Repositories;

public interface ISedaEducationRecordRepository : IRepository<SedaEducationRecord>
{
    Task<PagedResult<SedaEducationRecordDto>> GetPagedAsync(SedaEducationRecordListParams p, CancellationToken ct);
    Task<List<SedaEducationRecordDto>> GetAllFilteredAsync(SedaEducationRecordListParams p, CancellationToken ct);
    Task<List<SedaEducationRecord>> GetByYearAsync(string academicYear, CancellationToken ct);
    Task<List<SedaEducationRecord>> GetByPeriodAsync(Guid periodId, CancellationToken ct);
    Task<List<string>> GetYearsAsync(CancellationToken ct);
    Task<List<SedaEducationRecord>> GetByTcknAsync(string tckn, CancellationToken ct);
    Task<List<SedaEducationRecord>> GetByPhoneAsync(string phone, CancellationToken ct);
    Task<Dictionary<string, Guid>> GetParticipantIdsByTcknsAsync(List<string> tckns, CancellationToken ct);
}
