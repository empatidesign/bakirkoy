using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Surveys.Dtos;
using Nexora.Domain.Entities.Surveys;

namespace Nexora.Application.Common.Repositories;

public interface ISurveyRepository : IRepository<Survey>
{
    Task<PagedResult<Survey>> GetPagedAsync(SurveyListParams p, CancellationToken ct);
    Task<List<SurveyQuestion>> GetQuestionsAsync(Guid surveyId, CancellationToken ct);
    Task ReplaceQuestionsAsync(Guid surveyId, IEnumerable<SurveyQuestion> questions, CancellationToken ct);
    Task<(int Total, int Active, int Passive, int Draft, int Completed)> GetSummaryCountsAsync(CancellationToken ct);
    Task<int> GetTotalResponsesAsync(CancellationToken ct);
    Task<Dictionary<Guid, int>> GetResponseCountsAsync(IReadOnlyCollection<Guid> surveyIds, CancellationToken ct);
    Task<List<SurveyCategoryCountDto>> GetCategoryDistributionAsync(CancellationToken ct);
    Task<List<Survey>> GetRecentAsync(int take, CancellationToken ct);

    Task<bool> ResponseExistsAsync(Guid surveyId, string tc, CancellationToken ct);
    Task<HashSet<Guid>> GetRespondedSurveyIdsAsync(IReadOnlyCollection<Guid> surveyIds, string tc, CancellationToken ct);
    Task AddResponseAsync(SurveyResponse response, CancellationToken ct);
    Task<int> CountResponsesAsync(Guid surveyId, CancellationToken ct);

    Task<List<Guid>> GetParticipantIdsBySurveysAsync(IReadOnlyCollection<Guid> surveyIds, CancellationToken ct);
    Task<List<SurveyResponse>> GetResponsesBySurveyIdsAsync(IReadOnlyCollection<Guid> surveyIds, CancellationToken ct);
    Task<int> CountResponsesByParticipantsAsync(IReadOnlyCollection<Guid> participantIds, CancellationToken ct);

    // Bireysel anket cevaplarını görüntüleme (admin panel) için: bir ankete verilen tüm
    // cevapları en yeniden eskiye sayfalayarak döner.
    Task<(List<SurveyResponse> Items, int Total)> GetResponsesPagedAsync(Guid surveyId, int page, int limit, CancellationToken ct);
    Task<SurveyResponse?> GetResponseByIdAsync(Guid surveyId, Guid responseId, CancellationToken ct);

    // Gerçek analitik/raporlama hesaplaması için: sahte/sıfır veri yerine AnswersJson'daki
    // ham cevapları okuyup ortalama/dağılım hesaplayabilmek için gereken sorgular.
    Task<List<SurveyResponse>> GetAllResponsesAsync(Guid surveyId, CancellationToken ct);
    Task<List<(Guid SurveyId, DateTime SubmittedAt, string AnswersJson)>> GetResponseAnswersSinceAsync(DateTime since, CancellationToken ct);
    Task<Dictionary<Guid, int>> GetQuestionCountsAsync(CancellationToken ct);
    Task<Dictionary<Guid, SurveyQuestion>> GetQuestionMetaAsync(CancellationToken ct);

    // Admin panelde bir katılımcının detay ekranındaki "Anketler" sekmesi için: bu kişinin
    // isimli (anonim OLMAYAN) anketlere verdiği cevapları bulur. Anonim anketlerde
    // ParticipantId hiç kaydedilmez (bkz. ParticipantSurveyService.SubmitAsync) — bu bilinçli
    // bir tasarım kararıdır (anket anonim ise kimlik hiçbir admin ekranında ifşa edilmez,
    // bkz. SurveyService.LoadParticipantsAsync). Bu yüzden burada da sadece ParticipantId
    // eşleşmesi aranır; anonim anketler bu kişiye asla bağlanmaz.
    Task<List<SurveyResponse>> GetResponsesForParticipantAsync(Guid participantId, CancellationToken ct);

    // Kullanıcı isteği (2026-08-12): katılım sonrası zorunlu anket otomasyonu — bir kaynak tipi
    // (Event/Travel/Facility/Library) için zaten anket bağlanmış SourceId kümesini döner; yeni
    // otomatik anket üretimi bu kümeyle kesişmeyen kaynaklar için çalışır (tekrar üretim yok).
    Task<HashSet<Guid>> GetSourceIdsByTypeAsync(string sourceType, CancellationToken ct);

    // Kullanıcı isteği (2026-09-20): "insanları çok yormadan" — vatandaş başına günlük
    // opsiyonel anket yanıtı limiti/aralığı tek satırlık singleton ayar (MobileAppConfig
    // ile aynı desen).
    Task<SurveyGlobalSettings?> GetGlobalSettingsAsync(CancellationToken ct);
    Task AddGlobalSettingsAsync(SurveyGlobalSettings settings, CancellationToken ct);
    void UpdateGlobalSettings(SurveyGlobalSettings settings);
}
