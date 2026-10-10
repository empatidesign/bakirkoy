namespace Nexora.Application.Features.ParticipantSurveys.Dtos;

/// <summary>
/// Kullanıcı isteği (2026-09-01): saha görevlisi olarak atanmış vatandaşlar (Participant
/// anketörler) citizen-portal (localhost:3100) üzerinden kendilerine atanmış saha görevlerini
/// tablo hâlinde görüp, görüştükleri vatandaşın TC kimlik numarasıyla anket doldurabilsin.
/// Bu DTO'lar yalnızca "InterviewerType = participant" olan görevler için kullanılır.
/// </summary>
public record FieldTaskDto(
    Guid Id,
    Guid SurveyId,
    string SurveyTitle,
    string SurveyCategory,
    int QuestionCount,
    int EstimatedDuration,
    string Neighborhood,
    DateTime StartDate,
    DateTime EndDate,
    int TargetCount,
    int DailyTarget,
    int CompletedCount,
    int TodayCount,
    double ProgressPercent,
    string Status,
    string? Note,
    bool RequireLocation,
    bool IsWindowOpen,
    /// <summary>
    /// Kullanıcı isteği (2026-09-02): "pasif anket başlamıyor sebep nedir".
    /// Görev kapalıysa NEDEN kapalı olduğu; anketör ekranında birebir gösterilir.
    /// Değerler: survey_inactive | task_cancelled | task_completed | out_of_window |
    /// target_reached | daily_quota_reached | null (açık).
    /// </summary>
    string? ClosedReason = null);

public record FieldTaskDetailDto(
    FieldTaskDto Task,
    string SurveyDescription,
    bool IsAnonymous,
    List<CitizenSurveyQuestionDto> Questions);

/// <summary>
/// Kullanıcı isteği (2026-09-01, saha kimlik akışı revizyonu): görüşülen kişi "İsimsiz /
/// Anonim" seçildiyse Tckn boş bırakılabilir — bu durumda IsAnonymousRespondent=true
/// gönderilir ve sunucu tarafında benzersiz bir anonim kimlik üretilir (tekrar-yanıt
/// kontrolü / DB zorunluluğu için). TC girildiyse yine de doğrulanır ve normal akış işler.
/// </summary>
public record FieldSurveySubmitRequest(
    List<CitizenSurveyAnswerDto> Answers,
    string? Tckn = null,
    bool IsAnonymousRespondent = false,
    string? Neighborhood = null,
    string? AgeGroup = null,
    string? Gender = null,
    int? DurationSeconds = null,
    double? Latitude = null,
    double? Longitude = null,
    string? LocalUuid = null);

public record FieldSurveySubmitResultDto(
    Guid ResponseId,
    DateTime SubmittedAt,
    int CompletedCount,
    int TodayCount);

/// <summary>Anketörün kendi görevinde topladığı son kayıtlar — TC maskeli döner.</summary>
public record FieldResponseSummaryDto(
    Guid Id,
    string TcknMasked,
    string? Neighborhood,
    string? AgeGroup,
    string? Gender,
    int? DurationSeconds,
    DateTime SubmittedAt);

/// <summary>Anketörün TC ile aradığı vatandaşın ön-doğrulama sonucu.</summary>
public record FieldRespondentLookupDto(
    string Tckn,
    bool IsRegistered,
    string? FullName,
    string? Neighborhood,
    string? AgeGroup,
    string? Gender,
    bool AlreadyResponded,
    // Kullanıcı isteği (2026-09-07): "kişinin tc si ile ilgili bilgi tüm bilgiler arka
    // planda geliyordur ... adres mahalle sokak ev daire vs girmeden de işlem yapabilir" —
    // kayıtlı katılımcının gerçek adresi de döner ki talep/şikayet formu adres girmeden
    // otomatik doldurulabilsin. Maskelenmez (yalnızca anketöre, aktif görev sırasında
    // gösterilir — ad-soyad zaten maskeli döndüğü için tek başına adres kimlik ifşası
    // oluşturmaz).
    string? Address,
    string? Phone);

/// <summary>
/// Kullanıcı isteği (2026-09-01): sahada TC yerel Participant tablosunda kayıtlı değilse,
/// anketör TC + doğum tarihi girerek gerçek NVI (MERNİS) sorgusuyla ad-soyad, doğum tarihi
/// ve cinsiyeti doğrulayabilsin. Sonuç maskeli döner (KVKK) — anketör tam ismi göremez,
/// yalnızca kişinin gerçekten var olduğunu ve verdiği bilgilerin tutarlılığını teyit eder.
/// </summary>
public record FieldNviLookupRequest(string Tckn, DateTime BirthDate);

