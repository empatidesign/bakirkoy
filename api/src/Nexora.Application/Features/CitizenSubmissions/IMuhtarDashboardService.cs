using Nexora.Application.Features.CitizenSubmissions.Dtos;

namespace Nexora.Application.Features.CitizenSubmissions;

/// <summary>
/// Kullanıcı isteği (2026-08-28): muhtarın kendi panelinde mahallesindeki tüm süreci — kimlik
/// bilgisi olmadan — görmesi, en çok hangi konularda başvuru geldiğini ve sürelerin nasıl
/// işlediğini izlemesi, kayda kendi görüşünü eklemesi.
/// </summary>
public interface IMuhtarDashboardService
{
    Task<MuhtarDashboardDto> GetDashboardAsync(string? neighborhood, string? dateRange, CancellationToken ct);
    Task<MuhtarSubmissionDetailDto> GetDetailAsync(Guid submissionId, CancellationToken ct);
    Task<MuhtarSubmissionDetailDto> AddOpinionAsync(Guid submissionId, MuhtarOpinionRequest req, CancellationToken ct);
}
