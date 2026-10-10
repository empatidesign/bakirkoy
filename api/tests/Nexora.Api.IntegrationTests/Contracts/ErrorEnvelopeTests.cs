using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Contracts;

// Exercises the real hosted error pipeline (ExceptionHandlingMiddleware + ResponseWrappingMiddleware
// + CorrelationIdMiddleware) over real HTTP against the real PostgreSQL-backed host. Every case
// asserts the documented ApiResponse envelope: HTTP status, errorCode, message, and correlationId.
[Collection(ApiCollection.Name)]
public sealed class ErrorEnvelopeTests
{
    private readonly NexoraApiFactory _factory;

    public ErrorEnvelopeTests(ApiTestHost host) => _factory = host.Factory;

    private sealed record Envelope(
        bool Success,
        int StatusCode,
        string? Message,
        string? ErrorCode,
        string? CorrelationId);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static async Task<Envelope> ReadEnvelopeAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        body.Should().NotBeNullOrWhiteSpace("every error response must carry an ApiResponse envelope body");
        var envelope = JsonSerializer.Deserialize<Envelope>(body, Json);
        envelope.Should().NotBeNull();
        return envelope!;
    }

    private static void AssertCorrelationId(HttpResponseMessage response, Envelope envelope)
    {
        // The envelope correlationId must be present and must match the response header set by
        // CorrelationIdMiddleware for the same request.
        envelope.CorrelationId.Should().NotBeNullOrWhiteSpace();
        response.Headers.TryGetValues("X-Correlation-Id", out var header).Should().BeTrue();
        header!.Single().Should().Be(envelope.CorrelationId);
    }

    [Fact]
    public async Task Malformed_json_returns_400_envelope()
    {
        var client = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), "err-malformed@nexora.local"));

        var content = new StringContent("{ this is not valid json ", Encoding.UTF8, "application/json");
        var response = await client.PostAsync("/api/v1/event-categories", content);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var envelope = await ReadEnvelopeAsync(response);
        envelope.Success.Should().BeFalse();
        envelope.StatusCode.Should().Be(400);
        envelope.ErrorCode.Should().Be("MALFORMED_REQUEST_BODY");
        envelope.Message.Should().NotBeNullOrWhiteSpace();
        AssertCorrelationId(response, envelope);
    }

    [Fact]
    public async Task Invalid_guid_query_parameter_returns_400_envelope()
    {
        var client = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), "err-guid@nexora.local"));

        // libraryId is a required non-nullable Guid bound from the query string; an unparseable
        // value is rejected by model binding as a BadHttpRequestException -> 400 envelope.
        var response = await client.GetAsync("/api/v1/library-staff/eligible?libraryId=not-a-guid");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var envelope = await ReadEnvelopeAsync(response);
        envelope.Success.Should().BeFalse();
        envelope.StatusCode.Should().Be(400);
        envelope.ErrorCode.Should().Be("MISSING_REQUIRED_PARAMETER");
        envelope.Message.Should().NotBeNullOrWhiteSpace();
        AssertCorrelationId(response, envelope);
    }

    [Fact]
    public async Task Missing_authentication_returns_401_envelope()
    {
        // No Authorization header: rejected by the authentication layer before the handler runs.
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/event-categories");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var envelope = await ReadEnvelopeAsync(response);
        envelope.Success.Should().BeFalse();
        envelope.StatusCode.Should().Be(401);
        envelope.ErrorCode.Should().Be("UNAUTHORIZED");
        envelope.Message.Should().NotBeNullOrWhiteSpace();
        AssertCorrelationId(response, envelope);
    }

    [Fact]
    public async Task Missing_permission_returns_403_envelope()
    {
        // Authenticated admin whose role holds no permissions: reaches PermissionEnforcementMiddleware
        // and is rejected with 403 FORBIDDEN.
        var client = await _factory.CreateClientAsync(
            TestIdentity.PermissionlessAdmin(Guid.NewGuid(), "err-forbidden@nexora.local"));

        var response = await client.GetAsync("/api/v1/event-categories");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var envelope = await ReadEnvelopeAsync(response);
        envelope.Success.Should().BeFalse();
        envelope.StatusCode.Should().Be(403);
        envelope.ErrorCode.Should().Be("FORBIDDEN");
        envelope.Message.Should().NotBeNullOrWhiteSpace();
        AssertCorrelationId(response, envelope);
    }

    [Fact]
    public async Task Duplicate_conflict_returns_409_envelope()
    {
        var client = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), "err-conflict@nexora.local"));

        var name = $"Çakışma Kategorisi {Guid.NewGuid():N}";
        var payload = new { name, description = (string?)null, color = "#3B82F6", defaultPoints = 0 };

        var first = await client.PostAsJsonAsync("/api/v1/event-categories", payload);
        first.StatusCode.Should().Be(HttpStatusCode.Created,
            "the first create with a unique name must succeed against real PostgreSQL");

        var duplicate = await client.PostAsJsonAsync("/api/v1/event-categories", payload);

        duplicate.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var envelope = await ReadEnvelopeAsync(duplicate);
        envelope.Success.Should().BeFalse();
        envelope.StatusCode.Should().Be(409);
        envelope.ErrorCode.Should().Be("DUPLICATE_EVENT_CATEGORY");
        envelope.Message.Should().NotBeNullOrWhiteSpace();
        AssertCorrelationId(duplicate, envelope);
    }
}
