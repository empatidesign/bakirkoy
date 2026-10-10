using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities;

public interface IFacilityReportService
{
    Task<FacilityReportSummaryDto> GetSummaryAsync(string module, CancellationToken ct);
}
