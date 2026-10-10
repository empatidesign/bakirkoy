namespace Nexora.Application.Features.Surveys.Dtos;

// ---------------------------------------------------------------------------
// SultanŞehir Anket Platformu — saha görevleri, kota, soru bankası, şablonlar,
// mahalle/konu analitiği ve Başkanlık karar destek ekranı DTO'ları.
// Kaynak: docs/SultanSehir_Anket_Platformu_MD_Paketi (01, 02, 03, 04, 08).
// ---------------------------------------------------------------------------

// --- Saha görevleri (doküman 03 & 08) ---

/// <summary>
/// Kullanıcı isteği (2026-09-01): saha görevlisi olarak yalnızca yönetici hesapları değil,
/// site üyesi vatandaşlar (Participant) da atanabilsin. Birleşik arama sonucu — TC, telefon
/// veya isimle hem AdminUser hem Participant havuzunda arar.
/// </summary>
public record SurveyInterviewerCandidateDto(
    Guid Id,
    /// <summary>admin | participant</summary>
    string Type,
    string FullName,
    string? Phone,
    string? TcknMasked,
    string? Department,
    string? Neighborhood
);

public record SurveyFieldTaskDto(
    Guid Id,
    Guid SurveyId,
    string SurveyTitle,
    Guid InterviewerId,
    /// <summary>admin | participant</summary>
    string InterviewerType,
    string InterviewerName,
    string Neighborhood,
    DateTime StartDate,
    DateTime EndDate,
    int TargetCount,
    int DailyTarget,
    string Status,
    string? Note,
    DateTime? LastSyncAt,
    int CompletedCount,
    int TodayCount,
    double ProgressPercent,
    DateTime CreatedAt
);

