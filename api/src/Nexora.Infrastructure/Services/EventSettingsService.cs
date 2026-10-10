using System.Text.Json;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class EventSettingsService(IUnitOfWork uow, IAuditService audit) : IEventSettingsService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public static readonly IReadOnlyList<EventNotificationTemplateDto> DefaultNotificationTemplates =
    [
        new("application_received", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz alındı.", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz alındı."),
        new("application_reviewing", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz değerlendiriliyor.", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz değerlendiriliyor."),
        new("application_approved", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} ({{tarih}}) etkinliğine başvurunuz onaylandı.", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} ({{tarih}}) etkinliğine başvurunuz onaylandı."),
        new("application_registered", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} ({{tarih}}) etkinliğine kaydınız yapıldı.", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} ({{tarih}}) etkinliğine kaydınız yapıldı."),
        new("application_rejected", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz reddedildi. {{red_nedeni}}", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz reddedildi. {{red_nedeni}}"),
        new("application_waitlisted", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliği kontenjanı dolu olduğu için yedek listesine {{sira}}. sırada alındınız.", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliği kontenjanı dolu olduğu için yedek listesine {{sira}}. sırada alındınız."),
        new("registration_cancelled", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine kaydınız iptal edildi.", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine kaydınız iptal edildi."),
        new("postponed", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliği ertelenmiştir. Yeni tarih: {{tarih}}. Anlayışınız için teşekkür ederiz.", true, "Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliği ertelenmiştir. Yeni tarih: {{tarih}}. Anlayışınız için teşekkür ederiz."),
        new("emergency", true, "ACİL: Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğiyle ilgili önemli bir duyuru var. Lütfen belediyeyi arayın.", true, "ACİL: Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğiyle ilgili önemli bir duyuru var. Lütfen belediyeyi arayın."),
    ];

    public async Task<EventSettingsDto> GetAsync(CancellationToken ct)
    {
        var record = await uow.EventSettings.GetCurrentAsync(ct);
        if (record is null) return Default();

        var dto = JsonSerializer.Deserialize<EventSettingsDto>(record.ConfigJson, JsonOpts) ?? Default();
        // Kullanıcı isteği (2026-08-08): yeni bir şablon olayı (ör. postponed/emergency) eklendiğinde,
        // daha önce kaydedilmiş ayarlarda (Count > 0) bu yeni olay hiç bulunmadığı için admin panelde
        // hiç görünmüyordu (SettingsTab.tsx if (!tpl) return null). Eksik olaylar varsayılanla
        // tamamlanır — Travel modülündeki aynı deseni (mergeTravelNotificationTemplates) izler.
        var existing = dto.NotificationTemplates ?? [];
        var merged = DefaultNotificationTemplates
            .Select(def =>
            {
                var found = existing.FirstOrDefault(t => t.Event == def.Event);
                if (found is null) return def;
                // Kullanıcı isteği (2026-10-06): bu kayıt push alanları eklenmeden ÖNCE kaydedilmişse
                // (eski JSON'da notifyBody hiç yoktu) deserialize sırasında boş string'e düşer — admin
                // ayarlar ekranını yeniden kaydetmeden push hiç gitmez. SMS metniyle aynı içeriğe
                // düşürülüyor (Facility'deki FindTemplate'in aynı geriye-dönük-uyum davranışı).
                return string.IsNullOrWhiteSpace(found.NotifyBody) ? found with { NotifyBody = found.SmsBody } : found;
            })
            .ToList();
        return dto with { NotificationTemplates = merged };
    }

    public async Task<EventSettingsDto> SaveAsync(EventSettingsDto dto, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(dto, JsonOpts);
        var record = await uow.EventSettings.GetCurrentAsync(ct);
        var oldJson = record?.ConfigJson;

        if (record is null)
        {
            record = EventSettingsRecord.Create(json);
            await uow.EventSettings.AddAsync(record, ct);
        }
        else
        {
            record.Update(json);
            uow.EventSettings.Update(record);
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SystemConfig,
            EntityType = "EventSettings",
            EntityId = record.Id,
            Module = "Events",
            Description = "Etkinlik modülü ayarları güncellendi.",
            OldValues = oldJson,
            NewValues = json,
        }, ct);

        return dto;
    }

    private static EventSettingsDto Default() => new(
        General: new GeneralSettingsDto(0, 99, 20, 24, true, true, false),
        Participation: new ParticipationSettingsDto("weekly", 1, true, true, false),
        Notifications: new NotificationSettingsDto(true, false, true, true, true, false, true),
        Attendance: new AttendanceSettingsDto(true, true, true, 15, 60, true, true, 60, 180),
        Qr: new QrSettingsDto("rotating", 60, true, true, true, true, false),
        Images: new ImageSettingsDto(
            CropEnabled: true,
            AutoCompress: true,
            EnforceWebSpecs: true,
            EnforceMobileSpecs: true,
            Web: new ImageVariantsDto(
                new ImageSpecDto(1920, 720, 800),
                new ImageSpecDto(600, 400, 200),
                new ImageSpecDto(240, 240, 80)),
            Mobile: new ImageVariantsDto(
                new ImageSpecDto(1080, 1350, 600),
                new ImageSpecDto(750, 750, 250),
                new ImageSpecDto(320, 320, 100))),
        NotificationTemplates: DefaultNotificationTemplates
    );
}
