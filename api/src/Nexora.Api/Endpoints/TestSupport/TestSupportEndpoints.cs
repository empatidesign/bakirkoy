using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Travels;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Api.Endpoints.TestSupport;

public sealed record ResidueTarget(Type EntityType, string PropertyName);
public sealed record ResidueMatch(string Resource, string Field);
public sealed record ResidueResponse(IReadOnlyList<ResidueMatch> Residues);

public static class TestSupportEndpoints
{
    public const int MaxResults = 10;
    public const int CommandTimeoutSeconds = 5;
    public const int ApiKeyHexLength = 64;

    public static IReadOnlyList<ResidueTarget> ResidueTargets { get; } =
    [
        new(typeof(Event), nameof(Event.Code)),
        new(typeof(Event), nameof(Event.Name)),
        new(typeof(Session), nameof(Session.Code)),
        new(typeof(Travel), nameof(Travel.Code)),
        new(typeof(Travel), nameof(Travel.Name)),
    ];

    public static bool IsEnabled(string environmentName) =>
        string.Equals(environmentName, "Testing", StringComparison.OrdinalIgnoreCase);

    public static bool HasValidApiKey(string? provided, string? configured)
    {
        if (string.IsNullOrWhiteSpace(provided) || string.IsNullOrWhiteSpace(configured)) return false;
        if (!Regex.IsMatch(configured, "^[a-f0-9]{64}$", RegexOptions.IgnoreCase) || HasShortPeriod(configured)) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(provided), Encoding.UTF8.GetBytes(configured));
    }

    public static string CreateTestTag(string runId) =>
        $"e2e-{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(runId))).ToLowerInvariant()[..16]}";

    public static string GetRateLimitPartitionKey(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    public static IEndpointRouteBuilder MapTestSupportEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/test-support/residue", FindResidue)
            .RequireRateLimiting("test-support");
        return app;
    }

    private static async Task<IResult> FindResidue(
        string runId,
        HttpRequest request,
        IConfiguration configuration,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        if (!HasValidApiKey(request.Headers["X-Test-Api-Key"].FirstOrDefault(), configuration["TestSupport:ApiKey"]))
            return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(runId) || runId.Length > 200)
            return Results.BadRequest(new { error = "runId is required and must be at most 200 characters" });

        var residues = new List<ResidueMatch>();
        var testTag = CreateTestTag(runId);
        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(cancellationToken);

        foreach (var target in ResidueTargets)
        {
            var entity = db.Model.FindEntityType(target.EntityType)
                ?? throw new InvalidOperationException($"Entity not mapped: {target.EntityType.Name}");
            var table = entity.GetTableName()
                ?? throw new InvalidOperationException($"Table not mapped: {target.EntityType.Name}");
            var store = StoreObjectIdentifier.Table(table, entity.GetSchema());
            var column = entity.FindProperty(target.PropertyName)?.GetColumnName(store)
                ?? throw new InvalidOperationException($"Property not mapped: {target.EntityType.Name}.{target.PropertyName}");

            await using var command = connection.CreateCommand();
            command.CommandTimeout = CommandTimeoutSeconds;
            command.CommandText = $"SELECT EXISTS (SELECT 1 FROM {Quote(entity.GetSchema() ?? "public")}.{Quote(table)} WHERE {Quote(column)} ILIKE @runId ESCAPE '\\' LIMIT 1)";
            var parameter = command.CreateParameter();
            parameter.ParameterName = "runId";
            parameter.Value = $"%{testTag}%";
            command.Parameters.Add(parameter);
            if (Convert.ToBoolean(await command.ExecuteScalarAsync(cancellationToken)))
            {
                residues.Add(new(target.EntityType.Name, target.PropertyName));
                if (residues.Count == MaxResults) break;
            }
        }

        return Results.Ok(new ResidueResponse(residues));
    }

    private static string Quote(string identifier) => $"\"{identifier.Replace("\"", "\"\"")}\"";

    private static bool HasShortPeriod(string value)
    {
        for (var length = 1; length <= 16; length++)
            if (value.Length % length == 0 && string.Concat(Enumerable.Repeat(value[..length], value.Length / length)) == value)
                return true;
        return false;
    }
}
