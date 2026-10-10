using Nexora.Application.Features.Reports.Dtos;

namespace Nexora.Application.Features.Reports;

public interface IReportsService
{
    Task<ReportsOverviewDto> GetOverviewAsync(ReportsOverviewParams p, CancellationToken ct);
    Task<ReportsParticipantDetailDto> GetParticipantDetailAsync(Guid? participantId, string? tckn, string? fullName, ReportsParticipantDetailParams p, CancellationToken ct);
}
