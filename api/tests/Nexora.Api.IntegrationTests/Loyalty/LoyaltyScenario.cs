using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;

namespace Nexora.Api.IntegrationTests.Loyalty;

// Shared helpers for creating real LoyaltyRule/Reward fixture data over the real admin HTTP API
// (Task 12, matching Events/Facilities/Companies' Scenario precedent).
internal static class LoyaltyScenario
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record Envelope<T>(bool Success, int StatusCode, string? Message, string? ErrorCode, T? Data);
    private sealed record IdOnly(string Id);

    public static async Task<string> CreateRuleAsync(HttpClient admin, string actionKey, string label, int points, string? description = null)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/loyalty/rules",
            new { actionKey, label, points, description });
        response.StatusCode.Should().Be(HttpStatusCode.Created,
            $"loyalty rule create must succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await response.Content.ReadAsStringAsync(), Web);
        return body!.Data!.Id;
    }

    public static async Task<string> CreateRewardAsync(HttpClient admin, string name, int pointsRequired, int stock, string? description = null)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/loyalty/rewards",
            new { name, pointsRequired, stock, description, imageUrl = (string?)null });
        response.StatusCode.Should().Be(HttpStatusCode.Created,
            $"reward create must succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await response.Content.ReadAsStringAsync(), Web);
        return body!.Data!.Id;
    }
}
