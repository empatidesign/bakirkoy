using System.Net;
using System.Net.Http;
using System.Net.Sockets;

namespace Nexora.Infrastructure.Http;

// ULAK-05: admin tarafından girilebilen dış entegrasyon adreslerine (Ulakbel BaseUrl vb.) sunucudan
// istek atmadan ÖNCE tek kaynak SSRF doğrulaması. Hem bağlantı testi hem GERÇEK gönderim yolu bunu
// kullanır. Yalnızca https; hedef host'un çözümlendiği TÜM IP'ler özel/loopback/link-local/reserved
// olmamalı. IPv4-mapped IPv6 (::ffff:10.0.0.1) IPv4 aralığına indirgenerek kontrol edilir.
public static class OutboundUrlGuard
{
    public static bool TryValidate(string? rawUrl, out string error)
    {
        error = string.Empty;
        if (string.IsNullOrWhiteSpace(rawUrl))
        {
            error = "Hedef adres yapılandırılmamış.";
            return false;
        }

        if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var uri))
        {
            error = "Hedef adres geçersiz bir URL.";
            return false;
        }

        if (uri.Scheme != Uri.UriSchemeHttps)
        {
            error = "Güvenlik nedeniyle yalnızca https:// adreslerine istek atılabilir.";
            return false;
        }

        IPAddress[] addresses;
        try
        {
            addresses = Dns.GetHostAddresses(uri.Host);
        }
        catch
        {
            error = "Hedef adresin host adı çözümlenemedi.";
            return false;
        }

        if (addresses.Length == 0 || addresses.Any(IsPrivateOrReservedAddress))
        {
            error = "Güvenlik nedeniyle iç ağ/özel/loopback adreslerine istek atılamaz.";
            return false;
        }

        return true;
    }

    public static bool IsPrivateOrReservedAddress(IPAddress ip)
    {
        // IPv4-mapped IPv6 (::ffff:a.b.c.d) IPv4 aralık kontrolünü baypas etmesin.
        if (ip.AddressFamily == AddressFamily.InterNetworkV6 && ip.IsIPv4MappedToIPv6)
            ip = ip.MapToIPv4();

        if (IPAddress.IsLoopback(ip)) return true;

        var bytes = ip.GetAddressBytes();
        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            if (bytes[0] == 10) return true;
            if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
            if (bytes[0] == 192 && bytes[1] == 168) return true;
            if (bytes[0] == 169 && bytes[1] == 254) return true;
            if (bytes[0] == 127) return true;
            if (bytes[0] == 0) return true;
            if (bytes[0] == 100 && bytes[1] >= 64 && bytes[1] <= 127) return true;
            if (bytes[0] >= 224) return true;
        }
        else if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (ip.Equals(IPAddress.IPv6Any) || ip.Equals(IPAddress.IPv6None)) return true;
            if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast) return true;
            if ((bytes[0] & 0xfe) == 0xfc) return true;
        }

        return false;
    }

    public static async ValueTask<Stream> GuardedConnectAsync(SocketsHttpConnectionContext context, CancellationToken ct)
    {
        var host = context.DnsEndPoint.Host;
        var port = context.DnsEndPoint.Port;

        var addresses = IPAddress.TryParse(host, out var literal)
            ? [literal]
            : await Dns.GetHostAddressesAsync(host, ct);

        var safe = addresses.Where(a => !IsPrivateOrReservedAddress(a)).ToArray();
        if (safe.Length == 0)
            throw new IOException("Güvenlik nedeniyle iç ağ/özel/loopback adreslerine bağlanılamaz.");

        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(safe, port, ct);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }
}
