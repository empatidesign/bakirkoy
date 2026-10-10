using System.Text;
using Hangfire.Dashboard;

namespace Nexora.Api.Common.Hangfire;

public class HangfireAuthFilter(string username, string password) : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();
        var header = httpContext.Request.Headers.Authorization.ToString();

        if (header.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var encoded = header["Basic ".Length..].Trim();
                var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(encoded));
                var separator = decoded.IndexOf(':');
                if (separator > 0
                    && decoded[..separator] == username
                    && decoded[(separator + 1)..] == password)
                    return true;
            }
            catch (FormatException) { }
        }

        httpContext.Response.StatusCode = StatusCodes.Status401Unauthorized;
        httpContext.Response.Headers.WWWAuthenticate = "Basic realm=\"Hangfire\"";
        return false;
    }
}
