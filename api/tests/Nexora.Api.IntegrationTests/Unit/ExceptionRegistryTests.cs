using Xunit;

namespace Nexora.Api.IntegrationTests.Contracts;

// Task 6, Ruling D: "Step 1's failing-first assertion must make an EXPIRED exception fail the
// suite... this can be a small isolated unit test of the exceptions-loader function, real code,
// not a mock." Exercises Nexora.Api.IntegrationTests.Contracts.ExceptionRegistry directly — real
// parsing/validation code, no host, no HTTP, no database. Lives in this project (not
// Nexora.UnitTests) because ExceptionRegistry/EndpointException are declared here and
// Nexora.UnitTests does not reference this test project.
public class ExceptionRegistryTests
{
    private static string WriteTempJson(string json)
    {
        var path = Path.Combine(Path.GetTempPath(), $"endpoint-exceptions-test-{Guid.NewGuid():N}.json");
        File.WriteAllText(path, json);
        return path;
    }

    [Fact]
    public void EnsureNoneExpired_throws_for_a_synthetic_past_dated_entry()
    {
        var path = WriteTempJson("""
        [
          { "method": "GET", "route": "/api/v1/synthetic-expired", "reason": "test", "owner": "task-6", "expiryDate": "2020-01-01" }
        ]
        """);

        var exceptions = ExceptionRegistry.Load(path);

        var act = () => ExceptionRegistry.EnsureNoneExpired(exceptions, DateOnly.FromDateTime(DateTime.UtcNow));

        var ex = Assert.Throws<InvalidOperationException>(act);
        Assert.Contains("EXPIRED", ex.Message);
        Assert.Contains("/api/v1/synthetic-expired", ex.Message);
    }

    [Fact]
    public void EnsureNoneExpired_does_not_throw_for_a_future_dated_entry()
    {
        var path = WriteTempJson("""
        [
          { "method": "GET", "route": "/api/v1/synthetic-future", "reason": "test", "owner": "task-6", "expiryDate": "2099-01-01" }
        ]
        """);

        var exceptions = ExceptionRegistry.Load(path);

        ExceptionRegistry.EnsureNoneExpired(exceptions, DateOnly.FromDateTime(DateTime.UtcNow));
    }

    [Fact]
    public void Load_throws_for_an_entry_missing_a_required_field()
    {
        var path = WriteTempJson("""
        [
          { "method": "GET", "route": "", "reason": "test", "owner": "task-6", "expiryDate": "2099-01-01" }
        ]
        """);

        Assert.Throws<InvalidOperationException>(() => ExceptionRegistry.Load(path));
    }

    [Fact]
    public void Load_throws_for_an_unparseable_expiry_date()
    {
        var path = WriteTempJson("""
        [
          { "method": "GET", "route": "/x", "reason": "test", "owner": "task-6", "expiryDate": "not-a-date" }
        ]
        """);

        Assert.Throws<InvalidOperationException>(() => ExceptionRegistry.Load(path));
    }

    [Fact]
    public void Matches_treats_ANY_method_as_a_wildcard_but_route_must_match_exactly()
    {
        var entry = new EndpointException("ANY", "/hubs/team", "reason", "task-6", new DateOnly(2099, 1, 1));

        Assert.True(entry.Matches("GET", "/hubs/team"));
        Assert.True(entry.Matches("POST", "/hubs/team"));
        Assert.False(entry.Matches("GET", "/hubs/other"));
    }

    [Fact]
    public void Matches_is_case_insensitive_on_method_but_exact_on_route()
    {
        var entry = new EndpointException("GET", "/api/v1/x", "reason", "task-6", new DateOnly(2099, 1, 1));

        Assert.True(entry.Matches("get", "/api/v1/x"));
        Assert.False(entry.Matches("GET", "/api/v1/X"));
    }
}
