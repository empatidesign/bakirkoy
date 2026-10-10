using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.CitizenSubmissions;

public class CitizenSubmission : BaseEntity
{
    public string? TrackingNo { get; private set; }
    public string CitizenName { get; private set; } = "";
    public string CitizenPhone { get; private set; } = "";
    public string CitizenTc { get; private set; } = "";
    /// <summary>
    /// Kullanıcı isteği (2026-09-05): "TC kimlik doğum tarihi sorgulaması olacak, kişi
    /// talep bıraktığında anonim ise burdan o bilgileri isteyecek, başlangıçta vermişse
    /// o bilgilere göre doldurulacak" — saha anketinin kimlik doğrulama adımında (NVI)
    /// zaten alınmış TC + doğum tarihi burada da tutulur; ayrı bir doğrulama YAPILMAZ
    /// (anket ekranı zaten NVI ile doğruladı), yalnızca referans/teyit amaçlı saklanır.
    /// Anonim katılımda veya bağımsız açılan talep formunda boş bırakılabilir.
    /// </summary>
    public DateTime? CitizenBirthDate { get; private set; }
    public string Neighborhood { get; private set; } = "";
    public string Address { get; private set; } = "";
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }
    public string CategoryId { get; private set; } = "";
    public string SubmissionType { get; private set; } = "request";
    public string Priority { get; private set; } = "normal";
    public bool NotifyMuhtar { get; private set; }
    public string? ComplaintReason { get; private set; }
    public string Title { get; private set; } = "";
    public string Description { get; private set; } = "";
    public int PhotoCount { get; private set; }
    public string Status { get; private set; } = "new";
    public DateTime SubmittedAt { get; private set; } = DateTime.UtcNow;
    public string SubmittedVia { get; private set; } = "mobile_app";
    public DateTime? ForwardedAt { get; private set; }
    public DateTime? ResolvedAt { get; private set; }
    public string? UlakbelUnit { get; private set; }
    public string? UlakbelTrackingNo { get; private set; }
    public List<string> MediaUrls { get; private set; } = [];

    // --- Kullanıcı isteği (2026-08-28) ---
    /// <summary>"residence" = ikametgah adresi, "other" = farklı bir adres/konum.</summary>
    public string AddressType { get; private set; } = "residence";
    /// <summary>"neighborhood" = mahalle geneli, "district" = Sultangazi geneli.</summary>
    public string Scope { get; private set; } = "neighborhood";
    /// <summary>İçerik analizinden çıkan, başvurunun iletileceği müdürlük.</summary>
    public string? RoutedUnit { get; private set; }
    /// <summary>Analizin kategori/müdürlük kararına olan güveni (0-1).</summary>
    public double? AnalysisConfidence { get; private set; }
    /// <summary>Analizde yakalanan anahtar kelimeler (denetlenebilirlik için).</summary>
    public List<string> AnalysisKeywords { get; private set; } = [];
    /// <summary>Metinde kişi ismi / kişiye yönelik şikayet tespit edildi mi (muhtardan gizlenir).</summary>
    public bool ContainsPersonReference { get; private set; }
    /// <summary>Vatandaşın kimliği muhtardan gizli tutulsun mu (varsayılan: evet).</summary>
    public bool IsAnonymousToMuhtar { get; private set; } = true;
    /// <summary>Belediyeden gelen son bilgilendirme metni (vatandaşa ve muhtara gösterilir).</summary>
    public string? ResolutionNote { get; private set; }
    public DateTime? FirstResponseAt { get; private set; }

    // --- Kullanıcı isteği (2026-09-07): Ulakbel'e iletilmiş taleplerin süre aşımını
    // izleyip vatandaşa push bildirim gönderen zamanlanmış iş için idempotency alanları.
    // Her aşama (uyarı / aşım) yalnızca BİR KEZ bildirilir — cron her 3 saatte bir
    // çalıştığı için bu alanlar olmadan aynı kayıt için tekrar tekrar bildirim gönderilirdi. ---
    /// <summary>SLA hedef süresinin %80'ine ulaşıldığında (süre dolmadan önce "yaklaşıyor"
    /// uyarısı) gönderilen bildirimin zamanı. Null ise henüz gönderilmemiş.</summary>
    public DateTime? SlaWarningNotifiedAt { get; private set; }
    /// <summary>SLA hedef süresi tamamen aşıldığında gönderilen bildirimin zamanı.
    /// Null ise henüz gönderilmemiş.</summary>
    public DateTime? SlaBreachNotifiedAt { get; private set; }

    // ULAK-02/03: dış iletim sonucu belirsizse (timeout / 5xx / sözleşme-dışı 2xx → uzak kayıt oluşmuş
    // OLABİLİR) bu durum KALICI işaretlenir; operatör Ulakbell'de doğrulayıp sıfırlayana kadar kör
    // yeniden gönderim engellenir. null = temiz, "unknown" = doğrulama bekliyor.
    public string? UlakbelForwardState { get; private set; }
    public DateTime? UlakbelLastAttemptAt { get; private set; }
    // ULAK-03 fencing: her gönderim denemesine özgü kimlik. Sonuç (delivered/unknown/temizleme) ve reset
    // yazımları YALNIZ bu kimlik hâlâ eşleşiyorsa uygulanır (atomik koşullu UPDATE). Redis kilidi kaybolup
    // araya reset/yeni deneme girse bile eski denemenin bayat yazımı yeni kararı EZEMEZ.
    public Guid? UlakbelForwardAttemptId { get; private set; }

    public static CitizenSubmission Create(
        string citizenName, string citizenPhone, string citizenTc,
        string neighborhood, string address,
        string categoryId, string submissionType, string priority,
        string title, string description)
        => new()
        {
            CitizenName = citizenName.Trim(),
            CitizenPhone = citizenPhone.Trim(),
            CitizenTc = citizenTc.Trim(),
            Neighborhood = neighborhood.Trim(),
            Address = address.Trim(),
            CategoryId = categoryId,
            SubmissionType = submissionType,
            Priority = priority,
            Title = title.Trim(),
            Description = description.Trim(),
            Status = "new",
            SubmittedAt = DateTime.UtcNow,
        };

    public void SetGeo(double? latitude, double? longitude)
    {
        Latitude = latitude;
        Longitude = longitude;
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-05): saha anketinin kimlik adımında (T.C. kimlikli
    /// katılımda) zaten NVI ile doğrulanmış doğum tarihi varsa, ya da anonim katılımdan
    /// sonra açılan talep formunda anketör isteğe bağlı olarak elle girdiyse burada saklanır.
    /// </summary>
    public void SetCitizenBirthDate(DateTime? birthDate)
    {
        CitizenBirthDate = birthDate.HasValue ? DateTime.SpecifyKind(birthDate.Value, DateTimeKind.Utc) : null;
    }

    public void SetMeta(bool notifyMuhtar, string? complaintReason, int photoCount, string submittedVia)
    {
        NotifyMuhtar = notifyMuhtar;
        ComplaintReason = complaintReason;
        PhotoCount = photoCount < 0 ? 0 : photoCount;
        SubmittedVia = submittedVia;
    }

    public void SetMediaUrls(List<string>? urls)
    {
        MediaUrls = urls ?? [];
        PhotoCount = MediaUrls.Count;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Kullanıcı isteği (2026-08-28): adresin ikametgah mı farklı bir yer mi olduğu + kapsam.</summary>
    public void SetLocationContext(string addressType, string scope)
    {
        AddressType = addressType is "other" ? "other" : "residence";
        Scope = scope is "district" ? "district" : "neighborhood";
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>İçerik analizinin sonucu: hedef müdürlük, güven skoru, anahtar kelimeler, kişi referansı.</summary>
    public void ApplyAnalysis(string routedUnit, double confidence, IEnumerable<string> keywords, bool containsPersonReference, string? categoryId = null)
    {
        RoutedUnit = routedUnit;
        AnalysisConfidence = Math.Round(confidence, 2);
        AnalysisKeywords = keywords.Take(12).ToList();
        ContainsPersonReference = containsPersonReference;
        if (!string.IsNullOrWhiteSpace(categoryId)) CategoryId = categoryId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetAnonymousToMuhtar(bool anonymous)
    {
        IsAnonymousToMuhtar = anonymous;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Hata raporu (docs/hata.md #4.4): vatandaş oluşturduğu başvuruyu düzenleyemiyordu —
    /// güncelleme yolu hiç yoktu. Yalnızca içerik alanları (başlık/açıklama/tür/öncelik) ve
    /// yalnızca başvuru henüz işleme alınmadan (bkz. IsEditableByCitizen) değiştirilebilir;
    /// takip no, durum, konum ve süreç geçmişi korunur.
    /// </summary>
    public void UpdateByCitizen(string title, string description, string submissionType, string priority)
    {
        Title = title.Trim();
        Description = description.Trim();
        SubmissionType = submissionType;
        Priority = priority;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Düzenlemeye yalnızca başvuru henüz belediye tarafından ele alınmadıysa izin verilir.
    /// İncelemeye alınmış/iletilmiş bir başvurunun metni değişirse, ilgili birimin gördüğü
    /// talep ile kaydın içeriği ayrışır.
    /// </summary>
    public bool IsEditableByCitizen() => Status == "new" && ForwardedAt is null;

    public void SetResolutionNote(string? note)
    {
        ResolutionNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkFirstResponse()
    {
        FirstResponseAt ??= DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>SLA "yaklaşıyor" uyarısı gönderildi olarak işaretler (idempotency).</summary>
    public void MarkSlaWarningNotified()
    {
        SlaWarningNotifiedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>SLA süresi aşıldı bildirimi gönderildi olarak işaretler (idempotency).</summary>
    public void MarkSlaBreachNotified()
    {
        SlaBreachNotifiedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetTrackingNo(string? trackingNo) => TrackingNo = trackingNo;

    public void SetStatus(string status)
    {
        Status = status;
        ResolvedAt = status == "resolved" ? DateTime.UtcNow : ResolvedAt;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordUlakbelForward(string ulakbelUnit, string ulakbelTrackingNo)
    {
        ForwardedAt = DateTime.UtcNow;
        UlakbelUnit = ulakbelUnit;
        UlakbelTrackingNo = ulakbelTrackingNo;
        UlakbelForwardState = null;
        UlakbelLastAttemptAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkForwardOutcomeUnknown()
    {
        UlakbelForwardState = "unknown";
        UlakbelLastAttemptAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool HasUnknownForwardOutcome => UlakbelForwardState == "unknown";

    public bool HasPendingForwardOutcome => UlakbelForwardState is "sending" or "unknown";

    public void ResetUlakbelForwardState()
    {
        UlakbelForwardState = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ToggleNotifyMuhtar()
    {
        NotifyMuhtar = !NotifyMuhtar;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SeedState(string status, DateTime submittedAt, DateTime? forwardedAt, DateTime? resolvedAt, string? ulakbelUnit, string? ulakbelTrackingNo)
    {
        Status = status;
        SubmittedAt = submittedAt;
        ForwardedAt = forwardedAt;
        ResolvedAt = resolvedAt;
        UlakbelUnit = ulakbelUnit;
        UlakbelTrackingNo = ulakbelTrackingNo;
    }
}
