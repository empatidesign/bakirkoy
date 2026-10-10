using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Seda;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services.Seda;

namespace Nexora.Infrastructure.Services;

public class SedaApplicationService(IUnitOfWork uow, ICurrentUser currentUser, IActivityLogger log, IExcelService excel,
    Nexora.Application.Features.Notifications.INotificationService inApp, IUserScopeService userScope, IAuditService audit,
    ISedaSettingsService sedaSettings, INotificationDispatcher dispatcher, ISmsGovernanceService smsGovernance)
    : ISedaApplicationService
{
    private static readonly string[] Statuses = ["pending", "approved", "rejected"];

    private static readonly Dictionary<string, string> StatusInfoLabels = new()
    {
        ["application_received"] = "Başvuru Alındı",
        ["approved"] = "Onaylandı",
        ["rejected"] = "Reddedildi",
        ["cancelled"] = "İptal Edildi",
        ["postponed"] = "Ertelendi",
        ["emergency"] = "Acil Durum",
        ["manual"] = "Bilgilendirme",
    };

    // SEDA modülü izin kataloğunda "Scopable=true" olarak işaretli (bir personel sadece
    // belirli okulların SEDA başvurularını görebilecek şekilde sınırlandırılabilir) ama
    // servis katmanında bu scope hiç uygulanmıyordu — scope'lu bir kullanıcı sistemdeki TÜM
    // okulların/öğrencilerin (TC kimlik no, adres dahil) başvurularını görebiliyor, ID ile
    // doğrudan erişebiliyordu (bkz. seda-scope-idor-2026-07-30 bulgusu, P1). Kayıtlar SchoolId
    // FK değil SchoolName string alanı kullandığı için scope, GetScopedNamesAsync ile okul
    // ADI listesi olarak çözülüyor.
    private async Task<IReadOnlyCollection<string>?> GetScopedSchoolNamesAsync(CancellationToken ct)
        => currentUser.Id is Guid uid
            ? await userScope.GetScopedNamesAsync(uid, "seda", ct)
            : null;

    public async Task<PagedResult<SedaApplicationDto>> GetPagedAsync(SedaApplicationListParams p, CancellationToken ct)
    {
        var scopedNames = await GetScopedSchoolNamesAsync(ct);
        var paged = await uow.SedaApplications.GetPagedAsync(p, scopedNames, ct);
        return new PagedResult<SedaApplicationDto>
        {
            Items = paged.Items.Select(ToDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<SedaApplicationSummaryDto> GetSummaryAsync(string? schoolName, CancellationToken ct)
    {
        var scopedNames = await GetScopedSchoolNamesAsync(ct);
        var (total, approved, pending, rejected) = await uow.SedaApplications.GetSummaryAsync(schoolName, scopedNames, ct);
        return new SedaApplicationSummaryDto(total, approved, pending, rejected);
    }

    public async Task<SedaApplicationDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.SedaApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "SEDA_APPLICATION_NOT_FOUND");
        await EnsureInScopeAsync(app, ct);
        return ToDto(app);
    }

    private async Task EnsureInScopeAsync(SedaApplication app, CancellationToken ct)
    {
        var scopedNames = await GetScopedSchoolNamesAsync(ct);
        if (scopedNames is not null && !scopedNames.Contains(app.SchoolName))
            throw new NotFoundException("Başvuru bulunamadı.", "SEDA_APPLICATION_NOT_FOUND");
    }

    private async Task EnsureSchoolInScopeAsync(string schoolName, CancellationToken ct)
    {
        var scopedNames = await GetScopedSchoolNamesAsync(ct);
        if (scopedNames is not null && !scopedNames.Contains(schoolName))
            throw new ForbiddenException("Bu okul için başvuru işlemi yapma yetkiniz yok.", "SEDA_SCHOOL_OUT_OF_SCOPE");
    }

    public async Task<SedaApplicationDto> CreateAsync(SedaApplicationFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.StudentName, req.SchoolName });

        await EnsureSchoolInScopeAsync(req.SchoolName.Trim(), ct);

        var settings = await sedaSettings.GetAsync(ct);
        var tckn = req.Tckn.Trim();

        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        SedaApplication app;
        try
        {
            await uow.AcquireAdvisoryLockAsync(SedaConcurrency.TcknLockKey(tckn), ct);

            if (await uow.SedaApplications.HasActiveApplicationForTcknAsync(tckn, settings.ActivePeriod?.Id, ct))
                throw new ConflictException("Bu TC kimlik numarasıyla zaten aktif bir SEDA başvurusu bulunuyor.", "SEDA_ALREADY_APPLIED");

            if (settings.ActivePeriod is not null && settings.ActivePeriod.MaxApplications > 0)
            {
                await uow.AcquireAdvisoryLockAsync(SedaConcurrency.PeriodLockKey(settings.ActivePeriod.Id), ct);
                if (await uow.SedaApplications.CountByPeriodAsync(settings.ActivePeriod.Id, ct) >= settings.ActivePeriod.MaxApplications)
                    throw new ConflictException("Başvuru kontenjanı dolmuştur.", "SEDA_QUOTA_FULL");
            }

            if (settings.ActivePeriod is not null)
            {
                var today = Nexora.Domain.Common.TurkeyTime.TodayDate();
                if (today < settings.ActivePeriod.StartDate.Date || today > settings.ActivePeriod.EndDate.Date)
                    throw new ConflictException("Başvuru dönemi şu anda açık değil (dönem tarihleri dışında).", "SEDA_PERIOD_OUT_OF_WINDOW");
            }

            var code = $"SEDA{await uow.SedaApplications.NextCodeNumberAsync(ct):D6}";
            app = SedaApplication.Create(
                code, req.StudentName.Trim(), req.StudentSurname.Trim(), tckn, ParseDate(req.BirthDate),
                req.SchoolName.Trim(), req.NextYearGrade.Trim(), req.EducationType.Trim(), req.ExamCenterName.Trim(),
                req.StudentPhone.Trim(), req.ParentPhone.Trim(), req.Neighborhood?.Trim() ?? string.Empty, req.Address.Trim(),
                req.Status, req.Notes, currentUser.Name, null, settings.ActivePeriod?.Id);

            await uow.SedaApplications.AddAsync(app, ct);
            await uow.SaveChangesAsync(ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch (Exception ex) when (SedaConcurrency.IsTcknUniqueViolation(ex))
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw new ConflictException("Bu TC kimlik numarasıyla zaten aktif bir SEDA başvurusu bulunuyor.", "SEDA_ALREADY_APPLIED");
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "SedaApplication",
            EntityId = app.Id,
            Module = "Seda",
            Description = $"SEDA başvurusu oluşturuldu: {app.Code} — {app.StudentName} {app.StudentSurname} ({app.SchoolName})",
            NewValues = JsonSerializer.Serialize(ToDto(app)),
        }, ct);

        return ToDto(app);
    }

    public async Task<SedaApplicationDto> UpdateAsync(Guid id, SedaApplicationFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var app = await uow.SedaApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "SEDA_APPLICATION_NOT_FOUND");
        await EnsureInScopeAsync(app, ct);
        await EnsureSchoolInScopeAsync(req.SchoolName.Trim(), ct);

        var oldStatus = app.Status;
        var statusChanged = !string.Equals(oldStatus, req.Status, StringComparison.Ordinal);
        if (statusChanged)
            EnsureStatusTransitionAllowed(oldStatus, req.Status);

        var oldValues = JsonSerializer.Serialize(ToDto(app));

        app.Update(
            req.StudentName.Trim(), req.StudentSurname.Trim(), req.Tckn.Trim(), ParseDate(req.BirthDate),
            req.SchoolName.Trim(), req.NextYearGrade.Trim(), req.EducationType.Trim(), req.ExamCenterName.Trim(),
            req.StudentPhone.Trim(), req.ParentPhone.Trim(), req.Neighborhood?.Trim() ?? string.Empty, req.Address.Trim(), req.Status, req.Notes);

        if (statusChanged)
            app.SetStatus(req.Status, currentUser.Name);

        uow.SedaApplications.Update(app);
        try
        {
            await uow.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (SedaConcurrency.IsTcknUniqueViolation(ex))
        {
            throw new ConflictException("Bu TC kimlik numarasıyla zaten aktif bir SEDA başvurusu bulunuyor.", "SEDA_ALREADY_APPLIED");
        }

        if (statusChanged)
            await NotifyStatusChangedAsync(app, req.Status, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = statusChanged ? AuditAction.StatusChange : AuditAction.Update,
            EntityType = "SedaApplication",
            EntityId = app.Id,
            Module = "Seda",
            Description = statusChanged
                ? $"SEDA başvurusu güncellendi ve durumu değişti ({oldStatus} → {req.Status}): {app.Code} — {app.StudentName} {app.StudentSurname}"
                : $"SEDA başvurusu güncellendi: {app.Code} — {app.StudentName} {app.StudentSurname}",
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(ToDto(app)),
        }, ct);

        return ToDto(app);
    }

    private static void EnsureStatusTransitionAllowed(string oldStatus, string newStatus)
    {
        if (!Statuses.Contains(newStatus))
            throw new ConflictException("Geçersiz başvuru durumu.", "INVALID_APPLICATION_STATUS");
        if (oldStatus == "rejected" && newStatus == "approved")
            throw new ConflictException("Reddedilmiş bir başvuru doğrudan onaylanamaz.", "INVALID_STATUS_TRANSITION");
        if (oldStatus == "cancelled")
            throw new ConflictException("Vatandaşın iptal ettiği başvurunun durumu değiştirilemez.", "INVALID_STATUS_TRANSITION");
    }

    private async Task NotifyStatusChangedAsync(SedaApplication app, string status, CancellationToken ct)
    {
        if (status is not ("approved" or "rejected"))
            return;

        var settings = await sedaSettings.GetAsync(ct);
        var template = (settings.NotificationTemplates ?? []).FirstOrDefault(t => t.Event == status);
        if (template is null) return;

        var statusInfo = StatusInfoLabels.GetValueOrDefault(status, status);

        if (template.NotifyEnabled && !string.IsNullOrWhiteSpace(template.NotifyBody) && app.CitizenUserId is Guid citizenId)
        {
            var body = SedaMessageRenderer.Render(template.NotifyBody, app);
            await inApp.CreateAsync(citizenId, $"SEDA başvurunuz {statusInfo.ToLowerInvariant()}", body, "seda-application",
                "seda", app.Id.ToString(), null, null, statusInfo, ct);
        }

        var phone = string.IsNullOrWhiteSpace(app.ParentPhone) ? app.StudentPhone : app.ParentPhone;
        if (template.SmsEnabled && !string.IsNullOrWhiteSpace(template.SmsBody) && !string.IsNullOrWhiteSpace(phone))
        {
            var body = SedaMessageRenderer.Render(template.SmsBody, app);
            try { await dispatcher.SendSmsAsync(phone, body, ct); }
            catch { }
        }
    }

    public async Task<SedaManualMessageResultDto> SendManualMessageAsync(SedaManualMessageRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(SendManualMessageAsync), new { req.TemplateEvent, req.StatusFilter });

        if (!req.Sms && !req.Notify)
            throw new ConflictException("En az bir kanal seçin (SMS veya bildirim).", "NO_CHANNEL");

        var settings = await sedaSettings.GetAsync(ct);
        var template = (settings.NotificationTemplates ?? []).FirstOrDefault(t => t.Event == req.TemplateEvent);
        var smsBodyTemplate = req.CustomText ?? template?.SmsBody ?? string.Empty;
        var notifyBodyTemplate = req.CustomText ?? template?.NotifyBody ?? string.Empty;
        var smsEnabled = req.Sms && (req.CustomText is not null || (template?.SmsEnabled ?? false)) && !string.IsNullOrWhiteSpace(smsBodyTemplate);
        var notifyEnabled = req.Notify && (req.CustomText is not null || (template?.NotifyEnabled ?? false)) && !string.IsNullOrWhiteSpace(notifyBodyTemplate);

        if (!smsEnabled && !notifyEnabled)
            throw new ConflictException("Gönderilecek şablon veya metin boş.", "EMPTY_MESSAGE");

        var scopedNames = await GetScopedSchoolNamesAsync(ct);
        var applications = await uow.SedaApplications.GetAllFilteredAsync(new SedaApplicationListParams(), scopedNames, ct);
        if (req.StatusFilter is { Count: > 0 })
            applications = applications.Where(a => req.StatusFilter.Contains(a.Status)).ToList();
        if (!string.IsNullOrWhiteSpace(req.SchoolName))
            applications = applications.Where(a => a.SchoolName == req.SchoolName).ToList();
        if (smsEnabled) await smsGovernance.EnsureCanSendAsync("Seda", req.TemplateEvent, applications.Count, req.SmsOtp, ct);

        var statusInfo = StatusInfoLabels.GetValueOrDefault(req.TemplateEvent, "Bilgilendirme");
        var recipients = 0;
        var smsSent = 0;
        var notifsSent = 0;

        foreach (var app in applications)
        {
            recipients++;
            if (notifyEnabled && app.CitizenUserId is Guid citizenId)
            {
                var body = SedaMessageRenderer.Render(notifyBodyTemplate, app);
                await inApp.CreateAsync(citizenId, statusInfo, body, "seda-application",
                    "seda", app.Id.ToString(), null, null, statusInfo, ct);
                notifsSent++;
            }

            var phone = string.IsNullOrWhiteSpace(app.ParentPhone) ? app.StudentPhone : app.ParentPhone;
            if (smsEnabled && !string.IsNullOrWhiteSpace(phone))
            {
                var body = SedaMessageRenderer.Render(smsBodyTemplate, app);
                try { if (await dispatcher.SendSmsAsync(phone, body, ct)) smsSent++; }
                catch { }
            }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "SedaApplication",
            Module = "Seda",
            Description = $"SEDA başvurularına manuel mesaj gönderildi ({recipients} alıcı, SMS: {smsSent}, bildirim: {notifsSent}).",
            AdditionalDataJson = JsonSerializer.Serialize(new { req.TemplateEvent, req.StatusFilter, req.SchoolName, recipients, smsSent, notifsSent }),
        }, ct);

        return new SedaManualMessageResultDto(recipients, smsSent, notifsSent, false);
    }

    public async Task<SedaApplicationDto> SetStatusAsync(Guid id, string status, string? reason, CancellationToken ct)
    {
        var app = await uow.SedaApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "SEDA_APPLICATION_NOT_FOUND");
        await EnsureInScopeAsync(app, ct);

        // SED-APR-005: reddedilmiş bir başvuru doğrudan API çağrısıyla onaya geçirilemez —
        // FacilityApplicationService.ApproveAsync'teki aynı durum-geçiş kilidi (admin UI zaten
        // engelliyordu ama sunucu tarafı kontrol etmiyordu, doğrudan API çağrısı bunu atlatabiliyordu).
        var oldStatus = app.Status;
        EnsureStatusTransitionAllowed(oldStatus, status);

        app.SetStatus(status, currentUser.Name, reason);
        uow.SedaApplications.Update(app);
        await uow.SaveChangesAsync(ct);

        await NotifyStatusChangedAsync(app, status, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = status == "approved" ? AuditAction.Approve : status == "rejected" ? AuditAction.Reject : AuditAction.StatusChange,
            EntityType = "SedaApplication",
            EntityId = app.Id,
            Module = "Seda",
            Description = $"SEDA başvurusu durumu değişti ({oldStatus} → {status}): {app.Code} — {app.StudentName} {app.StudentSurname}",
            ChangesJson = JsonSerializer.Serialize(new { oldStatus, newStatus = status }),
        }, ct);

        return ToDto(app);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.SedaApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "SEDA_APPLICATION_NOT_FOUND");
        await EnsureInScopeAsync(app, ct);

        uow.SedaApplications.Delete(app);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "SedaApplication",
            EntityId = app.Id,
            Module = "Seda",
            Description = $"SEDA başvurusu silindi: {app.Code} — {app.StudentName} {app.StudentSurname} ({app.SchoolName})",
            OldValues = JsonSerializer.Serialize(ToDto(app)),
        }, ct);
    }

    public async Task<(byte[] Bytes, string FileName)> ExportExcelAsync(SedaApplicationListParams p, CancellationToken ct)
    {
        var scopedNames = await GetScopedSchoolNamesAsync(ct);
        var items = await uow.SedaApplications.GetAllFilteredAsync(p, scopedNames, ct);
        var dtos = items.Select(ToDto).ToList();

        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(p.SchoolName)) parts.Add(p.SchoolName);
        if (!string.IsNullOrWhiteSpace(p.Status)) parts.Add(p.Status);
        if (p.StartDate.HasValue || p.EndDate.HasValue)
            parts.Add($"{p.StartDate?.ToString("dd.MM.yyyy") ?? ""}–{p.EndDate?.ToString("dd.MM.yyyy") ?? ""}");
        var title = parts.Count > 0 ? string.Join(", ", parts) : "Tüm Başvurular";

        var bytes = excel.BuildSedaApplicationExport(dtos, title);
        var fileName = $"SEDA_Basvurular_{TurkeyTime.NowWallClock():yyyyMMdd_HHmm}.xlsx";

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Export,
            EntityType = "SedaApplication",
            Module = "Seda",
            Description = $"SEDA başvuru listesi Excel'e aktarıldı ({dtos.Count} kayıt): {title}",
            AdditionalDataJson = JsonSerializer.Serialize(new { count = dtos.Count, filter = title }),
        }, ct);

        return (bytes, fileName);
    }

    private static DateTime? ParseDate(string? value)
        => DateTime.TryParse(value, out var d) ? d.Date : null;

    public async Task<SedaYearlyReportDto> GetYearlyReportAsync(SedaYearlyReportParams p, CancellationToken ct)
    {
        var scopedNames = await GetScopedSchoolNamesAsync(ct);
        return await uow.SedaApplications.GetYearlyReportAsync(p, scopedNames, ct);
    }

    private static SedaApplicationDto ToDto(SedaApplication a) => new(
        a.Id, a.Code, a.StudentName, a.StudentSurname, a.Tckn, a.BirthDate, a.SchoolName,
        a.NextYearGrade, a.EducationType, a.ExamCenterName, a.StudentPhone, a.ParentPhone,
        a.Neighborhood, a.Address, a.Status, a.Notes, a.RejectionReason, a.CreatedAt, a.AppliedBy, a.ReviewedAt, a.ReviewedBy);
}
