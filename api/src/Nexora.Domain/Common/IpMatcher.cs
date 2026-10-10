using System.Net;

namespace Nexora.Domain.Common;

public static class IpMatcher
{
    public static bool Matches(string? clientIp, IEnumerable<string> allowedEntries)
    {
        if (string.IsNullOrWhiteSpace(clientIp) || !IPAddress.TryParse(clientIp, out var ip))
            return false;

        if (ip.IsIPv4MappedToIPv6)
            ip = ip.MapToIPv4();

        foreach (var entry in allowedEntries)
        {
            var trimmed = entry?.Trim();
            if (string.IsNullOrEmpty(trimmed)) continue;

            if (trimmed.Contains('/'))
            {
                if (IPNetwork.TryParse(trimmed, out var network) && network.Contains(ip))
                    return true;
            }
            else if (IPAddress.TryParse(trimmed, out var single))
            {
                var normalized = single.IsIPv4MappedToIPv6 ? single.MapToIPv4() : single;
                if (normalized.Equals(ip))
                    return true;
            }
        }
        return false;
    }
}
