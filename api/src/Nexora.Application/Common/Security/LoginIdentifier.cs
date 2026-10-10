namespace Nexora.Application.Common.Security;

/// <summary>
/// Kullanıcı isteği (2026-09-07): şifre sıfırlama e-posta VEYA telefon numarasıyla
/// başlatılabilir. Girilen metnin hangisi olduğunu tek yerde belirlemek için burası
/// kullanılır — validator ve servis aynı kararı vermek zorunda.
/// </summary>
public static class LoginIdentifier
{
    /// <summary>Metin "@" içeriyorsa e-posta kabul edilir.</summary>
    public static bool LooksLikeEmail(string? value)
        => !string.IsNullOrWhiteSpace(value) && value.Contains('@');

    /// <summary>Rakam dışı karakterler ayıklandığında en az 10 hane kalıyorsa telefondur.</summary>
    public static bool LooksLikePhone(string? value)
        => DigitsOf(value).Length is >= 10 and <= 15;

    public static string DigitsOf(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? ""
            : new string(value.Where(char.IsDigit).ToArray());

    /// <summary>
    /// Kullanıcı isteği (2026-09-25): firma ve personel girişinde telefon her biçimde
    /// ("5321234567", "0532 123 45 67", "+90 532 123 45 67") kabul edilsin. Kayıtlar
    /// "0XXXXXXXXXX" (11 hane) biçiminde tutulduğu için girdi o biçime çevrilir.
    /// Tanınmayan biçimde girdi kırpılmış hâliyle döner.
    /// </summary>
    public static string NormalizeTrPhone(string? value)
    {
        var digits = DigitsOf(value);
        if (digits.Length == 12 && digits.StartsWith("90")) return "0" + digits[2..];
        if (digits.Length == 11 && digits[0] == '0') return digits;
        if (digits.Length == 10 && digits[0] == '5') return "0" + digits;
        return value?.Trim() ?? "";
    }

    /// <summary>E-posta ya da telefon olarak tanınabiliyorsa geçerlidir.</summary>
    public static bool IsValid(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        return LooksLikeEmail(value)
            ? value.Trim().Length >= 5 && value.Contains('.', StringComparison.Ordinal)
            : LooksLikePhone(value);
    }
}
