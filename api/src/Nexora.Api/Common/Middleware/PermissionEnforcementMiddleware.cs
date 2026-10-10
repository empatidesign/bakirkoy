using Microsoft.Extensions.Caching.Memory;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;

namespace Nexora.Api.Common.Middleware;

public class PermissionEnforcementMiddleware(RequestDelegate next)
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);

    // SORUN (2026-09-23, gerçek entegrasyon testi çalıştırılırken bulundu): bu metot
    // `IRedisService? redis = null` şeklinde OPSİYONEL bir parametre bildiriyordu. C#
    // seviyesinde opsiyonel görünse de ASP.NET Core middleware'i InvokeAsync
    // parametrelerini DI'dan ZORUNLU olarak çözer — varsayılan değer dikkate alınmaz.
    // IRedisService yalnızca ConnectionStrings:Redis doluyken kayıtlı olduğundan
    // (bkz. DependencyInjection.cs ~318), Redis'siz bir ortamda yetki gerektiren HER
    // istek DI hatasıyla 500 dönüyordu ("Unable to resolve service for type
    // IRedisService while attempting to Invoke middleware"). DI kaydının yanındaki
    // "Redis yapılandırılmamışsa ... uygulama çalışmaya devam eder" notu bu yüzden
    // fiilen yanlıştı. Servis artık RequestServices üzerinden opsiyonel çözülüyor.
    public async Task InvokeAsync(
        HttpContext context,
        ICurrentUser currentUser,
        IUnitOfWork uow,
        IMemoryCache? memoryCache = null)
    {
        var redis = context.RequestServices.GetService<IRedisService>();
        var required = context.GetEndpoint()?.Metadata.GetMetadata<RequirePermissionMetadata>();
        if (required is null)
        {
            await next(context);
            return;
        }

        if (currentUser.IsSuperAdmin)
        {
            await next(context);
            return;
        }

        if (currentUser.Id is not Guid userId || !await HasPermissionCachedAsync(uow, userId, required.PermissionKeys, memoryCache, redis, context.RequestAborted))
            throw new ForbiddenException("Bu işlem için yetkiniz bulunmuyor.", "FORBIDDEN");

        await next(context);
    }

    private static async Task<bool> HasPermissionCachedAsync(
        IUnitOfWork uow,
        Guid userId,
        string[] permissionKeys,
        IMemoryCache? memoryCache,
        IRedisService? redis,
        CancellationToken ct)
    {
        var cacheKey = $"auth:admin-perms:{userId}";

        if (memoryCache != null && memoryCache.TryGetValue(cacheKey, out HashSet<string>? memKeys) && memKeys is not null)
        {
            return permissionKeys.Any(k => memKeys.Contains(k));
        }

        if (redis != null)
        {
            var redisKeysList = await redis.GetAsync<List<string>>(cacheKey, ct);
            if (redisKeysList is not null)
            {
                var keysSet = redisKeysList.ToHashSet(StringComparer.OrdinalIgnoreCase);
                memoryCache?.Set(cacheKey, keysSet, CacheDuration);
                return permissionKeys.Any(k => keysSet.Contains(k));
            }
        }

        var resolvedKeys = await ResolveUserPermissionsAsync(uow, userId, ct);
        var resolvedSet = resolvedKeys.ToHashSet(StringComparer.OrdinalIgnoreCase);

        memoryCache?.Set(cacheKey, resolvedSet, CacheDuration);
        if (redis != null)
        {
            await redis.SetAsync(cacheKey, resolvedKeys, CacheDuration, ct);
        }

        return permissionKeys.Any(k => resolvedSet.Contains(k));
    }

    private static async Task<List<string>> ResolveUserPermissionsAsync(IUnitOfWork uow, Guid userId, CancellationToken ct)
    {
        var user = await uow.AdminUsers.GetByIdAsync(userId, ct);
        if (user is null) return [];
        var roleId = user.RoleId;

        var permissionIds = await uow.RolePermissions.GetPermissionIdsByRoleAsync(roleId, ct);
        if (permissionIds.Count == 0) return [];

        var permissions = await uow.Permissions.GetByIdsAsync(permissionIds, ct);
        return permissions.Select(p => p.Key).ToList();
    }
}
