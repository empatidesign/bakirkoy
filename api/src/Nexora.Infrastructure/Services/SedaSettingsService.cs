using System.Text.Json;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Seda;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class SedaSettingsService(IUnitOfWork uow, IActivityLogger log, IAuditService audit) : ISedaSettingsService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public static readonly IReadOnlyList<SedaNotificationTemplateDto> DefaultNotificationTemplates =
    [
        new("application_received", true, "Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA eğitim başvurunuz alınmıştır.", true, "{{ogrenci_adi}} için SEDA eğitim başvurunuz alınmıştır."),
        new("approved", true, "Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA eğitim başvurunuz onaylandı. Sınav merkezi: {{sinav_merkezi}}.", true, "{{ogrenci_adi}} için SEDA eğitim başvurunuz onaylandı."),
        new("rejected", true, "Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA eğitim başvurunuz reddedildi. {{red_nedeni}}", true, "{{ogrenci_adi}} için SEDA eğitim başvurunuz reddedildi. {{red_nedeni}}"),
        new("cancelled", true, "Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA eğitim başvurunuz iptal edildi.", true, "{{ogrenci_adi}} için SEDA eğitim başvurunuz iptal edildi."),
        new("postponed", true, "Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için planlanan SEDA sınav/eğitim süreci ertelenmiştir. Yeni bilgilendirme ayrıca yapılacaktır.", true, "{{ogrenci_adi}} için SEDA sınav/eğitim süreci ertelenmiştir."),
        new("emergency", true, "ACİL: Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA süreciyle ilgili önemli bir duyuru vardır. Lütfen belediye ile iletişime geçiniz.", true, "ACİL DURUM: {{ogrenci_adi}} için SEDA süreciyle ilgili önemli duyuru vardır."),
        new("manual", true, "Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA eğitim süreci hakkında bilgilendirme: ", true, "{{ogrenci_adi}} için SEDA eğitim süreci hakkında bilgilendirme: "),
    ];

    public async Task<SedaSettingsDto> GetAsync(CancellationToken ct)
    {
        var settings = await EnsureSettingsAsync(ct);
        return await BuildDtoAsync(settings, ct);
    }

    public async Task<SedaSettingsDto> UpdateAsync(UpdateSedaSettingsRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), req);

        var settings = await EnsureSettingsAsync(ct);
        var oldValues = JsonSerializer.Serialize(new { settings.ApplicationsOpen, settings.RequireApproval, settings.AutoCloseWhenFull, settings.NotificationTemplatesJson });
        var templatesJson = req.NotificationTemplates is null ? null : JsonSerializer.Serialize(req.NotificationTemplates, JsonOpts);

        settings.Update(
            req.ApplicationsOpen ?? settings.ApplicationsOpen,
            req.RequireApproval ?? settings.RequireApproval,
            req.AutoCloseWhenFull ?? settings.AutoCloseWhenFull,
            templatesJson);

        uow.SedaSettings.Update(settings);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SystemConfig,
            EntityType = "SedaSetting",
            EntityId = settings.Id,
            Module = "Seda",
            Description = "SEDA modül ayarları güncellendi.",
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(new { settings.ApplicationsOpen, settings.RequireApproval, settings.AutoCloseWhenFull, settings.NotificationTemplatesJson }),
        }, ct);

        return await BuildDtoAsync(settings, ct);
    }

    private async Task<SedaSetting> EnsureSettingsAsync(CancellationToken ct)
    {
        var settings = await uow.SedaSettings.GetSingletonAsync(ct);
        if (settings is not null) return settings;

        settings = SedaSetting.CreateDefault();
        await uow.SedaSettings.AddAsync(settings, ct);
        await uow.SaveChangesAsync(ct);
        return settings;
    }

    private async Task<SedaSettingsDto> BuildDtoAsync(SedaSetting settings, CancellationToken ct)
    {
        var active = await uow.SedaPeriods.GetActiveAsync(ct);
        SedaPeriodDto? activeDto = null;
        if (active is not null)
        {
            var current = await uow.SedaApplications.CountByPeriodAsync(active.Id, ct);
            activeDto = new SedaPeriodDto(active.Id, active.Name, active.StartDate, active.EndDate,
                active.MaxApplications, current, active.Description, active.IsActive);
        }

        var savedTemplates = Deserialize<List<SedaNotificationTemplateDto>>(settings.NotificationTemplatesJson, []);
        var templates = MergeNotificationTemplates(savedTemplates);
        return new SedaSettingsDto(settings.ApplicationsOpen, settings.RequireApproval, settings.AutoCloseWhenFull, activeDto, templates);
    }

    private static List<SedaNotificationTemplateDto> MergeNotificationTemplates(List<SedaNotificationTemplateDto> saved)
    {
        var byEvent = saved.GroupBy(t => t.Event).ToDictionary(g => g.Key, g => g.Last());
        return DefaultNotificationTemplates.Select(d => byEvent.TryGetValue(d.Event, out var current) ? current : d).ToList();
    }

    private static T Deserialize<T>(string json, T fallback)
    {
        if (string.IsNullOrWhiteSpace(json)) return fallback;
        try { return JsonSerializer.Deserialize<T>(json, JsonOpts) ?? fallback; }
        catch { return fallback; }
    }
}
