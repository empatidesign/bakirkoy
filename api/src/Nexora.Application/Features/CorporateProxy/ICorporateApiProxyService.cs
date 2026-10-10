namespace Nexora.Application.Features.CorporateProxy;

/// <summary>
/// Kurumsal API (sultangazi.bel.tr/api/v2) proxy'si.
///
/// GEREKÇE (GUVENLIK-YOL-HARITASI.md madde 2): mobil uygulama önceden bu API'ye
/// doğrudan client_id/client_secret ile bağlanıyordu; bu kimlik bilgileri
/// uygulama paketinde (react-native-config → native binary) düz metin olarak
/// duruyordu ve `strings` ile çıkarılabiliyordu. Bu servis, secret'ı yalnızca
/// sunucuda tutarak mobil uygulamanın hiçbir zaman onu görmemesini sağlar.
///
/// Mobil uygulama artık bu API'ye kendi kullanıcı JWT'siyle (Nexora auth)
/// istek atar; bu servis kurumsal API token'ını arka planda alıp/yenileyip
/// isteği iletir.
/// </summary>
public interface ICorporateApiProxyService
{
    /// <summary>
    /// İzin verilen yollardan biri için kurumsal API'ye GET isteği atar ve ham
    /// JSON gövdeyi döner. path allowlist dışındaysa (bkz. CorporateApiAllowedPaths)
    /// çağıran taraf (endpoint) bu metodu hiç çağırmamalıdır — allowlist kontrolü
    /// endpoint katmanında yapılır, böylece 404/403 ayrımı HTTP katmanında kalır.
    /// </summary>
    Task<CorporateApiResult> GetAsync(string path, string? queryString, CancellationToken ct);
}

public sealed record CorporateApiResult(int StatusCode, string? Body, string? ContentType);
