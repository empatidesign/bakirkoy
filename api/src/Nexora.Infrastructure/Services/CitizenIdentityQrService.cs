using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenIdentity;

namespace Nexora.Infrastructure.Services;

public class CitizenIdentityQrService(IUnitOfWork uow, IConfiguration config, IRedisService redis) : ICitizenIdentityQrService
{
    private const string Prefix = "nxr-cid_";
    private const int WindowSeconds = 60;
    private const int ShortCodeLength = 10;
    private const string ShortCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const int MaxAttemptsPerCode = 5;

    private int ShortCodeTtlSeconds => ConfigurationBinder.GetValue(config, "QrSettings:ShortCodeTtlSeconds", 90);

    private byte[] SecretKey =>
        Encoding.UTF8.GetBytes(config["QrSettings:SecretKey"]
            ?? throw new InvalidOperationException("QrSettings:SecretKey yapılandırılmamış."));

    private static string ShortCodeKey(string code) => $"cid-qr:short:{code}";
    private static string ShortCodeAttemptsKey(string code) => $"cid-qr:short-attempts:{code}";

    public async Task<CitizenIdentityQrDto> GenerateAsync(Guid participantId, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var tcHash = HashShort(participant.Tckn);
        var telHash = participant.Phone is not null ? HashShort(participant.Phone) : "0";
        var day = DateTime.UtcNow.ToString("yyyyMMdd");
        var windowIndex = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / WindowSeconds;

        var payload = $"{participantId}|{tcHash}|{telHash}|{day}|{windowIndex}";
        var payloadB64 = Base64UrlEncode(Encoding.UTF8.GetBytes(payload));
        var hmac = ComputeHmac(payloadB64);
        var token = $"{Prefix}{payloadB64}.{hmac}";

        var windowStart = windowIndex * WindowSeconds;
        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(windowStart + WindowSeconds).UtcDateTime;

        var shortCode = await GenerateUniqueShortCodeAsync(ct);
        await redis.SetAsync(ShortCodeKey(shortCode), participantId, TimeSpan.FromSeconds(ShortCodeTtlSeconds), ct);

        return new CitizenIdentityQrDto(token, WindowSeconds, expiresAt, shortCode);
    }

    private async Task<string> GenerateUniqueShortCodeAsync(CancellationToken ct)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = RandomShortCode();
            if (!await redis.ExistsAsync(ShortCodeKey(code), ct))
                return code;
        }
        throw new InvalidOperationException("Kısa kod üretilemedi.");
    }

    private static string RandomShortCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(ShortCodeLength);
        var chars = new char[ShortCodeLength];
        for (var i = 0; i < ShortCodeLength; i++)
            chars[i] = ShortCodeAlphabet[bytes[i] % ShortCodeAlphabet.Length];
        return new string(chars);
    }

    private static string HashShort(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes)[..16].ToLowerInvariant();
    }

    private string ComputeHmac(string data)
    {
        using var hmac = new HMACSHA256(SecretKey);
        return Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(data)));
    }

    public async Task<(bool Success, Guid ParticipantId)> TryVerifyAsync(string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return (false, Guid.Empty);

        if (IsShortCode(token))
            return await TryVerifyShortCodeAsync(token, ct);

        return (TryVerifyRotatingToken(token, out var rotatingParticipantId), rotatingParticipantId);
    }

    private async Task<(bool Success, Guid ParticipantId)> TryVerifyShortCodeAsync(string code, CancellationToken ct)
    {
        var attemptsKey = ShortCodeAttemptsKey(code);
        var attempts = await redis.GetAsync<int?>(attemptsKey, ct) ?? 0;
        if (attempts >= MaxAttemptsPerCode)
            return (false, Guid.Empty);

        var participantId = await redis.GetAsync<Guid?>(ShortCodeKey(code), ct);
        if (participantId is not Guid pid || pid == Guid.Empty)
        {
            await redis.SetAsync(attemptsKey, attempts + 1, TimeSpan.FromSeconds(ShortCodeTtlSeconds), ct);
            return (false, Guid.Empty);
        }

        await redis.RemoveAsync(ShortCodeKey(code), ct);
        return (true, pid);
    }

    private static bool IsShortCode(string token) =>
        token.Length == ShortCodeLength && token.All(c => ShortCodeAlphabet.Contains(char.ToUpperInvariant(c)));

    private bool TryVerifyRotatingToken(string token, out Guid participantId)
    {
        participantId = Guid.Empty;
        if (!token.StartsWith(Prefix, StringComparison.Ordinal))
            return false;

        var withoutPrefix = token[Prefix.Length..];
        var dotIdx = withoutPrefix.LastIndexOf('.');
        if (dotIdx < 0) return false;

        var payloadB64 = withoutPrefix[..dotIdx];
        var providedHmac = withoutPrefix[(dotIdx + 1)..];

        if (providedHmac != ComputeHmac(payloadB64)) return false;

        string payload;
        try { payload = System.Text.Encoding.UTF8.GetString(Base64UrlDecode(payloadB64)); }
        catch { return false; }

        var parts = payload.Split('|');
        if (parts.Length < 5 || !Guid.TryParse(parts[0], out participantId)) return false;

        var currentWindow = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / WindowSeconds;
        if (!long.TryParse(parts[4], out var tokenWindow)) return false;
        if (Math.Abs(currentWindow - tokenWindow) > 1) return false;

        return true;
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private static byte[] Base64UrlDecode(string b64)
    {
        var padded = b64.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}
