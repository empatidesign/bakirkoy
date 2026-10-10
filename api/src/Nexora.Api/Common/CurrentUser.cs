using System.Net;
using System.Security.Claims;
using Nexora.Application.Common.Interfaces;

namespace Nexora.Api.Common;

public class CurrentUser(IHttpContextAccessor httpContextAccessor, IConfiguration configuration) : ICurrentUser
{
    private ClaimsPrincipal? User => httpContextAccessor.HttpContext?.User;

    public Guid? Id
    {
        get
        {
            var raw = User?.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? User?.FindFirstValue("sub");
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public string? Name => User?.FindFirstValue(ClaimTypes.Name)
                        ?? User?.FindFirstValue("name");

    public string? Email => User?.FindFirstValue(ClaimTypes.Email)
                         ?? User?.FindFirstValue("email");

    public string? Role => User?.FindFirstValue("role_name");

    public bool IsSuperAdmin => string.Equals(User?.FindFirstValue("is_super_admin"), "true", StringComparison.OrdinalIgnoreCase);

    public bool MustChangePassword => string.Equals(User?.FindFirstValue("must_change_password"), "true", StringComparison.OrdinalIgnoreCase);

    public string? UserType => User?.FindFirstValue("user_type");

    public string? Platform => httpContextAccessor.HttpContext?.Request.Headers["X-Client-Platform"].FirstOrDefault();

    public string? IpAddress => ResolveIpAddress();

    public string? ConnectionIpAddress => NormalizeIp(httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString());

    public string? UserAgent => httpContextAccessor.HttpContext?.Request.Headers.UserAgent;

    public string? SessionId => User?.FindFirstValue("sessionId");

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true;

    public Guid? CompanyStaffCompanyId
    {
        get
        {
            var raw = User?.FindFirstValue("companyId");
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public bool CanRedeem
    {
        get
        {
            var userType = User?.FindFirstValue("user_type");
            if (userType != "company_staff") return true;
            return string.Equals(User?.FindFirstValue("can_redeem"), "true", StringComparison.OrdinalIgnoreCase);
        }
    }

    public bool CanManageCampaigns
    {
        get
        {
            var userType = User?.FindFirstValue("user_type");
            if (userType != "company_staff") return true;
            return string.Equals(User?.FindFirstValue("can_manage_campaigns"), "true", StringComparison.OrdinalIgnoreCase);
        }
    }

    private string? ResolveIpAddress()
    {
        var context = httpContextAccessor.HttpContext;
        if (context is null) return null;

        var connectionIp = NormalizeIp(context.Connection.RemoteIpAddress?.ToString());

        var trusted = configuration.GetSection("Security:TrustedProxies").Get<string[]>() ?? [];
        if (!ShouldTrustForwardedHeaders(context.Connection.RemoteIpAddress, trusted))
            return connectionIp;

        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwardedFor))
        {
            var hops = forwardedFor.Split(',')
                .Select(NormalizeIp)
                .Where(h => !string.IsNullOrEmpty(h))
                .ToList();
            for (var i = hops.Count - 1; i >= 0; i--)
                if (!Nexora.Domain.Common.IpMatcher.Matches(hops[i]!, trusted))
                    return hops[i];
        }

        var realIp = NormalizeIp(context.Request.Headers["X-Real-IP"].FirstOrDefault());
        if (!string.IsNullOrEmpty(realIp)) return realIp;

        return connectionIp;
    }

    private static bool ShouldTrustForwardedHeaders(IPAddress? remote, string[] trusted)
    {
        if (trusted.Length == 0) return false;
        if (remote is null) return false;

        return Nexora.Domain.Common.IpMatcher.Matches(remote.ToString(), trusted);
    }

    private static string? NormalizeIp(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var value = raw.Trim();
        if (IPAddress.TryParse(value, out var parsed))
            return parsed.IsIPv4MappedToIPv6 ? parsed.MapToIPv4().ToString() : parsed.ToString();

        return value;
    }
}
