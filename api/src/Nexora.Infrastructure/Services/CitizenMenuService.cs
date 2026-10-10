using System.Text.Json;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenMenu;
using Nexora.Application.Features.CitizenMenu.Dtos;
using Nexora.Domain.Entities.CitizenMenu;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class CitizenMenuService(IUnitOfWork uow, IAuditService audit) : ICitizenMenuService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<CitizenMenuDto> GetAsync(CancellationToken ct)
    {
        var setting = await uow.CitizenMenuSettings.GetSingletonAsync(ct);
        if (setting is null)
            return new CitizenMenuDto(CitizenMenuDefaults.Items);

        var stored = Deserialize(setting.ItemsJson);
        return new CitizenMenuDto(MergeWithDefaults(stored));
    }

    public async Task<CitizenMenuDto> UpdateAsync(UpdateCitizenMenuRequest req, CancellationToken ct)
    {
        var lockedKeys = CitizenMenuDefaults.Items.Where(d => d.Locked).Select(d => d.Key).ToHashSet();
        var normalized = req.Items
            .Select((i, index) => new CitizenMenuItemDto(
                i.Key,
                lockedKeys.Contains(i.Key) || i.Visible,
                index,
                lockedKeys.Contains(i.Key)))
            .ToList();

        var merged = MergeWithDefaults(normalized);
        var json = JsonSerializer.Serialize(merged, JsonOpts);

        var setting = await uow.CitizenMenuSettings.GetSingletonAsync(ct);
        if (setting is null)
        {
            setting = CitizenMenuSetting.Create(json);
            await uow.CitizenMenuSettings.AddAsync(setting, ct);
        }
        else
        {
            setting.Update(json);
            uow.CitizenMenuSettings.Update(setting);
        }
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "CitizenMenuSetting",
            EntityId = setting.Id,
            Module = "Settings",
            Description = "Vatandaş portalı menüsü güncellendi.",
        }, ct);

        return new CitizenMenuDto(merged);
    }

    private static List<CitizenMenuItemDto> Deserialize(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<List<CitizenMenuItemDto>>(json, JsonOpts) ?? []; }
        catch { return []; }
    }

    private static List<CitizenMenuItemDto> MergeWithDefaults(List<CitizenMenuItemDto> items)
    {
        var byKey = items.Where(i => CitizenMenuDefaults.Items.Any(d => d.Key == i.Key))
            .GroupBy(i => i.Key).ToDictionary(g => g.Key, g => g.First());

        var missing = CitizenMenuDefaults.Items.Where(d => !byKey.ContainsKey(d.Key));
        var ordered = byKey.Values.OrderBy(i => i.Order).Concat(missing).ToList();

        return ordered
            .Select((i, index) =>
            {
                var def = CitizenMenuDefaults.Items.First(d => d.Key == i.Key);
                return new CitizenMenuItemDto(i.Key, def.Locked || i.Visible, index, def.Locked);
            })
            .ToList();
    }
}
