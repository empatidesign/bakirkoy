using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantSurveys.Dtos;

namespace Nexora.Application.Features.ParticipantSurveys;

public interface IParticipantSurveyService
{
    Task<PagedResult<CitizenSurveyDto>> GetListAsync(CitizenSurveyListParams p, CancellationToken ct);
    Task<CitizenSurveyDetailDto> GetDetailAsync(Guid surveyId, CancellationToken ct);
    Task<CitizenSurveySubmitResultDto> SubmitAsync(Guid surveyId, CitizenSurveySubmitRequest req, CancellationToken ct);
    Task<List<CitizenSurveyDto>> GetPendingAsync(CancellationToken ct);
    Task<PendingSurveySummaryDto> GetPendingSummaryAsync(CancellationToken ct);

    // Kullanıcı isteği (2026-09-01): saha görevlisi olarak atanmış vatandaşlar giriş
    // yaptığında "Vatandaş Portalı / Anket Sistemi" seçim ekranı gösterilsin diye —
    // bu vatandaşın en az bir aktif (assigned/in_progress) saha görevi var mı bilgisi.
    Task<bool> HasActiveFieldAssignmentAsync(CancellationToken ct);

    // Kullanıcı isteği (2026-09-01): saha görevlisi vatandaş, citizen-portal üzerinden
    // kendisine atanmış görevleri tablo hâlinde görür, görüştüğü kişinin TC'siyle anketi
    // doldurur. Aşağıdaki uçlar yalnızca InterviewerType = "participant" görevlerde çalışır.
    Task<List<FieldTaskDto>> GetMyFieldTasksAsync(CancellationToken ct);
    Task<FieldTaskDetailDto> GetMyFieldTaskDetailAsync(Guid taskId, CancellationToken ct);
    Task<FieldRespondentLookupDto> LookupFieldRespondentAsync(Guid taskId, string tckn, CancellationToken ct);
    Task<FieldSurveySubmitResultDto> SubmitFieldResponseAsync(Guid taskId, FieldSurveySubmitRequest req, CancellationToken ct);
    Task<List<FieldResponseSummaryDto>> GetMyFieldResponsesAsync(Guid taskId, int take, CancellationToken ct);

    // Kullanıcı isteği (2026-09-01): sahada TC yerel katılımcı kaydında yoksa NVI ile
    // doğrudan doğrulama; görüşülen kişi adına talep/öneri/şikayet oluşturma; anketi
    // kendisinin doldurması için SMS ile link gönderme.
    Task<FieldNviLookupResultDto> NviLookupFieldRespondentAsync(Guid taskId, FieldNviLookupRequest req, CancellationToken ct);
    Task<FieldCitizenSubmissionResultDto> CreateFieldCitizenSubmissionAsync(FieldCitizenSubmissionRequest req, CancellationToken ct);
    Task<FieldSurveySmsLinkResultDto> SendFieldSurveySmsLinkAsync(Guid taskId, FieldSurveySmsLinkRequest req, CancellationToken ct);

    // Kullanıcı isteği (2026-09-01): saha görevlisi uygulaması açıkken GPS konumu periyodik
    // olarak gönderilir; yönetici canlı haritada görevliyi takip eder, yürünen mesafe ve
    // gezilen noktalar raporlanır. Aktif saha görevi yoksa ping reddedilir (KVKK).
    Task<FieldLocationPingResultDto> RecordFieldLocationAsync(FieldLocationPingRequest req, CancellationToken ct);

    // Kullanıcı isteği (2026-08-12): pacing algoritması — vatandaşa bloklayıcı zorunlu anket
    // modalı gösterildiği an frontend bunu çağırır; bir sonraki zorunlu anket en az
    // SurveySettings:MinMandatoryPromptIntervalMinutes geçmeden tekrar sunulmaz.
    Task MarkMandatorySurveyPromptedAsync(CancellationToken ct);
}
