using Nexora.Application.Features.Notifications.Dtos;

namespace Nexora.Application.Features.Notifications;

/// <summary>
/// Doğum günü kutlama ayarları + manuel çalıştırma/önizleme.
/// Ayarlar <c>ModuleNotificationSettings</c> tablosunda <c>module="birthday"</c> satırında tutulur.
/// </summary>
public interface IBirthdayGreetingService
{
    Task<BirthdaySettingsDto> GetSettingsAsync(CancellationToken ct);

    Task<BirthdaySettingsDto> SaveSettingsAsync(BirthdaySettingsDto dto, CancellationToken ct);

    /// <summary>Bugün doğum günü olanları listeler (gönderim yapmaz).</summary>
    Task<IReadOnlyList<BirthdayPreviewItemDto>> PreviewAsync(CancellationToken ct);

    /// <summary>
    /// Gönderimi çalıştırır. <paramref name="dryRun"/> true ise hiçbir mesaj gönderilmez,
    /// yalnızca kaç kişiye gideceği hesaplanır. <paramref name="force"/> true ise
    /// "otomatik gönderim kapalı" ve "saat henüz gelmedi" kontrolleri atlanır (admin tetiklemesi).
    /// </summary>
    Task<BirthdayRunResultDto> RunAsync(bool dryRun, bool force, CancellationToken ct);

    /// <summary>
    /// Canlı durum: gönderim sürüyor mu, kaç mesaj gönderilmeyi bekliyor.
    /// Admin panelde "gönderilmeyi bekleyen X mesaj var" uyarısını besler.
    /// </summary>
    Task<BirthdayStatusDto> GetStatusAsync(CancellationToken ct);

    /// <summary>
    /// Devam eden gönderimi iptal eder — kalan tüm liste gönderilmez.
    /// Yanlış gönderim fark edildiğinde acil durdurma (kill switch).
    /// </summary>
    Task<BirthdayCancelResultDto> CancelAsync(string? cancelledBy, CancellationToken ct);
}
