using System.Net;
using Microsoft.Extensions.Configuration;

namespace Nexora.Infrastructure.Services;

// Shared private-network/SSRF allowlist guard extracted so `LibraryLockController` can reuse the
// exact same defense `FacilityDoorController` already had (Task 9 finding: the Library module's
// outbound lock-trigger path had NO such guard at all, unlike the Facility module's twin
// controller — a genuine, real asymmetry, fixed here by giving both controllers one shared
// implementation instead of leaving Library unguarded or duplicating the logic a second time).
// Config key (`DoorSecurity:AllowPublicTargets`) is REUSED, not duplicated, per the binding ruling
// in task-9-brief.md ("gated by the SAME DoorSecurity:AllowPublicTargets config key already used
// by FacilityDoorController").
public static class DoorSecurityGuard
{
    public static bool AllowPublicTargets(IConfiguration config) =>
        config.GetValue("DoorSecurity:AllowPublicTargets", false);

    public static async Task<bool> IsHostAllowedAsync(string? host, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(host)) return false;
        if (IPAddress.TryParse(host, out var literal)) return IsLoopbackOnly(literal);
        try
        {
            var addrs = await Dns.GetHostAddressesAsync(host, ct);
            if (addrs.Length == 0) return false;
            foreach (var a in addrs)
                if (!IsLoopbackOnly(a)) return false;
            return true;
        }
        catch
        {
            return false;
        }
    }

    // Task 9 (real finding, task-9-brief.md Ruling d/Report requirement): the default-deny SSRF
    // guard's allowlist is LOOPBACK ONLY, not the wider RFC1918 private-range set IsPrivateAddress
    // below still exposes for its OTHER, narrower callers (the HTTP-plaintext-password warning in
    // FacilityDoorController/LibraryLockController, which is a "don't send a plaintext credential
    // over LAN http" lever, not a network-isolation lever — see that call site's own comment). No
    // request may reach a real device IP by default: a LAN-private-but-not-loopback address like
    // 192.168.1.50 is exactly the shape of a real physical device on this network and must be
    // denied unless DoorSecurity:AllowPublicTargets is explicitly enabled, proven by
    // LibraryDeviceMatrixTests.SsrfGuard_PrivateButNotLoopback_DefaultDenied.
    private static bool IsLoopbackOnly(IPAddress addr)
    {
        if (addr.IsIPv4MappedToIPv6) addr = addr.MapToIPv4();
        return IPAddress.IsLoopback(addr);
    }

    public static bool IsPrivateAddress(string? ip)
        => IPAddress.TryParse(ip, out var addr) && IsPrivateAddress(addr);

    public static bool IsPrivateAddress(IPAddress addr)
    {
        if (IPAddress.IsLoopback(addr)) return true;
        if (addr.IsIPv4MappedToIPv6) addr = addr.MapToIPv4();
        var b = addr.GetAddressBytes();
        if (b.Length != 4) return false;
        return b[0] switch
        {
            10 => true,
            172 => b[1] >= 16 && b[1] <= 31,
            192 => b[1] == 168,
            169 => b[1] == 254,
            _ => false,
        };
    }
}
