using System.Text.Json;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.AiCatalog;
using Nexora.Application.Features.AiCatalog.Dtos;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.ParticipantFacilities.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.EmergencyAreas;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği: dış bir yapay zeka asistanının, belediyenin tüm modüllerindeki
/// (kütüphane, kurs/program, salon, gezi, acil toplanma alanı, hizmet tesisi) verilere
/// "hangi program nerede var, nerede boşluk var" gibi sorularla erişebilmesi — ama hiçbir
/// kayıt/başvuru/iptal işlemi YAPAMAMASI. Bu servis kasıtlı olarak salt-okunurdur: hiçbir
/// Create/Update/Delete metodu yoktur ve hiçbir yazma repository çağrısı içermez.
/// </summary>
public class AiCatalogService(IUnitOfWork uow) : IAiCatalogService
{
    public async Task<AiCatalogSummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var programs = await SearchProgramsAsync(new AiCatalogSearchParams(Limit: int.MaxValue), ct);
        var libraries = await SearchLibrariesAsync(new AiCatalogSearchParams(Limit: int.MaxValue), ct);
        var halls = await SearchHallsAsync(new AiCatalogSearchParams(Limit: int.MaxValue), ct);
        var travels = await SearchTravelsAsync(new AiCatalogSearchParams(Limit: int.MaxValue), ct);
        var emergencyAreas = await SearchEmergencyAreasAsync(new AiCatalogSearchParams(Limit: int.MaxValue), ct);
        var facilities = await SearchFacilitiesAsync(new AiCatalogSearchParams(Limit: int.MaxValue), ct);

