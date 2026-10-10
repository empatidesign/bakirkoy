using Nexora.Application.Features.Integrations.Dtos;

namespace Nexora.Application.Features.Integrations;

public interface IIntegrationSettingsService
{
    Task<IntegrationSettingsDto> GetAsync(CancellationToken ct);
    Task<IntegrationSettingsDto> SaveAsync(UpdateIntegrationSettingsRequest req, CancellationToken ct);

    Task<PublicMapConfigDto> GetPublicMapConfigAsync(CancellationToken ct);

    Task<ResolvedAiProvider?> ResolveAiProviderAsync(string? preferredProvider, CancellationToken ct);

    Task<ResolvedUlakbelConfig?> ResolveUlakbelAsync(CancellationToken ct);

    /// <summary>
    /// Kullanıcı isteği (2026-08-08): "Ulakbel'den bildirim gidiyorsa ordan gitsin ama bizim
    /// sistemde gitsin veya gitmesin şeklinde ayar olsun". Ulakbel entegrasyonu gerçekten
    /// yapılandırılmış (Enabled) olsun ya da olmasın (simülasyon modunda dahi) bu ayar,
    /// sistemin KENDİ vatandaş bildirimini (CitizenSubmissionService.
    /// NotifyCitizenOfStatusChangeAsync) açık/kapalı tutar — Ulakbel'in kendi tarafından
    /// vatandaşa ayrıca bir bildirim gidip gitmediğinden bağımsızdır, o bizim kontrolümüzde
    /// değildir. Varsayılan true (mevcut davranışla geriye dönük uyumlu).
    /// </summary>
    Task<bool> ShouldNotifyCitizenOnUlakbelUpdateAsync(CancellationToken ct);

    /// <summary>Flexcity açık ve adres + uygulama anahtarı girilmişse bağlantı bilgileri, değilse null.</summary>
    Task<ResolvedFlexcityConfig?> ResolveFlexcityAsync(CancellationToken ct);

    /// <summary>
    /// Bridge360 açık ve adres + API anahtarı girilmişse bağlantı bilgileri, değilse null.
    /// Not: Henüz gerçek Bridge360 API şeması yok; bu yalnızca bağlantı ayarlarını çözümler,
    /// gerçek bir gönderim/forward servisi (Ulakbell'deki ResolveUlakbelAsync'in forward
    /// karşılığı) henüz YAZILMADI çünkü API dokümanı sağlanmadı.
    /// </summary>
    Task<ResolvedBridge360Config?> ResolveBridge360Async(CancellationToken ct);
}

public record ResolvedAiProvider(string Provider, string ApiKey, string? Model);

public record ResolvedUlakbelConfig(string BaseUrl, string ApiToken, int? SourceId);

public record ResolvedFlexcityConfig(string BaseUrl, string AppKey, string? SecurityCode);

public record ResolvedBridge360Config(string BaseUrl, string ApiKey);
