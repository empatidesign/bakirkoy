using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Interfaces;

namespace Nexora.Infrastructure.Services;

public class QrTokenService(IConfiguration config) : IQrTokenService
{
    private const string Prefix = "nxr_";

    private byte[] SecretKey =>
        Encoding.UTF8.GetBytes(config["QrSettings:SecretKey"]
            ?? throw new InvalidOperationException("QrSettings:SecretKey yapılandırılmamış."));

    public string Generate(Guid subjectId, string context, int windowSeconds)
    {
        var windowIndex = GetWindowIndex(windowSeconds);
        var payloadB64 = EncodePayload(subjectId, context, windowIndex);
        var hmac = ComputeHmac(payloadB64);
        return $"{Prefix}{payloadB64}.{hmac}";
    }

    public bool Verify(string token, Guid subjectId, string context, int windowSeconds, int toleranceWindows = 1)
    {
        if (!TryDecompose(token, out var payloadB64, out var signature)) return false;
        if (!ConstantTimeEquals(ComputeHmac(payloadB64), signature)) return false;
        if (!TryDecodePayload(payloadB64, out var tSubject, out var tContext, out var tWindow)) return false;
        if (tSubject != subjectId || tContext != context) return false;

        var currentWindow = GetWindowIndex(windowSeconds);
        return Math.Abs(currentWindow - tWindow) <= toleranceWindows;
    }

    public bool TryParseSubjectId(string token, out Guid subjectId)
    {
        subjectId = Guid.Empty;
        if (!TryDecompose(token, out var payloadB64, out _)) return false;
        return TryDecodePayload(payloadB64, out subjectId, out _, out _);
    }

    public bool TryParseContext(string token, out string context)
    {
        context = "";
        if (!TryDecompose(token, out var payloadB64, out _)) return false;
        return TryDecodePayload(payloadB64, out _, out context, out _);
    }

    public bool IsRotatingToken(string token) =>
        !string.IsNullOrWhiteSpace(token) && token.StartsWith(Prefix, StringComparison.Ordinal);

    private static long GetWindowIndex(int windowSeconds) =>
        DateTimeOffset.UtcNow.ToUnixTimeSeconds() / windowSeconds;

    private static string EncodePayload(Guid subjectId, string context, long windowIndex)
    {
        var raw = $"{subjectId}|{context}|{windowIndex}";
        return Base64UrlEncode(Encoding.UTF8.GetBytes(raw));
    }

    private static bool TryDecodePayload(string payloadB64, out Guid subjectId, out string context, out long windowIndex)
    {
        subjectId = Guid.Empty;
        context = "";
        windowIndex = 0;
        try
        {
            var raw = Encoding.UTF8.GetString(Base64UrlDecode(payloadB64));
            var parts = raw.Split('|');
            if (parts.Length != 3) return false;
            if (!Guid.TryParse(parts[0], out subjectId)) return false;
            context = parts[1];
            return long.TryParse(parts[2], out windowIndex);
        }
        catch { return false; }
    }

    private static bool TryDecompose(string token, out string payloadB64, out string signature)
    {
        payloadB64 = "";
        signature = "";
        if (!token.StartsWith(Prefix, StringComparison.Ordinal)) return false;
        var body = token[Prefix.Length..];
        var dot = body.LastIndexOf('.');
        if (dot <= 0) return false;
        payloadB64 = body[..dot];
        signature = body[(dot + 1)..];
        return true;
    }

    private string ComputeHmac(string data)
    {
        using var hmac = new HMACSHA256(SecretKey);
        return Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(data)));
    }

    private static bool ConstantTimeEquals(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private static byte[] Base64UrlDecode(string s) =>
        Convert.FromBase64String(
            s.Replace('-', '+').Replace('_', '/')
             .PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
}
