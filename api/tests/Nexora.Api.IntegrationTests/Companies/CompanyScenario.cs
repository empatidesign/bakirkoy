using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;

namespace Nexora.Api.IntegrationTests.Companies;

// Shared helpers for creating real ServiceCategory/Campaign fixture data over the real admin HTTP
// API (matching Events/Facilities' EventScenario/FacilityScenario precedent: no direct DbContext
// seeding for domain state reachable through a real endpoint). Company/CompanyStaff identities
// themselves are seeded directly (CompanyTestIdentity.cs) because there is no real HTTP
// registration+approval flow this suite can drive in one step without duplicating the whole
// CompanyAuth OTP pipeline — matching CitizenTestIdentity's own documented trade-off.
internal static class CompanyScenario
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record Envelope<T>(bool Success, int StatusCode, string? Message, string? ErrorCode, T? Data);
    private sealed record IdOnly(Guid Id);

    public static async Task<Guid> CreateServiceCategoryAsync(HttpClient admin, string tag)
    {
        var payload = new { name = $"{tag} Kategori", description = (string?)null, color = "#3B82F6" };
        var response = await admin.PostAsJsonAsync("/api/v1/service-categories", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created,
            $"service category create must succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await response.Content.ReadAsStringAsync(), Web);
        return body!.Data!.Id;
    }

    public sealed record CreateCampaignOptions
    {
        public Guid CompanyId { get; init; }
        public string Tag { get; init; } = "T12CMP";
        public string DiscountType { get; init; } = "percentage";
        public decimal DiscountValue { get; init; } = 10m;
        public int PerUserLimit { get; init; } = 5;
        public int? TotalUsageLimit { get; init; }
        public decimal? MinOrderAmount { get; init; }
        public DateTime? StartDate { get; init; }
        public DateTime? EndDate { get; init; }
    }

    public static async Task<Guid> CreateCampaignAsync(HttpClient admin, CreateCampaignOptions o)
    {
        var start = o.StartDate ?? DateTime.UtcNow.Date;
        var end = o.EndDate ?? DateTime.UtcNow.Date.AddDays(30);
        var payload = new
        {
            companyId = o.CompanyId,
            name = $"{o.Tag} Kampanya",
            discountType = o.DiscountType,
            discountValue = o.DiscountValue,
            perUserLimit = o.PerUserLimit,
            totalUsageLimit = o.TotalUsageLimit,
            minOrderAmount = o.MinOrderAmount,
            startDate = start,
            endDate = end,
            category = (string?)null,
            imageUrl = (string?)null,
            description = "task12 test fixture",
            rules = (string?)null,
            kvkkText = (string?)null,
            products = Array.Empty<object>(),
        };

        var response = await admin.PostAsJsonAsync("/api/v1/campaigns", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created,
            $"campaign create must succeed; body: {await response.Content.ReadAsStringAsync()}");
        var body = JsonSerializer.Deserialize<Envelope<IdOnly>>(await response.Content.ReadAsStringAsync(), Web);
        return body!.Data!.Id;
    }
}
