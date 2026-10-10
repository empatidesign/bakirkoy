using System.Security.Cryptography;
using System.Text;

namespace Nexora.Infrastructure.Services;

public static class LiderTekCrypto
{
    // LiderTek PN-1000P (ve aynı ailedeki diğer modeller) cihazının kendi web panelindeki
    // "Şifre" (BAUTHP / Basic-Auth password) alanı en fazla 31 karakter kabul ediyor.
    // Guid.NewGuid().ToString("N") her zaman 32 hex karakter üretir; bu anahtar cihaza
    // yazılmaya çalışılınca son karakter kesilip form submit'i tutarsız/bozuk bir değer
    // kaydediyor, bu da cihaz<->API kimlik doğrulamasının sessizce başarısız olmasına yol
    // açıyor (Hikmet Baysal Giriş cihazında 2026-08-27'de canlı tespit edildi — ApiKey DB'de
    // 32 karakterdi, cihazda 31 karaktere kesilmiş haliyle farklı bir değer olarak duruyordu).
    // Bu yüzden tüm LiderTek uyumlu cihaz ApiKey'leri SADECE bu metotla üretilmeli.
    public const int DeviceApiKeyLength = 31;
    public static string GenerateDeviceApiKey() => Guid.NewGuid().ToString("N")[..DeviceApiKeyLength];

    private static readonly Encoding PayloadEncoding = ResolvePayloadEncoding();
    private static readonly byte[] ZeroIv = new byte[16];

    private static Encoding ResolvePayloadEncoding()
    {
        try
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding("iso-8859-9");
        }
        catch (Exception)
        {
            return Encoding.Latin1;
        }
    }

    public static byte[] DeriveKeyFromDeviceId(long deviceId)
    {
        var id = (uint)deviceId;
        var key = new byte[32];
        for (var i = 0; i < 8; i++)
        {
            var p = i * 4;
            key[p + 0] = (byte)(id >> 24);
            key[p + 1] = (byte)(id >> 16);
            key[p + 2] = (byte)(id >> 8);
            key[p + 3] = (byte)id;
        }
        return key;
    }

    public static byte[] NormalizeKey(byte[] password)
    {
        if (password.Length == 32) return password;
        var key = new byte[32];
        Array.Copy(password, key, Math.Min(32, password.Length));
        return key;
    }

    public static string? DecryptToText(string base64Cipher, byte[] key)
    {
        try
        {
            var cipher = Convert.FromBase64String(base64Cipher);
            using var aes = Aes.Create();
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;
            aes.Key = key;
            aes.IV = ZeroIv;
            using var decryptor = aes.CreateDecryptor();
            var plain = decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
            return PayloadEncoding.GetString(plain);
        }
        catch (Exception)
        {
            return null;
        }
    }

    public static string EncryptText(string plainText, byte[] key)
    {
        var plain = PayloadEncoding.GetBytes(plainText);
        using var aes = Aes.Create();
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;
        aes.Key = key;
        aes.IV = ZeroIv;
        using var encryptor = aes.CreateEncryptor();
        var cipher = encryptor.TransformFinalBlock(plain, 0, plain.Length);
        return Convert.ToBase64String(cipher);
    }
}
