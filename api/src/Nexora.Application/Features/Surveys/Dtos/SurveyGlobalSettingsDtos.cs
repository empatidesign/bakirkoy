namespace Nexora.Application.Features.Surveys.Dtos;

/// <summary>
/// Kullanıcı isteği (2026-09-20): "insanları çok yormadan katılımı sağlayacağız" — Anketler
/// &gt; Genel Ayarlar sekmesinde yönetilen, vatandaş başına GÜNLÜK opsiyonel anket yanıtı
/// limiti ve iki yanıt arası bekleme süresi. Zorunlu anketler bu ayardan etkilenmez.
/// </summary>
public record SurveyGlobalSettingsDto(
    int MaxOptionalResponsesPerDay,
    int MinMinutesBetweenOptionalResponses,
    DateTime? UpdatedAt);

public record UpdateSurveyGlobalSettingsRequest(
    int MaxOptionalResponsesPerDay,
    int MinMinutesBetweenOptionalResponses);
