using System.Text.Json;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Services;

public class TravelSettingsService(IUnitOfWork uow, IActivityLogger log) : ITravelSettingsService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Kullanıcı isteği (2026-08-07): birleşik gezi mesaj şablonu sistemi varsayılanları.
    /// Değişkenler: {{ad}} {{soyad}} {{sefer}} {{tarih}} {{saat}} {{guzergah}} {{kalkis_noktasi}}
    /// {{red_nedeni}} {{sira}}. "manual" olayı gerçek bir tetikleyici değildir — toplu/manuel
    /// mesaj ekranında admin'e hazır bir öneri metni sunmak için kullanılır.
    /// </summary>
    public static readonly IReadOnlyList<TravelNotificationTemplateDto> DefaultNotificationTemplates =
    [
        new("application_received", true, "Sayın {{ad}} {{soyad}}, {{sefer}} gezisine başvurunuz alındı.", true, "{{sefer}} gezisine başvurunuz alındı."),
        new("approved", true, "Sayın {{ad}} {{soyad}}, {{sefer}} ({{tarih}} {{saat}}) gezisine kaydınız onaylandı.", true, "{{sefer}} gezisine kaydınız onaylandı."),
        new("rejected", true, "Sayın {{ad}} {{soyad}}, {{sefer}} gezisine başvurunuz maalesef reddedildi.", true, "{{sefer}} gezisine başvurunuz maalesef reddedildi."),
        new("waitlist", true, "Sayın {{ad}} {{soyad}}, {{sefer}} gezisi için yedek listeye alındınız.", true, "{{sefer}} gezisi için yedek listeye alındınız."),
        new("promoted", true, "Sayın {{ad}} {{soyad}}, {{sefer}} gezisinde kontenjan açıldı; koltuk seçip başvurunuzu tamamlayabilirsiniz.", true, "{{sefer}} gezisinde kontenjan açıldı; koltuk seçip başvurunuzu tamamlayabilirsiniz."),
        new("promoted_approved", true, "Sayın {{ad}} {{soyad}}, {{sefer}} gezisinde yer açıldığı için yedek listesinden kaydınız onaylandı; koltuğunuz atandı.", true, "{{sefer}} gezisinde yer açıldığı için yedek listesinden kaydınız onaylandı; koltuğunuz atandı."),
        new("cancelled", true, "Sayın {{ad}} {{soyad}}, {{sefer}} gezisinin {{tarih}} {{saat}} tarihli seferi iptal edilmiştir. Güzergâh: {{guzergah}}. Ayrıntılı bilgi için belediyemizle iletişime geçebilirsiniz.", true, "{{sefer}} gezisinin {{tarih}} {{saat}} tarihli seferi iptal edilmiştir. Güzergâh: {{guzergah}}."),
        new("postponed", true, "Sayın {{ad}} {{soyad}}, {{sefer}} gezisi ertelenmiştir. Güncel tarih ve saat: {{tarih}} {{saat}}. Güzergâh: {{guzergah}}. Kalkış noktası: {{kalkis_noktasi}}.", true, "{{sefer}} gezisi ertelenmiştir. Güncel tarih: {{tarih}} {{saat}}. Kalkış: {{kalkis_noktasi}}."),
        new("emergency", true, "ACİL: Sayın {{ad}} {{soyad}}, {{sefer}} gezisiyle ilgili önemli bir duyuru var. Lütfen belediyeyi arayın.", true, "ACİL DURUM: {{sefer}} gezisiyle ilgili önemli bir duyuru var."),
        new("departure_reminder", true, "Sayın {{ad}} {{soyad}}, {{sefer}} gezisi {{tarih}} {{saat}} tarihinde {{kalkis_noktasi}} noktasından kalkacak. Lütfen zamanında hazır olun.", true, "{{sefer}} gezisi {{tarih}} {{saat}} tarihinde kalkacak. Lütfen zamanında hazır olun."),
        new("manual", true, "Sayın {{ad}} {{soyad}}, {{sefer}} gezisi hakkında bilgilendirme: ", true, "{{sefer}} gezisi hakkında bilgilendirme: "),
    ];

    public async Task<TravelSettingsDto> GetAsync(CancellationToken ct)
    {
        var record = await uow.TravelSettings.GetSingletonAsync(ct);
        if (record is null) return Defaults();

        var templates = Deserialize<List<TravelNotificationTemplateDto>>(record.NotificationTemplatesJson, []);

        return new TravelSettingsDto(
            Deserialize(record.GeneralJson, DefaultGeneral()),
            Deserialize(record.ParticipationJson, DefaultParticipation()),
            Deserialize(record.PaymentJson, DefaultPayment()),
            Deserialize<List<TravelRestrictionRuleDto>>(record.RestrictionsJson, []),
            Deserialize<List<TravelRuleItemDto>>(record.RulesJson, []),
            MergeTemplates(templates));
    }

    public async Task<TravelSettingsDto> SaveAsync(TravelSettingsDto req, CancellationToken ct)
    {
        log.LogStep(nameof(SaveAsync), new { });

        var record = await uow.TravelSettings.GetSingletonAsync(ct);

        var general = JsonSerializer.Serialize(req.General, JsonOpts);
        var participation = JsonSerializer.Serialize(req.Participation, JsonOpts);
        var payment = JsonSerializer.Serialize(req.Payment, JsonOpts);
        var restrictions = JsonSerializer.Serialize(req.Restrictions ?? [], JsonOpts);
        var rules = JsonSerializer.Serialize(req.Rules ?? [], JsonOpts);
        var templates = JsonSerializer.Serialize(req.NotificationTemplates ?? [], JsonOpts);

        if (record is null)
        {
            record = TravelSettingsRecord.Create();
            record.Update(general, participation, payment, restrictions, rules, templates);
            await uow.TravelSettings.AddAsync(record, ct);
        }
        else
        {
            record.Update(general, participation, payment, restrictions, rules, templates);
            uow.TravelSettings.Update(record);
        }

        await uow.SaveChangesAsync(ct);
        return await GetAsync(ct);
    }

    private static T Deserialize<T>(string json, T fallback)
    {
        if (string.IsNullOrWhiteSpace(json)) return fallback;
        try { return JsonSerializer.Deserialize<T>(json, JsonOpts) ?? fallback; }
        catch { return fallback; }
    }

    private static TravelSettingsDto Defaults()
        => new(DefaultGeneral(), DefaultParticipation(), DefaultPayment(), [], [], DefaultNotificationTemplates.ToList());

    private static List<TravelNotificationTemplateDto> MergeTemplates(List<TravelNotificationTemplateDto> existing)
    {
        const string legacyCancelledSms = "Sayın {{ad}} {{soyad}}, {{sefer}} gezisine kaydınız iptal edildi.";
        const string legacyPostponedSms = "Sayın {{ad}} {{soyad}}, {{sefer}} gezisi ertelenmiştir. Yeni tarih: {{tarih}} {{saat}}. Anlayışınız için teşekkür ederiz.";
        return DefaultNotificationTemplates.Select(defaultTemplate =>
        {
            var saved = existing.FirstOrDefault(template => template.Event == defaultTemplate.Event);
            if (saved is null) return defaultTemplate;
            // Yalnız eski sistem varsayılanlarını güncelle; yöneticinin özelleştirdiği metni koru.
            if (saved.Event == "cancelled" && saved.SmsBody == legacyCancelledSms) return defaultTemplate;
            if (saved.Event == "postponed" && saved.SmsBody == legacyPostponedSms) return defaultTemplate;
            return saved;
        }).ToList();
    }

    private static TravelGeneralSettingsDto DefaultGeneral() => new(50, 18, 65, 7, 3, true, true, false, 25, true, 5);
    private static TravelParticipationSettingsDto DefaultParticipation() => new("none", 1, true);
    private static TravelPaymentSettingsDto DefaultPayment() => new(false, 5, 0, "partial");
}
