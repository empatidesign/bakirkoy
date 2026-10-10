using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Application.Features.Surveys.Dtos;

namespace Nexora.Application.Features.Surveys;

public interface ISurveyService
{
    Task<PagedResult<SurveyDto>> GetPagedAsync(SurveyListParams p, CancellationToken ct);
    Task<SurveySummaryDto> GetSummaryAsync(CancellationToken ct);
    Task<SurveyDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SurveyDto> CreateAsync(CreateSurveyRequest req, CancellationToken ct);
    Task<SurveyDto> UpdateAsync(Guid id, UpdateSurveyRequest req, CancellationToken ct);
    Task<SurveyDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<SurveyDto> DuplicateAsync(Guid id, CancellationToken ct);
    /// <summary>
    /// Kullanıcı isteği (2026-09-01): "silmek icin mutlaka silmek istiyorum onay gibi birşey
    /// yazıp silmek lazım cünkü birsürü data gider ... silmek süper yönetici yapbilir".
    /// Anket silmek, ankete verilmiş TÜM yanıtları da yok eder; bu yüzden iki koruma vardır:
    /// (1) yalnızca süper yönetici silebilir, (2) istek gövdesinde tam onay metni gönderilmelidir.
    /// </summary>
    Task DeleteAsync(Guid id, SurveyDeleteRequest req, CancellationToken ct);

    /// <summary>Silme ekranında gösterilecek etki özeti (kaç yanıt/saha görevi yok olacak).</summary>
    Task<SurveyDeleteImpactDto> GetDeleteImpactAsync(Guid id, CancellationToken ct);
    Task<List<SurveyQuestionDto>> GetQuestionsAsync(Guid surveyId, CancellationToken ct);
    Task<SurveyAnalyticsDto> GetAnalyticsAsync(Guid surveyId, CancellationToken ct);

    // Bireysel anket cevaplarını görüntüleme (admin panel "Yanıtlar" sekmesi).
    Task<PagedResult<SurveyResponseListItemDto>> GetResponsesAsync(Guid surveyId, SurveyResponseListParams p, CancellationToken ct);
    Task<SurveyResponseListItemDto> GetResponseByIdAsync(Guid surveyId, Guid responseId, CancellationToken ct);
    Task<ModuleManualMessageResultDto> SendManualMessageAsync(ModuleManualMessageRequest req, CancellationToken ct);

    // Kullanıcı isteği (2026-09-20): Anketler > Genel Ayarlar — günlük opsiyonel anket
    // yanıtı limiti ve iki yanıt arası bekleme süresi.
    Task<SurveyGlobalSettingsDto> GetGlobalSettingsAsync(CancellationToken ct);
    Task<SurveyGlobalSettingsDto> UpdateGlobalSettingsAsync(UpdateSurveyGlobalSettingsRequest req, CancellationToken ct);
}
