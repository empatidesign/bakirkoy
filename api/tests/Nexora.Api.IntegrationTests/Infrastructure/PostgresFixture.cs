using Npgsql;
using Xunit;

namespace Nexora.Api.IntegrationTests.Infrastructure;

// Provides a REAL PostgreSQL database, unique per test collection, reusing the existing
// Docker/dev Postgres server (docker-compose service `nexora-postgres`, host port 34100).
//
// The repository's migration folder is not applicable from an empty database (its earliest
// baseline migrations were squashed out of source and later migrations conflict with the
// model), so the schema is materialized once from the current EF model via EnsureCreated and
// the full migration history is stamped so the hosted app sees zero pending migrations. That
// work is performed by NexoraApiFactory before the host boots. This fixture only owns the
// database lifecycle: it creates a fresh, empty, isolated database and drops it on disposal.
// No in-memory provider is ever substituted.
public sealed class PostgresFixture : IAsyncLifetime
{
    // Admin/maintenance connection to the shared dev Postgres. Overridable via env for CI.
    private const string DefaultAdminConnectionString =
        "Host=localhost;Port=34100;Database=postgres;Username=nexora_admin;Password=Nexora2026!";

    private readonly string _adminConnectionString =
        Environment.GetEnvironmentVariable("NEXORA_IT_ADMIN_POSTGRES") ?? DefaultAdminConnectionString;

    public string DatabaseName { get; } =
        $"nexora_it_{Guid.NewGuid():N}";

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        var builder = new NpgsqlConnectionStringBuilder(_adminConnectionString);
        var host = builder.Host;
        var port = builder.Port;
        var user = builder.Username;

        await using (var admin = new NpgsqlConnection(_adminConnectionString))
        {
            await admin.OpenAsync();
            await using var create = admin.CreateCommand();
            create.CommandText = $"CREATE DATABASE \"{DatabaseName}\"";
            await create.ExecuteNonQueryAsync();
        }

        ConnectionString = new NpgsqlConnectionStringBuilder(_adminConnectionString)
        {
            Database = DatabaseName,
        }.ConnectionString;

        Console.WriteLine(
            $"[PostgresFixture] Created real PostgreSQL database '{DatabaseName}' on {host}:{port} (user={user}).");
    }

    public async Task DisposeAsync()
    {
        try
        {
            NpgsqlConnection.ClearAllPools();
            await using var admin = new NpgsqlConnection(_adminConnectionString);
            await admin.OpenAsync();

            await using (var terminate = admin.CreateCommand())
            {
                terminate.CommandText =
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = @db AND pid <> pg_backend_pid()";
                terminate.Parameters.AddWithValue("db", DatabaseName);
                await terminate.ExecuteNonQueryAsync();
            }

            await using var drop = admin.CreateCommand();
            drop.CommandText = $"DROP DATABASE IF EXISTS \"{DatabaseName}\"";
            await drop.ExecuteNonQueryAsync();
            Console.WriteLine($"[PostgresFixture] Dropped real PostgreSQL database '{DatabaseName}'.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PostgresFixture] Cleanup of '{DatabaseName}' failed: {ex.Message}");
        }
    }
}
