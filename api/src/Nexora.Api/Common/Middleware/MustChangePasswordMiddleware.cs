using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;

namespace Nexora.Api.Common.Middleware;

public class MustChangePasswordMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> AllowedPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/v1/auth/change-initial-password",
        "/api/v1/auth/change-password",
        "/api/v1/auth/me",
        "/api/v1/auth/session-check",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
        "/api/v1/auth/citizen/change-initial-password",
        "/api/v1/auth/citizen/change-password",
        "/api/v1/auth/citizen/me",
        "/api/v1/auth/citizen/logout",
        "/api/v1/auth/citizen/refresh",
        "/api/v1/auth/company/change-initial",
        "/api/v1/auth/company/change-password",
        "/api/v1/auth/company/me",
        "/api/v1/auth/company/logout",
        "/api/v1/auth/company/refresh",
    };

    public async Task InvokeAsync(HttpContext context, ICurrentUser currentUser, IUnitOfWork uow)
    {
        if (currentUser.MustChangePassword && !IsAllowed(context.Request.Path)
            && await StillMustChangeAsync(currentUser, uow, context.RequestAborted))
            throw new ForbiddenException("Devam etmeden önce geçici şifrenizi değiştirmeniz gerekiyor.", "MUST_CHANGE_PASSWORD");

        await next(context);
    }

    private static bool IsAllowed(PathString path)
    {
        var value = path.Value?.TrimEnd('/');
        return !string.IsNullOrEmpty(value) && AllowedPaths.Contains(value);
    }

    private static async Task<bool> StillMustChangeAsync(ICurrentUser currentUser, IUnitOfWork uow, CancellationToken ct)
    {
        if (currentUser.Id is not Guid id) return false;
        return currentUser.UserType switch
        {
            "admin" => (await uow.AdminUsers.GetByIdAsync(id, ct))?.MustChangePassword ?? false,
            "citizen" => (await uow.Participants.GetByIdAsync(id, ct))?.MustChangePassword ?? false,
            "company" => (await uow.Companies.GetByIdAsync(id, ct))?.IsFirstLogin ?? false,
            _ => false,
        };
    }
}