public record FieldNviLookupResultDto(
    bool Verified,
    string? ErrorMessage,
    string? MaskedFullName,
    string? Gender,
    string? AgeGroup,
    string? Neighborhood);

/// <summary>
/// Kullanıcı isteği (2026-09-01): saha görevlisi, görüştüğü vatandaş adına doğrudan
/// (Muhtarlık modülündeki) talep/öneri/şikayet kaydı oluşturabilsin — anket doldurmadan
/// önce/sonra/bağımsız olarak. TC/ad-soyad/telefon verilmişse başvuruya işlenir; anonim
/// katılımcı için ad "Sahada Görüşülen Vatandaş (Anonim)" olarak kaydedilir. FieldTaskId
/// zorunludur — anketörün gerçekten kendisine atanmış bir görev üzerinden sahada olduğunu
/// doğrulamak (yetkisiz kullanım engeli) için LoadOwnedTaskAsync ile kapsam kontrolü yapılır.
/// Kullanıcı isteği (2026-09-05): CitizenBirthDate isteğe bağlıdır — anket kimlik adımında
/// zaten NVI ile doğrulanmışsa istemci otomatik gönderir, anonim katılımdan sonra
/// bağımsız açılan formda anketör isterse elle girer, hiçbiri yoksa boş bırakılır.
/// </summary>
public record FieldCitizenSubmissionRequest(
    Guid FieldTaskId,
    string Title,
    string Description,
    string CategoryId,
    string SubmissionType,
    string Neighborhood,
    string? CitizenName = null,
    string? CitizenPhone = null,
    string? CitizenTc = null,
    string? Address = null,
    double? Latitude = null,
    double? Longitude = null,
    DateTime? CitizenBirthDate = null,
    // Kullanıcı isteği (2026-09-07): "talep veya istek şikayetin kendi adresi ise ikamet
    // adresi değilse başka bir adrese esmek gerekirse sokak mahalle cadde vs ile adres
    // girilir" — "residence" = katılımcının kayıtlı ikamet adresi kullanılır (Address/
    // Neighborhood boş bırakılabilir), "other" = anketörün elle girdiği farklı bir adres.
    string? AddressType = "residence");

public record FieldCitizenSubmissionResultDto(Guid Id, string? TrackingNo, DateTime SubmittedAt);

/// <summary>
/// Kullanıcı isteği (2026-09-01): sahada vatandaş anketi kendisi doldurmak istemiyorsa,
/// anketör bilgilerini (en azından telefon) alıp SMS ile bir anket linki gönderebilsin —
/// vatandaş kendi telefonundan girip cevaplasın. TC/ad-soyad/doğum tarihi biliniyorsa
/// isteğe bağlı olarak eklenir (ileride ön-doldurma/eşleştirme için), ama zorunlu değildir.
/// </summary>
public record FieldSurveySmsLinkRequest(
    string Phone,
    string? Tckn = null,
    string? FullName = null,
    DateTime? BirthDate = null);

public record FieldSurveySmsLinkResultDto(bool Sent, string? ErrorMessage);

/// <summary>
/// Kullanıcı isteği (2026-09-01): "canlı haritada saha görevlileri canlı takip edilecek,
/// GPS açık olacak, ne kadar yürüdüğünü nereleri gezdiğini de takip edeceğiz."
/// Saha uygulaması açıkken periyodik (varsayılan 30 sn) gönderilen konum ping'i.
/// Sunucu, bir önceki ping'e göre mesafeyi kendisi hesaplar (cihaza güvenilmez).
/// </summary>
public record FieldLocationPingRequest(
    double Latitude,
    double Longitude,
    double? AccuracyMeters = null,
    double? SpeedMps = null,
    DateTime? RecordedAt = null,
    Guid? FieldTaskId = null);

public record FieldLocationPingResultDto(
    bool Accepted,
    /// <summary>Bugün toplam yürünen mesafe (metre) — anketör kendi ekranında görebilir.</summary>
    double TodayDistanceMeters,
    /// <summary>Bir sonraki ping için önerilen bekleme (saniye).</summary>
    int NextPingSeconds);
