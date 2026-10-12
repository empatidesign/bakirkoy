using Microsoft.Extensions.Configuration;
using System.Text.RegularExpressions;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.ParticipantSubmissions;
using Nexora.Application.Features.ParticipantSubmissions.Dtos;
using Nexora.Domain.Entities.CitizenSubmissions;

namespace Nexora.Infrastructure.Services;

public class ParticipantSubmissionService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IFileStorageService storage,
    IMuhtarNotifier muhtarNotifier,
    Nexora.Application.Features.CitizenSubmissions.ISubmissionContentAnalyzer analyzer,
    IConfiguration config) : IParticipantSubmissionService
{
    private const long MaxMediaSizeBytes = 100L * 1024 * 1024;
    private static readonly HashSet<string> AllowedMediaContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/x-matroska",
    };

    public async Task<CitizenSubmissionFormOptionsDto> GetFormOptionsAsync(CancellationToken ct)
    {
        string? residenceNeighborhood = null;
        string? residenceAddress = null;
        string? residenceDistrict = null;

        // Kullanıcı isteği (2026-08-28): "bunun ikametgah adresi mi yoksa farklı bir adreste mi
        // olduğunu seçecek" — "ikametgah adresim" seçildiğinde form otomatik dolsun diye
        // vatandaşın kayıtlı mahalle/adres bilgisini de döndürüyoruz.
        if (currentUser.Id is Guid uid)
        {
            var participant = await uow.Participants.GetByIdAsync(uid, ct);
            if (participant is not null)
            {
                residenceNeighborhood = ResidenceNeighborhood(participant);
                residenceDistrict = participant.District;
                residenceAddress = participant.Address;
            }
        }

        return new CitizenSubmissionFormOptionsDto(
            MuhtarlikReference.CategoryOptions,
            MuhtarlikReference.SubmissionTypeOptions,
            MuhtarlikReference.PriorityOptions,
            MuhtarlikReference.NeighborhoodOptions,
            MuhtarlikReference.AddressTypeOptions,
            MuhtarlikReference.ScopeOptions,
            residenceNeighborhood,
            residenceAddress,
            residenceDistrict);
    }

    // İlçe dışındaki aynı adlı mahalleler yerel muhtar kapsamıyla eşleşmemelidir.
    private static string? ResidenceNeighborhood(Domain.Entities.Participants.Participant participant)
    {
        var district = participant.District?.Trim();
        var neighborhood = participant.Neighborhood?.Trim();
        if (!string.IsNullOrWhiteSpace(district) &&
            !string.Equals(district, "Bakırköy", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(district, "Bakirkoy", StringComparison.OrdinalIgnoreCase))
            return string.IsNullOrWhiteSpace(neighborhood) ? null : $"{district} / {neighborhood}";

        return NormalizeNeighborhood(neighborhood) ?? ExtractNeighborhoodFromAddress(participant.Address);
    }

    /// <summary>
    /// Participant.Neighborhood serbest metin olabilir ("Cebeci", "CEBECİ MAH." vb.); referans
    /// listesindeki resmi ada ("Cebeci Mahallesi") eşlemeye çalışırız, eşleşmezse null döneriz
    /// (form boş kalır, vatandaş kendisi seçer) — yanlış mahalleye başvuru düşmesin.
    /// </summary>
    private static string? NormalizeNeighborhood(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var exact = MuhtarlikReference.Neighborhoods.FirstOrDefault(n => string.Equals(n, raw.Trim(), StringComparison.OrdinalIgnoreCase));
        if (exact is not null) return exact;

        var core = raw.Trim()
            .Replace("MAHALLESİ", "", StringComparison.OrdinalIgnoreCase)
            .Replace("MAH.", "", StringComparison.OrdinalIgnoreCase)
            .Replace("MAH", "", StringComparison.OrdinalIgnoreCase)
            .Trim();
        if (core.Length == 0) return null;

        return MuhtarlikReference.Neighborhoods.FirstOrDefault(n =>
            n.StartsWith(core, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Participant.Neighborhood boş olduğunda son çare: serbest metin Address alanından
    /// ("Cumhuriyet Mah. Atatürk Cad. No:12 D:5 Sultangazi/İstanbul") mahalle adını çıkarmayı
    /// dener. Referans listesindeki her mahalle adının kök halini ("Cumhuriyet", "50. Yıl" vb.)
    /// adres metninde kelime sınırıyla arar; birden fazla veya hiç eşleşme yoksa null döner.
    /// </summary>
    private static string? ExtractNeighborhoodFromAddress(string? address)
    {
        if (string.IsNullOrWhiteSpace(address)) return null;

        foreach (var neighborhood in MuhtarlikReference.Neighborhoods)
        {
            var core = neighborhood
                .Replace(" Mahallesi", "", StringComparison.OrdinalIgnoreCase)
                .Trim();
            if (core.Length == 0) continue;

            var pattern = $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(core)}(?![\p{{L}}\p{{N}}])";
            if (Regex.IsMatch(address, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
                return neighborhood;
        }

        return null;
    }

    public async Task<SubmissionMediaUploadDto> UploadMediaAsync(Stream stream, string fileName, string contentType, long sizeBytes, CancellationToken ct)
    {
        if (currentUser.Id is null)
            throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        if (sizeBytes <= 0)
            throw new ConflictException("Dosya boş görünüyor.", "FILE_EMPTY");

        if (sizeBytes > MaxMediaSizeBytes)
            throw new ConflictException("Dosya boyutu en fazla 100 MB olabilir.", "FILE_TOO_LARGE");

        if (!AllowedMediaContentTypes.Contains(contentType))
            throw new ConflictException("Yalnızca fotoğraf (JPEG/PNG/WEBP) veya video (MP4/MOV/WEBM) yükleyebilirsiniz. iPhone ile çektiğiniz HEIC fotoğraflar desteklenmiyor; telefon ayarlarından \"En Uyumlu\" biçimi seçip tekrar deneyin.", "UNSUPPORTED_MEDIA_TYPE");

        var result = await storage.UploadAsync(stream, fileName, contentType, "nexora-public", ct, keyPrefix: "citizen-submissions");
        return new SubmissionMediaUploadDto(result.Url, result.ObjectName, result.SizeBytes);
    }

    public async Task<PagedResult<CitizenSubmissionMeDto>> GetMySubmissionsAsync(CitizenSubmissionMeListParams p, CancellationToken ct)
    {
        var participant = await GetCurrentParticipantAsync(ct);
        var tckn = participant.Tckn;

        var all = await uow.CitizenSubmissions.FindAsync(s => s.CitizenTc == tckn, ct);

        var query = all.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Status))
            query = query.Where(s => s.Status.Equals(p.Status, StringComparison.OrdinalIgnoreCase));

        query = (p.Sort?.ToLowerInvariant(), p.Order?.ToLowerInvariant()) switch
        {
            ("submittedat", "asc") => query.OrderBy(s => s.SubmittedAt),
            _ => query.OrderByDescending(s => s.SubmittedAt),
        };

        var total = query.Count();
        var pageItems = query.Skip((p.PageResolved - 1) * p.LimitResolved).Take(p.LimitResolved).ToList();

        // Liste ekranında da süreç özeti (kaç saat geçti / gecikti mi) gösterilebilsin diye
        // olayları tek sorguda topluca çekiyoruz (N+1 önleme).
        var events = await uow.CitizenSubmissionEvents.GetBySubmissionsAsync(pageItems.Select(x => x.Id).ToList(), ct);
        var grouped = events.GroupBy(e => e.SubmissionId).ToDictionary(g => g.Key, g => g.ToList());

        var items = pageItems
            .Select(s => ToDto(s, grouped.GetValueOrDefault(s.Id) ?? []))
            .ToList();

        return new PagedResult<CitizenSubmissionMeDto>
        {
            Items = items,
            Total = total,
            Page = p.PageResolved,
            Limit = p.LimitResolved,
        };
    }

    public async Task<CitizenSubmissionMeDto> GetMySubmissionByIdAsync(Guid id, CancellationToken ct)
    {
        var participant = await GetCurrentParticipantAsync(ct);
        var s = await uow.CitizenSubmissions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "SUBMISSION_NOT_FOUND");

        if (!string.Equals(s.CitizenTc, participant.Tckn, StringComparison.Ordinal))
            throw new ForbiddenException("Bu başvuruya erişim yetkiniz yok.", "FORBIDDEN_SUBMISSION");

        var events = await uow.CitizenSubmissionEvents.GetBySubmissionAsync(s.Id, ct);
        return ToDto(s, events);
    }

    /// <summary>
    /// Hata raporu (docs/hata.md #4.4): "daha önce oluşturulmuş bir talep üzerinde düzenleme
    /// gerçekleştirilemiyor" — kök neden yetki ya da form değil, ortada bir güncelleme ucunun
    /// HİÇ OLMAMASIYDI. Düzenleme yalnızca başvuru henüz işleme alınmadan mümkün; içerik
    /// değiştiğinde yönlendirme analizi yeniden çalışır (yanlış müdürlükte kalmasın) ve süreç
    /// geçmişine bir "güncellendi" adımı düşülür.
    /// </summary>
    public async Task<CitizenSubmissionMeDto> UpdateAsync(Guid id, UpdateCitizenSubmissionMeRequest req, CancellationToken ct)
    {
        var participant = await GetCurrentParticipantAsync(ct);

        var submission = await uow.CitizenSubmissions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "SUBMISSION_NOT_FOUND");

        if (!string.Equals(submission.CitizenTc, participant.Tckn, StringComparison.Ordinal))
            throw new ForbiddenException("Bu başvuruya erişim yetkiniz yok.", "FORBIDDEN_SUBMISSION");

        if (!submission.IsEditableByCitizen())
            throw new ConflictException(
                "Bu başvuru işleme alındığı için artık düzenlenemiyor. Eklemek istediğiniz bilgi için yeni bir başvuru oluşturabilirsiniz.",
                "SUBMISSION_NOT_EDITABLE");

        if (string.IsNullOrWhiteSpace(req.Title))
            throw new ValidationException("Başlık alanı zorunludur.", new Dictionary<string, string[]>
            {
                ["title"] = ["Başlık alanı zorunludur."]
            });

        if (string.IsNullOrWhiteSpace(req.Description))
            throw new ValidationException("Açıklama alanı zorunludur.", new Dictionary<string, string[]>
            {
                ["description"] = ["Açıklama alanı zorunludur."]
            });

        submission.UpdateByCitizen(req.Title, req.Description, req.SubmissionType, req.Priority);

        // İçerik değiştiyse yönlendirme de değişmiş olabilir; oluşturmadaki aynı kural.
        var analysis = analyzer.Analyze(req.Title, req.Description, submission.CategoryId, req.SubmissionType);
        submission.ApplyAnalysis(
            analysis.RoutedUnit, analysis.Confidence, analysis.Keywords, analysis.ContainsPersonReference,
            analysis.Confidence >= 0.75 ? analysis.CategoryId : null);

        // ULAK-03 (A): tam-satır Update() YOK — vatandaş düzenlemesi yalnız içerik alanlarını yazsın; eşzamanlı
        // bir gönderimin iletim alanları (trackingNo/state/attempt-id) bu yolda ezilmesin.
        await uow.SaveChangesAsync(ct);

        await AddEventAsync(submission, "info", submission.Status,
            "Başvuru güncellendi",
            "Başvurunuzun içeriği tarafınızdan güncellendi.",
            actorType: "citizen", ct: ct);

        var events = await uow.CitizenSubmissionEvents.GetBySubmissionAsync(submission.Id, ct);
        return ToDto(submission, events);
    }

    public async Task<CitizenSubmissionMeDto> GetMySubmissionByTrackingNoAsync(string trackingNo, CancellationToken ct)
    {
        var participant = await GetCurrentParticipantAsync(ct);
        var normalized = trackingNo.Trim();

        var s = await uow.CitizenSubmissions.FirstOrDefaultAsync(
            x => x.TrackingNo == normalized || x.UlakbelTrackingNo == normalized, ct)
            ?? throw new NotFoundException("Bu takip numarasına ait başvuru bulunamadı.", "SUBMISSION_NOT_FOUND");

        if (!string.Equals(s.CitizenTc, participant.Tckn, StringComparison.Ordinal))
            throw new ForbiddenException("Bu başvuruya erişim yetkiniz yok.", "FORBIDDEN_SUBMISSION");

        var events = await uow.CitizenSubmissionEvents.GetBySubmissionAsync(s.Id, ct);
        return ToDto(s, events);
    }

    private async Task<Domain.Entities.Participants.Participant> GetCurrentParticipantAsync(CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        return await uow.Participants.GetByIdAsync(actorId, ct)
            ?? throw new NotFoundException("Vatandaş kaydı bulunamadı.", "PARTICIPANT_NOT_FOUND");
    }

    public async Task<CitizenSubmissionMeDto> CreateAsync(CreateCitizenSubmissionMeRequest req, CancellationToken ct)
    {
        var participant = await GetCurrentParticipantAsync(ct);

        if (string.IsNullOrWhiteSpace(req.Title))
            throw new ValidationException("Başlık alanı zorunludur.", new Dictionary<string, string[]>
            {
                ["title"] = ["Başlık alanı zorunludur."]
            });

        if (string.IsNullOrWhiteSpace(req.Description))
            throw new ValidationException("Açıklama alanı zorunludur.", new Dictionary<string, string[]>
            {
                ["description"] = ["Açıklama alanı zorunludur."]
            });

        var neighborhood = req.Neighborhood;
        var address = req.Address;
        if (req.AddressType is null or "residence")
        {
            neighborhood = ResidenceNeighborhood(participant);
            address = participant.Address;
            if (string.IsNullOrWhiteSpace(neighborhood) || string.IsNullOrWhiteSpace(address))
                throw new ConflictException(
                    "Kayıtlı ikamet adresinizin ilçe ve mahalle bilgilerini tamamlayın veya farklı adres seçin.",
                    "RESIDENCE_ADDRESS_REQUIRED");
            if (neighborhood.Length > 150 || address.Length > 500)
                throw new ConflictException("Kayıtlı adres bilgilerinizi kontrol edin.", "RESIDENCE_ADDRESS_INVALID");
        }

        var windowMinutes = config.GetValue("MuhtarlikSettings:DuplicateWindowMinutes", 10);
        var duplicateCutoff = DateTime.UtcNow.AddMinutes(-windowMinutes);
        var normalizedTitle = req.Title.Trim();
        var normalizedDescription = req.Description.Trim();

        var recentSubmissions = await uow.CitizenSubmissions.FindAsync(
            s => s.CitizenTc == participant.Tckn && s.CreatedAt >= duplicateCutoff, ct);

        var isDuplicate = recentSubmissions.Any(s =>
            string.Equals(s.Title.Trim(), normalizedTitle, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(s.Description.Trim(), normalizedDescription, StringComparison.Ordinal));

        if (isDuplicate)
            throw new ConflictException("Aynı başvuruyu az önce gönderdiniz. Lütfen bekleyin.", "DUPLICATE_SUBMISSION");

        var submission = CitizenSubmission.Create(
            participant.FullName,
            participant.Phone ?? "",
            participant.Tckn,
            neighborhood,
            address,
            req.CategoryId,
            req.SubmissionType,
            req.Priority,
            req.Title,
            req.Description);

        submission.SetGeo(req.Latitude, req.Longitude);
        submission.SetMeta(req.NotifyMuhtar, req.ComplaintReason, 0, "mobile_app");
        submission.SetLocationContext(req.AddressType ?? "residence", req.Scope ?? "neighborhood");
        // Kullanıcı isteği (2026-08-28): "burdaki kimin gönderdiği isim vs görünmeyecek" —
        // vatandaş kimliği muhtara karşı HER ZAMAN gizlidir.
        submission.SetAnonymousToMuhtar(true);
        if (req.MediaUrls is { Count: > 0 })
            submission.SetMediaUrls(req.MediaUrls.Take(10).ToList());

        // Denetim düzeltmesi (2026-09-01, YÜKSEK-KVKK): "yenigelistirmeler" (762feb4) commit'i
        // otomatik-Ulakbel-iletimini kaldırırken (bilinçli, ayrı bir karar — ForwardAsync artık
        // panelden manuel tetikleniyor) analyzer.Analyze() çağrısını da YANLIŞLIKLA birlikte
        // silmişti. Sonuç: ApplyAnalysis() hiç çağrılmadığı için ContainsPersonReference HER
        // ZAMAN false kalıyordu — canlı DB'de kanıtlandı, 310 kayıttan 310'unda false (metinde
        // "komşum Ahmet Yıldırım" gibi açık kişi adı geçen kayıt dahil). Bu alan, muhtar
        // panelinde başlık/açıklamanın gösterilip gösterilmeyeceğini belirleyen TEK mekanizma
        // (bkz. MuhtarDashboardService.ToAnonymousItem — contentVisible = !ContainsPersonReference).
        // Analiz artık geri bağlandı; yalnızca RoutedUnit/AnalysisConfidence/Keywords/
        // ContainsPersonReference dolduruluyor, otomatik Ulakbel iletimi (kasıtlı olarak
        // kaldırılmış davranış) GERİ EKLENMEDİ.
        var analysis = analyzer.Analyze(req.Title, req.Description, req.CategoryId, req.SubmissionType);
        submission.ApplyAnalysis(
            analysis.RoutedUnit, analysis.Confidence, analysis.Keywords, analysis.ContainsPersonReference,
            // Vatandaşın seçtiği kategoriyi yalnızca analiz yüksek güvenle farklı bir konu
            // tespit ettiyse geçersiz kılarız (güven < 0.75 ise vatandaşın seçimi esastır).
            analysis.Confidence >= 0.75 ? analysis.CategoryId : null);

        var trackingNo = GenerateTrackingNo();
        submission.SetTrackingNo(trackingNo);

        await uow.CitizenSubmissions.AddAsync(submission, ct);
        // ULAK-04: TrackingNo unique index ihlalinde (aynı ms + aynı rastgele son ek) sınırlı yeniden
        // üretim + insert retry — kayıt kaybı önlenir. Bu create ayrı bir transaction içinde değil.
        await Nexora.Infrastructure.Persistence.TrackingNoRetry.SaveWithRetryAsync(
            uow, () => submission.SetTrackingNo(GenerateTrackingNo()), ct);
        trackingNo = submission.TrackingNo ?? trackingNo;

        await AddEventAsync(submission, "created", submission.Status,
            "Başvurunuz alındı",
            $"Takip No: {trackingNo}. {MuhtarlikReference.ScopeLabel(submission.Scope)} kapsamında, {MuhtarlikReference.AddressTypeLabel(submission.AddressType)} üzerinden kaydedildi.",
            actorType: "citizen", ct: ct);

        await AddEventAsync(submission, "analyzed", submission.Status,
            "İçerik analiz edildi",
            analysis.Summary,
            actorType: "system", ct: ct);

        await AddEventAsync(submission, "info", submission.Status,
            "Çağrı merkezi incelemesinde",
            "Başvurunuz çağrı merkezi tarafından incelenecek ve ilgili müdürlüğe yönlendirilecektir.",
            actorType: "system", ct: ct);

        // Kullanıcı isteği (2026-08-08 / 2026-08-28): muhtar mahallesinde olan biteni görmeli.
        // Bildirim gönderimi başvuru oluşturmayı ASLA engellemesin diye best-effort.
        try { await muhtarNotifier.NotifyNewSubmissionAsync(submission, ct); }
        catch { }

        var events = await uow.CitizenSubmissionEvents.GetBySubmissionAsync(submission.Id, ct);
        return ToDto(submission, events);
    }

    private async Task AddEventAsync(
        CitizenSubmission submission, string eventType, string status, string title, string? note,
        string actorType, CancellationToken ct)
    {
        var ev = CitizenSubmissionEvent.Create(
            submission.Id, eventType, status, title, note, actorType,
            // Muhtar tarafında kişi adı görünmeyeceği için ActorName'i vatandaş olaylarında hiç yazmıyoruz.
            actorName: null,
            actorId: null,
            visibleToCitizen: true,
            visibleToMuhtar: true);
        await uow.CitizenSubmissionEvents.AddAsync(ev, ct);
        await uow.SaveChangesAsync(ct);
    }

    private static CitizenSubmissionMeDto ToDto(CitizenSubmission s, IReadOnlyList<CitizenSubmissionEvent> events)
    {
        var timeline = SubmissionTimelineBuilder.Build(events, forCitizen: true);
        var endTime = s.ResolvedAt ?? DateTime.UtcNow;
        var elapsed = Math.Round((endTime - s.SubmittedAt).TotalHours, 1);

        return new CitizenSubmissionMeDto(
            s.Id,
            s.TrackingNo,
            s.Title,
            s.Description,
            s.CategoryId,
            MuhtarlikReference.CategoryLabel(s.CategoryId),
            s.SubmissionType,
            MuhtarlikReference.SubmissionTypeLabel(s.SubmissionType),
            s.Priority,
            MuhtarlikReference.PriorityLabel(s.Priority),
            s.Latitude,
            s.Longitude,
            s.Neighborhood,
            s.Address,
            s.AddressType,
            s.Scope,
            s.Status,
            MuhtarlikReference.StatusLabel(s.Status),
            s.SubmittedAt,
            s.ForwardedAt,
            s.ResolvedAt,
            s.MediaUrls,
            s.RoutedUnit ?? s.UlakbelUnit,
            s.UlakbelTrackingNo,
            s.ResolutionNote,
            elapsed,
            s.IsEditableByCitizen(),
            timeline);
    }

    // ULAK-04: takip numarası tek kaynaktan (SubmissionTrackingNo) üretilir; tüm kanallar aynı biçimi kullanır.
    private static string GenerateTrackingNo() => Nexora.Domain.Common.SubmissionTrackingNo.Generate();
}
