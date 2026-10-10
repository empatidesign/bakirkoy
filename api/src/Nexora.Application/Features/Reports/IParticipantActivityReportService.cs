using Nexora.Application.Features.Reports.Dtos;

namespace Nexora.Application.Features.Reports;

public interface IParticipantActivityReportService
{
    Task<ParticipantActivityReportDto> GetReportAsync(ParticipantActivityReportParams p, CancellationToken ct);
    Task<ParticipantActivityDetailDto?> GetDetailAsync(Guid? participantId, string? tckn, ParticipantActivityReportParams p, CancellationToken ct);
}
