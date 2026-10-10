using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.Integrations;
using Nexora.Infrastructure.Http;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// ulakBELL Başvuru Sistemi entegrasyonu.
///
/// Kullanıcı isteği (2026-09-07): Sultangazi Belediyesi ulakBELL API erişim bilgileri
/// (BaseUrl + API Token) sağlandı ve gerçek entegrasyonun yazılması istendi. Gerçek API
/// şeması, ulakBELL'in resmi Postman koleksiyonundan (https://api.ulakbell.com) çıkarıldı
/// — önceki implementasyon (externalId/title/neighborhood... alanları) tahmine dayalıydı
/// ve gerçek servisle UYUŞMUYORDU. Gerçek /api/incident endpoint'i şu alanları bekler:
///   source_id (int, zorunlu), text (string, zorunlu), mobile_phone (long, opsiyonel),
///   attachments[] ({local_name, real_name}), geogrophic_coordinate{lat,long,accy},
///   incident_type ("demand"|"complaint"|"thank"|"project"|"information"|"notice").
/// Adres alanları (ilce_id/mahalle_id/sokak_id) kurumun ulakBELL'e özel sayısal ID
/// setini gerektirir ve bizim mahalle isim listemizle (MuhtarlikReference.Neighborhoods)
/// birebir eşlenemez; bu yüzden adres bilgisi insan-okur "text" alanına gömülür, adres
/// ID alanları gönderilmez (API dokümantasyonuna göre zorunlu değiller, yalnızca
/// "Adres Listeleme" servisleriyle önceden çözülmüş ID varsa kullanılır).
/// </summary>
public class UlakbelForwardService(
    IHttpClientFactory httpClientFactory,
    IIntegrationSettingsService settings,
    IFileStorageService fileStorage,
    IOptions<MinioSettings> minioOptions,
    ILogger<UlakbelForwardService> logger) : IUlakbelForwardService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<UlakbelForwardResult> ForwardAsync(UlakbelForwardRequest request, CancellationToken ct)
    {
        var config = await settings.ResolveUlakbelAsync(ct);
        if (config is null)
        {
            logger.LogInformation("Ulakbell iletimi kapalı veya yapılandırılmamış. SubmissionId={SubmissionId}", request.SubmissionId);
            return new UlakbelForwardResult(IsSimulated: false, TrackingNo: "", Success: false,
                ErrorMessage: "Ulakbel iletimi kapalı. Başvuru yalnızca bu sistemde saklanır.",
                Outcome: UlakbelForwardOutcome.Failed);
        }

        if (config.SourceId is null or <= 0)
        {
            logger.LogWarning("Ulakbell SourceId (Başvuru Kaynağı) yapılandırılmamış. SubmissionId={SubmissionId}", request.SubmissionId);
            return new UlakbelForwardResult(
                IsSimulated: false, TrackingNo: "",
                Success: false, ErrorMessage: "Ulakbell Başvuru Kaynağı (Source ID) ayarlanmamış. Lütfen Ayarlar > Entegrasyonlar'dan yapılandırın.",
                Outcome: UlakbelForwardOutcome.Failed);
        }

        // ULAK-05: GERÇEK gönderim yolu da (yalnız bağlantı testi değil) SSRF doğrulamasından geçer.
        // BaseUrl admin girdisi serbest metindir; https + iç ağ/loopback/link-local/metadata engeli
        // hem incident hem dosya-yükleme çağrılarından ÖNCE tek noktada uygulanır. Redirect ile
        // özel IP'ye kaçış, "ulakbel" HttpClient'ında AllowAutoRedirect=false ile kapatılıdır (DI).
        if (!OutboundUrlGuard.TryValidate(config.BaseUrl, out var urlError))
        {
            logger.LogWarning("Ulakbell BaseUrl SSRF doğrulamasından geçmedi. SubmissionId={SubmissionId} Error={Error}", request.SubmissionId, urlError);
            return new UlakbelForwardResult(IsSimulated: false, TrackingNo: "", Success: false, ErrorMessage: urlError,
                Outcome: UlakbelForwardOutcome.Failed);
        }

        var client = httpClientFactory.CreateClient("ulakbel");
        client.Timeout = TimeSpan.FromSeconds(30);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config.ApiToken);

        try
        {
            var attachments = await UploadAttachmentsAsync(client, config.BaseUrl, request.MediaUrls, request.SubmissionId, ct);

            var text = BuildIncidentText(request);
            var mobilePhone = TryParseMobilePhone(request.CitizenPhone);
            if (mobilePhone is null && !string.IsNullOrWhiteSpace(request.CitizenPhone))
                logger.LogWarning(
                    "Ulakbell iletimi: iletişim telefonu desteklenen TR biçimine (5XXXXXXXXX) normalize edilemedi, mobile_phone atlandı. SubmissionId={SubmissionId}",
                    request.SubmissionId);

            object? geo = request.Latitude.HasValue && request.Longitude.HasValue
                ? new { lat = request.Latitude.Value, @long = request.Longitude.Value, accy = 100 }
                : null;

            var payload = new Dictionary<string, object?>
            {
                ["source_id"] = config.SourceId.Value,
                ["text"] = text,
                ["incident_type"] = MapIncidentType(request.CategoryLabel, request.Priority),
            };
            if (mobilePhone is not null) payload["mobile_phone"] = mobilePhone.Value;
            if (attachments.Count > 0) payload["attachments"] = attachments;
            if (geo is not null) payload["geogrophic_coordinate"] = geo;

            using var response = await client.PostAsJsonAsync($"{config.BaseUrl}/api/incident", payload, JsonOpts, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Ulakbell /api/incident HTTP {Status} döndürdü. SubmissionId={SubmissionId} Body={Body}",
                    (int)response.StatusCode, request.SubmissionId, Truncate(body));
                // ULAK-03: 4xx = sunucu isteği REDDETTİ, uzak kayıt oluşmadı → güvenle yeniden gönderilebilir (Failed).
                // 5xx = sunucu tarafında hata; kayıt oluşmuş OLABİLİR → belirsiz (Unknown), kör tekrar POST yapılmamalı.
                var status = (int)response.StatusCode;
                var outcome = status is >= 500 ? UlakbelForwardOutcome.Unknown : UlakbelForwardOutcome.Failed;
                var message = outcome == UlakbelForwardOutcome.Unknown
                    ? $"Ulakbell servisi HTTP {status} döndürdü; iletim sonucu belirsiz. Ulakbell tarafında kaydın oluşup oluşmadığını kontrol etmeden tekrar göndermeyin."
                    : $"Ulakbell servisi HTTP {status} döndürdü.";
                return new UlakbelForwardResult(
                    IsSimulated: false, TrackingNo: "",
                    Success: false, ErrorMessage: message, Outcome: outcome);
            }

            // ULAK-02: HTTP 2xx tek başına teslim kanıtı değildir. Yanıt gerçekten sözleşmeye uymalı:
            // JSON nesne kökü + BOŞ OLMAYAN uzak kimlik (public_token veya pozitif number). Aksi halde
            // ({} / HTML / [] / boş / success:false / hata nesnesi / boş token) YEREL/RASTGELE numarayla
            // "iletildi" ÜRETİLMEZ — kontrollü başarısız sonuç döner; çağıran kör tekrar POST yapmaz.
            var remoteTrackingNo = TryExtractRemoteIdentifier(body);
            if (remoteTrackingNo is null)
            {
                logger.LogWarning(
                    "Ulakbell 2xx döndü ama yanıt sözleşmeye uymuyor / uzak kimlik yok. SubmissionId={SubmissionId} Body={Body}",
                    request.SubmissionId, Truncate(body));
                // ULAK-02/03: 2xx döndü ama sözleşmeye uymuyor → sunucu isteği ALMIŞ olabilir; kayıt oluşmuş
                // OLABİLİR. Belirsiz sonuç (Unknown): kör tekrar POST engellenmeli, operatör doğrulaması gerekir.
                return new UlakbelForwardResult(
                    IsSimulated: false, TrackingNo: "", Success: false,
                    ErrorMessage: "Ulakbell'den beklenen başvuru numarası alınamadı; iletim doğrulanamadı. Ulakbell tarafında kaydın oluşup oluşmadığını kontrol etmeden tekrar göndermeyin.",
                    Outcome: UlakbelForwardOutcome.Unknown);
            }
            logger.LogInformation(
                "Ulakbell'e gerçek API ile iletildi. SubmissionId={SubmissionId} UlakbelTrackingNo={TrackingNo}",
                request.SubmissionId, remoteTrackingNo);
            return new UlakbelForwardResult(IsSimulated: false, TrackingNo: remoteTrackingNo, Success: true, ErrorMessage: null,
                Outcome: UlakbelForwardOutcome.Delivered);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (TaskCanceledException ex)
        {
            // Timeout (ct iptali DEĞİL): istek sunucuya ulaşıp kayıt oluşmuş OLABİLİR → belirsiz.
            logger.LogWarning(ex, "Ulakbell API çağrısı zaman aşımına uğradı. SubmissionId={SubmissionId}", request.SubmissionId);
            return new UlakbelForwardResult(
                IsSimulated: false, TrackingNo: "", Success: false,
                ErrorMessage: "Ulakbell servisi zaman aşımına uğradı; iletim sonucu belirsiz. Ulakbell tarafında kaydın oluşup oluşmadığını kontrol etmeden tekrar göndermeyin.",
                Outcome: UlakbelForwardOutcome.Unknown);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Ulakbell API çağrısı başarısız oldu. SubmissionId={SubmissionId} Error={Error}", request.SubmissionId, ex.HttpRequestError);
            // ULAK-03 (A): HttpRequestException her zaman "istek ulaşmadı" demek değildir. Yalnız gönderim
            // ÖNCESİ kesinleşen hatalar (DNS/connect/TLS/proxy — connect-guard reddi dahil) güvenle yeniden
            // gönderilebilir (Failed). Gönderim başladıktan sonraki response-ended/read/connection-reset gibi
            // hatalarda uzak kayıt oluşmuş OLABİLİR → belirsiz (Unknown).
            var notSent = ex.HttpRequestError is HttpRequestError.NameResolutionError
                or HttpRequestError.ConnectionError
                or HttpRequestError.SecureConnectionError
                or HttpRequestError.ProxyTunnelError;
            return new UlakbelForwardResult(
                IsSimulated: false, TrackingNo: "", Success: false,
                ErrorMessage: notSent
                    ? "Ulakbell servisine ulaşılamadı. Lütfen daha sonra tekrar deneyin veya API ayarlarını kontrol edin."
                    : "Ulakbell servisiyle bağlantı iletim sırasında kesildi; iletim sonucu belirsiz. Ulakbell tarafında kaydın oluşup oluşmadığını kontrol etmeden tekrar göndermeyin.",
                Outcome: notSent ? UlakbelForwardOutcome.Failed : UlakbelForwardOutcome.Unknown);
        }
        catch (JsonException ex)
        {
            // Beklenmedik serileştirme/ayrıştırma anomalisi — konservatif belirsiz.
            logger.LogWarning(ex, "Ulakbell yanıtı işlenirken beklenmedik hata. SubmissionId={SubmissionId}", request.SubmissionId);
            return new UlakbelForwardResult(
                IsSimulated: false, TrackingNo: "", Success: false,
                ErrorMessage: "Ulakbell yanıtı işlenemedi; iletim sonucu belirsiz. Ulakbell tarafında kaydın oluşup oluşmadığını kontrol etmeden tekrar göndermeyin.",
                Outcome: UlakbelForwardOutcome.Unknown);
        }
    }

    /// <summary>
    /// Bize ait medya URL'leri (/api/v1/files/public/{objectName}) MinIO'dan indirilip
    /// ulakBELL'in kendi "Dosya Yükleme" servisine (POST /api/attachment/upload,
    /// multipart "files[]") yeniden yüklenir; dönen local_name'ler incident'a eklenir.
    /// Herhangi bir dosya indirme/yükleme hatası tüm iletimi düşürmez — sessizce atlanır,
    /// başvuru metni yine de gönderilir (dosya olmadan da geçerli bir başvurudur).
    /// </summary>
    private async Task<List<Dictionary<string, string>>> UploadAttachmentsAsync(
        HttpClient client, string baseUrl, IReadOnlyList<string> mediaUrls, Guid submissionId, CancellationToken ct)
    {
        var result = new List<Dictionary<string, string>>();
        if (mediaUrls.Count == 0) return result;

        using var form = new MultipartFormDataContent();
        var owned = new List<Stream>();
        try
        {
            foreach (var url in mediaUrls.Take(10))
            {
                var objectName = ExtractPublicObjectName(url);
                if (objectName is null) continue;

                var download = await fileStorage.GetObjectAsync(objectName, minioOptions.Value.PublicBucket, ct);
                if (download is null)
                {
                    logger.LogWarning("Ulakbell iletimi: medya indirilemedi, atlanıyor. SubmissionId={SubmissionId} Object={Object}", submissionId, objectName);
                    continue;
                }
                owned.Add(download.Stream);
                var fileName = objectName.Contains('/') ? objectName[(objectName.LastIndexOf('/') + 1)..] : objectName;
                var content = new StreamContent(download.Stream);
                content.Headers.ContentType = new MediaTypeHeaderValue(download.ContentType);
                form.Add(content, "files[]", fileName);
            }

            if (!form.Any()) return result;

            using var uploadResponse = await client.PostAsync($"{baseUrl}/api/attachment/upload", form, ct);
            var uploadBody = await uploadResponse.Content.ReadAsStringAsync(ct);
            if (!uploadResponse.IsSuccessStatusCode)
            {
                logger.LogWarning("Ulakbell dosya yükleme HTTP {Status} döndürdü. SubmissionId={SubmissionId} Body={Body}",
                    (int)uploadResponse.StatusCode, submissionId, Truncate(uploadBody));
                return result;
            }

            using var doc = JsonDocument.Parse(uploadBody);
            if (doc.RootElement.TryGetProperty("files", out var files) && files.ValueKind == JsonValueKind.Array)
            {
                foreach (var f in files.EnumerateArray())
                {
                    var localName = f.TryGetProperty("local_name", out var ln) ? ln.GetString() : null;
                    var realName = f.TryGetProperty("real_name", out var rn) ? rn.GetString() : null;
                    if (!string.IsNullOrEmpty(localName))
                        result.Add(new Dictionary<string, string> { ["local_name"] = localName, ["real_name"] = realName ?? localName });
                }
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or IOException)
        {
            logger.LogWarning(ex, "Ulakbell dosya yükleme sırasında hata. SubmissionId={SubmissionId}", submissionId);
        }
        finally
        {
            foreach (var s in owned) await s.DisposeAsync();
        }
        return result;
    }

    /// <summary>"/api/v1/files/public/{objectName}" göreli yolundan MinIO object adını çıkarır.
    /// Bu formatta olmayan (örn. dış/absolute) URL'ler yok sayılır.</summary>
    private static string? ExtractPublicObjectName(string url)
    {
        const string marker = "/files/public/";
        var idx = url.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;
        var encoded = url[(idx + marker.Length)..];
        try { return Uri.UnescapeDataString(encoded); }
        catch { return null; }
    }

    private static string BuildIncidentText(UlakbelForwardRequest r)
    {
        var lines = new List<string>
        {
            r.Title,
            "",
            r.Description,
            "",
            $"Mahalle: {r.Neighborhood}",
            $"Adres: {r.Address}",
            $"Kategori: {r.CategoryLabel}",
            $"Öncelik: {r.Priority}",
            $"Yönlendirilen birim: {r.TargetUnit}",
        };
        if (!string.IsNullOrWhiteSpace(r.TrackingNo)) lines.Add($"Nexora takip no: {r.TrackingNo}");
        lines.Add("Kaynak: Nexora Muhtarlık Sistemi");
        return string.Join('\n', lines);
    }

    private static long? TryParseMobilePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        // ULAK-12: desteklenen TR biçimleri tek yerde ele alınır — +90/0090/90/0 ülke-kodu varyantları
        // temizlenip 10 haneli (5XXXXXXXXX) ulakBELL biçimine indirilir. Başka ülke numarası veya
        // maskeli/eksik giriş rastgele kırpılmaz: son kontrol (10 hane + baş '5') geçmezse null döner
        // (çağıran atlanan telefonu loglar).
        if (digits.StartsWith("0090")) digits = digits[4..];
        else if (digits.Length == 12 && digits.StartsWith("90")) digits = digits[2..];
        else if (digits.Length == 11 && digits.StartsWith('0')) digits = digits[1..];
        return digits.Length == 10 && digits[0] == '5' && long.TryParse(digits, out var v) ? v : null;
    }

    private static string MapIncidentType(string categoryLabel, string priority)
        // Nexora tarafında başvurular "request/suggestion/complaint" olarak sınıflanıyor
        // (bkz. MuhtarlikReference.SubmissionTypes) ama bu bilgi ForwardAsync'e kadar
        // taşınmıyor; kategori etiketi ve önceliğe göre en yakın ulakBELL tipine eşlenir.
        => priority == "urgent" ? "notice" : "complaint";

    // ULAK-02: yalnız GERÇEK bir uzak kimlik döner; aksi halde null (başarı üretilmez). Nesne olmayan kök,
    // boş gövde, HTML, [] , success:false, hata nesnesi ve boş/whitespace token → null. Rastgele/yerel
    // numaraya DÜŞÜLMEZ.
    private static string? TryExtractRemoteIdentifier(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;
            if (root.TryGetProperty("success", out var succ) && succ.ValueKind == JsonValueKind.False) return null;
            if (root.TryGetProperty("error", out var err) && err.ValueKind is not JsonValueKind.Null) return null;

            if (root.TryGetProperty("public_token", out var pt) && pt.ValueKind == JsonValueKind.String)
            {
                var token = pt.GetString();
                if (!string.IsNullOrWhiteSpace(token)) return token.Trim();
            }
            if (root.TryGetProperty("number", out var num) && num.ValueKind == JsonValueKind.Number
                && num.TryGetInt64(out var n) && n > 0)
                return n.ToString();

            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string Truncate(string s) => s.Length > 500 ? s[..500] : s;
}
