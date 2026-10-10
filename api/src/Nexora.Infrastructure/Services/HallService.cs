using System.Text.Json;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Halls;
using Nexora.Application.Features.Halls.Dtos;
using Nexora.Domain.Entities.Halls;
using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class HallService(IUnitOfWork uow, IActivityLogger log, ISessionService sessionService, IUserScopeService scopeService, ICurrentUser currentUser, IAuditService audit) : IHallService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<PagedResult<HallDto>> GetPagedAsync(HallListParams p, CancellationToken ct)
    {
        var scopedIds = await scopeService.GetScopedRefIdsAsync(currentUser.Id ?? Guid.Empty, "halls", ct);
        if (scopedIds is not null && scopedIds.Count == 0)
            return new PagedResult<HallDto> { Items = [], Total = 0, Page = p.PageResolved, Limit = p.LimitResolved };

        var paged = await uow.Halls.GetPagedAsync(p, ct, scopedIds);

        return new PagedResult<HallDto>
        {
            Items = paged.Items.Select(ToDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public Task<HallSummaryDto> GetSummaryAsync(HallListParams p, CancellationToken ct)
        => uow.Halls.GetSummaryAsync(p, ct);

    // Yetki alani (scope) kisitli bir kullanicinin, kendi liste ekraninda gormedigi bir
    // salonun ID'sini biliyorsa bile erismesini engeller (IDOR onlemi, bkz. salonlar-idor-
    // 2026-07-30 bulgusu). GetPagedAsync scope'u zaten uyguluyordu ama ID-bazli metotlarin
    // hicbiri bu kontrolu yapmiyordu.
    private async Task EnsureInScopeAsync(Guid id, CancellationToken ct)
    {
        var scopedIds = await scopeService.GetScopedRefIdsAsync(currentUser.Id ?? Guid.Empty, "halls", ct);
        if (scopedIds is not null && !scopedIds.Contains(id))
            throw new NotFoundException("Salon bulunamadı.", "HALL_NOT_FOUND");
    }

    public async Task<HallDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var hall = await uow.Halls.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Salon bulunamadı.", "HALL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);
        return ToDto(hall);
    }

    public async Task<HallDto> CreateAsync(CreateHallRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name, req.FacilityId });

        var facility = await uow.ServiceFacilities.GetByIdAsync(req.FacilityId, ct)
            ?? throw new NotFoundException("Seçilen hizmet tesisi bulunamadı.", "FACILITY_NOT_FOUND");
        EnsureOutdoorAllowed(req.Type, facility);

        var seated = req.SeatingMode == "seated";
        var layoutJson = seated ? SerializeLayout(req.Layout) : null;
        var floorCount = seated ? req.Layout?.Floors.Count ?? 0 : 0;

        var hall = Hall.Create(req.FacilityId, facility.Name, req.Name, req.Type, req.BuildingFloor,
            req.SeatingMode, req.Capacity, floorCount, layoutJson, req.FeatureIds ?? [], req.Description, req.About);

        await uow.Halls.AddAsync(hall, ct);
        await uow.SaveChangesAsync(ct);

        return ToDto(hall);
    }

    public async Task<HallDto> UpdateAsync(Guid id, CreateHallRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var hall = await uow.Halls.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Salon bulunamadı.", "HALL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var facility = await uow.ServiceFacilities.GetByIdAsync(req.FacilityId, ct)
            ?? throw new NotFoundException("Seçilen hizmet tesisi bulunamadı.", "FACILITY_NOT_FOUND");
        EnsureOutdoorAllowed(req.Type, facility);

        var seated = req.SeatingMode == "seated";
        var layoutJson = seated ? SerializeLayout(req.Layout) : null;
        var floorCount = seated ? req.Layout?.Floors.Count ?? 0 : 0;
        // NOT: Ham string karsilastirmasi (hall.LayoutJson != layoutJson) kullanilmiyor.
        // Postgres jsonb sutunu diskte kanonik anahtar sirasiyla saklaniyor; EF Core DB'den
        // okuyunca bu sirayla gelir, ama JsonSerializer.Serialize DTO alan tanim sirasiyla
        // uretiyor. Icerik birebir ayni olsa bile string'ler eslesmiyordu ve layoutChanged
        // her zaman true donup koltuk atamalarini (SetSeatStates(null)) siliyordu (bkz.
        // NEXORA_KAPSAMLI_HATA_RAPORU_2026-08-26.md #10). JsonComparisonHelper anahtar
        // sirasindan bagimsiz semantik karsilastirma yapar.
        var layoutChanged = !JsonComparisonHelper.JsonEquals(hall.LayoutJson, layoutJson);

        hall.Update(req.FacilityId, facility.Name, req.Name, req.Type, req.BuildingFloor,
            req.SeatingMode, req.Capacity, floorCount, layoutJson, req.FeatureIds ?? [], req.Description, req.About);

        if (layoutChanged) hall.SetSeatStates(null);

        uow.Halls.Update(hall);
        await uow.SaveChangesAsync(ct);

        return ToDto(hall);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var hall = await uow.Halls.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Salon bulunamadı.", "HALL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var today = TurkeyTime.TodayDate();
        var upcomingSessions = await uow.Sessions.CountAsync(
            s => s.HallId == id && s.IsActive && s.Date.Date >= today, ct);
        if (upcomingSessions > 0)
            throw new ConflictException(
                $"Bu salona bağlı {upcomingSessions} adet gelecek tarihli aktif seans bulunmaktadır. Salonu silmeden önce bu seansları iptal edin veya salonu pasife alın.",
                "HALL_HAS_UPCOMING_SESSIONS");

        var activeEvents = await uow.Events.CountAsync(
            e => e.HallId == id && e.IsActive && e.EndDate.Date >= today, ct);
        if (activeEvents > 0)
            throw new ConflictException(
                $"Bu salona bağlı {activeEvents} adet aktif etkinlik bulunmaktadır. Salonu silmeden önce bu etkinlikleri kaldırın veya salonu pasife alın.",
                "HALL_HAS_ACTIVE_EVENTS");

        uow.Halls.Delete(hall);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<HallDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var hall = await uow.Halls.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Salon bulunamadı.", "HALL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        if (hall.IsActive)
        {
            hall.Deactivate();
            // Salon pasife alındığında bağlı gelecekteki aktif seanslar da pasife çekilir
            // (bkz. salonlar-cascade-eksigi-2026-07-30 bulgusu, P1) — aksi halde pasif bir
            // salona bağlı etkinlikler sessizce başvuru almaya devam edebiliyordu.
            await sessionService.DeactivateByHallAsync(id, ct);
        }
        else
        {
            hall.Activate();
        }

        uow.Halls.Update(hall);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Hall",
            EntityId = hall.Id,
            Module = "Halls",
            Description = hall.IsActive
                ? $"Salon aktifleştirildi: {hall.Name}"
                : $"Salon pasifleştirildi: {hall.Name}",
        }, ct);

        return ToDto(hall);
    }

    public async Task<Dictionary<string, string>> GetSeatPlanAsync(Guid id, CancellationToken ct)
    {
        var hall = await uow.Halls.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Salon bulunamadı.", "HALL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        if (string.IsNullOrWhiteSpace(hall.SeatStatesJson)) return [];
        return JsonSerializer.Deserialize<Dictionary<string, string>>(hall.SeatStatesJson, JsonOpts) ?? [];
    }

    public async Task SaveSeatPlanAsync(Guid id, SeatPlanRequest req, CancellationToken ct)
    {
        var hall = await uow.Halls.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Salon bulunamadı.", "HALL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var holds = req.States
            .Where(kv => kv.Value is "protocol" or "closed")
            .ToDictionary(kv => kv.Key, kv => kv.Value);
        hall.SetSeatStates(holds.Count == 0 ? null : JsonSerializer.Serialize(holds, JsonOpts));
        uow.Halls.Update(hall);
        await uow.SaveChangesAsync(ct);
        await sessionService.PropagateHallSeatChangeAsync(id, ct);
    }

    public async Task<HallFeatureCatalogDto> GetCatalogAsync(CancellationToken ct)
        => await BuildCatalogAsync(ct);

    // Admin paneli yalnızca bu renkleri çizebiliyor; bilinmeyen renk özellik panelini çökertiyordu.
    private static readonly string[] AllowedGroupColors = ["blue", "green", "orange", "violet", "cyan", "red"];

    private static void EnsureValidGroupColor(string color)
    {
        if (!AllowedGroupColors.Contains(color))
            throw new ValidationException("Geçersiz grup rengi.", new Dictionary<string, string[]> { ["Color"] = ["Geçersiz grup rengi."] });
    }

    public async Task<HallFeatureCatalogDto> CreateGroupAsync(FeatureGroupRequest req, CancellationToken ct)
    {
        EnsureValidGroupColor(req.Color);
        var sort = await uow.HallFeatures.GroupCountAsync(ct);
        await uow.HallFeatures.AddGroupAsync(HallFeatureGroup.Create(GenKey("grp"), req.Name, req.Color, sort), ct);
        await uow.SaveChangesAsync(ct);
        return await BuildCatalogAsync(ct);
    }

    public async Task<HallFeatureCatalogDto> UpdateGroupAsync(string key, FeatureGroupRequest req, CancellationToken ct)
    {
        var group = await uow.HallFeatures.GetGroupByKeyAsync(key, ct)
            ?? throw new NotFoundException("Özellik grubu bulunamadı.", "FEATURE_GROUP_NOT_FOUND");
        EnsureValidGroupColor(req.Color);
        group.Update(req.Name, req.Color);
        uow.HallFeatures.UpdateGroup(group);
        await uow.SaveChangesAsync(ct);
        return await BuildCatalogAsync(ct);
    }

    public async Task<HallFeatureCatalogDto> DeleteGroupAsync(string key, CancellationToken ct)
    {
        var group = await uow.HallFeatures.GetGroupByKeyAsync(key, ct)
            ?? throw new NotFoundException("Özellik grubu bulunamadı.", "FEATURE_GROUP_NOT_FOUND");

        var features = await uow.HallFeatures.GetFeaturesByGroupAsync(key, ct);
        foreach (var f in features) uow.HallFeatures.DeleteFeature(f);
        uow.HallFeatures.DeleteGroup(group);
        await uow.SaveChangesAsync(ct);
        return await BuildCatalogAsync(ct);
    }

    public async Task<HallFeatureCatalogDto> CreateFeatureAsync(FeatureRequest req, CancellationToken ct)
    {
        var sort = await uow.HallFeatures.FeatureCountAsync(ct);
        await uow.HallFeatures.AddFeatureAsync(HallFeature.Create(GenKey("feat"), req.Name, req.Group, sort), ct);
        await uow.SaveChangesAsync(ct);
        return await BuildCatalogAsync(ct);
    }

    public async Task<HallFeatureCatalogDto> UpdateFeatureAsync(string key, FeatureRequest req, CancellationToken ct)
    {
        var feature = await uow.HallFeatures.GetFeatureByKeyAsync(key, ct)
            ?? throw new NotFoundException("Özellik bulunamadı.", "FEATURE_NOT_FOUND");
        feature.Update(req.Name, req.Group);
        uow.HallFeatures.UpdateFeature(feature);
        await uow.SaveChangesAsync(ct);
        return await BuildCatalogAsync(ct);
    }

    public async Task<HallFeatureCatalogDto> DeleteFeatureAsync(string key, CancellationToken ct)
    {
        var feature = await uow.HallFeatures.GetFeatureByKeyAsync(key, ct)
            ?? throw new NotFoundException("Özellik bulunamadı.", "FEATURE_NOT_FOUND");
        uow.HallFeatures.DeleteFeature(feature);
        await uow.SaveChangesAsync(ct);
        return await BuildCatalogAsync(ct);
    }

    public async Task<List<HallFeatureTemplateDto>> GetTemplatesAsync(CancellationToken ct)
    {
        var templates = await uow.HallFeatures.GetTemplatesAsync(ct);
        return templates.Select(ToTemplateDto).ToList();
    }

    public async Task<HallFeatureTemplateDto> CreateTemplateAsync(FeatureTemplateRequest req, CancellationToken ct)
    {
        var template = HallFeatureTemplate.Create(req.Name, req.Description, req.FeatureIds ?? []);
        await uow.HallFeatures.AddTemplateAsync(template, ct);
        await uow.SaveChangesAsync(ct);
        return ToTemplateDto(template);
    }

    public async Task DeleteTemplateAsync(Guid id, CancellationToken ct)
    {
        var template = await uow.HallFeatures.GetTemplateAsync(id, ct)
            ?? throw new NotFoundException("Şablon bulunamadı.", "TEMPLATE_NOT_FOUND");
        uow.HallFeatures.DeleteTemplate(template);
        await uow.SaveChangesAsync(ct);
    }

    private async Task<HallFeatureCatalogDto> BuildCatalogAsync(CancellationToken ct)
    {
        var groups = await uow.HallFeatures.GetGroupsAsync(ct);
        var features = await uow.HallFeatures.GetFeaturesAsync(ct);
        return new HallFeatureCatalogDto(
            groups.Select(g => new HallFeatureGroupDto(g.Key, g.Name, g.Color)).ToList(),
            features.Select(f => new HallFeatureDto(f.Key, f.Name, f.GroupKey)).ToList());
    }

    private static HallFeatureTemplateDto ToTemplateDto(HallFeatureTemplate t)
        => new(t.Id.ToString(), t.Name, t.Description, t.FeatureIds);

    private static void EnsureOutdoorAllowed(string type, ServiceFacility facility)
    {
        if (type == "outdoor" && facility.LocationType != FacilityLocationType.Outdoor)
            throw new ConflictException(
                "Açık hava salonu yalnızca açık hava (outdoor) bir hizmet tesisine eklenebilir.",
                "OUTDOOR_HALL_REQUIRES_OUTDOOR_FACILITY");
    }

    private static string GenKey(string prefix) => $"{prefix}_{Guid.NewGuid():N}"[..(prefix.Length + 11)];

    private static string? SerializeLayout(SeatingLayoutDto? layout)
        => layout is null ? null : JsonSerializer.Serialize(layout, JsonOpts);

    private static SeatingLayoutDto? DeserializeLayout(string? json)
        => string.IsNullOrWhiteSpace(json) ? null : JsonSerializer.Deserialize<SeatingLayoutDto>(json, JsonOpts);

    private static readonly HashSet<string> OccupiedStatuses = ["reserved", "protocol", "closed"];

    private static int CountOccupied(string? seatStatesJson)
    {
        if (string.IsNullOrWhiteSpace(seatStatesJson)) return 0;
        var states = JsonSerializer.Deserialize<Dictionary<string, string>>(seatStatesJson, JsonOpts);
        return states is null ? 0 : states.Values.Count(v => OccupiedStatuses.Contains(v));
    }

    private static HallDto ToDto(Hall h)
    {
        var available = Math.Max(0, h.Capacity - CountOccupied(h.SeatStatesJson));
        return new(h.Id, h.Name, h.FacilityId, h.FacilityName, h.Type, h.BuildingFloor, h.SeatingMode,
            h.Capacity, available, h.FloorCount, DeserializeLayout(h.LayoutJson), h.FeatureIds,
            h.Description, h.About, h.IsActive, h.CreatedAt);
    }
}
