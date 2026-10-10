using System.Net.Http.Json;
using System.Text.Json;

namespace Nexora.Api.IntegrationTests.Libraries;

// Task 9 (Ruling C): every scenario seeds a real ServiceFacility -> Library through the REAL
// public admin API (POST /service-facilities, /libraries), not by reaching into EF/DbContext
// directly, matching Task 7's established FacilityScenario pattern for the same reason (the same
// rule chain/validation the real UI drives must be exercised, not bypassed).
internal static class LibraryScenario
{
    public sealed record Seat(string Key, string Number);

    public sealed record Options
    {
        public string SeatingMode { get; init; } = "masali";
        public bool QueueEnabled { get; init; }
        public bool ReservationEnabled { get; init; }
        public string EntryControlMode { get; init; } = "manual";
        public string ExitControlMode { get; init; } = "manual";
        public int AutoCheckOutAfterMinutes { get; init; } = 240;
        public bool IpRestrictionEnabled { get; init; }
        public List<string>? AllowedIps { get; init; }
        public bool GeofenceEnabled { get; init; }
        public double? GeofenceLatitude { get; init; }
        public double? GeofenceLongitude { get; init; }
        public int GeofenceRadiusMeters { get; init; } = 150;
        public int Capacity { get; init; } = 4;
        public int SeatCount { get; init; } = 1;
        public string? AccessType { get; init; }
        public string? DeviceKind { get; init; }
        public bool DeviceControlEnabled { get; init; }
    }

    public sealed record Created(Guid ServiceFacilityId, Guid LibraryId, string LibraryName, List<Seat> SeatKeys);

    public static async Task<Created> CreateAsync(HttpClient adminClient, string tag, Options? options = null, CancellationToken ct = default)
    {
        options ??= new Options();

        var sfPayload = new
        {
            name = $"T9 SF {tag}",
            type = "library",
            locationType = "Indoor",
            city = "İstanbul",
            district = "Sultangazi",
            address = $"T9 Mah. {tag}",
            // ServiceFacility validator koordinatları zorunlu kılıyor (bkz. FacilityScenario.cs'in
            // aynı düzeltmesi, 2026-09-23) — bu alanlar olmadan her senaryo 400 ile düşer.
            latitude = 41.1086,
            longitude = 28.8681,
            weekdayOpen = "08:00",
            weekdayClose = "22:00",
            weekendOpen = "09:00",
            weekendClose = "20:00",
            parkingCapacity = 0,
            parkingType = "Free",
            capacity = 100,
        };
        var sfResponse = await adminClient.PostAsJsonAsync("/api/v1/service-facilities", sfPayload, ct);
        var sfBody = await ReadAsync(sfResponse, ct);
        if (!sfResponse.IsSuccessStatusCode)
            throw new InvalidOperationException($"service-facility create failed {(int)sfResponse.StatusCode}: {sfBody}");
        var serviceFacilityId = ExtractGuid(sfBody, "id");

        var seatKeys = new List<Seat>();
        var seats = new List<string>();
        for (var i = 1; i <= Math.Max(1, options.SeatCount); i++)
        {
            var label = $"A{i}";
            seats.Add(label);
            seatKeys.Add(new Seat($"floor-1|sec-1|{label}", label));
        }

        var libPayload = new
        {
            name = $"T9 Library {tag}",
            description = "Task 9 integration test library",
            serviceFacilityId = serviceFacilityId.ToString(),
            seatingMode = options.SeatingMode,
            isMultiFloor = false,
            floors = new object[]
            {
                new
                {
                    id = "floor-1",
                    name = "Zemin Kat",
                    capacity = options.Capacity,
                    active = true,
                    autoOpenWhenPreviousFull = false,
                    sections = new object[]
                    {
                        new { id = "sec-1", name = "A", seats },
                    },
                },
            },
            amenities = (List<string>?)null,
            queueEnabled = options.QueueEnabled,
            reservationEnabled = options.ReservationEnabled,
            entryControlMode = options.EntryControlMode,
            exitControlMode = options.ExitControlMode,
            autoCheckOutAfterMinutes = options.AutoCheckOutAfterMinutes,
            useCustomBreakSettings = false,
            breakDurationMinutes = 15,
            maxDailyBreaks = 3,
            longBreakDurationMinutes = 45,
            maxStudyHoursPerDay = 10,
            requireBreakAfterHours = 3,
            ipRestrictionEnabled = options.IpRestrictionEnabled,
            allowedIps = options.AllowedIps,
            isActive = true,
            grantAccess = false,
            geofenceEnabled = options.GeofenceEnabled,
            geofenceLatitude = options.GeofenceLatitude,
            geofenceLongitude = options.GeofenceLongitude,
            geofenceRadiusMeters = options.GeofenceRadiusMeters,
            deviceControlEnabled = options.DeviceControlEnabled,
            accessType = options.AccessType,
            deviceKind = options.DeviceKind,
        };
        var libResponse = await adminClient.PostAsJsonAsync("/api/v1/libraries", libPayload, ct);
        var libBody = await ReadAsync(libResponse, ct);
        if (!libResponse.IsSuccessStatusCode)
            throw new InvalidOperationException($"library create failed {(int)libResponse.StatusCode}: {libBody}");
        var libraryId = ExtractGuid(libBody, "id");
        var libraryName = ExtractString(libBody, "name");

        return new Created(serviceFacilityId, libraryId, libraryName, seatKeys);
    }

    public static async Task DeleteAsync(HttpClient adminClient, Created created, CancellationToken ct = default)
    {
        await adminClient.DeleteAsync($"/api/v1/libraries/{created.LibraryId}", ct);
        await adminClient.DeleteAsync($"/api/v1/service-facilities/{created.ServiceFacilityId}", ct);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response, CancellationToken ct)
    {
        var text = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(text) ? "{}" : text);
        return doc.RootElement.Clone();
    }

    private static Guid ExtractGuid(JsonElement root, string field)
    {
        var data = root.TryGetProperty("data", out var d) ? d : root;
        return data.GetProperty(field).GetGuid();
    }

    private static string ExtractString(JsonElement root, string field)
    {
        var data = root.TryGetProperty("data", out var d) ? d : root;
        return data.GetProperty(field).GetString() ?? "";
    }
}
