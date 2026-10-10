using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;

namespace Nexora.Api.IntegrationTests.Events;

// Shared helpers for creating real Events/Sessions/Categories over the real public admin HTTP API
// (Task 8 brief Ruling C: no direct DbContext seeding for domain data), used by both
// EventApplicationMatrixTests.cs and EventSeatConcurrencyTests.cs.
internal static class EventScenario
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record Envelope<T>(bool Success, int StatusCode, T Data);
    private sealed record IdOnly(Guid Id);

    public static async Task<Guid> CreateCategoryAsync(HttpClient admin, string tag)
    {
        var payload = new { name = $"{tag} Kategori", description = (string?)null, color = "#3B82F6", defaultPoints = 0 };
        var response = await admin.PostAsJsonAsync("/api/v1/event-categories", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created,
            $"category create must succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await response.Content.ReadAsStringAsync(), Web);
        return body!.Data.Id;
    }

    public sealed record CreateEventOptions
    {
        public Guid CategoryId { get; init; }
        public string Tag { get; init; } = "E2E";
        public bool HasSessions { get; init; }
        public bool HasSeating { get; init; }
        public string ReservationType { get; init; } = "none";
        public string RegistrationMode { get; init; } = "none";
        public string Gender { get; init; } = "all";
        public int MinAge { get; init; } = 0;
        public int MaxAge { get; init; } = 99;
        public int Capacity { get; init; } = 10;
        public int ReserveCapacity { get; init; } = 0;
        public DateTime? StartDate { get; init; }
        public DateTime? EndDate { get; init; }
        public string StartTime { get; init; } = "10:00";
        public string EndTime { get; init; } = "12:00";
        public DateTime? ApplicationStartDate { get; init; }
        public DateTime? ApplicationEndDate { get; init; }
        public bool AttendanceEnabled { get; init; }
        public bool QrEnabled { get; init; }
        public bool KioskEnabled { get; init; }
        public bool IsActive { get; init; } = true;
    }

    public static async Task<Guid> CreateEventAsync(HttpClient admin, CreateEventOptions o)
    {
        var start = o.StartDate ?? DateTime.UtcNow.AddDays(7);
        var end = o.EndDate ?? start;
        var payload = new
        {
            name = $"{o.Tag} Etkinlik",
            categoryId = o.CategoryId,
            venueType = "indoor",
            facilityId = (Guid?)null,
            hallId = (Guid?)null,
            location = (object?)null,
            startDate = start,
            endDate = end,
            isSingleDay = !o.HasSessions,
            gender = o.Gender,
            capacity = o.Capacity,
            reserveCapacity = o.ReserveCapacity,
            minAge = o.MinAge,
            maxAge = o.MaxAge,
            participationPeriod = "none",
            participationLimit = 0,
            description = "task8 test fixture",
            internalNote = "",
            images = new { },
            access = new
            {
                hasSessions = o.HasSessions,
                hasSeating = o.HasSeating,
                reservationType = o.ReservationType,
                registrationMode = o.RegistrationMode,
                attendanceEnabled = o.AttendanceEnabled,
                entryMethod = "checkin",
                qrEnabled = o.QrEnabled,
                qrType = "static",
                qrRotationSeconds = 0,
                kioskEnabled = o.KioskEnabled,
                turnstileEnabled = false,
                publicLinkEnabled = false,
                publicLinkRequiresPin = false,
                staffIds = Array.Empty<string>(),
            },
            pricing = new { },
            points = new { },
            isActive = o.IsActive,
            startTime = o.StartTime,
            endTime = o.EndTime,
            applicationStartDate = o.ApplicationStartDate,
            applicationEndDate = o.ApplicationEndDate,
        };

        var response = await admin.PostAsJsonAsync("/api/v1/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created,
            $"event create must succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await response.Content.ReadAsStringAsync(), Web);
        return body!.Data.Id;
    }

    public sealed record CreateSessionOptions
    {
        public Guid EventId { get; init; }
        public DateTime? Date { get; init; }
        public string StartTime { get; init; } = "10:00";
        public string EndTime { get; init; } = "12:00";
        public int Capacity { get; init; } = 10;
        public int ReserveCapacity { get; init; } = 0;
        public bool IsActive { get; init; } = true;
    }

    public static async Task<Guid> CreateSessionAsync(HttpClient admin, CreateSessionOptions o)
    {
        var date = o.Date ?? DateTime.UtcNow.AddDays(7);
        var payload = new
        {
            eventId = o.EventId,
            hallId = (Guid?)null,
            mode = "single",
            date,
            startTime = o.StartTime,
            endTime = o.EndTime,
            startDate = date,
            endDate = date,
            dayPlans = Array.Empty<object>(),
            capacity = o.Capacity,
            reserveCapacity = o.ReserveCapacity,
            instructor = (string?)null,
            instructorId = (string?)null,
            instructorPhone = (string?)null,
            instructorEmail = (string?)null,
            emergencyPhone = (string?)null,
            isActive = o.IsActive,
        };

        var response = await admin.PostAsJsonAsync("/api/v1/sessions", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created,
            $"session create must succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await response.Content.ReadAsStringAsync(), Web);
        return body!.Data.Id;
    }

    public static async Task<HttpClient> CitizenClientAsync(NexoraApiFactory factory, CitizenTestIdentity identity)
        => await factory.CreateCitizenClientAsync(identity);
}
