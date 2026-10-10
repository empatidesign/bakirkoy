using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Surveys.Dtos;

namespace Nexora.Application.Features.Surveys;

/// <summary>
/// SultanŞehir Anket, Saha Araştırma ve Vatandaş Geri Bildirim Platformu
/// (docs/SultanSehir_Anket_Platformu_MD_Paketi) için saha operasyonu, kota,
/// soru bankası, şablon ve karar destek analitiği servisi.
/// Mevcut <see cref="ISurveyService"/> (anket CRUD) bozulmadan genişletilir.
/// </summary>
public interface ISurveyPlatformService
{
    // Saha görevleri (doküman 03/08)
    Task<PagedResult<SurveyFieldTaskDto>> GetFieldTasksAsync(SurveyFieldTaskListParams p, CancellationToken ct);
    Task<SurveyFieldTaskDto> GetFieldTaskByIdAsync(Guid id, CancellationToken ct);
    Task<SurveyFieldTaskDto> CreateFieldTaskAsync(SaveSurveyFieldTaskRequest req, CancellationToken ct);
    Task<SurveyFieldTaskDto> UpdateFieldTaskAsync(Guid id, SaveSurveyFieldTaskRequest req, CancellationToken ct);
    Task DeleteFieldTaskAsync(Guid id, CancellationToken ct);
    Task<List<SurveyFieldTaskDto>> BatchCreateFieldTasksAsync(BatchCreateSurveyFieldTaskRequest req, CancellationToken ct);
    /// <summary>Seçili saha görevleri üzerinde toplu işlem: aktif/pasif, mahalle ata, anket ata, sil (soft-delete).</summary>
    Task<BulkSurveyFieldTaskResult> BulkFieldTaskActionAsync(BulkSurveyFieldTaskRequest req, CancellationToken ct);
    Task<List<SurveyInterviewerCandidateDto>> SearchInterviewerCandidatesAsync(string? search, CancellationToken ct);

    // Anketör performansı (doküman 01 §7)
    Task<List<SurveyInterviewerStatsDto>> GetInterviewerStatsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct);

    // Kullanıcı isteği (2026-09-01): saha görevlilerinin canlı GPS takibi ve gün izi.
    /// <summary>Sahadaki anketörlerin son konumu, çevrimiçilik durumu ve bugünkü yürüyüş/üretim özeti.</summary>
    Task<List<SurveyFieldLiveAgentDto>> GetLiveAgentsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct);
    /// <summary>Bir anketörün belirli bir güne ait rota izi, duraklamaları ve anket doldurduğu noktalar.</summary>
    Task<SurveyFieldTrailDto> GetAgentTrailAsync(Guid interviewerId, DateTime? date, CancellationToken ct);
    /// <summary>Anketör performans ve veri güvenilirliği tablosu (saha ortalamasıyla birlikte).</summary>
    Task<SurveyInterviewerPerformanceResultDto> GetInterviewerPerformanceAsync(SurveyAnalyticsFilterParams p, CancellationToken ct);

    // Kota yönetimi (doküman 01 §6)
    Task<List<SurveyQuotaDto>> GetQuotasAsync(Guid surveyId, CancellationToken ct);
    Task<List<SurveyQuotaDto>> SaveQuotasAsync(Guid surveyId, SaveSurveyQuotasRequest req, CancellationToken ct);

    // Soru bankası (doküman 02 §7)
    Task<PagedResult<SurveyQuestionBankItemDto>> GetQuestionBankAsync(SurveyQuestionBankListParams p, CancellationToken ct);
    Task<SurveyQuestionBankItemDto> CreateQuestionBankItemAsync(SaveSurveyQuestionBankItemRequest req, CancellationToken ct);
    Task<SurveyQuestionBankItemDto> UpdateQuestionBankItemAsync(Guid id, SaveSurveyQuestionBankItemRequest req, CancellationToken ct);
    Task<SurveyQuestionBankItemDto> ToggleQuestionBankItemAsync(Guid id, CancellationToken ct);
    Task DeleteQuestionBankItemAsync(Guid id, CancellationToken ct);
    Task<List<string>> GetQuestionBankTopicsAsync(CancellationToken ct);

    // Hazır anket şablonları (doküman 02 §6)
    Task<List<SurveyTemplateDto>> GetTemplatesAsync(CancellationToken ct);

    // Anketörlere toplu mesaj / duyuru (kullanıcı isteği 2026-09-01)
    Task<SurveyInterviewerMessageResult> SendInterviewerMessageAsync(SurveyInterviewerMessageRequest req, CancellationToken ct);

    // Gönderilen bildirimlerin okunma/onay takibi (kullanıcı isteği 2026-09-02)
    Task<List<SurveyNotificationSummaryDto>> GetInterviewerNotificationReceiptsAsync(
        Guid? interviewerId, Guid? surveyId, int take, CancellationToken ct);

    // Analitik (doküman 04)
    Task<List<SurveyNeighborhoodStatsDto>> GetNeighborhoodStatsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct);
    Task<List<SurveyTopicStatsDto>> GetTopicStatsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct);
    Task<SurveyFieldOperationsDto> GetFieldOperationsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct);
    Task<SurveyExecutiveDashboardDto> GetExecutiveDashboardAsync(SurveyAnalyticsFilterParams p, CancellationToken ct);
}
