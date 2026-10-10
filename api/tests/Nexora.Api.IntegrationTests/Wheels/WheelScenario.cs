using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;

namespace Nexora.Api.IntegrationTests.Wheels;

// Shared helpers for creating real Wheel/Gift fixture data over the real admin HTTP API
// (Task 12, matching Events/Facilities/Companies/Loyalty's Scenario precedent).
internal static class WheelScenario
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record Envelope<T>(bool Success, int StatusCode, string? Message, string? ErrorCode, T? Data);
    private sealed record IdOnly(Guid Id);

    public static async Task<Guid> CreateGiftAsync(HttpClient admin, string name, int points, int stockLimit, List<int>? winnerPattern = null)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/gifts",
            new { name, imageUrl = (string?)null, points, stockLimit, winnerPattern = winnerPattern ?? new List<int> { 1 }, description = (string?)null });
        response.StatusCode.Should().Be(HttpStatusCode.Created,
            $"gift create must succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await response.Content.ReadAsStringAsync(), Web);
        return body!.Data!.Id;
    }

    public sealed record SliceSpec(string Label, string Type, int Value, int WinRate, Guid? GiftId = null);

    public static async Task<Guid> CreateWheelAsync(HttpClient admin, string title, int dailySpinLimit, List<SliceSpec> slices,
        bool pointsAlgorithmEnabled = false, int pointsAlgorithmBase = 0, int pointsAlgorithmStep = 0,
        int pointsAlgorithmMax = 0, int pointsAlgorithmMaxSpins = 0)
    {
        var payload = new
        {
            title,
            description = (string?)null,
            dailySpinLimit,
            slices = slices.Select(s => new
            {
                label = s.Label,
                type = s.Type,
                value = s.Value,
                winRate = s.WinRate,
                color = "#3B82F6",
                giftId = s.GiftId,
            }).ToList(),
            pointsAlgorithmEnabled,
            pointsAlgorithmBase,
            pointsAlgorithmStep,
            pointsAlgorithmMax,
            pointsAlgorithmMaxSpins,
        };
        var response = await admin.PostAsJsonAsync("/api/v1/wheels", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created,
            $"wheel create must succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await response.Content.ReadAsStringAsync(), Web);
        return body!.Data!.Id;
    }
}
