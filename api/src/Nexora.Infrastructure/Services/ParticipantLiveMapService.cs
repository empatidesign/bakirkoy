using System.Text.Json;
using Nexora.Domain.Common;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.ParticipantLiveMap.Dtos;
using Nexora.Domain.Entities.Halls;
using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class ParticipantLiveMapService(IUnitOfWork uow) : Nexora.Application.Features.ParticipantLiveMap.IParticipantLiveMapService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<LiveMapResultDto> GetLiveMapAsync(CancellationToken ct)
    {
        var points = new List<LiveMapPointDto>();

        var areas = await uow.EmergencyAreas.FindAsync(
            a => a.Status == EmergencyAreaStatus.Active && a.Latitude != null && a.Longitude != null, ct);
        points.AddRange(areas.Select(a => new LiveMapPointDto(
            a.Id.ToString(), LiveMapPointType.EmergencyArea, a.Name,
            a.Neighborhood, a.Latitude!.Value, a.Longitude!.Value,
            "#dc2626", null, "/acil-alanlar")));

        var facilities = await uow.ServiceFacilities.FindAsync(
            f => f.Status == FacilityStatus.Active && f.Latitude != null && f.Longitude != null, ct);
        points.AddRange(facilities.Select(f => new LiveMapPointDto(
            f.Id.ToString(), LiveMapPointType.Facility, f.Name,
            f.District, f.Latitude!.Value, f.Longitude!.Value,
            "#059669", null, "/hizmetler",
            f.ParkingCapacity > 0, f.ParkingCapacity > 0 ? f.ParkingCapacity : null, f.ParkingCapacity > 0 ? f.ParkingType.ToString() : null)));

        var libraries = await uow.Libraries.FindAsync(l => l.IsActive, ct);
        var libFacIds = libraries.Select(l => l.ServiceFacilityId).Distinct().ToList();
        var libFacs = libFacIds.Count == 0
            ? new Dictionary<Guid, ServiceFacility>()
            : (await uow.ServiceFacilities.FindAsync(f => libFacIds.Contains(f.Id), ct)).ToDictionary(f => f.Id);
        foreach (var l in libraries)
        {
            double? lat = l.GeofenceLatitude, lng = l.GeofenceLongitude;
            if ((lat is null || lng is null) && libFacs.TryGetValue(l.ServiceFacilityId, out var lf))
            {
                lat ??= lf.Latitude;
                lng ??= lf.Longitude;
            }
            if (lat is null || lng is null) continue;
            points.Add(new LiveMapPointDto(
                l.Id.ToString(), LiveMapPointType.Library, l.Name,
                l.District, lat.Value, lng.Value,
                "#2563eb", null, "/kutuphane"));
        }

        var today = TurkeyTime.TodayDate();
        var events = await uow.Events.FindAsync(
            e => e.IsActive && e.EndDate.Date >= today, ct);

        if (events.Count > 0)
        {
            var hallIds = events.Where(e => e.HallId.HasValue).Select(e => e.HallId!.Value).Distinct().ToList();
            var halls = hallIds.Count == 0
                ? new Dictionary<Guid, Hall>()
                : (await uow.Halls.FindAsync(h => hallIds.Contains(h.Id), ct)).ToDictionary(h => h.Id);
            var facIds = events
                .Select(e => e.HallId.HasValue && halls.TryGetValue(e.HallId.Value, out var h) ? (Guid?)h.FacilityId : e.FacilityId)
                .Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
            var evFacs = facIds.Count == 0
                ? new Dictionary<Guid, ServiceFacility>()
                : (await uow.ServiceFacilities.FindAsync(f => facIds.Contains(f.Id), ct)).ToDictionary(f => f.Id);
            var catIds = events.Select(e => e.CategoryId).Distinct().ToList();
            var cats = catIds.Count == 0
                ? new Dictionary<Guid, string>()
                : (await uow.EventCategories.FindAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id, c => c.Color);

            foreach (var e in events)
            {
                var hall = e.HallId.HasValue ? halls.GetValueOrDefault(e.HallId.Value) : null;
                var facId = hall?.FacilityId ?? e.FacilityId;
                var fac = facId.HasValue ? evFacs.GetValueOrDefault(facId.Value) : null;
                double? lat = fac?.Latitude, lng = fac?.Longitude;
                if (lat is null || lng is null)
                {
                    var (jsonLat, jsonLng) = ReadLocationLatLng(e.LocationJson);
                    lat ??= jsonLat;
                    lng ??= jsonLng;
                }
                if (lat is null || lng is null) continue;

                var color = cats.GetValueOrDefault(e.CategoryId, "#7c3aed");
                var venueName = hall?.Name ?? fac?.Name;
                points.Add(new LiveMapPointDto(
                    e.Id.ToString(), LiveMapPointType.Event, e.Name,
                    venueName, lat.Value, lng.Value,
                    color, e.StartDate, "/etkinlikler"));
            }
        }

        return new LiveMapResultDto(points);
    }

    private static (double? Latitude, double? Longitude) ReadLocationLatLng(string? locationJson)
    {
        if (string.IsNullOrWhiteSpace(locationJson)) return (null, null);
        try
        {
            using var doc = JsonDocument.Parse(locationJson);
            double? lat = doc.RootElement.TryGetProperty("latitude", out var la) && la.ValueKind == JsonValueKind.Number ? la.GetDouble() : null;
            double? lng = doc.RootElement.TryGetProperty("longitude", out var lo) && lo.ValueKind == JsonValueKind.Number ? lo.GetDouble() : null;
            return (lat, lng);
        }
        catch { return (null, null); }
    }
}
