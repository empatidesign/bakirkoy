using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class TravelRouteService(IUnitOfWork uow, IActivityLogger log, ICurrentUser currentUser, IUserScopeService userScope, IAuditService audit) : ITravelRouteService
{
    public async Task<PagedResult<TravelRouteDto>> GetPagedAsync(TravelRouteListParams p, CancellationToken ct)
    {
        var paged = await uow.TravelRoutes.GetPagedAsync(p, ct);
        return await MapPageAsync(paged, ct);
    }

    public async Task<List<TravelRouteOptionDto>> GetOptionsAsync(string? search, CancellationToken ct)
    {
        var items = await uow.TravelRoutes.GetOptionsAsync(search, ct);
        return items.Select(r => new TravelRouteOptionDto(r.Id, r.Name, r.Destination)).ToList();
    }

    public async Task<TravelRouteDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var r = await uow.TravelRoutes.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_ROUTE_NOT_FOUND");
        var stats = await uow.Travels.GetStatsByRoutesAsync([id], ct);
        var (total, active) = stats.GetValueOrDefault(id);
        return await ToDtoAsync(r, total, active, ct);
    }

    public async Task<TravelRouteDto> CreateAsync(TravelRouteFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (!await uow.TravelCategories.AnyAsync(c => c.Id == req.CategoryId, ct))
            throw new NotFoundException("Kategori bulunamadı.", "TRAVEL_CATEGORY_NOT_FOUND");

        var route = TravelRoute.Create(ToData(req), null);

        await uow.TravelRoutes.AddAsync(route, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "TravelRoute",
            EntityId = route.Id,
            Module = "Travels",
            Description = $"Gezi rotası oluşturuldu: {route.Name}",
        }, ct);

        return await ToDtoAsync(route, 0, 0, ct);
    }

    public async Task<TravelRouteDto> UpdateAsync(Guid id, TravelRouteFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var route = await uow.TravelRoutes.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_ROUTE_NOT_FOUND");

        if (!await uow.TravelCategories.AnyAsync(c => c.Id == req.CategoryId, ct))
            throw new NotFoundException("Kategori bulunamadı.", "TRAVEL_CATEGORY_NOT_FOUND");

        var routeBefore = JsonSerializer.Serialize(new { route.Name, route.Destination, route.CategoryId, route.IsActive });

        route.Update(ToData(req), null);
        uow.TravelRoutes.Update(route);

        // Route içeriği sefer bazında override edilemez — bağlı tüm Seferlerin
        // denormalize kopyasını (isim/hedef/açıklama/kural/yaş-cinsiyet/kısıtlar/
        // görsel/fiyat/puan) senkronize et. Tarih/kapasite/ekip/otobüs/durum
        // sefere özgüdür, dokunulmaz.
        var linkedTravels = (await uow.Travels.FindAsync(t => t.RouteId == id, ct)).ToList();
        foreach (var t in linkedTravels)
        {
            t.SyncFromRoute(route);
            uow.Travels.Update(t);
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "TravelRoute",
            EntityId = route.Id,
            Module = "Travels",
            Description = $"Gezi rotası güncellendi: {route.Name} — bağlı {linkedTravels.Count} sefer senkronize edildi",
            OldValues = routeBefore,
            NewValues = JsonSerializer.Serialize(new { route.Name, route.Destination, route.CategoryId, route.IsActive }),
        }, ct);

        var stats = await uow.Travels.GetStatsByRoutesAsync([id], ct);
        var (total, active) = stats.GetValueOrDefault(id);
        return await ToDtoAsync(route, total, active, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var route = await uow.TravelRoutes.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_ROUTE_NOT_FOUND");

        if (await uow.Travels.CountByRouteAsync(id, ct) > 0)
            throw new ConflictException("Bu geziye tanımlı sefer bulunduğu için silinemez.", "TRAVEL_ROUTE_IN_USE");

        route.MarkDeleted(null);
        uow.TravelRoutes.Update(route);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "TravelRoute",
            EntityId = route.Id,
            Module = "Travels",
            Description = $"Gezi rotası silindi: {route.Name}",
        }, ct);
    }

    public async Task<TravelRouteDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var route = await uow.TravelRoutes.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_ROUTE_NOT_FOUND");

        if (route.IsActive) route.Deactivate(); else route.Activate();

        uow.TravelRoutes.Update(route);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "TravelRoute",
            EntityId = route.Id,
            Module = "Travels",
            Description = route.IsActive
                ? $"Gezi rotası aktifleştirildi: {route.Name}"
                : $"Gezi rotası pasifleştirildi: {route.Name}",
        }, ct);

        var stats = await uow.Travels.GetStatsByRoutesAsync([id], ct);
        var (total, active) = stats.GetValueOrDefault(id);
        return await ToDtoAsync(route, total, active, ct);
    }

    public async Task<PagedResult<TravelDto>> GetTravelsAsync(Guid routeId, TravelListParams p, CancellationToken ct)
    {
        if (!await uow.TravelRoutes.AnyAsync(r => r.Id == routeId, ct))
            throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_ROUTE_NOT_FOUND");

        var scoped = new TravelListParams
        {
            Page = p.Page,
            Limit = p.Limit,
            Search = p.Search,
            RouteId = routeId,
            IsActive = p.IsActive,
            StartDate = p.StartDate,
            EndDate = p.EndDate,
            Sort = p.Sort,
            Order = p.Order,
        };

        var scopedRefIds = currentUser.Id is Guid uid
            ? await userScope.GetScopedRefIdsAsync(uid, "travels", ct)
            : null;

        var paged = await uow.Travels.GetPagedAsync(scoped, scopedRefIds, ct);
        var catIds = paged.Items.Select(e => e.CategoryId).Distinct().ToList();
        var cats = catIds.Count == 0
            ? new Dictionary<Guid, TravelCategory>()
            : (await uow.TravelCategories.FindAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id);

        return new PagedResult<TravelDto>
        {
            Items = paged.Items.Select(e => MapTravel(e, cats.GetValueOrDefault(e.CategoryId)?.Name ?? "", cats.GetValueOrDefault(e.CategoryId)?.Color ?? "")).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    private static TravelRouteData ToData(TravelRouteFormRequest r)
        => new(
            r.Name, r.CategoryId, r.Destination ?? "", r.Latitude, r.Longitude,
            r.Description ?? "", r.Conditions ?? "", r.InternalNote ?? "",
            r.Gender, r.MinAge, r.MaxAge,
            RawOrEmpty(r.Restrictions), RawOrEmpty(r.Images), RawOrEmpty(r.Pricing), RawOrEmpty(r.Points),
            r.SultangaziResidentOnly,
            r.DeparturePoint ?? "",
            // SORUN 4 düzeltmesi (2026-08-07): request'te IsActive zaten vardı, sadece buraya
            // hiç map edilmiyordu — bu yüzden formdaki "Aktif" toggle'ı backend'e hiç ulaşmıyordu.
            r.IsActive);

    private static string RawOrEmpty(JsonElement el)
        => el.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null ? "{}" : el.GetRawText();

    private async Task<PagedResult<TravelRouteDto>> MapPageAsync(PagedResult<TravelRoute> paged, CancellationToken ct)
    {
        var catIds = paged.Items.Select(e => e.CategoryId).Distinct().ToList();
        var cats = catIds.Count == 0
            ? new Dictionary<Guid, TravelCategory>()
            : (await uow.TravelCategories.FindAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id);

        var routeIds = paged.Items.Select(e => e.Id).ToList();
        var stats = routeIds.Count == 0
            ? new Dictionary<Guid, (int Total, int Active)>()
            : await uow.Travels.GetStatsByRoutesAsync(routeIds, ct);

        return new PagedResult<TravelRouteDto>
        {
            Items = paged.Items.Select(e =>
            {
                var (total, active) = stats.GetValueOrDefault(e.Id);
                var cat = cats.GetValueOrDefault(e.CategoryId);
                return Map(e, cat?.Name ?? "", cat?.Color ?? "", total, active);
            }).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    private async Task<TravelRouteDto> ToDtoAsync(TravelRoute e, int total, int active, CancellationToken ct)
    {
        var cat = await uow.TravelCategories.GetByIdAsync(e.CategoryId, ct);
        return Map(e, cat?.Name ?? "", cat?.Color ?? "", total, active);
    }

    private static TravelRouteDto Map(TravelRoute e, string categoryName, string categoryColor, int travelCount, int activeTravelCount)
        => new(
            e.Id, e.Name, e.CategoryId, categoryName, categoryColor,
            e.Destination, e.Latitude, e.Longitude, e.Description, e.Conditions, e.InternalNote,
            e.Gender, e.MinAge, e.MaxAge,
            ParseJson(e.RestrictionsJson), ParseJson(FileUrl.NormalizeImagesJson(e.ImagesJson)), ParseJson(e.PricingJson), ParseJson(e.PointsJson),
            e.IsActive, e.SultangaziResidentOnly, e.DeparturePoint,
            travelCount, activeTravelCount,
            e.CreatedAt, e.UpdatedAt);

    private static TravelDto MapTravel(Travel e, string categoryName, string categoryColor)
        => new(
            e.Id, e.Code, e.RouteId, e.Name, e.CategoryId, categoryName, categoryColor,
            e.Destination, e.Latitude, e.Longitude, e.Description, e.Conditions, e.InternalNote,
            e.StartDate, e.EndDate, e.RegistrationStartDate, e.RegistrationEndDate,
            e.Gender, e.MinAge, e.MaxAge,
            e.Capacity, e.RegisteredCount, e.ReserveCount, e.ReserveCapacity,
            e.ParticipationPeriod, e.ParticipationLimit, e.ExemptFromParticipationLimit, e.CancellationDeadlineHours,
            ParseJson(e.RestrictionsJson), ParseJson(FileUrl.NormalizeImagesJson(e.ImagesJson)), ParseJson(e.PricingJson), ParseJson(e.PointsJson),
            ParseJson(e.CrewJson),
            e.BusCount, e.IsActive, e.SultangaziResidentOnly, e.DeparturePoint,
            e.CreatedAt, e.UpdatedAt, e.DeletedAt, e.DeletedBy);

    private static JsonElement ParseJson(string json)
        => JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json).RootElement.Clone();
}
