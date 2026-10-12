using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.ApiResponse;
using Nexora.Domain.Common;
using Nexora.Application.Common;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.CitizenSubmissions.Dtos;
using Nexora.Application.Features.Integrations;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Application.Features.Nvi;
using Nexora.Domain.Entities.CitizenSubmissions;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class CitizenSubmissionService(
    IUnitOfWork uow,
    IAuditService audit,
    ICurrentUser currentUser,
    IUserScopeService scopeService,
    IScopedStaffService scopedStaff,
    IUlakbelForwardService ulakbelForward,
    IIntegrationSettingsService integrationSettings,
    INotificationService notificationService,
    INotificationDispatcher dispatcher,
    IModuleNotificationSettingsService moduleSettings,
    ISubmissionContentAnalyzer contentAnalyzer,
    INviService nvi,
    IFileStorageService fileStorage,
    ISmsService sms,
    ISmsGovernanceService smsGovernance,
    IRedisService redis,
    Microsoft.Extensions.Configuration.IConfiguration config,
    ILogger<CitizenSubmissionService> logger) : ICitizenSubmissionService
{
    private int ForwardLockTtlSeconds => Math.Max(10, config.GetValue("CitizenSubmissionSettings:ForwardLockTtlSeconds", 90));
    private const long MaxMuhtarMediaSizeBytes = 100L * 1024 * 1024;
    private static readonly HashSet<string> AllowedMuhtarMediaContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/x-matroska",
    };

    /// <summary>
    /// Kullanıcı isteği (2026-08-28): "tüm süreci yöneten bir yapı kur ... tüm süreler
    /// anlatılacak". Her durum değişikliği süreç zaman çizelgesine yazılır; muhtar ve vatandaş
    /// aynı süreci (kimlik bilgisi olmadan) izleyebilsin.
    /// </summary>
    private async Task AddEventAsync(
        Domain.Entities.CitizenSubmissions.CitizenSubmission s,
        string eventType, string title, string? note,
        bool visibleToCitizen, CancellationToken ct)
    {
        var admin = currentUser.Id is Guid uid ? await uow.AdminUsers.GetByIdAsync(uid, ct) : null;
        var ev = Domain.Entities.CitizenSubmissions.CitizenSubmissionEvent.Create(
            s.Id, eventType, s.Status, title, note,
            actorType: "municipality",
            actorName: admin?.FullName,
            actorId: admin?.Id,
            visibleToCitizen: visibleToCitizen,
            visibleToMuhtar: true);
        await uow.CitizenSubmissionEvents.AddAsync(ev, ct);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<ModuleManualMessageResultDto> SendManualMessageAsync(ModuleManualMessageRequest req, CancellationToken ct)
    {
        // BULGU (2026-09-21 uçtan uca test, K7): req.Ids null gönderildiğinde (istemci
        // hatası/eksik alan) bu satır NullReferenceException fırlatıyordu ve middleware
        // bunu 400 yerine çıplak 500'e çeviriyordu. Model binding, DTO'nun List<Guid> Ids
        // (non-nullable) olmasına rağmen JSON body'de "ids":null geldiğinde null atamaya
        // devam ediyor — .NET record'lar bunu derleme zamanında engellemez.
        if (req.Ids is null || req.Ids.Count == 0) throw new ConflictException("En az bir kayıt seçmelisiniz.", "NO_TARGET");
        if (!req.Sms && !req.Notify) throw new ConflictException("En az bir kanal seçin.", "NO_CHANNEL");
        var scope = await GetNeighborhoodScopeAsync(ct);
        var submissions = await uow.CitizenSubmissions.FindAsync(s => req.Ids.Contains(s.Id), ct);
        if (scope is not null) submissions = submissions.Where(s => scope.Contains(s.Neighborhood)).ToList();
        if (submissions.Count == 0) return new ModuleManualMessageResultDto(0, 0, 0, false);
        var settings = await moduleSettings.GetAsync("muhtarlik", ct);
        var template = settings.NotificationTemplates?.FirstOrDefault(t => t.Event == req.TemplateEvent)
            ?? throw new ConflictException("Şablon bulunamadı.", "TEMPLATE_NOT_FOUND");

        // Şablon/validasyon geçtikten SONRA çağrılır: aksi halde başarısız bir
        // istek (ör. şablon bulunamadı) bile kullanıcının günlük SMS hakkını
        // gereksiz yere tüketirdi (2026-09-19 canlı testte tespit edildi).
        if (req.Sms) await smsGovernance.EnsureCanSendAsync("CitizenSubmission", req.TemplateEvent, req.Ids.Count, req.SmsOtp, ct);
        var smsTemplate = string.IsNullOrWhiteSpace(req.CustomText) ? template.SmsBody : req.CustomText!;
        var notifyTemplate = string.IsNullOrWhiteSpace(req.CustomText) ? template.NotifyBody : req.CustomText!;
        var tckns = submissions.Select(s => s.CitizenTc).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
        var participants = (await uow.Participants.FindAsync(p => tckns.Contains(p.Tckn), ct)).ToDictionary(p => p.Tckn, p => p);
        var recipients = 0; var smsSent = 0; var notifs = 0;
        foreach (var s in submissions)
        {
            recipients++;
            var vars = new Dictionary<string, string?> { ["talep_no"] = s.TrackingNo ?? s.Id.ToString()[..8], ["kategori"] = Nexora.Application.Features.CitizenSubmissions.MuhtarlikReference.CategoryLabel(s.CategoryId) };
            var fullName = s.CitizenName;
            if (req.Notify && template.NotifyEnabled && participants.TryGetValue(s.CitizenTc, out var participant))
            { await notificationService.CreateAsync(participant.Id, "Muhtarlık Talebi", ModuleMessageRenderer.Render(notifyTemplate, participant.FullName, vars), "muhtarlik-manual", ct); notifs++; }
            if (req.Sms && template.SmsEnabled && !string.IsNullOrWhiteSpace(s.CitizenPhone))
            { try { if (await dispatcher.SendSmsAsync(s.CitizenPhone, ModuleMessageRenderer.Render(smsTemplate, fullName, vars), ct)) smsSent++; } catch { } }
        }
        return new ModuleManualMessageResultDto(recipients, smsSent, notifs, req.Sms && smsSent > 0 && sms.IsMockMode);
    }
    private async Task<IReadOnlyList<string>?> GetNeighborhoodScopeAsync(CancellationToken ct)
    {
        if (currentUser.Id is not Guid userId) return null;
        var names = await scopeService.GetScopedNamesAsync(userId, "muhtarlik", ct);
        return names?.ToList();
    }

    /// <summary>
    /// Denetim düzeltmesi (2026-09-01, KRİTİK): canlı testte kanıtlandı — tek bir mahalleye
    /// (örn. "Cumhuriyet Mahallesi") scope'lu bir muhtar hesabı, `PUT /api/v1/muhtarlik/
    /// notification-settings` ucuna `muhtarlik.edit` izniyle erişip, TÜM 16 mahalledeki
    /// vatandaşlara giden SMS/bildirim şablon metinlerini (ör. "resolved" şablonu) tek bir
    /// global kayıt üzerinden değiştirebiliyordu — kendi mahallesiyle sınırlı değildi. Bu,
    /// `AnalyticsService.cs` (80ad46f) ve `LibrarySettingsService.EnsureWriteInScopeAsync`
    /// (GLOBAL_SETTINGS_FORBIDDEN) ile aynı denetim ailesinin bir parçası: scope'lu personel
    /// yalnızca KENDİ kaydını görmeli/değiştirmeli demek, paylaşılan/global yapılandırmaya
    /// erişememesi gerektiği anlamına gelir. Kütüphanenin aksine muhtarlık bildirim ayarları
    /// mahalle bazında ayrıştırılmış bir modele sahip değil (ModuleNotificationSettingsService
    /// modül başına TEK kayıt tutuyor) — bu yüzden "kendi kaydına yaz" diye bir ayrım mümkün
    /// değil; scope'lu HERHANGİ bir muhtar bu ayarı hiç değiştiremez, yalnızca kapsam kısıtı
    /// olmayan (scope=null, örn. SuperAdmin/belediye yöneticisi) hesaplar değiştirebilir.
    /// </summary>
    public async Task EnsureCanManageGlobalNotificationSettingsAsync(CancellationToken ct)
    {
        var scope = await GetNeighborhoodScopeAsync(ct);
        if (scope is not null)
            throw new ForbiddenException(
                "Muhtarlık bildirim şablonları tüm mahalleleri etkileyen genel bir ayardır; yalnızca kapsam kısıtı olmayan yöneticiler değiştirebilir.",
                "GLOBAL_SETTINGS_FORBIDDEN");
    }

    private static bool ShouldHideIdentity(IReadOnlyList<string>? scope) => scope is not null;

    public async Task<PagedResult<CitizenSubmissionDto>> GetPagedAsync(CitizenSubmissionListParams p, CancellationToken ct)
    {
        var scope = await GetNeighborhoodScopeAsync(ct);
        var paged = await uow.CitizenSubmissions.GetPagedAsync(p, scope, ct);
        var hideIdentity = ShouldHideIdentity(scope);

        var neighborhoods = paged.Items.Select(s => s.Neighborhood).Distinct().ToList();
        var muhtarCache = new Dictionary<string, Domain.Entities.Auth.AdminUser?>();
        foreach (var n in neighborhoods)
            muhtarCache[n] = await FindMuhtarAdminAsync(n, ct);

        return new PagedResult<CitizenSubmissionDto>
        {
            Items = paged.Items.Select(s => MapDto(s, hideIdentity, muhtarCache.GetValueOrDefault(s.Neighborhood))).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<SubmissionSummaryDto> GetSummaryAsync(CitizenSubmissionListParams p, CancellationToken ct)
    {
        var scope = await GetNeighborhoodScopeAsync(ct);
        return await uow.CitizenSubmissions.GetSummaryAsync(p, scope, ct);
    }

    public async Task<IReadOnlyList<SubmissionMapPointDto>> GetMapPointsAsync(CitizenSubmissionListParams p, CancellationToken ct)
    {
        var scope = await GetNeighborhoodScopeAsync(ct);
        var list = await uow.CitizenSubmissions.GetMapPointsAsync(p, scope, ct);
        return list
            .Where(x => x.Latitude.HasValue && x.Longitude.HasValue)
            .Select(x => new SubmissionMapPointDto(
                x.Id, x.Title, x.Neighborhood, x.Latitude!.Value, x.Longitude!.Value,
                x.SubmissionType, x.Priority, x.Status, x.NotifyMuhtar))
            .ToList();
    }

    public async Task<SubmissionReportsSummaryDto> GetReportsSummaryAsync(CancellationToken ct)
    {
        var scopedNames = await GetNeighborhoodScopeAsync(ct);
        var all = await uow.CitizenSubmissions.GetForReportsAsync(ct);
        if (scopedNames is not null)
            all = all.Where(x => scopedNames.Contains(x.Neighborhood)).ToList();
        return BuildReports(all);
    }

    public Task<IReadOnlyList<CitizenSubmissionOptionDto>> GetNeighborhoodOptionsAsync(CancellationToken ct)
        => Task.FromResult(MuhtarlikReference.NeighborhoodOptions);

    public async Task<ProvisionMuhtarResultDto> ProvisionMuhtarAsync(string neighborhood, ProvisionMuhtarRequest req, CancellationToken ct)
    {
        if (!MuhtarlikReference.Neighborhoods.Contains(neighborhood))
            throw new ConflictException("Geçersiz mahalle.", "INVALID_NEIGHBORHOOD");

        if (string.IsNullOrWhiteSpace(req.FullName))
            throw new ConflictException("Muhtarın ad soyad bilgisi zorunludur.", "MUHTAR_NAME_REQUIRED");

        var refId = MuhtarlikReference.NeighborhoodRefId(neighborhood);
        var slug = MuhtarlikReference.SlugifyForUsername(neighborhood);
        var email = string.IsNullOrWhiteSpace(req.Email)
            ? $"muhtar.{slug}@bakirkoy.bel.tr"
            : req.Email.Trim().ToLowerInvariant();

        var wasAlreadyAssigned = (await uow.ScopeNodes.GetByRefAsync("muhtarlik", refId, ct)) is not null;

        var result = await scopedStaff.AssignAsync(new AssignScopedStaffRequest(
            FullName: req.FullName.Trim(),
            Tckn: null,
            Phone: req.Phone,
            Email: email,
            RoleTemplateKey: "muhtar",
            ScopeModuleKey: "muhtarlik",
            ScopeRefId: refId,
            ScopeName: neighborhood,
            ScopeType: "Neighborhood",
            DeliveryChannel: string.IsNullOrWhiteSpace(req.Phone) ? "Email" : "Sms"), ct);

        return new ProvisionMuhtarResultDto(
            result.AdminUserId, result.FullName, result.Email, req.Phone, neighborhood,
            AccountCreated: !wasAlreadyAssigned, result.TemporaryPassword);
    }

    public async Task<IReadOnlyList<MuhtarAssignmentDto>> GetMuhtarAssignmentsAsync(CancellationToken ct)
    {
        // Mahalle scope'una göre filtreleme: önceden bu metod hiçbir scope kontrolü yapmadan
        // TÜM mahallelerin atanmış muhtarlarının ad-soyad/e-posta/telefon/adminUserId bilgisini
        // döndürüyordu — tek bir mahalleye scope'lu bir muhtar bile diğer tüm mahallelerin
        // muhtar iletişim bilgilerini görebiliyordu (bkz. muhtar-assignments-scope-sizintisi-
        // 2026-07-30 bulgusu, P1). Scope'lu bir kullanıcı için sadece kendi scope'undaki
        // mahallelerin gerçek bilgisi döner; diğer mahalleler "atanmış mı" (accountProvisioned)
        // bilgisiyle birlikte ama kişisel veri olmadan listelenir.
        var scope = await GetNeighborhoodScopeAsync(ct);
        var results = new List<MuhtarAssignmentDto>();
        foreach (var neighborhood in MuhtarlikReference.Neighborhoods)
        {
            var inScope = scope is null || scope.Contains(neighborhood);
            var admin = await FindMuhtarAdminAsync(neighborhood, ct);
            if (admin is null)
            {
                results.Add(new MuhtarAssignmentDto(neighborhood, false, null, null, null, null));
            }
            else if (inScope)
            {
                results.Add(new MuhtarAssignmentDto(neighborhood, true, admin.Id, admin.FullName, admin.Email, admin.Phone, admin.IsActive));
            }
            else
            {
                results.Add(new MuhtarAssignmentDto(neighborhood, true, null, null, null, null));
            }
        }
        return results;
    }

    private async Task<Domain.Entities.Auth.AdminUser?> FindMuhtarAdminAsync(string neighborhood, CancellationToken ct)
    {
        var refId = MuhtarlikReference.NeighborhoodRefId(neighborhood);
        var node = await uow.ScopeNodes.GetByRefAsync("muhtarlik", refId, ct);
        if (node is null) return null;

        var scopes = await uow.AdminScopes.GetByScopeNodeAsync(node.Id, ct);
        if (scopes.Count == 0) return null;

        // Denetim düzeltmesi (2026-09-07, canlı DB'de kanıtlandı — bkz. muhtar-assignments
        // hayalet-boş-mahalle bulgusu): "silinen yönetici → AdminScope kalıntısı temizlenmiyor"
        // hatası (2026-09-05'te AdminUserManagementService.DeleteAsync'e eklenen HardRemoveRange
        // ile İLERİYE dönük kapatıldı) geçmiş verideki kalıntı AdminScope satırlarını düzeltmedi.
        // scopes[0] her zaman EN ESKİ (silinmiş) kaydı döndürebiliyordu — bu da GERÇEKTEN atanmış,
        // aktif bir muhtarı (ör. Cumhuriyet/50. Yıl Mahallesi'nde bulundu) admin listesinde
        // "Hesap Atanmamış" gibi göstererek yeni bir hesap oluşturulmaya (ve orijinal muhtarın
        // gizlenmeye devam etmesine) yol açabiliyordu. Artık İLK scope kaydı değil, GERÇEKTEN
        // var olan (soft-delete filtresini geçen) ilk AdminUser'a ait olan taranır.
        foreach (var s in scopes)
        {
            var admin = await uow.AdminUsers.GetByIdAsync(s.AdminUserId, ct);
            if (admin is not null) return admin;
        }
        return null;
    }

    public async Task<CitizenSubmissionDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await uow.CitizenSubmissions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "CITIZEN_SUBMISSION_NOT_FOUND");
        var scope = await AssertNeighborhoodAccessAsync(s.Neighborhood, ct);
        return await MapDtoAsync(s, ShouldHideIdentity(scope), ct);
    }

    public async Task<CitizenSubmissionDto> UpdateStatusAsync(Guid id, string status, CancellationToken ct)
        => await UpdateStatusAsync(id, status, null, ct);

    public async Task<CitizenSubmissionDto> UpdateStatusAsync(Guid id, string status, string? note, CancellationToken ct)
    {
        if (!MuhtarlikReference.StatusActionAllowed.Contains(status))
            throw new ConflictException("Geçersiz başvuru durumu.", "INVALID_SUBMISSION_STATUS");

        var s = await uow.CitizenSubmissions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "CITIZEN_SUBMISSION_NOT_FOUND");
        var scope = await AssertNeighborhoodAccessAsync(s.Neighborhood, ct);

        s.SetStatus(status);
        s.MarkFirstResponse();
        // Kullanıcı isteği (2026-08-28): "çözüldüğünde veya bilgi geldiğinde kişiye bildirim
        // gelmeli olayın ne olduğu" — kapanış/inceleme notu hem vatandaşa hem muhtara gider.
        if (!string.IsNullOrWhiteSpace(note))
            s.SetResolutionNote(note);
        // ULAK-03 (A): tam-satır Update() YOK — yalnız değişen alanlar (durum/not/zaman) yazılır. Aksi halde
        // eşzamanlı bir gönderimin yazdığı iletim alanları (trackingNo/state/attempt-id) bu yolda ezilebilirdi.
        await uow.SaveChangesAsync(ct);

        await AddEventAsync(s, status, MuhtarlikReference.StatusLabel(status),
            string.IsNullOrWhiteSpace(note) ? null : note.Trim(), visibleToCitizen: true, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "CitizenSubmission",
            EntityId = s.Id,
            Module = "Muhtarlik",
            Description = $"Başvuru durumu değiştirildi: {s.Title} → {MuhtarlikReference.StatusLabel(status)}",
        }, ct);

        await NotifyCitizenOfStatusChangeAsync(s, ct);

        return await MapDtoAsync(s, ShouldHideIdentity(scope), ct);
    }

    private static string ForwardLockKey(Guid id) => $"ulakbel:forward:{id}";

    // ULAK-03: kilidi işlem boyunca canlı tut (lease renewal). Sabit TTL, ekleri indirip yükleyen + HTTP
    // (30 sn timeout) + DB + audit içeren gönderimi tek başına sınırlayamaz; süresi dolarsa kilit başka
    // sahibe (reset/ikinci forward) geçebilirdi. TTL/3 aralıkla token-sahipli PEXPIRE ile uzatılır; süreç
    // ölürse yenileme durur → TTL lapse → mutabakat açılır. Kilit kaybı ayrıca DB attempt-id fence ile de
    // yakalanır (bayat yazım yeni kararı ezemez).
    private async Task RenewLockLoopAsync(string key, string token, int ttlSeconds, CancellationToken ct)
    {
        var interval = TimeSpan.FromSeconds(Math.Max(3, ttlSeconds / 3));
        try
        {
            while (!ct.IsCancellationRequested)
            {
                await Task.Delay(interval, ct);
                if (!await redis.RenewLockAsync(key, token, TimeSpan.FromSeconds(ttlSeconds), CancellationToken.None))
                {
                    logger.LogWarning("Ulakbell gönderim kilidi sahipliği kaybedildi (yenileme başarısız). Key={Key}", key);
                    return;
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            // ULAK-03 (E): yenileme hatası (Redis timeout/bağlantı) task'ı FAULTED bırakmamalı — ana sonucu
            // örtmez, release'i atlatmaz. Sahiplik kaybının sonucu attempt-id fence ile yakalanır.
            logger.LogWarning(ex, "Ulakbell gönderim kilidi yenilenirken hata; yenileme durduruldu. Key={Key}", key);
        }
    }

    public async Task<CitizenSubmissionDto> ForwardAsync(Guid id, CancellationToken ct)
    {
        // ULAK-03 (C): eşzamanlı iki "İlet" çağrısının ikisinin de POST yapmasını önleyen atomik
        // sahiplenme. Aynı başvuru için tek seferde tek gönderim; kilit alınamıyorsa istek reddedilir.
        var lockKey = ForwardLockKey(id);
        var ttl = ForwardLockTtlSeconds;
        var token = await redis.TryAcquireLockAsync(lockKey, TimeSpan.FromSeconds(ttl), ct);
        if (token is null)
            throw new ConflictException(
                "Bu başvuru şu anda iletiliyor. Lütfen birkaç saniye sonra tekrar deneyin.",
                "ULAKBEL_FORWARD_IN_PROGRESS");
        using var renewalCts = new CancellationTokenSource();
        var renewal = RenewLockLoopAsync(lockKey, token, ttl, renewalCts.Token);
        try
        {
            return await ForwardInternalAsync(id, ct);
        }
        finally
        {
            // ULAK-03 (E): temizlik ADIMLARI ana sonucu örtmemeli ve birbirini atlamamalı. Renewal beklemesi
            // ve kilit bırakma AYRI güvenli bloklarda; hataları yutulur (release best-effort).
            renewalCts.Cancel();
            try { await renewal; } catch { }
            try { await redis.ReleaseLockAsync(lockKey, token, CancellationToken.None); }
            catch (Exception ex) { logger.LogWarning(ex, "Ulakbell gönderim kilidi bırakılamadı. Key={Key}", lockKey); }
        }
    }

    private async Task<CitizenSubmissionDto> ForwardInternalAsync(Guid id, CancellationToken ct)
    {
        var s = await uow.CitizenSubmissions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "CITIZEN_SUBMISSION_NOT_FOUND");
        var scope = await AssertNeighborhoodAccessAsync(s.Neighborhood, ct);

        if (s.UlakbelTrackingNo is { Length: > 0 })
            throw new ConflictException("Bu kaydın içeriği zaten gönderilmiş.", "ALREADY_FORWARDED");

        // ULAK-02/03: önceki iletim ya belirsiz sonuçlandı ya da tamamlanmadan kesildi (sending/unknown) →
        // uzak kayıt oluşmuş OLABİLİR. Kör tekrar POST engellenir. Operatör Ulakbell'de doğrulayıp kaydın
        // oluşmadığını görürse "İletim durumunu sıfırla" ile yeniden gönderime izin verebilir.
        if (s.HasPendingForwardOutcome)
            throw new ConflictException(
                "Bu başvurunun önceki iletim denemesi doğrulanabilir bir sonuçla tamamlanmadı; Ulakbell'de kayıt oluşmuş olabilir. " +
                "Ulakbell tarafında kaydın oluşup oluşmadığı doğrulanmadan tekrar gönderilemez. Kayıt oluşmadıysa iletim durumunu sıfırlayın.",
                "ULAKBEL_OUTCOME_UNKNOWN");

        var unit = MuhtarlikReference.UlakbelUnitFor(s.CategoryId);

        // ULAK-03 (C): HTTP'den ÖNCE başlangıç sahiplenmesi ATOMİK KOŞULLU UPDATE ile yapılır — yalnız kayıt
        // hâlâ iletilmemiş VE askıda değilse "sending" + attempt-id yazılır. Okuma ile yazım arasında araya
        // başka bir gönderim/durum girdiyse (kilit kaybı) 0 satır → tam-satır ezme YERİNE conflict üretilir.
        var attemptId = await uow.CitizenSubmissions.TryBeginForwardAttemptAsync(id, ct);
        if (attemptId is null)
            throw new ConflictException(
                "Bu başvurunun durumu bu sırada değişti (başka bir gönderim başlamış veya tamamlanmış olabilir). Lütfen ekranı yenileyip tekrar deneyin.",
                "ULAKBEL_FORWARD_IN_PROGRESS");
        var attempt = attemptId.Value;

        UlakbelForwardResult forward;
        try
        {
            forward = await ulakbelForward.ForwardAsync(new UlakbelForwardRequest(
                s.Id, s.TrackingNo, s.CitizenPhone, s.Title, s.Description, s.Neighborhood, s.Address,
                s.Latitude, s.Longitude, MuhtarlikReference.CategoryLabel(s.CategoryId), s.Priority,
                unit, s.MediaUrls), ct);
        }
        catch (OperationCanceledException)
        {
            // Caller iptali: POST gönderilmiş OLABİLİR → "sending" intent'i KORUNUR (temizlenmez), böylece
            // sonraki çağrı mutabakata kadar bloklanır. Intent zaten commit edildiğinden burada yazım gerekmez.
            throw;
        }

        // Sonuç yazımları caller token'ından BAĞIMSIZ (CancellationToken.None) ve attempt-id ile FENCED:
        // araya reset/yeni deneme girdiyse (kilit kaybı) atomik koşullu UPDATE 0 satır etkiler → bayat yazım
        // yeni kararı EZEMEZ.
        if (!forward.Success)
        {
            if (forward.Outcome == UlakbelForwardOutcome.Unknown)
            {
                await uow.CitizenSubmissions.TryApplyForwardUnknownAsync(s.Id, attempt, CancellationToken.None);
                await audit.LogAsync(new AuditEntry
                {
                    Action = AuditAction.StatusChange,
                    EntityType = "CitizenSubmission",
                    EntityId = s.Id,
                    Module = "Muhtarlik",
                    Level = AuditLogLevel.Warning,
                    Result = LogResult.Failure,
                    Description = $"Ulakbell iletim sonucu belirsiz kaldı, kör tekrar gönderim kilitlendi: {s.Title}",
                    ErrorMessage = forward.ErrorMessage,
                }, CancellationToken.None);
            }
            else
            {
                await uow.CitizenSubmissions.TryClearForwardSendingAsync(s.Id, attempt, CancellationToken.None);
            }
            throw new ConflictException(
                forward.ErrorMessage ?? "Ulakbell'e iletim başarısız oldu.",
                forward.Outcome == UlakbelForwardOutcome.Unknown ? "ULAKBEL_OUTCOME_UNKNOWN" : "ULAKBEL_FORWARD_FAILED");
        }

        var applied = await uow.CitizenSubmissions.TryApplyForwardDeliveredAsync(s.Id, attempt, unit, forward.TrackingNo, CancellationToken.None);
        if (!applied)
        {
            // Deneme geçersizleşmiş (bu forward sürerken kilit kaybı + reset/yeni deneme). Uzak kayıt oluşmuş
            // OLABİLİR; kör yeni gönderime izin verilmez, mutabakat gerekir.
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.StatusChange,
                EntityType = "CitizenSubmission",
                EntityId = s.Id,
                Module = "Muhtarlik",
                Level = AuditLogLevel.Warning,
                Result = LogResult.Failure,
                Description = $"Ulakbell teslim sonucu yazılamadı: deneme kimliği geçersizleşmiş (araya reset/yeni deneme girdi). Uzak kayıt: {forward.TrackingNo}",
            }, CancellationToken.None);
            throw new ConflictException(
                "İletim tamamlandı ancak bu sırada durum sıfırlandığı için sonuç güvenle kaydedilemedi. " +
                "Ulakbell tarafında kaydın oluşup oluşmadığını doğrulamadan tekrar göndermeyin.",
                "ULAKBEL_OUTCOME_UNKNOWN");
        }

        var fresh = await uow.CitizenSubmissions.GetByIdFreshAsync(s.Id, CancellationToken.None) ?? s;

        await AddEventAsync(fresh, "content_sent", "İçerik gönderildi",
            "Başvurunuzun içeriği çağrı merkezine gönderildi. Kayıt alındıktan sonra ilgili müdürlüğe yönlendirilecektir.",
            visibleToCitizen: true, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "CitizenSubmission",
            EntityId = s.Id,
            Module = "Muhtarlik",
            Description = forward.IsSimulated
                ? $"Başvuru içeriği gönderildi (simülasyon — gerçek entegrasyon yapılandırılmamış): {s.Title} → {unit} ({forward.TrackingNo})"
                : $"Başvuru içeriği gönderildi (gerçek API): {s.Title} → {unit} ({forward.TrackingNo})",
        }, ct);

        await NotifyCitizenOfStatusChangeAsync(fresh, ct);

        return await MapDtoAsync(fresh, ShouldHideIdentity(scope), ct);
    }

    public async Task<CitizenSubmissionDto> ResetUlakbelForwardStateAsync(Guid id, string? reason, CancellationToken ct)
    {
        // ULAK-03 (F): mutabakatsız kolay yeniden gönderimi daraltmak için sıfırlama açık bir "kayıt
        // bulunmadığı doğrulandı" kararı + zorunlu inceleme notu ile audit'lenir.
        if (string.IsNullOrWhiteSpace(reason))
            throw new ConflictException(
                "İletim durumunu sıfırlamak için Ulakbell'de kaydın oluşmadığını doğruladığınıza dair bir açıklama girmelisiniz.",
                "RESET_REASON_REQUIRED");

        // ULAK-03 (reset↔forward yarışı): sıfırlama, gönderimle AYNI kilidi alır. Kilit alınamıyorsa aktif bir
        // gönderim sürüyor demektir → sıfırlama reddedilir (çalışan denemeyi/başarı bilgisini ezmez). Kilit
        // alındığında aktif gönderim yoktur; entity kilit ALTINDA taze okunur, böylece "sending" yalnız KESİLMİŞ
        // bir denemeyi temsil eder ve başarı bilgisi (trackingNo) ezilemez.
        var lockKey = ForwardLockKey(id);
        var ttl = ForwardLockTtlSeconds;
        var token = await redis.TryAcquireLockAsync(lockKey, TimeSpan.FromSeconds(ttl), ct);
        if (token is null)
            throw new ConflictException(
                "Bu başvuru şu anda iletiliyor; iletim tamamlanmadan durumu sıfırlanamaz. Lütfen birkaç saniye sonra tekrar deneyin.",
                "ULAKBEL_FORWARD_IN_PROGRESS");
        using var renewalCts = new CancellationTokenSource();
        var renewal = RenewLockLoopAsync(lockKey, token, ttl, renewalCts.Token);
        try
        {
            var s = await uow.CitizenSubmissions.GetByIdAsync(id, ct)
                ?? throw new NotFoundException("Başvuru bulunamadı.", "CITIZEN_SUBMISSION_NOT_FOUND");
            var scope = await AssertNeighborhoodAccessAsync(s.Neighborhood, ct);

            if (s.UlakbelTrackingNo is { Length: > 0 })
                throw new ConflictException("Bu kayıt zaten iletildi; iletim durumu sıfırlanamaz.", "ALREADY_FORWARDED");
            if (!s.HasPendingForwardOutcome)
                throw new ConflictException("Bu kayıtta sıfırlanacak belirsiz/askıda iletim durumu yok.", "NO_PENDING_FORWARD_STATE");

            // ULAK-03 (B): reset YALNIZ operatörün gördüğü denemeyi (kilit altında okunan attempt-id) temizler
            // (CAS). Gecikmiş bir reset, araya girmiş yeni bir denemeyi (farklı attempt-id) temizleyemez → 0 satır.
            var cleared = await uow.CitizenSubmissions.TryResetForwardStateAsync(id, s.UlakbelForwardAttemptId, CancellationToken.None);
            if (!cleared)
                throw new ConflictException(
                    "Kayıt durumu bu sırada değişti; sıfırlama uygulanamadı. Lütfen ekranı yenileyip tekrar deneyin.",
                    "RESET_STATE_CHANGED");

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.StatusChange,
                EntityType = "CitizenSubmission",
                EntityId = s.Id,
                Module = "Muhtarlik",
                Level = AuditLogLevel.Warning,
                Description = $"Belirsiz/askıda Ulakbell iletim durumu operatör tarafından sıfırlandı — gerekçe: {reason.Trim()} ({s.Title})",
            }, ct);

            var fresh = await uow.CitizenSubmissions.GetByIdFreshAsync(id, CancellationToken.None) ?? s;
            return await MapDtoAsync(fresh, ShouldHideIdentity(scope), ct);
        }
        finally
        {
            renewalCts.Cancel();
            try { await renewal; } catch { }
            try { await redis.ReleaseLockAsync(lockKey, token, CancellationToken.None); }
            catch (Exception ex) { logger.LogWarning(ex, "Ulakbell reset kilidi bırakılamadı. Key={Key}", lockKey); }
        }
    }

    public async Task<CitizenSubmissionDto> ToggleNotifyMuhtarAsync(Guid id, CancellationToken ct)
    {
        var s = await uow.CitizenSubmissions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "CITIZEN_SUBMISSION_NOT_FOUND");
        var scope = await AssertNeighborhoodAccessAsync(s.Neighborhood, ct);

        if (scope is not null)
            throw new ForbiddenException(
                "Muhtar bildirim tercihi vatandaşa aittir; muhtar hesapları bu ayarı değiştiremez.",
                "NOTIFY_MUHTAR_FORBIDDEN");

        s.ToggleNotifyMuhtar();
        // ULAK-03 (A): tam-satır Update() YOK — yalnız NotifyMuhtar/UpdatedAt yazılır; iletim alanları korunur.
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "CitizenSubmission",
            EntityId = s.Id,
            Module = "Muhtarlik",
            Description = $"Muhtara bildirim {(s.NotifyMuhtar ? "açıldı" : "kapatıldı")}: {s.Title}",
        }, ct);

        return await MapDtoAsync(s, ShouldHideIdentity(scope), ct);
    }

    // Kullanıcı isteği (2026-08-08): "onların da gerekirse talepte bulunabilmesi" — muhtar
    // kendisi de mahallesi adına belediyeye bir talep/istek/şikayet iletebilsin. Vatandaş
    // formundan farkı: kimlik/telefon/TC alanları boş (muhtarın kendi kimliği vatandaş değil),
    // Neighborhood her zaman muhtarın TEK scope'lu mahallesidir (istemciden gelmez, sahtecilik
    // riski olmasın diye scope'tan zorla okunur), SubmittedVia="muhtar_panel" ile
    // işaretlenir (istatistiklerde ayrı bir kanal olarak görünür).
    //
    // Kullanıcı isteği (2026-09-07): "kişi başkası adına yapılacaksa muhtar burdan talep
    // oluştururken kişinin bilgilerini form içinde girecek ... gönder dediğimizde o kişi
    // sistemde üye ise o kişinin panelinde otomatik görünecek, değilse kişinin cep telefonu
    // iletişim bilgisi de girilmesi lazım" — OnBehalfOf=true olduğunda: TC + doğum tarihi
    // NviLookupAsync ile TEKRAR sunucu tarafında doğrulanır (istemcinin daha önce gösterdiği
    // ada güvenilmez, sahte isim/TC eşleşmesiyle talep açılmasın diye), Participant tablosunda
    // bu TC kayıtlıysa CitizenTc alanı o kişiye eşitlenir — /me/submissions zaten
    // `CitizenTc == participant.Tckn` ile filtrelediği için kayıt OTOMATİK olarak o vatandaşın
    // kendi panelinde görünür (ayrı bir "bağlama" adımı gerekmez). Kayıtlı değilse muhtarın
    // girdiği telefon zorunludur (en azından iletişim kurulabilsin diye).
    public async Task<CitizenSubmissionDto> CreateByMuhtarAsync(CreateSubmissionByMuhtarRequest req, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid)
            throw new ForbiddenException("Oturum bulunamadı.", "NO_SESSION");

        var scopedNames = await GetNeighborhoodScopeAsync(ct);
        if (scopedNames is null || scopedNames.Count != 1)
            throw new ConflictException(
                "Bu işlem yalnızca tek bir mahalleye atanmış muhtar hesapları için kullanılabilir.",
                "MUHTAR_SCOPE_REQUIRED");
        var neighborhood = scopedNames.First();

        if (string.IsNullOrWhiteSpace(req.Title))
            throw new ConflictException("Başlık alanı zorunludur.", "TITLE_REQUIRED");
        if (string.IsNullOrWhiteSpace(req.Description))
            throw new ConflictException("Açıklama alanı zorunludur.", "DESCRIPTION_REQUIRED");
        if (!MuhtarlikReference.SubmissionTypes.Contains(req.SubmissionType))
            throw new ConflictException("Geçersiz başvuru türü.", "INVALID_SUBMISSION_TYPE");
        if (!MuhtarlikReference.Priorities.Contains(req.Priority))
            throw new ConflictException("Geçersiz öncelik.", "INVALID_PRIORITY");

        var admin = await uow.AdminUsers.GetByIdAsync(uid, ct);

        CitizenSubmission submission;
        if (req.OnBehalfOf)
        {
            if (string.IsNullOrWhiteSpace(req.CitizenTc) || !TcKimlikValidator.IsValid(req.CitizenTc))
                throw new ConflictException("Geçerli bir T.C. kimlik numarası giriniz.", "INVALID_TCKN");
            if (!req.CitizenBirthDate.HasValue)
                throw new ConflictException("Doğum tarihi zorunludur.", "BIRTHDATE_REQUIRED");

            var tckn = req.CitizenTc.Trim();
            var participant = await uow.Participants.GetByTcknAsync(tckn, ct);

            string citizenName;
            string citizenPhone;
            if (participant is not null)
            {
                // Kişi sistemde kayıtlı (Participant/citizen-portal üyesi): ad-soyad ve
                // telefon HER ZAMAN kayıtlı Participant kaydından alınır, istemcinin
                // gönderdiği req.CitizenPhone burada YOK SAYILIR — aksi halde muhtarın
                // yanlışlıkla girdiği bir telefon gerçek kayıtlı telefonun üzerine geçerdi.
                citizenName = participant.FullName;
                citizenPhone = participant.Phone ?? "";
            }
            else
            {
                // Kayıtlı değil: NVI'de kişinin gerçekten var olduğunu doğrula (sahte TC ile
                // talep açılmasın), ama ad-soyad/adres NVI'den DEĞİL sunucunun kendi
                // doğrulamasından gelir; telefon kayıtlı olmadığı için muhtardan zorunludur.
                var nviRes = await nvi.GetPersonAndChildrenAsync(tckn, req.CitizenBirthDate.Value, 0, ct);
                if (!nviRes.Success || nviRes.Person is null)
                    throw new ConflictException(nviRes.ErrorMessage ?? "Kimlik doğrulanamadı.", "NVI_FAILED");
                citizenName = $"{nviRes.Person.FirstName} {nviRes.Person.LastName}".Trim();

                if (string.IsNullOrWhiteSpace(req.CitizenPhone))
                    throw new ConflictException(
                        "Bu kişi sistemde kayıtlı değil; iletişim için cep telefonu numarası zorunludur.",
                        "CITIZEN_PHONE_REQUIRED");
                citizenPhone = req.CitizenPhone.Trim();
            }

            var addressType = req.AddressType == "other" ? "other" : "residence";
            string address;
            if (addressType == "residence")
            {
                // İkametgah adresi: önce kayıtlı Participant adresi, yoksa NVI'nin
                // döndürdüğü yerleşim adresi, o da yoksa mahalle adı yedek olarak kullanılır.
                address = participant?.Address
                    ?? (await SafeNviAddressAsync(tckn, req.CitizenBirthDate.Value, ct))
                    ?? neighborhood;
            }
            else
            {
                if (string.IsNullOrWhiteSpace(req.Address))
                    throw new ConflictException("Başka adres seçildi; adres alanı zorunludur.", "ADDRESS_REQUIRED");
                address = req.Address.Trim();
            }

            submission = CitizenSubmission.Create(
                citizenName, citizenPhone, tckn,
                neighborhood, address,
                req.CategoryId, req.SubmissionType, req.Priority,
                req.Title, req.Description);
            submission.SetCitizenBirthDate(req.CitizenBirthDate);
            submission.SetLocationContext(addressType, "neighborhood");
            // Kişi adına açılan gerçek bir talep — vatandaş kimliği muhtardan (yani BU
            // muhtardan, kaydı zaten kendisi oluşturdu) gizlenmez; süreç normal akışında.
            submission.SetAnonymousToMuhtar(false);
            submission.SetMeta(false, null, 0, "muhtar_panel");
            if (req.MediaUrls is { Count: > 0 })
                submission.SetMediaUrls(req.MediaUrls.Take(10).ToList());
        }
        else
        {
            if (string.IsNullOrWhiteSpace(req.Address))
                throw new ConflictException("Adres alanı zorunludur.", "ADDRESS_REQUIRED");

            var muhtarName = admin?.FullName ?? "Muhtar";
            var muhtarPhone = admin?.Phone ?? "";
            submission = CitizenSubmission.Create(
                muhtarName, muhtarPhone, "",
                neighborhood, req.Address.Trim(),
                req.CategoryId, req.SubmissionType, req.Priority,
                req.Title, req.Description);
            submission.SetMeta(false, null, 0, "muhtar_panel");
        }

        submission.SetGeo(req.Latitude, req.Longitude);
        // ULAK-04: ortak, çakışmaya dayanıklı üretici (eski saniye-bazlı biçim aynı saniyede eşzamanlı
        // muhtar başvurusunda TrackingNo unique index çakışmasına düşürüyordu).
        submission.SetTrackingNo(Nexora.Domain.Common.SubmissionTrackingNo.Generate());

        await uow.CitizenSubmissions.AddAsync(submission, ct);
        await Nexora.Infrastructure.Persistence.TrackingNoRetry.SaveWithRetryAsync(
            uow, () => submission.SetTrackingNo(Nexora.Domain.Common.SubmissionTrackingNo.Generate()), ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "CitizenSubmission",
            EntityId = submission.Id,
            Module = "Muhtarlik",
            Description = req.OnBehalfOf
                ? $"Muhtar başkası adına yeni talep oluşturdu: {submission.Title} ({neighborhood}, TC {IdentityMask.MaskTckn(submission.CitizenTc)})"
                : $"Muhtar tarafından yeni talep oluşturuldu: {submission.Title} ({neighborhood})",
        }, ct);

        return await MapDtoAsync(submission, false, ct);
    }

    private async Task<string?> SafeNviAddressAsync(string tckn, DateTime birthDate, CancellationToken ct)
    {
        try
        {
            var res = await nvi.GetAddressAsync(tckn, birthDate, ct);
            return res.Success ? res.Address?.FullAddress : null;
        }
        catch
        {
            return null;
        }
    }

    public async Task<MuhtarNviLookupResultDto> MuhtarNviLookupAsync(MuhtarNviLookupRequest req, CancellationToken ct)
    {
        var scopedNames = await GetNeighborhoodScopeAsync(ct);
        if (scopedNames is null || scopedNames.Count != 1)
            throw new ConflictException(
                "Bu işlem yalnızca tek bir mahalleye atanmış muhtar hesapları için kullanılabilir.",
                "MUHTAR_SCOPE_REQUIRED");

        if (!TcKimlikValidator.IsValid(req.Tckn))
            throw new ConflictException("Geçerli bir T.C. kimlik numarası giriniz.", "INVALID_TCKN");
        var tckn = req.Tckn.Trim();

        var participant = await uow.Participants.GetByTcknAsync(tckn, ct);
        if (participant is not null)
        {
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.View,
                EntityType = "MuhtarNviLookup",
                Module = "Muhtarlik",
                Description = $"Muhtar TC sorgusu (kayıtlı vatandaş): TC {IdentityMask.MaskTckn(tckn)}",
            }, ct);

            return new MuhtarNviLookupResultDto(
                tckn, participant.FullName, participant.BirthDate, participant.Gender.ToString(),
                participant.Address, IsRegisteredCitizen: true,
                RegisteredPhoneMasked: IdentityMask.MaskPhoneStrict(participant.Phone));
        }

        var res = await nvi.GetPersonAndChildrenAsync(tckn, req.BirthDate, 0, ct);
        if (!res.Success || res.Person is null)
            throw new ConflictException(res.ErrorMessage ?? "Kimlik doğrulanamadı.", "NVI_FAILED");

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.View,
            EntityType = "MuhtarNviLookup",
            Module = "Muhtarlik",
            Description = $"Muhtar TC sorgusu (NVI): TC {IdentityMask.MaskTckn(tckn)}",
        }, ct);

        var person = res.Person;
        return new MuhtarNviLookupResultDto(
            person.Tckn, $"{person.FirstName} {person.LastName}".Trim(), person.BirthDate,
            person.Gender.ToString(), person.Address, IsRegisteredCitizen: false, RegisteredPhoneMasked: null);
    }

    public async Task<MuhtarSubmissionMediaUploadDto> UploadMuhtarMediaAsync(Stream stream, string fileName, string contentType, long sizeBytes, CancellationToken ct)
    {
        var scopedNames = await GetNeighborhoodScopeAsync(ct);
        if (scopedNames is null || scopedNames.Count != 1)
            throw new ForbiddenException("Bu işlem yalnızca muhtar hesapları için kullanılabilir.", "MUHTAR_SCOPE_REQUIRED");

        if (sizeBytes <= 0)
            throw new ConflictException("Dosya boş görünüyor.", "FILE_EMPTY");
        if (sizeBytes > MaxMuhtarMediaSizeBytes)
            throw new ConflictException("Dosya boyutu en fazla 100 MB olabilir.", "FILE_TOO_LARGE");
        if (!AllowedMuhtarMediaContentTypes.Contains(contentType))
            throw new ConflictException(
                "Yalnızca fotoğraf (JPEG/PNG/WEBP) veya video (MP4/MOV/WEBM) yükleyebilirsiniz. iPhone HEIC formatı desteklenmiyor.",
                "UNSUPPORTED_MEDIA_TYPE");

        var result = await fileStorage.UploadAsync(stream, fileName, contentType, "nexora-public", ct, keyPrefix: "citizen-submissions");
        return new MuhtarSubmissionMediaUploadDto(result.Url, result.ObjectName, result.SizeBytes);
    }

    private async Task<IReadOnlyList<string>?> AssertNeighborhoodAccessAsync(string neighborhood, CancellationToken ct)
    {
        var scopedNames = await GetNeighborhoodScopeAsync(ct);
        if (scopedNames is not null && !scopedNames.Contains(neighborhood))
            throw new ForbiddenException("Bu başvuruya erişim yetkiniz yok.", "FORBIDDEN_NEIGHBORHOOD");
        return scopedNames;
    }

    private async Task NotifyCitizenOfStatusChangeAsync(CitizenSubmission s, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(s.CitizenTc)) return;

        // Kullanıcı isteği (2026-08-08): "Ulakbel'den bildirim gidiyorsa ordan gitsin ama bizim
        // sistemde gitsin veya gitmesin şeklinde ayar olsun". "forwarded"/"resolved"/"rejected"
        // Ulakbel akışıyla ilgili durumlardır (forward sonrası ya da forward sonucu); bu üç
        // durumda sistem içi bildirim, Ayarlar > Entegrasyonlar > Ulakbel'deki
        // NotifyCitizenOnUpdate anahtarına tabidir. "in_review" Ulakbel'den bağımsız dahili bir
        // durum olduğundan bu ayardan etkilenmez, her zaman gönderilir.
        var isUlakbelRelatedStatus = s.Status is "forwarded" or "resolved" or "rejected";
        if (isUlakbelRelatedStatus && !await integrationSettings.ShouldNotifyCitizenOnUlakbelUpdateAsync(ct))
            return;

        var participant = await uow.Participants.GetByTcknAsync(s.CitizenTc, ct);
        if (participant is null) return;

        var (title, body) = s.Status switch
        {
            "in_review" => ("Başvurunuz incelemeye alındı", $"\"{s.Title}\" başlıklı başvurunuz incelemeye alındı."),
            "forwarded" => ("Başvurunuz gönderildi", $"\"{s.Title}\" başlıklı başvurunuzun içeriği gönderildi, çağrı merkezi incelemesinde."),
            "resolved" => ("Başvurunuz çözüldü", $"\"{s.Title}\" başlıklı başvurunuz çözüldü olarak işaretlendi."),
            "rejected" => ("Başvurunuz reddedildi", $"\"{s.Title}\" başlıklı başvurunuz reddedildi."),
            _ => (default(string), default(string)),
        };
        if (title is null || body is null) return;

        // Kullanıcı isteği (2026-08-28): "çözüldüğünde veya bilgi geldiğinde kişiye bildirim
        // gelmeli olayın ne olduğu" — bildirim gövdesine belediyeden gelen açıklama ve
        // sürecin ne kadar sürdüğü de eklenir.
        if (!string.IsNullOrWhiteSpace(s.ResolutionNote))
            body += $" Açıklama: {s.ResolutionNote}";

        var elapsedHours = Math.Round(((s.ResolvedAt ?? DateTime.UtcNow) - s.SubmittedAt).TotalHours, 1);
        body += $" (Başvuru süresi: {elapsedHours} saat)";

        await notificationService.CreateAsync(
            participant.Id, title, body, "submission",
            "citizen-submission", s.Id.ToString(), null, null, s.Status, ct);
    }

    private async Task<CitizenSubmissionDto> MapDtoAsync(CitizenSubmission s, bool hideIdentity, CancellationToken ct)
    {
        var muhtarAdmin = await FindMuhtarAdminAsync(s.Neighborhood, ct);
        return MapDto(s, hideIdentity, muhtarAdmin);
    }

    private CitizenSubmissionDto MapDto(CitizenSubmission s, bool hideIdentity, Domain.Entities.Auth.AdminUser? muhtarAdmin)
    {
        var (muhtarName, muhtarPhone, provisioned) = muhtarAdmin is not null
            ? (muhtarAdmin.FullName, muhtarAdmin.Phone, true)
            : MuhtarlikReference.MuhtarFor(s.Neighborhood) is { } fallback
                ? (fallback.Name, fallback.Phone, false)
                : (null, null, false);
        // Kullanıcı isteği (2026-09-07): "kişisel bilgileri mümkün mertebe gizle muhtar
        // sadece genel konuyu anlasın ... adres kişisel bilgiler ad soyad bilgileri muhtar
        // göremesin" — hideIdentity=true (muhtar/mahalle-scope'lu görünüm) iken:
        //  - Address TAMAMEN gizlenir (önceden ham adres muhtara da gidiyordu — KVKK açığı).
        //  - Title/Description'daki tespit edilen şahıs adları *** ile maskelenir; geri kalan
        //    genel metin (konu/şikayet özeti) görünür kalır.
        var title = hideIdentity ? contentAnalyzer.MaskPersonNames(s.Title) : s.Title;
        var description = hideIdentity ? contentAnalyzer.MaskPersonNames(s.Description) : s.Description;
        var address = hideIdentity ? "Gizli — kimlik korunuyor" : s.Address;
        return new CitizenSubmissionDto(
            s.Id,
            s.TrackingNo,
            hideIdentity ? "Gizli — kimlik korunuyor" : s.CitizenName,
            hideIdentity ? "" : s.CitizenPhone,
            hideIdentity ? "" : s.CitizenTc,
            s.Neighborhood,
            address,
            hideIdentity ? null : s.Latitude,
            hideIdentity ? null : s.Longitude,
            s.CategoryId,
            s.SubmissionType,
            s.Priority,
            s.NotifyMuhtar,
            s.ComplaintReason,
            title,
            description,
            s.PhotoCount,
            s.Status,
            s.SubmittedAt,
            s.SubmittedVia,
            s.ForwardedAt,
            s.ResolvedAt,
            s.UlakbelUnit,
            s.UlakbelTrackingNo,
            muhtarName,
            muhtarPhone,
            hideIdentity,
            s.MediaUrls,
            provisioned,
            hideIdentity ? null : s.CitizenBirthDate,
            s.UlakbelForwardState);
    }


    private static SubmissionReportsSummaryDto BuildReports(List<CitizenSubmission> all)
    {
        var total = all.Count;

        var resolved = all.Where(x => x.Status == "resolved" && x.ResolvedAt != null).ToList();
        var resolvedCount = resolved.Count;
        var avg = resolvedCount > 0
            ? resolved.Average(x => (x.ResolvedAt!.Value - x.SubmittedAt).TotalDays)
            : 0;

        var ulakbelForwarded = all.Count(x => x.Status == "forwarded" || x.UlakbelTrackingNo != null);
        var ulakbelEligible = all.Count(x => x.Status != "rejected");
        var ulakbelRate = ulakbelEligible > 0 ? (double)ulakbelForwarded / ulakbelEligible * 100 : 0;
        var resolutionRate = total > 0 ? (double)resolvedCount / total * 100 : 0;
        var pending = all.Count(x => x.Status == "new" || x.Status == "in_review");

        var byCategory = all
            .GroupBy(x => x.CategoryId)
            .Select(g => new SubmissionDistributionItemDto(g.Key, MuhtarlikReference.CategoryLabel(g.Key), g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        var byNeighborhood = all
            .GroupBy(x => x.Neighborhood)
            .Select(g => new SubmissionDistributionItemDto(g.Key, g.Key, g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        var byType = MuhtarlikReference.SubmissionTypes
            .Select(t => new SubmissionDistributionItemDto(t, MuhtarlikReference.SubmissionTypeLabel(t), all.Count(x => x.SubmissionType == t)))
            .ToList();

        var byPriority = MuhtarlikReference.Priorities
            .Select(pr => new SubmissionDistributionItemDto(pr, MuhtarlikReference.PriorityLabel(pr), all.Count(x => x.Priority == pr)))
            .ToList();

        var byStatus = MuhtarlikReference.AllowedStatuses
            .Select(st => new SubmissionDistributionItemDto(st, MuhtarlikReference.StatusLabel(st), all.Count(x => x.Status == st)))
            .ToList();

        var today = TurkeyTime.TodayDate();
        var trend = Enumerable.Range(0, 7)
            .Select(i =>
            {
                var day = today.AddDays(-(6 - i));
                return new SubmissionTrendPointDto(day.ToString("yyyy-MM-dd"), all.Count(x => TurkeyTime.ToTurkey(x.SubmittedAt).Date == day));
            })
            .ToList();

        var neighborhoodBreakdown = all
            .GroupBy(x => x.Neighborhood)
            .Select(g =>
            {
                var items = g.ToList();
                var topCats = items
                    .GroupBy(x => x.CategoryId)
                    .Select(c => new SubmissionDistributionItemDto(c.Key, MuhtarlikReference.CategoryLabel(c.Key), c.Count()))
                    .OrderByDescending(c => c.Count)
                    .Take(5)
                    .ToList();
                return new NeighborhoodBreakdownItemDto(
                    g.Key,
                    items.Count,
                    items.Count(x => x.SubmissionType == "complaint"),
                    items.Count(x => x.SubmissionType == "request"),
                    items.Count(x => x.SubmissionType == "suggestion"),
                    items.Count(x => x.Priority == "urgent"),
                    items.Count(x => x.Status == "resolved"),
                    topCats);
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        // Kullanıcı isteği (2026-08-08): "çok iyi bir istatistik istiyorum" — genişletilmiş
        // rapor blokları.

        // a) Kanal bazlı dağılım (SubmittedVia: mobile_app / muhtar_panel / vb.)
        var byChannel = all
            .GroupBy(x => x.SubmittedVia)
            .Select(g => new SubmissionDistributionItemDto(g.Key, ChannelLabel(g.Key), g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        // b) Ortalama iletim süresi (SubmittedAt → ForwardedAt arası, saat cinsinden)
        var forwarded = all.Where(x => x.ForwardedAt != null).ToList();
        var avgForwardHours = forwarded.Count > 0
            ? forwarded.Average(x => (x.ForwardedAt!.Value - x.SubmittedAt).TotalHours)
            : 0;

        // c) 30 günlük trend (mevcut 7 günün yanına)
        var trend30d = Enumerable.Range(0, 30)
            .Select(i =>
            {
                var day = today.AddDays(-(29 - i));
                return new SubmissionTrendPointDto(day.ToString("yyyy-MM-dd"), all.Count(x => TurkeyTime.ToTurkey(x.SubmittedAt).Date == day));
            })
            .ToList();

        // d) Muhtar/mahalle bazlı performans (en hızlı çözen / en çok bekleyen)
        var muhtarPerformance = all
            .GroupBy(x => x.Neighborhood)
            .Select(g =>
            {
                var items = g.ToList();
                var itemsResolved = items.Where(x => x.Status == "resolved" && x.ResolvedAt != null).ToList();
                var nAvg = itemsResolved.Count > 0
                    ? itemsResolved.Average(x => (x.ResolvedAt!.Value - x.SubmittedAt).TotalDays)
                    : 0;
                var nPending = items.Count(x => x.Status is "new" or "in_review");
                var nRate = items.Count > 0 ? (double)itemsResolved.Count / items.Count * 100 : 0;
                return new MuhtarPerformanceItemDto(
                    g.Key, items.Count, itemsResolved.Count, Math.Round(nAvg, 1), nPending, Math.Round(nRate, 1));
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        // e) Şikayet nedeni dağılımı (yalnızca ComplaintReason dolu olanlar)
        var byComplaintReason = all
            .Where(x => !string.IsNullOrWhiteSpace(x.ComplaintReason))
            .GroupBy(x => x.ComplaintReason!)
            .Select(g => new SubmissionDistributionItemDto(g.Key, ComplaintReasonLabel(g.Key), g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        // f) Haftanın günü / saat bazlı yoğunluk (Türkiye saatine göre)
        var heatmap = all
            .Select(x => TurkeyTime.ToTurkey(x.SubmittedAt))
            .GroupBy(t => ((int)t.DayOfWeek, t.Hour))
            .Select(g => new SubmissionHeatmapPointDto(g.Key.Item1, g.Key.Item2, g.Count()))
            .OrderBy(x => x.DayOfWeek).ThenBy(x => x.Hour)
            .ToList();

        // g) Kullanıcı isteği (2026-09-07): "en çok şikayet edilen" ve "en çok talep edilen"
        // konu başlıkları — kategori kırılımını başvuru türüne göre ayırıyor.
        var byCategoryComplaint = all
            .Where(x => x.SubmissionType == "complaint")
            .GroupBy(x => x.CategoryId)
            .Select(g => new SubmissionDistributionItemDto(g.Key, MuhtarlikReference.CategoryLabel(g.Key), g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        var byCategoryRequest = all
            .Where(x => x.SubmissionType is "request" or "suggestion")
            .GroupBy(x => x.CategoryId)
            .Select(g => new SubmissionDistributionItemDto(g.Key, MuhtarlikReference.CategoryLabel(g.Key), g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        return new SubmissionReportsSummaryDto(
            Math.Round(avg, 1),
            resolvedCount,
            ulakbelForwarded,
            ulakbelEligible,
            Math.Round(ulakbelRate, 1),
            Math.Round(resolutionRate, 1),
            pending,
            byCategory,
            byNeighborhood,
            byType,
            byPriority,
            byStatus,
            trend,
            neighborhoodBreakdown,
            byChannel,
            Math.Round(avgForwardHours, 1),
            trend30d,
            muhtarPerformance,
            byComplaintReason,
            heatmap,
            byCategoryComplaint,
            byCategoryRequest);
    }

    private static string ChannelLabel(string channel) => channel switch
    {
        "mobile_app" => "Mobil Uygulama",
        "muhtar_panel" => "Muhtar Paneli",
        "web" => "Web",
        _ => channel,
    };

    private static string ComplaintReasonLabel(string reason) => reason switch
    {
        "public_safety" => "Kamu Güvenliği",
        "health_hygiene" => "Sağlık / Hijyen",
        "recurring" => "Tekrarlayan Sorun",
        "service_quality" => "Hizmet Kalitesi",
        "environmental" => "Çevresel Etki",
        "noise" => "Gürültü",
        "damage" => "Mülk / Eşya Hasarı",
        "other" => "Diğer",
        _ => reason,
    };
}
