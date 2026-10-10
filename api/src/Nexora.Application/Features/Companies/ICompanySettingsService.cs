using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies;

public interface ICompanySettingsService
{
    Task<CompanySettingsDto> GetAsync(CancellationToken ct);
    Task<CompanySettingsDto> SaveAsync(CompanySettingsDto dto, CancellationToken ct);

    /// <summary>
    /// Verilen olay için DB'de yapılandırılmış+aktif şablon varsa render edilmiş metni, yoksa null döner.
    /// Çağıran taraf null durumunda kendi orijinal sabit metnini kullanmaya devam eder (fallback).
    /// </summary>
    Task<string?> TryRenderAsync(string eventKey, CompanyNotificationContext ctx, CancellationToken ct);

    Task<CompanyManualMessageResultDto> SendManualMessageAsync(CompanyManualMessageRequest req, CancellationToken ct);
}
