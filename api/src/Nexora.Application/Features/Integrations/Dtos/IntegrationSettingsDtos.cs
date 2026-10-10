namespace Nexora.Application.Features.Integrations.Dtos;


public record MapProviderSettingsDto(
    bool Enabled,
    bool HasApiKey,
    string? MaskedApiKey
);

public record AiProviderSettingsDto(
    bool Enabled,
    bool HasApiKey,
    string? MaskedApiKey,
    string? Model
);

public record UlakbelSettingsDto(
    bool Enabled,
    string? BaseUrl,
    bool HasApiToken,
    string? MaskedApiToken,
    bool NotifyCitizenOnUpdate,
    // Kullanıcı isteği (2026-09-07): gerçek ulakBELL API'si (/api/incident) başvuruyu hangi
    // "Başvuru Kaynağı"na ekleyeceğini source_id ile belirler (Yönetici > Başvuru Kaynakları'ndan
    // alınır). Bu alan olmadan gerçek API'ye başvuru oluşturulamaz.
    int? SourceId
);

public record IntegrationSettingsDto(
    MapProviderSettingsDto GoogleMaps,
    AiProviderSettingsDto OpenAi,
    AiProviderSettingsDto Anthropic,
    AiProviderSettingsDto Gemini,
    string? DefaultAiProvider,
    UlakbelSettingsDto Ulakbel,
    FlexcitySettingsDto? Flexcity = null,
    Bridge360SettingsDto? Bridge360 = null
);

/// <summary>
/// Bridge360 belediye çağrı merkezi/CRM entegrasyonu — Kullanıcı isteği (2026-10-07): Halk Masası
/// mock modülü kaldırılıp tüm vatandaş talep/şikayet/öneri akışı gerçek Muhtarlık/CitizenSubmission
/// sistemine konsolide edilirken, gelecekte Ulakbell'in yanına/yerine Bridge360'a da iletim
/// eklenmesi istendi. HENÜZ GERÇEK BRIDGE360 API DOKÜMANTASYONU / ERİŞİM BİLGİSİ SAĞLANMADI
/// (Ulakbell'in aksine, o gerçek bir Postman koleksiyonuyla doğrulanmıştı). Bu yüzden burada
/// SADECE bağlantı ayarları (adres + API anahtarı) ve genel bir "sunucuya erişilebiliyor mu"
/// testi vardır — Ulakbell'deki /api/incident gibi UYDURULMUŞ bir gönderim şeması YOKTUR.
/// Gerçek API dokümanı geldiğinde IBridge360ForwardService eklenip CitizenSubmissionService'teki
/// ForwardAsync akışına Ulakbel'e paralel bir hedef olarak bağlanacaktır.
/// </summary>
public record Bridge360SettingsDto(
    bool Enabled,
    string? BaseUrl,
    bool HasApiKey,
    string? MaskedApiKey
);

/// <summary>Flexcity KTS (kütüphane emanet/ödünç) bağlantısı. Varsayılan kapalı; admin panelden açılır.</summary>
public record FlexcitySettingsDto(
    bool Enabled,
    string? BaseUrl,
    bool HasAppKey,
    string? MaskedAppKey,
    bool HasSecurityCode
);

public record UpdateFlexcitySettingsRequest(bool Enabled, string? BaseUrl, string? AppKey, string? SecurityCode, bool ClearCredentials = false);

public record UpdateBridge360SettingsRequest(bool Enabled, string? BaseUrl, string? ApiKey, bool ClearApiKey = false);

public record UpdateMapProviderRequest(bool Enabled, string? ApiKey, bool ClearApiKey);

public record UpdateAiProviderRequest(bool Enabled, string? ApiKey, bool ClearApiKey, string? Model);

public record UpdateUlakbelSettingsRequest(bool Enabled, string? BaseUrl, string? ApiToken, bool ClearApiToken, bool NotifyCitizenOnUpdate = true, int? SourceId = null);

public record UpdateIntegrationSettingsRequest(
    UpdateMapProviderRequest GoogleMaps,
    UpdateAiProviderRequest OpenAi,
    UpdateAiProviderRequest Anthropic,
    UpdateAiProviderRequest Gemini,
    string? DefaultAiProvider,
    UpdateUlakbelSettingsRequest? Ulakbel,
    UpdateFlexcitySettingsRequest? Flexcity = null,
    UpdateBridge360SettingsRequest? Bridge360 = null
);

public record PublicMapConfigDto(bool Enabled, string? ApiKey);
