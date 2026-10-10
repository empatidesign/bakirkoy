using System.Text.Json;
using Nexora.Domain.Common;
using Nexora.Application.Common;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Public;
using Nexora.Application.Features.Public.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class PublicCatalogService(IUnitOfWork uow) : IPublicCatalogService
{


    public async Task<IReadOnlyList<PublicServiceFacilityDto>> GetFacilitiesAsync(PublicFacilityQuery q, CancellationToken ct)
    {
        var facilities = await uow.ServiceFacilities.GetPublicDiscoverAsync(q, ct);
        return facilities.Select(MapFacility).ToList();
    }

    public async Task<PublicServiceFacilityDto?> GetFacilityAsync(Guid id, CancellationToken ct)
    {
        var f = await uow.ServiceFacilities.GetByIdAsync(id, ct);
        if (f is null || f.Status != FacilityStatus.Active) return null;
        return MapFacility(f);
    }

    public async Task<IReadOnlyList<PublicFacilityMapPointDto>> GetFacilityMapPointsAsync(CancellationToken ct)
    {
        var facilities = await uow.ServiceFacilities.FindAsync(
            f => f.Status == FacilityStatus.Active && f.Latitude != null && f.Longitude != null, ct);
        return facilities
            .OrderBy(f => f.Name)
            .Select(f => new PublicFacilityMapPointDto(
                f.Id, f.Name, f.Type, f.Latitude!.Value, f.Longitude!.Value,
                NullIfEmpty(f.District), PrimaryImageUrl(f.Images)))
            .ToList();
    }

    private static PublicServiceFacilityDto MapFacility(ServiceFacility f)
    {
        var services = f.OfferedServices
            .Where(s => s.Active)
            .Select(s => new PublicServiceOfferingDto(s.Name, s.Module, NullIfEmpty(s.Description)))
            .ToList();

        var images = f.Images
            .Select(i => new PublicFacilityImageDto(ImageUrl(i) ?? "", NullIfEmpty(i.Name), i.IsPrimary))
            .Where(i => !string.IsNullOrWhiteSpace(i.Url))
            .ToList();

        var hours = HasAny(f.WeekdayOpen, f.WeekdayClose, f.WeekendOpen, f.WeekendClose)
            ? new PublicWorkingHoursDto(NullIfEmpty(f.WeekdayOpen), NullIfEmpty(f.WeekdayClose), NullIfEmpty(f.WeekendOpen), NullIfEmpty(f.WeekendClose))
            : null;

        return new PublicServiceFacilityDto(
            f.Id,
            f.Name,
            f.Type,
            f.LocationType.ToString(),
            f.OutdoorCategory?.ToString(),
            f.AreaSizeM2,
            NullIfEmpty(f.Description),
            NullIfEmpty(f.About),
            NullIfEmpty(f.City),
            NullIfEmpty(f.District),
            NullIfEmpty(f.Address),
            f.Latitude,
            f.Longitude,
            NullIfEmpty(f.EmergencyPhone),
            NullIfEmpty(f.Website),
            NullIfEmpty(f.Facebook),
            NullIfEmpty(f.Instagram),
            NullIfEmpty(f.Twitter),
            hours,
            f.Facilities ?? [],
            f.AccessibilityFeatures ?? [],
            f.ParkingCapacity > 0 ? f.ParkingCapacity : null,
            f.ParkingType.ToString(),
            f.Capacity,
            services,
            images,
            PrimaryImageUrl(f.Images),
            f.UpdatedAt);
    }


    public async Task<IReadOnlyList<PublicEventDto>> GetEventsAsync(PublicEventQuery q, CancellationToken ct)
    {
        var pageItems = await uow.Events.GetPublicDiscoverAsync(q, TurkeyTime.NowWallClock(), ct);
        return await MapEventsAsync(pageItems, ct);
    }

    public async Task<PublicEventDto?> GetEventAsync(Guid id, CancellationToken ct)
    {
        var e = await uow.Events.GetByIdAsync(id, ct);
        if (e is null || !e.IsActive) return null;
        return (await MapEventsAsync([e], ct)).FirstOrDefault();
    }

    public async Task<IReadOnlyList<PublicEventSessionDto>> GetEventSessionsAsync(Guid eventId, CancellationToken ct)
    {
        var e = await uow.Events.GetByIdAsync(eventId, ct);
        if (e is null || !e.IsActive) return [];
        var sessions = await uow.Sessions.GetByEventAsync(eventId, ct);
        return sessions
            .Where(s => s.Date.Date >= TurkeyTime.TodayDate())
            .OrderBy(s => s.Date).ThenBy(s => s.StartTime)
            .Select(s => new PublicEventSessionDto(s.Id, s.Date, s.StartTime, s.EndTime, !s.IsActive))
            .ToList();
    }

    public async Task<IReadOnlyList<PublicEventCategoryDto>> GetEventCategoriesAsync(CancellationToken ct)
    {
        var categories = await uow.EventCategories.GetActiveAsync(ct);
        var ids = categories.Select(c => c.Id).ToList();
        var counts = ids.Count > 0 ? await uow.Events.CountByCategoriesAsync(ids, ct) : new();
        return categories
            .OrderBy(c => c.Name)
            .Select(c => new PublicEventCategoryDto(c.Id, c.Name, NullIfEmpty(c.Color), counts.GetValueOrDefault(c.Id, 0)))
            .ToList();
    }

    public async Task<IReadOnlyList<PublicEventCalendarDayDto>> GetEventCalendarAsync(DateTime from, DateTime to, CancellationToken ct)
    {
        var events = await GetEventsAsync(new PublicEventQuery(From: from, To: to, IncludePast: true, Limit: 200), ct);
        return events
            .GroupBy(e => e.StartDate.Date)
            .OrderBy(g => g.Key)
            .Select(g => new PublicEventCalendarDayDto(g.Key, g.OrderBy(e => e.StartTime).ToList()))
            .ToList();
    }

    private async Task<List<PublicEventDto>> MapEventsAsync(List<Event> events, CancellationToken ct)
    {
        if (events.Count == 0) return [];

        var categoryIds = events.Select(e => e.CategoryId).Distinct().ToList();
        var categories = (await uow.EventCategories.GetActiveAsync(ct)).ToDictionary(c => c.Id);

        var facilityIds = events.Where(e => e.FacilityId.HasValue).Select(e => e.FacilityId!.Value).Distinct().ToList();
        var facilities = facilityIds.Count > 0
            ? (await uow.ServiceFacilities.FindAsync(f => facilityIds.Contains(f.Id), ct)).ToDictionary(f => f.Id)
            : new();

        var hallIds = events.Where(e => e.HallId.HasValue).Select(e => e.HallId!.Value).Distinct().ToList();
        var halls = hallIds.Count > 0
            ? (await uow.Halls.FindAsync(h => hallIds.Contains(h.Id), ct)).ToDictionary(h => h.Id)
            : new();

        return events.Select(e =>
        {
            categories.TryGetValue(e.CategoryId, out var cat);
            var fac = e.FacilityId.HasValue && facilities.TryGetValue(e.FacilityId.Value, out var f) ? f : null;
            var hall = e.HallId.HasValue && halls.TryGetValue(e.HallId.Value, out var h) ? h : null;
            var (isPaid, priceInfo) = ParsePricing(e.PricingJson);

            PublicEventLocationDto? location = null;
            if (fac is not null && (fac.Latitude.HasValue || !string.IsNullOrWhiteSpace(fac.Address)))
                location = new PublicEventLocationDto(fac.Name, fac.Latitude, fac.Longitude);

            var available = Math.Max(0, e.Capacity - e.RegisteredCount);
            var regOpen = e.IsActive && e.EndDate >= TurkeyTime.TodayDate() && (e.Capacity <= 0 || available > 0);

            return new PublicEventDto(
                e.Id, e.Code, e.Name,
                cat?.Name ?? "", NullIfEmpty(cat?.Color),
                e.VenueType, e.FacilityId, fac?.Name, e.HallId, hall?.Name,
                location,
                e.StartDate, e.EndDate, NullIfEmpty(e.StartTime), NullIfEmpty(e.EndTime), e.IsSingleDay,
                e.Gender, e.MinAge, e.MaxAge,
                e.Capacity, e.RegisteredCount, available, regOpen,
                isPaid, priceInfo,
                e.SultangaziResidentOnly,
                NullIfEmpty(e.Description),
                PrimaryEventImageUrl(e.ImagesJson),
                e.SessionCount);
        }).ToList();
    }


    private static (bool IsPaid, string? PriceInfo) ParsePricing(string? json)
    {
        if (string.IsNullOrWhiteSpace(json) || json == "{}") return (false, null);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var isFree = root.TryGetProperty("isFree", out var f) && f.ValueKind == JsonValueKind.True;
            var price = root.TryGetProperty("price", out var p) && p.TryGetDouble(out var pv) ? pv : 0;
            var currency = root.TryGetProperty("currency", out var c) ? c.GetString() : "TRY";
            if (isFree || price <= 0) return (false, null);
            return (true, $"{price:0.##} {currency}");
        }
        catch { return (false, null); }
    }

    private static string? PrimaryImageUrl(IEnumerable<FacilityImageItem>? images)
    {
        var img = images?.FirstOrDefault(i => i.IsPrimary) ?? images?.FirstOrDefault();
        return img is null ? null : ImageUrl(img);
    }

    private static string? ImageUrl(FacilityImageItem image)
    {
        if (!string.IsNullOrWhiteSpace(image.Url))
            return FileUrl.Normalize(image.Url) ?? image.Url;
        return string.IsNullOrWhiteSpace(image.Id) ? null : FileUrl.Public(image.Id);
    }

    private static readonly string[] RatioKeys = ["16:9", "4:3", "1:1", "9:16"];

    private static string? PrimaryEventImageUrl(string? imagesJson)
    {
        if (string.IsNullOrWhiteSpace(imagesJson) || imagesJson == "{}" || imagesJson == "[]") return null;
        try
        {
            using var doc = JsonDocument.Parse(FileUrl.NormalizeImagesJson(imagesJson));
            var root = doc.RootElement;

            if (root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty("ratios", out var ratiosEl)
                && ratiosEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var key in RatioKeys)
                {
                    if (ratiosEl.TryGetProperty(key, out var variantEl)
                        && variantEl.ValueKind == JsonValueKind.Object
                        && variantEl.TryGetProperty("url", out var ru)
                        && ru.ValueKind == JsonValueKind.String
                        && !string.IsNullOrWhiteSpace(ru.GetString()))
                        return ru.GetString();
                }
            }

            if (root.ValueKind == JsonValueKind.Object)
            {
                foreach (var group in new[] { "web", "mobile" })
                {
                    if (!root.TryGetProperty(group, out var groupEl) || groupEl.ValueKind != JsonValueKind.Object) continue;
                    foreach (var variant in new[] { "cover", "card", "thumb" })
                    {
                        if (groupEl.TryGetProperty(variant, out var variantEl)
                            && variantEl.ValueKind == JsonValueKind.Object
                            && variantEl.TryGetProperty("url", out var vu)
                            && vu.ValueKind == JsonValueKind.String
                            && !string.IsNullOrWhiteSpace(vu.GetString()))
                            return vu.GetString();
                    }
                }
            }

            if (root.ValueKind == JsonValueKind.Array && root.GetArrayLength() > 0)
            {
                var first = root[0];
                if (first.ValueKind == JsonValueKind.String) return first.GetString();
                if (first.ValueKind == JsonValueKind.Object && first.TryGetProperty("url", out var u)) return u.GetString();
            }
            else if (root.ValueKind == JsonValueKind.Object)
            {
                if (root.TryGetProperty("primary", out var pr) && pr.ValueKind == JsonValueKind.String) return pr.GetString();
                if (root.TryGetProperty("cover", out var cv) && cv.ValueKind == JsonValueKind.String) return cv.GetString();
                if (root.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array && items.GetArrayLength() > 0)
                {
                    var it = items[0];
                    if (it.ValueKind == JsonValueKind.Object && it.TryGetProperty("url", out var iu)) return iu.GetString();
                }
            }
        }
        catch {  }
        return null;
    }

    private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;
    private static bool HasAny(params string?[] values) => values.Any(v => !string.IsNullOrWhiteSpace(v));
}