public record SurveyFieldTaskListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? SurveyId { get; init; }
    public Guid? InterviewerId { get; init; }
    public string? Neighborhood { get; init; }
    public string? Status { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record SaveSurveyFieldTaskRequest(
    Guid SurveyId,
    Guid InterviewerId,
    string Neighborhood,
    DateTime StartDate,
    DateTime EndDate,
    int TargetCount,
    int DailyTarget,
    string? Note,
    string? Status,
    /// <summary>admin | participant — varsayılan admin (geri uyumluluk).</summary>
    string? InterviewerType = null
);

/// <summary>
/// Kullanıcı isteği (2026-09-01): tek işlemde birden fazla anketöre / birden fazla mahalleye
/// (ya da "Tüm Mahalleler" için tek bir kayıtla) toplu saha görevi ataması.
/// </summary>
public record BatchCreateSurveyFieldTaskRequest(
    Guid SurveyId,
    List<SurveyFieldTaskInterviewerRef> Interviewers,
    /// <summary>Boş ise "tüm mahalleler" anlamına gelir — tek bir görev kaydı, mahalle kısıtı olmadan oluşturulur.</summary>
    List<string> Neighborhoods,
    DateTime StartDate,
    DateTime EndDate,
    int TargetCount,
    int DailyTarget,
    string? Note
);

public record SurveyFieldTaskInterviewerRef(Guid Id, string Type);

/// <summary>
/// Kullanıcı isteği (2026-09-01): Saha Görevleri tablosunda satırları seçip tek
/// hamlede toplu aktif/pasif yapma, toplu mahalle atama, toplu anket atama ve
/// toplu silme. Silme her zaman soft-delete'tir; toplanan yanıtlar korunur.
/// </summary>
/// <param name="Action">activate | deactivate | assign-neighborhood | assign-survey | delete</param>
public record BulkSurveyFieldTaskRequest(
    List<Guid> Ids,
    string Action,
    /// <summary>assign-neighborhood için hedef mahalle; boş/null = "Tüm Mahalleler".</summary>
    string? Neighborhood = null,
    /// <summary>assign-survey için hedef anket.</summary>
    Guid? SurveyId = null
);

public record BulkSurveyFieldTaskResult(int Affected, int Skipped);

// --- Anketörlere toplu mesaj / duyuru (kullanıcı isteği 2026-09-01) ---

/// <summary>
/// Saha anketörlerine toplu bildirim, zorunlu onaylı duyuru ve/veya SMS gönderimi.
/// Alıcılar ya doğrudan (<see cref="InterviewerIds"/>) ya da bir ankete atanmış
/// tüm anketörler (<see cref="SurveyId"/>) üzerinden belirlenir.
/// </summary>
public record SurveyInterviewerMessageRequest(
    string Title,
    string Body,
    /// <summary>Doğrudan seçilen anketör (katılımcı) kimlikleri.</summary>
    List<Guid>? InterviewerIds = null,
    /// <summary>Verilirse bu ankete saha görevi atanmış tüm anketörler hedeflenir.</summary>
    Guid? SurveyId = null,
    /// <summary>Uygulama içi bildirim oluşturulsun mu (varsayılan evet).</summary>
    bool Notify = true,
    /// <summary>SMS gönderilsin mi.</summary>
    bool Sms = false,
    /// <summary>true ise anketör "Okudum" onayı vermeden popup kapanmaz.</summary>
    bool RequiresAck = false
);

public record SurveyInterviewerMessageResult(
    int Recipients,
    int NotificationsCreated,
    int SmsSent,
    int SmsFailed,
    bool SmsMockMode
);

// Kullanıcı isteği (2026-09-02): "gönderilen bildirimlerin ... adminde o bildirimi
// o kişinin okuduğu görülmeli." Anketörlere gönderilen duyuru/mesaj ve saha görevi
// bildirimlerinin tek tek okunma/onay durumu.

/// <summary>Tek bir anketöre giden bildirimin teslim ve okunma durumu.</summary>
public record SurveyNotificationReceiptDto(
    Guid NotificationId,
    Guid InterviewerId,
    string InterviewerName,
    string Title,
    string Body,
    string Type,
    DateTime SentAt,
    bool IsRead,
    DateTime? ReadAt,
    bool RequiresAck,
    DateTime? AcknowledgedAt
);

/// <summary>Bir duyurunun tüm alıcılardaki özeti (kaç kişi okudu / onayladı).</summary>
public record SurveyNotificationSummaryDto(
    string Title,
    string Type,
    DateTime SentAt,
    bool RequiresAck,
    int Recipients,
    int ReadCount,
    int AcknowledgedCount,
    List<SurveyNotificationReceiptDto> Receipts
);

// --- Anketör performansı (doküman 01 §7, 08 §7) ---

public record SurveyInterviewerStatsDto(
    Guid InterviewerId,
    string Name,
    string? Department,
    int TaskCount,
    int ActiveTaskCount,
    int TotalTarget,
    int CompletedCount,
    int TodayCount,
    double ProgressPercent,
    double AverageDurationSeconds,
    int FlaggedCount,
    List<string> Neighborhoods,
    DateTime? LastResponseAt
);

// --- Kota takibi (doküman 01 §6) ---

public record SurveyQuotaDto(
    Guid Id,
    Guid SurveyId,
    string Dimension,
    string Value,
    int TargetCount,
    int CurrentCount,
    double ProgressPercent
);

public record SaveSurveyQuotaRequest(string Dimension, string Value, int TargetCount);

public record SaveSurveyQuotasRequest(List<SaveSurveyQuotaRequest> Quotas);

// --- Soru bankası (doküman 02 §7) ---

public record SurveyQuestionBankItemDto(
    Guid Id,
    string Question,
    string? Description,
    string Type,
    List<string> Options,
    string Topic,
    string? Unit,
    SurveyQuestionConfigDto Config,
    int UsageCount,
    DateTime? LastUsedAt,
    bool IsActive,
    DateTime CreatedAt
);

public record SurveyQuestionBankListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Topic { get; init; }
    public string? Type { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record SaveSurveyQuestionBankItemRequest(
    string Question,
    string? Description,
    string Type,
    List<string> Options,
    string Topic,
    string? Unit,
    SurveyQuestionConfigRequest? Config,
    bool IsActive
);

// --- Anket şablonları (doküman 02 §6) ---

public record SurveyTemplateQuestionDto(
    string Type,
    string Question,
    string? Description,
    bool Required,
    List<string> Options,
    SurveyQuestionConfigDto? Config
);

public record SurveyTemplateDto(
    string Key,
    string Title,
    string Description,
    string Category,
    string Topic,
    string SurveyType,
    int EstimatedDuration,
    List<SurveyTemplateQuestionDto> Questions
);

// --- Mahalle / konu / demografi analitiği (doküman 04) ---

public record SurveyNeighborhoodStatsDto(
    string Neighborhood,
    int ResponseCount,
    double SatisfactionScore,
    int OpenSubmissionCount,
    int TotalSubmissionCount,
    int ResolvedSubmissionCount,
    double ResolutionRate,
    List<SurveyAnswerDistributionDto> TopIssues,
    List<SurveyAnswerDistributionDto> AgeGroups,
    List<SurveyAnswerDistributionDto> Genders,
    double TrendChangePercent
);

public record SurveyTopicStatsDto(
    string Topic,
    int ResponseCount,
    double SatisfactionScore,
    int SubmissionCount,
    int ResolvedCount,
    double ResolutionRate,
    double TrendChangePercent
);

public record SurveyFieldOperationsDto(
    int ActiveSurveys,
    int TodayResponses,
    int TotalResponses,
    int ActiveInterviewers,
    int OpenTasks,
    int FlaggedResponses,
    double QuotaFulfillmentPercent,
    double NeighborhoodCoveragePercent,
    List<SurveyAnswerDistributionDto> ResponsesByChannel,
    List<SurveyAnswerDistributionDto> ResponsesByNeighborhood,
    List<SurveyInterviewerStatsDto> TopInterviewers
);

// --- Başkanlık karar destek ekranı (doküman 04 §7) ---

public record SurveyCriticalAgendaItemDto(
    string Title,
    string Neighborhood,
    string Topic,
    double ChangePercent,
    string Severity
);

public record SurveyExecutiveTopicDto(string Topic, double Score, int Count, double ChangePercent);

/// <summary>Belirli bir günde toplanan yanıt sayısı — katılım trend grafiği için.</summary>
public record SurveyParticipationPointDto(string Date, int Responses);

// Kullanıcı isteği (2026-09-02, docs/ankettema/06.png "RAPORLAR" ekranı): Başkanlık Paneli
// tek ekranda toplam katılımcı, tüm anketlerin genel görünümü, memnuniyet dağılımı,
// zaman içinde katılım grafiği ve cinsiyet dağılımını göstermeli.
public record SurveyExecutiveDashboardDto(
    double SatisfactionIndex,
    double PulseScore,
    int TotalOpenIssues,
    string? CriticalNeighborhood,
    int PendingSubmissions,
    double AverageResolutionHours,
    double SubmissionClosureRate,
    List<SurveyCriticalAgendaItemDto> CriticalAgenda,
    List<SurveyNeighborhoodStatsDto> Neighborhoods,
    List<SurveyExecutiveTopicDto> TopComplaints,
    List<SurveyExecutiveTopicDto> TopSatisfactions,
    List<SurveySatisfactionTrendDto> SatisfactionTrend,
    List<SurveyAnswerDistributionDto> AgePriorities,
    // --- 06.png "RAPORLAR / GENEL BAKIŞ" alanları ---
    int TotalSurveys,
    int ActiveSurveys,
    int TotalResponses,
    int TotalParticipants,
    double AverageCompletionRate,
    double AverageDurationMinutes,
    /// <summary>5 kademeli memnuniyet dağılımı: Çok Memnun / Memnun / Kararsız / Memnun Değil / Hiç Memnun Değil.</summary>
    List<SurveyAnswerDistributionDto> SatisfactionDistribution,
    List<SurveyAnswerDistributionDto> GenderDistribution,
    List<SurveyParticipationPointDto> ParticipationOverTime
);

public record SurveyAnalyticsFilterParams
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public Guid? SurveyId { get; init; }
    public string? Neighborhood { get; init; }
    public string? Topic { get; init; }
    public string? AgeGroup { get; init; }
    public string? Gender { get; init; }
    public string? Channel { get; init; }
    public Guid? InterviewerId { get; init; }
}

// ---------------------------------------------------------------------------
// Kullanıcı isteği (2026-09-01): "canlı haritada saha görevlileri canlı takip edilecek,
// GPS açık olacak, ne kadar yürüdüğünü nereleri gezdiğini de takip edeceğiz" +
// "anket görevlilerinin kendi içinde performans takibi ... en çok anket yapan, aldıkları
// puan ortalamaları, en çok olumlu/olumsuz neler almış, neden biri olumlu diğeri olumsuz
// veya neden hep olumlu — anket sisteminin aritmetiği/fizibilitesi".
// ---------------------------------------------------------------------------

/// <summary>Sahadaki bir anketörün canlı durumu (harita pin'i).</summary>
public record SurveyFieldLiveAgentDto(
    Guid InterviewerId,
    string Name,
    string? Phone,
    Guid? ActiveTaskId,
    string? ActiveSurveyTitle,
    string Neighborhood,
    double? Latitude,
    double? Longitude,
    double? AccuracyMeters,
    DateTime? LastSeenAt,
    /// <summary>online (&lt;5 dk) | idle (&lt;30 dk) | offline</summary>
    string PresenceStatus,
    /// <summary>Bugün yürünen toplam yol (metre) — ardışık ping'lerin haversine toplamı.</summary>
    double TodayDistanceMeters,
    /// <summary>Bugün ziyaret edilen ayrık nokta (≈100 m ızgara) sayısı.</summary>
    int TodayVisitedPointCount,
    int TodayResponseCount,
    int TotalResponseCount,
    int TargetCount,
    double ProgressPercent);

public record SurveyFieldTrailPointDto(
    double Latitude,
    double Longitude,
    DateTime RecordedAt,
    double? AccuracyMeters,
    double DistanceFromPreviousMeters);

/// <summary>Anketörün bir gün içinde en az 10 dk kaldığı nokta (duraklama).</summary>
public record SurveyFieldStopDto(
    double Latitude,
    double Longitude,
    DateTime ArrivedAt,
    DateTime LeftAt,
    int MinutesSpent,
    int ResponseCount);

/// <summary>Anketörün gün izi: yürüyüş rotası, duraklamalar ve anket doldurduğu noktalar.</summary>
public record SurveyFieldTrailDto(
    Guid InterviewerId,
    string Name,
    DateTime Date,
    double TotalDistanceMeters,
    int ActiveMinutes,
    DateTime? FirstSeenAt,
    DateTime? LastSeenAt,
    List<SurveyFieldTrailPointDto> Points,
    List<SurveyFieldStopDto> Stops,
    List<SurveyFieldResponsePointDto> ResponsePoints);

public record SurveyFieldResponsePointDto(
    Guid ResponseId,
    double Latitude,
    double Longitude,
    DateTime SubmittedAt,
    string? Neighborhood,
    int? DurationSeconds,
    double? Score5,
    bool IsFlagged);

/// <summary>
/// Anketör performans aritmetiği. Tüm skorlar açık formüllüdür (bkz.
/// SurveyPerformanceMath) — "neden bu anketör hep olumlu?" sorusunun cevabı
/// <see cref="BiasIndex"/> (kendi olumlu oranı − saha ortalaması) ve
/// <see cref="Explanations"/> alanlarında verilir.
/// </summary>
public record SurveyInterviewerPerformanceDto(
    Guid InterviewerId,
    string Name,
    string? Department,
    int TaskCount,
    int TotalTarget,
    int CompletedCount,
    int TodayCount,
    double ProgressPercent,
    /// <summary>Yanıtların 5 üzerinden ortalama memnuniyet puanı.</summary>
    double AverageScore5,
    int ScoredResponseCount,
    double PositiveRate,
    double NeutralRate,
    double NegativeRate,
    /// <summary>Kendi olumlu oranı − saha genel olumlu oranı (yüzde puan). + = fazla olumlu.</summary>
    double BiasIndex,
    double AverageDurationSeconds,
    double MedianDurationSeconds,
    /// <summary>Saha medyanının %40'ından hızlı tamamlanan görüşme oranı (%).</summary>
    double FastResponseRate,
    /// <summary>Tüm skorlanabilir soruya aynı cevabı verme oranı (%) — "düz çizgi" doldurma.</summary>
    double StraightLiningRate,
    /// <summary>Konumu kaydedilmiş yanıt oranı (%).</summary>
    double GpsCoverageRate,
    /// <summary>Yanıtların ayrık konum (≈100 m) sayısı — aynı noktadan seri doldurma tespiti.</summary>
    int DistinctLocationCount,
    double DistanceWalkedMeters,
    int FlaggedCount,
    /// <summary>0-100 veri güvenilirliği: hız, düz çizgi, GPS ve konum çeşitliliği cezaları.</summary>
    double ReliabilityScore,
    /// <summary>0-100 genel performans: %45 hedef + %25 güvenilirlik + %15 kapsama + %15 tutarlılık.</summary>
    double PerformanceScore,
    List<string> Neighborhoods,
    /// <summary>En çok olumlu geri bildirim alınan konular/sorular.</summary>
    List<SurveyAnswerDistributionDto> TopPositiveTopics,
    /// <summary>En çok olumsuz geri bildirim alınan konular/sorular.</summary>
    List<SurveyAnswerDistributionDto> TopNegativeTopics,
    /// <summary>Skorun neden böyle çıktığını Türkçe açıklayan gerekçeler.</summary>
    List<string> Explanations,
    DateTime? LastResponseAt);

/// <summary>Saha geneli referans değerleri — tek tek anketörler bu ortalamalara göre yorumlanır.</summary>
public record SurveyPerformanceBenchmarkDto(
    int InterviewerCount,
    int TotalResponses,
    double AverageScore5,
    double PositiveRate,
    double NegativeRate,
    double MedianDurationSeconds,
    double AverageResponsesPerInterviewer,
    /// <summary>Olumlu oranının standart sapması — sapma eşiği (±1σ) bunun üzerinden kurulur.</summary>
    double PositiveRateStdDev);

public record SurveyInterviewerPerformanceResultDto(
    SurveyPerformanceBenchmarkDto Benchmark,
    List<SurveyInterviewerPerformanceDto> Interviewers);
