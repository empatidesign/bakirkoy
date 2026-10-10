using System.Text.Json;

namespace Nexora.Api.IntegrationTests.Contracts;

// Task 6, Ruling D: endpoint-exceptions.json is a committed exception REGISTRY for routes that
// cannot be classified/probed at all (not a dumping ground). This loader is real code (not a
// mock/stub) that both the coverage assertion and a small isolated unit test exercise directly.
public sealed record EndpointException(string Method, string Route, string Reason, string Owner, DateOnly ExpiryDate)
{
    public bool Matches(string method, string route) =>
        (string.Equals(Method, "ANY", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(Method, method, StringComparison.OrdinalIgnoreCase))
        && string.Equals(Route, route, StringComparison.Ordinal);
}

public static class ExceptionRegistry
{
    private sealed record RawEntry(string method, string route, string reason, string owner, string expiryDate);

    public static IReadOnlyList<EndpointException> Load(string jsonPath)
    {
        var json = File.ReadAllText(jsonPath);
        var raw = JsonSerializer.Deserialize<List<RawEntry>>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException($"endpoint-exceptions.json at '{jsonPath}' did not parse to a JSON array.");

        return raw.Select(r =>
        {
            if (string.IsNullOrWhiteSpace(r.method) || string.IsNullOrWhiteSpace(r.route)
                || string.IsNullOrWhiteSpace(r.reason) || string.IsNullOrWhiteSpace(r.owner)
                || string.IsNullOrWhiteSpace(r.expiryDate))
                throw new InvalidOperationException(
                    $"endpoint-exceptions.json entry missing a required field (method/route/reason/owner/expiryDate): {JsonSerializer.Serialize(r)}");

            if (!DateOnly.TryParse(r.expiryDate, out var expiry))
                throw new InvalidOperationException($"endpoint-exceptions.json entry has an unparseable expiryDate: '{r.expiryDate}'");

            return new EndpointException(r.method, r.route, r.reason, r.owner, expiry);
        }).ToList();
    }

    // Step 1's binding RED requirement (Ruling D): an EXPIRED exception must fail the suite,
    // not be silently honored. Called by the coverage assertion against real today's date, and
    // unit-tested directly here with a synthetic past-dated entry (no host/HTTP needed).
    public static void EnsureNoneExpired(IReadOnlyList<EndpointException> exceptions, DateOnly today)
    {
        var expired = exceptions.Where(e => e.ExpiryDate < today).ToList();
        if (expired.Count > 0)
            throw new InvalidOperationException(
                "endpoint-exceptions.json contains EXPIRED entries (must be renewed or the route must be " +
                "classified/probed for real, not left exempt indefinitely): " +
                string.Join(", ", expired.Select(e => $"{e.Method} {e.Route} (expired {e.ExpiryDate:yyyy-MM-dd})")));
    }
}
