using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using VaultSharp;
using VaultSharp.V1.AuthMethods.Token;

namespace Nexora.Infrastructure.Vault;

public static class VaultSecretManager
{
    public static IConfigurationBuilder AddVaultSecrets(
        this IConfigurationBuilder builder,
        IConfiguration config,
        ILoggerFactory? loggerFactory = null)
    {
        var logger = loggerFactory?.CreateLogger("Vault");
        if (!config.GetValue<bool>("Vault:Enabled"))
        {
            logger?.LogWarning("[VAULT-DIAG] Vault devre disi (Vault:Enabled=false) — secret yuklenmiyor. Nvi/Jwt/Minio creds bos kalir.");
            return builder;
        }

        try
        {
            var address     = config["Vault:Address"]!;
            var token       = config["Vault:Token"]!;
            var basePath    = config["Vault:SecretPath"]!;
            var mountPoint  = string.IsNullOrWhiteSpace(config["Vault:MountPoint"]) ? "secret" : config["Vault:MountPoint"]!;
            var environment = (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production").ToLowerInvariant();

            logger?.LogInformation("[VAULT-DIAG] Yukleniyor: address={Address} mount={Mount} base={Base} env={Env} tokenDolu={HasToken}",
                address, mountPoint, basePath, environment, !string.IsNullOrWhiteSpace(token));

            var authMethod    = new TokenAuthMethodInfo(token);
            var vaultSettings = new VaultClientSettings(address, authMethod);
            var client        = new VaultClient(vaultSettings);

            var merged = new Dictionary<string, string?>();
            // DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR Hangfire denetimi, madde #2): "hangfire" kategorisi
            // eklendi — Hangfire:DashboardUser/DashboardPassword önceden hiçbir Vault kategorisinden
            // okunmuyordu, prod'da appsettings.Production.json'da da tanımlı olmadığı için dashboard
            // credential'ları boş kalıyordu (Program.cs'teki fail-safe guard artık bu durumda
            // dashboard'u hiç mount etmiyor, ama asıl çözüm Vault'ta gerçek bir credential sağlamak).
            foreach (var category in new[] { "database", "main", "external", "hangfire" })
            {
                var fullPath = $"{basePath}/{environment}/{category}";
                try
                {
                    var secret = client.V1.Secrets.KeyValue.V2.ReadSecretAsync(path: fullPath, mountPoint: mountPoint)
                        .GetAwaiter().GetResult();
                    var count = secret?.Data?.Data?.Count ?? 0;
                    if (secret?.Data?.Data is not null)
                        foreach (var kv in secret.Data.Data)
                            merged[kv.Key] = kv.Value?.ToString() ?? "";
                    logger?.LogInformation("[VAULT-DIAG] {Path}: {Count} anahtar okundu", fullPath, count);
                }
                catch (Exception ex)
                {
                    logger?.LogWarning(ex, "[VAULT-DIAG] {Path} okunamadi", fullPath);
                }
            }

            var nviUserLoaded = merged.TryGetValue("Nvi:Username", out var nviUser) && !string.IsNullOrWhiteSpace(nviUser);
            var nviPassLoaded = merged.TryGetValue("Nvi:Password", out var nviPass) && !string.IsNullOrWhiteSpace(nviPass);

            if (merged.Count > 0)
            {
                builder.AddInMemoryCollection(merged);
                logger?.LogInformation("[VAULT-DIAG] Toplam {Count} secret yuklendi (base {Path}). Nvi:Username dolu={NviUser} Nvi:Password dolu={NviPass}",
                    merged.Count, $"{basePath}/{environment}", nviUserLoaded, nviPassLoaded);
            }
            else
            {
                logger?.LogWarning("[VAULT-DIAG] Hicbir secret yuklenemedi! base={Base} env={Env} — path/token/enabled kontrol et.", basePath, environment);
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "[VAULT-DIAG] Vault secret yuklemesi basarisiz. Defaults kullaniliyor.");
        }

        return builder;
    }
}
