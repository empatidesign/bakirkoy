using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;

namespace Nexora.Infrastructure.Services;

public interface IApiKeyEncryptor
{
    string Encrypt(string plainText);
    string? Decrypt(string? cipherText);

    string Mask(string plainText);
}

public class ApiKeyEncryptor : IApiKeyEncryptor
{
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private readonly byte[] _key;

    public ApiKeyEncryptor(IConfiguration config)
    {
        var secret = config["JwtSettings:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException("JwtSettings:SecretKey yapılandırılmamış — entegrasyon ayarları şifrelenemez.");
        _key = Rfc2898DeriveBytes.Pbkdf2(
            System.Text.Encoding.UTF8.GetBytes(secret),
            System.Text.Encoding.UTF8.GetBytes("nexora-integration-settings-salt-v1"),
            100_000, HashAlgorithmName.SHA256, 32);
    }

    public string Encrypt(string plainText)
    {
        var plainBytes = System.Text.Encoding.UTF8.GetBytes(plainText);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipherBytes = new byte[plainBytes.Length];
        var tag = new byte[TagSize];

        using var aesGcm = new AesGcm(_key, TagSize);
        aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);

        var combined = new byte[NonceSize + TagSize + cipherBytes.Length];
        Buffer.BlockCopy(nonce, 0, combined, 0, NonceSize);
        Buffer.BlockCopy(tag, 0, combined, NonceSize, TagSize);
        Buffer.BlockCopy(cipherBytes, 0, combined, NonceSize + TagSize, cipherBytes.Length);
        return Convert.ToBase64String(combined);
    }

    public string? Decrypt(string? cipherText)
    {
        if (string.IsNullOrWhiteSpace(cipherText)) return null;
        try
        {
            var combined = Convert.FromBase64String(cipherText);
            if (combined.Length < NonceSize + TagSize) return null;

            var nonce = combined[..NonceSize];
            var tag = combined[NonceSize..(NonceSize + TagSize)];
            var cipherBytes = combined[(NonceSize + TagSize)..];
            var plainBytes = new byte[cipherBytes.Length];

            using var aesGcm = new AesGcm(_key, TagSize);
            aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);
            return System.Text.Encoding.UTF8.GetString(plainBytes);
        }
        catch (Exception)
        {
            return null;
        }
    }

    public string Mask(string plainText)
    {
        if (string.IsNullOrWhiteSpace(plainText)) return string.Empty;
        if (plainText.Length <= 8) return new string('•', plainText.Length);
        var head = plainText[..4];
        var tail = plainText[^4..];
        return $"{head}••••{tail}";
    }
}
