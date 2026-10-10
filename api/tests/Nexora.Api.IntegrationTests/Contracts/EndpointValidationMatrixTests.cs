using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Contracts;

// Task 6, Ruling C: extends ErrorEnvelopeTests.cs's existing generic-validation pattern with a
// SMALL representative set covering the Step 4 cases the Task 5 tests don't yet cover:
// out-of-range paging, an oversize string against a real FluentValidation max-length rule, and an
// unsupported enum value bound from the body — all against real endpoints, real validators, real
// PostgreSQL. Not an attempt to enumerate all 93 FluentValidation validators (that is explicitly
// out of scope per the brief).
[Collection(ApiCollection.Name)]
public sealed class EndpointValidationMatrixTests
{
    private readonly NexoraApiFactory _factory;
    public EndpointValidationMatrixTests(ApiTestHost host) => _factory = host.Factory;

    private sealed record Envelope(bool Success, int StatusCode, string? Message, string? ErrorCode);

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private static async Task<Envelope> ReadEnvelopeAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        body.Should().NotBeNullOrWhiteSpace();
        var envelope = JsonSerializer.Deserialize<Envelope>(body, JsonOpts);
        envelope.Should().NotBeNull();
        return envelope!;
    }

    // Out-of-range paging: an absurdly large `page` value on a real paginated endpoint
    // (GetNeighborhoodDetail, backed by ParticipantDemographicsService) overflows int parsing at
    // the model-binding layer and is rejected as a real BadHttpRequestException ->
    // MISSING_REQUIRED_PARAMETER, the same binding-failure envelope Task 5 already proved for an
    // invalid GUID.
    [Fact]
    public async Task Absurdly_large_page_value_returns_400_binding_failure_envelope()
    {
        var client = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), $"valid-paging-{Guid.NewGuid():N}@nexora.local"));

        var response = await client.GetAsync(
            "/api/v1/participants/demographics/neighborhood/Merkez?page=99999999999999999999&limit=10");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var envelope = await ReadEnvelopeAsync(response);
        envelope.Success.Should().BeFalse();
        envelope.ErrorCode.Should().Be("MISSING_REQUIRED_PARAMETER");
    }

    // Negative paging value: a real, in-range-for-int but semantically invalid `page=-1` must not
    // be silently accepted as page -1 — the real service (ParticipantDemographicsService) clamps
    // it to page 1 rather than erroring; this proves the real clamping behavior (not a fabricated
    // 400) since the brief's out-of-range case can legitimately resolve to either a rejection or a
    // documented clamp, and the real code does the latter here.
    [Fact]
    public async Task Negative_page_value_is_clamped_to_first_page_not_silently_broken()
    {
        var client = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), $"valid-negpage-{Guid.NewGuid():N}@nexora.local"));

        var response = await client.GetAsync(
            "/api/v1/participants/demographics/neighborhood/Merkez?page=-1&limit=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        doc.RootElement.GetProperty("data").GetProperty("page").GetInt32().Should().Be(1,
            "the real service clamps page<1 to page 1 rather than erroring or returning a negative offset");
    }

    // Oversize string against a real FluentValidation MaximumLength rule
    // (CreateEventCategoryRequestValidator.Name, max 100).
    [Fact]
    public async Task Oversize_string_field_returns_400_validation_error_envelope()
    {
        var client = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), $"valid-oversize-{Guid.NewGuid():N}@nexora.local"));

        var payload = new
        {
            name = new string('a', 150),
            description = (string?)null,
            color = "#3B82F6",
            defaultPoints = 0,
        };
        var response = await client.PostAsJsonAsync("/api/v1/event-categories", payload);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var envelope = await ReadEnvelopeAsync(response);
        envelope.Success.Should().BeFalse();
        envelope.ErrorCode.Should().Be("VALIDATION_ERROR");
        envelope.Message.Should().Contain("100");
    }

    // Unsupported enum value bound from the request body: TopMenuLinkType is a real C# enum bound
    // via System.Text.Json's JsonStringEnumConverter (Program.cs ConfigureHttpJsonOptions); a
    // string that isn't one of Internal/External/WebView fails JSON deserialization and is caught
    // by the same real JsonException -> MALFORMED_REQUEST_BODY path Task 5 proved for malformed
    // JSON syntax.
    [Fact]
    public async Task Unsupported_enum_value_in_request_body_returns_400_malformed_body_envelope()
    {
        var client = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), $"valid-enum-{Guid.NewGuid():N}@nexora.local"));

        var payload = new
        {
            title = "Probe",
            icon = "star",
            iconType = "Emoji",
            color = "#3B82F6",
            linkType = "NotARealLinkType",
            linkTarget = "https://example.com",
            openInBlank = false,
        };
        var response = await client.PostAsJsonAsync("/api/v1/top-menu", payload);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var envelope = await ReadEnvelopeAsync(response);
        envelope.Success.Should().BeFalse();
        envelope.ErrorCode.Should().Be("MALFORMED_REQUEST_BODY");
    }
}
