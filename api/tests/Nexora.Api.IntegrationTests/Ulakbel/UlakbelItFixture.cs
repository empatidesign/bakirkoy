using Microsoft.EntityFrameworkCore;
using Nexora.Infrastructure.Persistence;
using Npgsql;
using StackExchange.Redis;
using Xunit;

namespace Nexora.Api.IntegrationTests.Ulakbel;

// GERÇEK PostgreSQL (izole, test-özel veritabanı) + GERÇEK Redis sağlar. Şema mevcut EF modelinden
// EnsureCreated ile oluşturulur (CitizenSubmissions için migration zinciri gerekmez; TrackingNo unique
// index modelden gelir). Redis, docker-compose'daki nexora-redis'e (veya NEXORA_IT_REDIS) bağlanır.
// Bağlantılar NEXORA_IT_ADMIN_POSTGRES / NEXORA_IT_REDIS ile CI/host-dışı ortamlar için override edilebilir.
public sealed class UlakbelItFixture : IAsyncLifetime
{
    private const string DefaultAdmin =
        "Host=localhost;Port=34100;Database=postgres;Username=nexora_admin;Password=Nexora2026!";
    private const string DefaultRedis = "localhost:34200,password=NexoraRedis2026!";

    private readonly string _admin =
        Environment.GetEnvironmentVariable("NEXORA_IT_ADMIN_POSTGRES") ?? DefaultAdmin;
    private readonly string _redisConn =
        Environment.GetEnvironmentVariable("NEXORA_IT_REDIS") ?? DefaultRedis;

    public string DatabaseName { get; } = $"nexora_ulakit_{Guid.NewGuid():N}";
    public string ConnectionString { get; private set; } = string.Empty;
    public IConnectionMultiplexer Redis { get; private set; } = null!;

    private DbContextOptions<AppDbContext> _options = null!;

    public AppDbContext NewDb() => new(_options);

    public async Task InitializeAsync()
    {
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

        await using (var admin = new NpgsqlConnection(_admin))
        {
            await admin.OpenAsync();
            await using var create = admin.CreateCommand();
            create.CommandText = $"CREATE DATABASE \"{DatabaseName}\"";
            await create.ExecuteNonQueryAsync();
        }

        ConnectionString = new NpgsqlConnectionStringBuilder(_admin) { Database = DatabaseName }.ConnectionString;
        _options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options;

        await using (var db = NewDb())
            await db.Database.EnsureCreatedAsync();

        Redis = await ConnectionMultiplexer.ConnectAsync(_redisConn);
    }

    public async Task DisposeAsync()
    {
        try { Redis?.Dispose(); } catch { }
        try
        {
            NpgsqlConnection.ClearAllPools();
            await using var admin = new NpgsqlConnection(_admin);
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
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UlakbelItFixture] Cleanup of '{DatabaseName}' failed: {ex.Message}");
        }
    }
}

[CollectionDefinition(UlakbelItCollection.Name)]
public sealed class UlakbelItCollection : ICollectionFixture<UlakbelItFixture>
{
    public const string Name = "Ulakbel forward (real PostgreSQL + real Redis)";
}
