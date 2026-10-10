using System.Security.Cryptography;

namespace Nexora.Infrastructure.Security;

/// <summary>
/// Kullanıcı isteği (2026-09-21): admin panelde hesap oluşturup "şifre gönder"
/// dendiğinde giden geçici şifre <b>çok karmaşık olmasın</b> — kullanıcı onu
/// telefondan/mailden okuyup elle yazacak. Bu yüzden yalnız büyük harf +
/// rakam kullanılır (küçük harf ve sembol yok), karıştırılabilir karakterler
/// (I/O/0/1) hariç tutulur, varsayılan uzunluk 8'dir (bkz.
/// <c>PasswordPolicy:GeneratedLength</c>).
/// <para>
/// Bu üretici hem hesap oluşturma/şifre sıfırlama (Admin/Company/Participant/
/// ScopedStaff) hem de "şifremi unuttum" (<see cref="Nexora.Infrastructure.Services.AuthService.ForgotPasswordAsync"/>)
/// akışlarında kullanılır — ikisi de <b>aynı algoritma</b> ile üretilsin diye.
/// </para>
/// </summary>
public static class PasswordGenerator
{
    public const string MockPassword = "sultangazi";

    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Digits = "23456789";

    public static string Generate(int length, bool useMock = false)
    {
        if (useMock) return MockPassword;

        var size = length < 8 ? 8 : length;
        var pools = new[] { Upper, Digits };
        var all = Upper + Digits;

        var chars = new char[size];

        for (var i = 0; i < pools.Length; i++)
            chars[i] = PickFrom(pools[i]);

        for (var i = pools.Length; i < size; i++)
            chars[i] = PickFrom(all);

        Shuffle(chars);
        return new string(chars);
    }

    private static char PickFrom(string pool)
    {
        var index = RandomNumberGenerator.GetInt32(pool.Length);
        return pool[index];
    }

    private static void Shuffle(char[] chars)
    {
        for (var i = chars.Length - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }
    }
}
