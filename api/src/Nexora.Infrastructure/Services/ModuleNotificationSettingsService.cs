using System.Text.Json;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-08-11): Quiz/Anket/Çark(Hediye)/Muhtarlık modülleri için paylaşılan
/// şablon ayar servisi. Company/Event/Facility'deki "admin hiç şablon girmese davranış
/// değişmez" deseni birebir korunur: her modülün gömülü varsayılan şablonu vardır, admin
/// düzenlediğinde DB'deki kayıt bu varsayılanların üzerine merge edilir.
/// </summary>
public class ModuleNotificationSettingsService(IUnitOfWork uow) : IModuleNotificationSettingsService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private static readonly IReadOnlyDictionary<string, IReadOnlyList<ModuleNotificationTemplateDto>> Defaults =
        new Dictionary<string, IReadOnlyList<ModuleNotificationTemplateDto>>
        {
            ["quiz"] =
            [
                new("manual", true, "Sayın {{ad}} {{soyad}}, {{yarisma}} bilgi yarışması hakkında bilgilendirme: ", true, "{{yarisma}} bilgi yarışması hakkında bilgilendirme: "),
                new("result_announced", true, "Sayın {{ad}} {{soyad}}, {{yarisma}} yarışmasındaki puanınız: {{puan}}.", true, "{{yarisma}} yarışmasındaki puanınız: {{puan}}."),
            ],
            ["survey"] =
            [
                new("manual", true, "Sayın {{ad}} {{soyad}}, {{anket}} anketi hakkında bilgilendirme: ", true, "{{anket}} anketi hakkında bilgilendirme: "),
                new("thank_you", true, "Sayın {{ad}} {{soyad}}, {{anket}} anketine katılımınız için teşekkür ederiz.", true, "{{anket}} anketine katılımınız için teşekkür ederiz."),
            ],
            ["wheel"] =
            [
                new("manual", true, "Sayın {{ad}} {{soyad}}, {{hediye}} talebiniz hakkında bilgilendirme: ", true, "{{hediye}} talebiniz hakkında bilgilendirme: "),
                new("winner_announced", true, "Sayın {{ad}} {{soyad}}, tebrikler! {{hediye}} hediyesini kazandınız (sıra: {{sira_no}}).", true, "Tebrikler! {{hediye}} hediyesini kazandınız (sıra: {{sira_no}})."),
            ],
            ["muhtarlik"] =
            [
                new("manual", true, "Sayın {{ad}} {{soyad}}, {{talep_no}} numaralı talebiniz hakkında bilgilendirme: ", true, "{{talep_no}} numaralı talebiniz hakkında bilgilendirme: "),
                new("resolved", true, "Sayın {{ad}} {{soyad}}, {{talep_no}} numaralı talebiniz ({{kategori}}) çözüldü.", true, "{{talep_no}} numaralı talebiniz ({{kategori}}) çözüldü."),
            ],
        };

    public IReadOnlyList<ModuleNotificationTemplateDto> GetDefaults(string module)
        => Defaults.TryGetValue(module, out var list) ? list : [];

    public async Task<ModuleNotificationSettingsDto> GetAsync(string module, CancellationToken ct)
    {
        var record = await uow.ModuleNotificationSettings.GetByModuleAsync(module, ct);
        var dto = record is null
            ? new ModuleNotificationSettingsDto(null)
            : JsonSerializer.Deserialize<ModuleNotificationSettingsDto>(record.ConfigJson, JsonOpts) ?? new ModuleNotificationSettingsDto(null);

        var existing = dto.NotificationTemplates ?? [];
        var merged = GetDefaults(module)
            .Select(def => existing.FirstOrDefault(t => t.Event == def.Event) ?? def)
            .ToList();
        return new ModuleNotificationSettingsDto(merged);
    }

    public async Task<ModuleNotificationSettingsDto> SaveAsync(string module, ModuleNotificationSettingsDto dto, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(dto, JsonOpts);
        var record = await uow.ModuleNotificationSettings.GetByModuleAsync(module, ct);
        if (record is null)
        {
            record = ModuleNotificationSettings.Create(module, json);
            await uow.ModuleNotificationSettings.AddAsync(record, ct);
        }
        else
        {
            record.Update(json);
            uow.ModuleNotificationSettings.Update(record);
        }
        await uow.SaveChangesAsync(ct);
        return await GetAsync(module, ct);
    }
}
