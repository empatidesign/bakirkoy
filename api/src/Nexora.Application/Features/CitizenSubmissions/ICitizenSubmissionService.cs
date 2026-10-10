using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Application.Features.CitizenSubmissions.Dtos;

namespace Nexora.Application.Features.CitizenSubmissions;

public interface ICitizenSubmissionService
{
    Task<PagedResult<CitizenSubmissionDto>> GetPagedAsync(CitizenSubmissionListParams p, CancellationToken ct);
    Task<SubmissionSummaryDto> GetSummaryAsync(CitizenSubmissionListParams p, CancellationToken ct);
    Task<IReadOnlyList<SubmissionMapPointDto>> GetMapPointsAsync(CitizenSubmissionListParams p, CancellationToken ct);
    Task<SubmissionReportsSummaryDto> GetReportsSummaryAsync(CancellationToken ct);
    Task<IReadOnlyList<CitizenSubmissionOptionDto>> GetNeighborhoodOptionsAsync(CancellationToken ct);
    Task<CitizenSubmissionDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<CitizenSubmissionDto> UpdateStatusAsync(Guid id, string status, CancellationToken ct);

    /// <summary>Kullanıcı isteği (2026-08-28): durum değişirken vatandaşa iletilecek açıklama notu.</summary>
    Task<CitizenSubmissionDto> UpdateStatusAsync(Guid id, string status, string? note, CancellationToken ct);
    Task<CitizenSubmissionDto> ForwardAsync(Guid id, CancellationToken ct);

    /// <summary>ULAK-02/03: dış iletim sonucu belirsiz kaldığında (uzak kayıt oluşmuş olabilir) kör tekrar
    /// gönderim kilitlenir; operatör Ulakbell'de kaydın oluşmadığını doğruladıysa bu kilidi kaldırır.</summary>
    Task<CitizenSubmissionDto> ResetUlakbelForwardStateAsync(Guid id, string? reason, CancellationToken ct);
    Task<CitizenSubmissionDto> ToggleNotifyMuhtarAsync(Guid id, CancellationToken ct);
    Task<ProvisionMuhtarResultDto> ProvisionMuhtarAsync(string neighborhood, ProvisionMuhtarRequest req, CancellationToken ct);
    Task<IReadOnlyList<MuhtarAssignmentDto>> GetMuhtarAssignmentsAsync(CancellationToken ct);

    /// <summary>Kullanıcı isteği (2026-08-08): muhtar kendi mahallesi adına yeni bir talep oluşturabilsin.</summary>
    Task<CitizenSubmissionDto> CreateByMuhtarAsync(CreateSubmissionByMuhtarRequest req, CancellationToken ct);

    /// <summary>
    /// Kullanıcı isteği (2026-09-07): muhtar başkası adına talep açarken TC + doğum tarihiyle
    /// NVI (MERNİS) sorgusu yapıp kişinin kimliğini doğrulayabilsin. Sonuç maskelenmez (muhtar
    /// zaten talebi bu kişi adına oluşturacağı için gerçek adı görmesi gerekir — bu, saha
    /// anketöründeki maskeli önizlemeden bilinçli olarak farklıdır: burada kimliği "teyit"
    /// değil, doğrudan talebe "yazma" amaçlı kullanılıyor).
    /// </summary>
    Task<MuhtarNviLookupResultDto> MuhtarNviLookupAsync(MuhtarNviLookupRequest req, CancellationToken ct);

    /// <summary>Muhtarın başkası adına açtığı talebe ekleyeceği fotoğraf/video.</summary>
    Task<MuhtarSubmissionMediaUploadDto> UploadMuhtarMediaAsync(Stream stream, string fileName, string contentType, long sizeBytes, CancellationToken ct);

    Task<ModuleManualMessageResultDto> SendManualMessageAsync(ModuleManualMessageRequest req, CancellationToken ct);

    /// <summary>
    /// Denetim düzeltmesi (2026-09-01, KRİTİK): tek bir mahalleye scope'lu bir muhtar hesabının
    /// SMS/bildirim şablon ayarlarını değiştirmesini engeller — bu ayarlar TÜM 16 mahalleyi
    /// etkileyen TEK bir global kayıttır (ModuleNotificationSettingsService modül-bazlı,
    /// mahalle-bazlı değil). Bkz. servis implementasyonundaki tam açıklama.
    /// </summary>
    Task EnsureCanManageGlobalNotificationSettingsAsync(CancellationToken ct);
}
