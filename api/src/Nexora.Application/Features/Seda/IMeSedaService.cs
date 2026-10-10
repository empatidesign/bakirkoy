using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda;

public interface IMeSedaService
{
    Task<CitizenSedaInfoDto> GetInfoAsync(CancellationToken ct);
    Task<CitizenSedaOptionsDto> GetOptionsAsync(CancellationToken ct);
    Task<SedaApplicationDto> ApplyAsync(CitizenSedaApplyRequest req, CancellationToken ct);
    Task<PagedResult<SedaApplicationDto>> GetMyApplicationsAsync(int page, int limit, CancellationToken ct);
    Task<CitizenSedaResultDto> GetMyResultAsync(CancellationToken ct);
    // Kullanıcı isteği (2026-08-12): "her eğitim öğretim yılı için gerekli olacak" + "telefon
    // numaraları ile sorgulayabilmesi" — vatandaş sadece aktif dönemin değil, TCKN veya telefon
    // numarasıyla eşleşen TÜM yılların/dönemlerin sonucunu görebilsin.
    Task<List<CitizenSedaResultItemDto>> GetMyResultsAsync(CancellationToken ct);
    Task CancelApplicationAsync(Guid applicationId, CancellationToken ct);
}
