using System.Text.Json;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.Notifications;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class CompanySettingsService(
    IUnitOfWork uow,
    IAuditService audit,
    INotificationDispatcher dispatcher,
    INotificationService notifications,
    ISmsService sms,
    ISmsGovernanceService smsGovernance) : ICompanySettingsService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // Varsayılan metinler CompanyService.cs'de daha önce sabit kodlu olan orijinal metinlerle birebir
    // aynı - admin hiç şablon girmese davranış değişmez (geriye dönük uyumlu).
    public static readonly IReadOnlyList<CompanyNotificationTemplateDto> DefaultNotificationTemplates =
    [
        new("temporary_password", true, "Sayın {{firma}}, firma giriş şifreniz: {{sifre}}. İlk girişte değiştirmeniz zorunludur."),
        new("approved", true, "Sayın {{firma}}, firmanız onaylandı. Kampanya oluşturabilirsiniz."),
        new("password_reset", true, "Sayın {{firma}}, yeni giriş şifreniz: {{sifre}}. İlk girişte değiştirmeniz zorunludur."),
        new("manual", true, "Sayın {{firma}}, bilgilendirme: "),
    ];

    public async Task<CompanySettingsDto> GetAsync(CancellationToken ct)
    {
        var record = await uow.CompanySettings.GetCurrentAsync(ct);
        var dto = record is null
            ? new CompanySettingsDto()
            : JsonSerializer.Deserialize<CompanySettingsDto>(record.ConfigJson, JsonOpts) ?? new CompanySettingsDto();

        var existing = dto.NotificationTemplates ?? [];
        var merged = DefaultNotificationTemplates
            .Select(def => existing.FirstOrDefault(t => t.Event == def.Event) ?? def)
            .ToList();
        return dto with { NotificationTemplates = merged };
    }

    public async Task<CompanySettingsDto> SaveAsync(CompanySettingsDto dto, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(dto, JsonOpts);
        var record = await uow.CompanySettings.GetCurrentAsync(ct);
        var oldJson = record?.ConfigJson;

        if (record is null)
        {
            record = CompanySettingsRecord.Create(json);
            await uow.CompanySettings.AddAsync(record, ct);
        }
        else
        {
            record.Update(json);
            uow.CompanySettings.Update(record);
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SystemConfig,
            EntityType = "CompanySettings",
            EntityId = record.Id,
            Module = "Companies",
            Description = "Firma modülü bildirim şablon ayarları güncellendi.",
            OldValues = oldJson,
            NewValues = json,
        }, ct);

        return dto;
    }

    /// <summary>
    /// Verilen olay için DB'de yapılandırılmış şablon varsa render edilmiş metni, yoksa null döner.
    /// Çağıran taraf null durumunda kendi orijinal sabit metnini kullanmaya devam eder (fallback,
    /// davranış değişikliği yok).
    /// </summary>
    public async Task<string?> TryRenderAsync(string eventKey, CompanyNotificationContext ctx, CancellationToken ct)
    {
        var settings = await GetAsync(ct);
        var tpl = settings.NotificationTemplates?.FirstOrDefault(t => t.Event == eventKey);
        if (tpl is null || !tpl.SmsEnabled || string.IsNullOrWhiteSpace(tpl.SmsBody)) return null;
        return CompanyMessageRenderer.Render(tpl.SmsBody, ctx);
    }

    public async Task<CompanyManualMessageResultDto> SendManualMessageAsync(CompanyManualMessageRequest req, CancellationToken ct)
    {
        if (!req.Sms && !req.Notify)
            throw new ConflictException("En az bir kanal seçin (SMS veya bildirim).", "NO_CHANNEL");

        var companyIds = req.CompanyIds.Distinct().ToList();
        if (companyIds.Count == 0)
            throw new ConflictException("En az bir firma seçmelisiniz.", "NO_TARGET");

        var settings = await GetAsync(ct);
        var template = (settings.NotificationTemplates ?? []).FirstOrDefault(t => t.Event == req.TemplateEvent);
        var bodyTemplate = req.CustomText ?? template?.SmsBody ?? string.Empty;
        var bodyEnabled = (req.CustomText is not null || (template?.SmsEnabled ?? false)) && !string.IsNullOrWhiteSpace(bodyTemplate);

        if (!bodyEnabled)
            throw new ConflictException("Gönderilecek şablon veya metin boş.", "EMPTY_MESSAGE");

        // Şablon/validasyon geçtikten SONRA çağrılır: aksi halde boş şablon gibi
        // başarısız bir istek bile kullanıcının günlük SMS hakkını gereksiz yere
        // tüketirdi (2026-09-19 canlı testte tespit edildi).
        if (req.Sms && bodyEnabled) await smsGovernance.EnsureCanSendAsync("Company", req.TemplateEvent, companyIds.Count, req.SmsOtp, ct);

        var companies = await uow.Companies.FindAsync(c => companyIds.Contains(c.Id), ct);
        if (companies.Count == 0)
            return new CompanyManualMessageResultDto(0, 0, 0, false);

        var recipients = 0;
        var smsSent = 0;
        var notificationsCreated = 0;

        foreach (var company in companies)
        {
            recipients++;
            var body = CompanyMessageRenderer.Render(bodyTemplate, new CompanyNotificationContext(company.Name));

            if (req.Notify)
            {
                await notifications.CreateAsync(company.Id, "Firma Bilgilendirme", body, "company:manual", "company", company.Id.ToString(), company.Name, null, "Bilgilendirme", ct);
                notificationsCreated++;
            }

            if (req.Sms && !string.IsNullOrWhiteSpace(company.Phone))
            {
                try { if (await dispatcher.SendSmsAsync(company.Phone, body, ct)) smsSent++; }
                catch { }
            }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Company",
            Module = "Companies",
            Description = $"Manuel firma mesajı gönderildi: {req.TemplateEvent} ({recipients} alıcı, SMS: {smsSent}, bildirim: {notificationsCreated}).",
        }, ct);

        return new CompanyManualMessageResultDto(recipients, smsSent, notificationsCreated, req.Sms && smsSent > 0 && sms.IsMockMode);
    }
}