        return new AiCatalogSummaryDto(
            programs.Count,
            programs.Count(p => p.HasAvailability),
            libraries.Count,
            libraries.Count(l => l.HasAvailability),
            halls.Count,
            travels.Count,
            travels.Count(t => t.HasAvailability),
            emergencyAreas.Count,
            facilities.Count,
            Nexora.Application.Features.Facilities.FacilityModuleRegistry.All.Append("library").Append("hall").Append("travel").ToList());
    }

    public async Task<IReadOnlyList<AiCatalogProgramDto>> SearchProgramsAsync(AiCatalogSearchParams p, CancellationToken ct)
    {
        var groups = await uow.FacilityGroups.FindAsync(g => g.IsActive, ct);

        if (!string.IsNullOrWhiteSpace(p.Module))
            groups = groups.Where(g => string.Equals(g.Module, p.Module, StringComparison.OrdinalIgnoreCase)).ToList();

        if (!string.IsNullOrWhiteSpace(p.Query))
        {
            var q = p.Query.Trim();
            groups = groups.Where(g =>
                g.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                (g.Description?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (g.InstructorName?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }

        if (p.OnlyAvailable == true)
            groups = groups.Where(g => g.Capacity <= 0 || g.RegisteredCount < g.Capacity).ToList();

        var facilityIds = groups.Select(g => g.FacilityId).Distinct().ToList();
        var facilities = facilityIds.Count == 0
            ? new Dictionary<Guid, Facility>()
            : (await uow.Facilities.FindAsync(f => facilityIds.Contains(f.Id), ct)).ToDictionary(f => f.Id);

        var branchIds = groups.Select(g => g.BranchId).Distinct().ToList();
        var branches = branchIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await uow.FacilityBranches.FindAsync(b => branchIds.Contains(b.Id), ct)).ToDictionary(b => b.Id, b => b.Name);

        var serviceFacilityIds = facilities.Values
            .Where(f => f.ServiceFacilityId.HasValue)
            .Select(f => f.ServiceFacilityId!.Value)
            .Distinct()
            .ToList();
        var serviceFacilities = serviceFacilityIds.Count == 0
            ? new Dictionary<Guid, ServiceFacility>()
            : (await uow.ServiceFacilities.FindAsync(s => serviceFacilityIds.Contains(s.Id), ct)).ToDictionary(s => s.Id);

        var items = groups.Select(g =>
        {
            facilities.TryGetValue(g.FacilityId, out var fac);
            branches.TryGetValue(g.BranchId, out var branchName);
            ServiceFacility? sf = fac?.ServiceFacilityId is Guid sfId && serviceFacilities.TryGetValue(sfId, out var sfEntity) ? sfEntity : null;

            var available = Math.Max(0, g.Capacity - g.RegisteredCount);
            var windowBlocked = FacilityApplicationWindow.Check(
                g.Type, g.ApplicationStartDate, g.ApplicationEndDate,
                g.PeriodStart, g.PeriodEnd, g.PeriodType, g.PeriodMonths,
                TurkeyTime.TodayDate()) is not null;

            return new AiCatalogProgramDto(
                g.Module,
                FacilityModuleLabels.For(g.Module),
                g.Id,
                g.Name,
                NullIfEmpty(g.Type),
                NullIfEmpty(g.Gender),
                g.AgeMin > 0 ? g.AgeMin : null,
                g.AgeMax > 0 ? g.AgeMax : null,
                g.Capacity,
                g.RegisteredCount,
                available,
                g.Capacity <= 0 || available > 0,
                g.PeriodStart,
                g.PeriodEnd,
                BuildScheduleSummary(g.ScheduleJson),
                BuildFeeText(g.FeeJson),
                NullIfEmpty(g.InstructorName),
                fac?.Name ?? "—",
                branchName,
                NullIfEmpty(sf?.Address),
                NullIfEmpty(sf?.District),
                sf?.Latitude,
                sf?.Longitude,
                !windowBlocked);
        }).ToList();

        return items
            .OrderBy(i => i.HasAvailability ? 0 : 1)
            .ThenBy(i => i.Name)
            .Take(p.Limit)
            .ToList();
    }

    public async Task<IReadOnlyList<AiCatalogLibraryDto>> SearchLibrariesAsync(AiCatalogSearchParams p, CancellationToken ct)
    {
        var libraries = await uow.Libraries.FindAsync(l => l.IsActive, ct);

        if (!string.IsNullOrWhiteSpace(p.Query))
        {
            var q = p.Query.Trim();
            libraries = libraries.Where(l =>
                l.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                (l.Description?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (l.District?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }

        if (!string.IsNullOrWhiteSpace(p.District))
            libraries = libraries.Where(l => string.Equals(l.District, p.District, StringComparison.OrdinalIgnoreCase)).ToList();

        var serviceFacilityIds = libraries.Select(l => l.ServiceFacilityId).Distinct().ToList();
        var serviceFacilities = serviceFacilityIds.Count == 0
            ? new Dictionary<Guid, ServiceFacility>()
            : (await uow.ServiceFacilities.FindAsync(s => serviceFacilityIds.Contains(s.Id), ct)).ToDictionary(s => s.Id);

        var libraryIds = libraries.Select(l => l.Id).ToList();
        var occupancy = await GetLibraryOccupancyAsync(libraryIds, ct);

        var emergencyAreas = await uow.EmergencyAreas.GetActiveAsync(ct);

        var items = libraries.Select(l =>
        {
            serviceFacilities.TryGetValue(l.ServiceFacilityId, out var sf);
            var inside = occupancy.GetValueOrDefault(l.Id, 0);
            var available = Math.Max(0, l.Capacity - inside);

            (string? Name, double? DistanceKm) nearest = (null, null);
            if (l.GeofenceLatitude.HasValue && l.GeofenceLongitude.HasValue && emergencyAreas.Count > 0)
            {
                var best = emergencyAreas
                    .Where(e => e.Latitude.HasValue && e.Longitude.HasValue)
                    .Select(e => (Area: e, Km: HaversineKm(l.GeofenceLatitude.Value, l.GeofenceLongitude.Value, e.Latitude!.Value, e.Longitude!.Value)))
                    .OrderBy(x => x.Km)
                    .FirstOrDefault();
                if (best.Area is not null)
                    nearest = (best.Area.Name, Math.Round(best.Km, 2));
            }

            return new AiCatalogLibraryDto(
                l.Id,
                l.Name,
                NullIfEmpty(l.Description),
                NullIfEmpty(l.Address ?? sf?.Address),
                NullIfEmpty(l.District ?? sf?.District),
                l.GeofenceLatitude ?? sf?.Latitude,
                l.GeofenceLongitude ?? sf?.Longitude,
                l.Capacity,
                inside,
                available,
                l.Capacity <= 0 || available > 0,
                l.AreaType,
                l.SeatingMode,
                l.ReservationEnabled,
                l.QueueEnabled,
                sf?.ParkingCapacity is > 0 ? sf.ParkingCapacity : null,
                sf?.ParkingCapacity is > 0 ? sf.ParkingType.ToString() : null,
                nearest.Name,
                nearest.DistanceKm);
        }).ToList();

        if (p.OnlyAvailable == true)
            items = items.Where(i => i.HasAvailability).ToList();

        return items
            .OrderBy(i => i.HasAvailability ? 0 : 1)
            .ThenBy(i => i.Name)
            .Take(p.Limit)
            .ToList();
    }

    public async Task<IReadOnlyList<AiCatalogHallDto>> SearchHallsAsync(AiCatalogSearchParams p, CancellationToken ct)
    {
        var halls = await uow.Halls.FindAsync(h => h.IsActive, ct);

        if (!string.IsNullOrWhiteSpace(p.Query))
        {
            var q = p.Query.Trim();
            halls = halls.Where(h =>
                h.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                (h.FacilityName?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }

        return halls
            .Select(h => new AiCatalogHallDto(h.Id, h.Name, h.Type, h.FacilityName, h.Capacity, h.BuildingFloor, NullIfEmpty(h.Description)))
            .OrderBy(h => h.Name)
            .Take(p.Limit)
            .ToList();
    }

    public async Task<IReadOnlyList<AiCatalogTravelDto>> SearchTravelsAsync(AiCatalogSearchParams p, CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        var travels = await uow.Travels.FindAsync(t => t.IsActive && t.EndDate >= today, ct);

        if (!string.IsNullOrWhiteSpace(p.Query))
        {
            var q = p.Query.Trim();
            travels = travels.Where(t =>
                t.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                t.Destination.Contains(q, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        var items = travels.Select(t =>
        {
            var available = Math.Max(0, t.Capacity - t.RegisteredCount);
            var regOpen = t.RegistrationStartDate <= DateTime.UtcNow && t.RegistrationEndDate >= DateTime.UtcNow && (t.Capacity <= 0 || available > 0);
            return new AiCatalogTravelDto(
                t.Id, t.Name, t.Destination,
                t.StartDate, t.EndDate, t.RegistrationStartDate, t.RegistrationEndDate,
                t.Gender, t.MinAge, t.MaxAge,
                t.Capacity, t.RegisteredCount, available,
                t.Capacity <= 0 || available > 0,
                regOpen,
                t.SultangaziResidentOnly,
                NullIfEmpty(t.DeparturePoint),
                NullIfEmpty(t.Description));
        }).ToList();

        if (p.OnlyAvailable == true)
            items = items.Where(i => i.HasAvailability).ToList();

        return items
            .OrderBy(i => i.StartDate)
            .Take(p.Limit)
            .ToList();
    }

    public async Task<IReadOnlyList<AiCatalogEmergencyAreaDto>> SearchEmergencyAreasAsync(AiCatalogSearchParams p, CancellationToken ct)
    {
        var areas = await uow.EmergencyAreas.GetActiveAsync(ct);

        if (!string.IsNullOrWhiteSpace(p.Query))
        {
            var q = p.Query.Trim();
            areas = areas.Where(a =>
                a.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                a.Neighborhood.Contains(q, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        if (!string.IsNullOrWhiteSpace(p.District))
            areas = areas.Where(a => a.Neighborhood.Contains(p.District, StringComparison.OrdinalIgnoreCase)).ToList();

        return areas
            .Select(a => new AiCatalogEmergencyAreaDto(
                a.Id, a.Name, a.Neighborhood, NullIfEmpty(a.Address), a.Latitude, a.Longitude,
                a.Capacity, a.AreaSizeM2,
                a.Equipment.Toilet, a.Equipment.Water, a.Equipment.Electricity,
                a.Equipment.Generator, a.Equipment.Heating, a.Equipment.TentArea,
                NullIfEmpty(a.EmergencyPhone)))
            .OrderBy(a => a.Name)
            .Take(p.Limit)
            .ToList();
    }

    public async Task<IReadOnlyList<AiCatalogFacilityDto>> SearchFacilitiesAsync(AiCatalogSearchParams p, CancellationToken ct)
    {
        var facilities = await uow.ServiceFacilities.FindAsync(f => f.Status == Nexora.Domain.Enums.FacilityStatus.Active, ct);

        if (!string.IsNullOrWhiteSpace(p.Query))
        {
            var q = p.Query.Trim();
            facilities = facilities.Where(f =>
                f.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                (f.Description?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }

        if (!string.IsNullOrWhiteSpace(p.District))
            facilities = facilities.Where(f => f.District.Contains(p.District, StringComparison.OrdinalIgnoreCase)).ToList();

        return facilities
            .Select(f =>
            {
                var images = f.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .Select(i => FileUrl.Public(string.IsNullOrWhiteSpace(i.Url) ? i.Id : i.Url))
                    .Where(u => !string.IsNullOrWhiteSpace(u))
                    .ToList();
                return new AiCatalogFacilityDto(
                    f.Id, f.Name, f.Type, f.LocationType.ToString(),
                    NullIfEmpty(f.Address), NullIfEmpty(f.District), f.Latitude, f.Longitude,
                    f.Capacity, f.ParkingCapacity > 0 ? f.ParkingCapacity : null,
                    f.ParkingCapacity > 0 ? f.ParkingType.ToString() : null,
                    f.Facilities ?? [], f.AccessibilityFeatures ?? [],
                    f.OfferedServices.Where(s => s.Active).Select(s => s.Module).Distinct().ToList(),
                    images!,
                    images.FirstOrDefault(),
                    f.UpdatedAt);
            })
            .OrderBy(f => f.Name)
            .Take(p.Limit)
            .ToList();
    }

    private async Task<Dictionary<Guid, int>> GetLibraryOccupancyAsync(List<Guid> libraryIds, CancellationToken ct)
    {
        if (libraryIds.Count == 0) return [];
        var activeSessions = await uow.LibrarySessions.FindAsync(
            s => libraryIds.Contains(s.LibraryId) && Nexora.Domain.Entities.Libraries.LibrarySessionStatus.ActiveStatuses.Contains(s.Status), ct);
        return activeSessions
            .GroupBy(s => s.LibraryId)
            .ToDictionary(g => g.Key, g => g.Count());
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0;
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    private static double ToRad(double deg) => deg * Math.PI / 180.0;

    private static string BuildScheduleSummary(string scheduleJson)
    {
        var slots = FacilityScheduleHelper.ParseSlots(scheduleJson);
        if (slots.Count == 0) return "";
        var parts = slots
            .Where(s => !string.IsNullOrWhiteSpace(s.Day))
            .Select(s => $"{s.Day} {s.StartTime}-{s.EndTime}".Trim())
            .Distinct()
            .ToList();
        return string.Join(", ", parts);
    }

    private static string? BuildFeeText(string feeJson)
    {
        if (string.IsNullOrWhiteSpace(feeJson) || feeJson == "{}") return null;
        try
        {
            using var doc = JsonDocument.Parse(feeJson);
            var root = doc.RootElement;
            var isFree = root.TryGetProperty("isFree", out var f) && f.ValueKind == JsonValueKind.True;
            if (isFree) return "Ücretsiz";
            var amount = root.TryGetProperty("amount", out var a) && a.TryGetDouble(out var av) ? av : (double?)null;
            if (amount is null or <= 0) return null;
            var currency = root.TryGetProperty("currency", out var c) ? c.GetString() : "TRY";
            return $"{amount:0.##} {currency}";
        }
        catch { return null; }
    }

    private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;
}
