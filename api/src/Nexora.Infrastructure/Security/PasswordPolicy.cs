using System.Text.RegularExpressions;

namespace Nexora.Infrastructure.Security;

/// <summary>
/// Ortak şifre karmaşıklık politikası. Platformda daha önce iki farklı ve
/// tutarsız şifre politikası uygulanıyordu: ResetPasswordRequestValidator
/// (8 karakter + büyük harf + rakam zorunlu) ve AuthService.ChangePasswordAsync/
/// ChangeInitialPasswordAsync (yalnızca 8 karakter uzunluk kontrolü, karmaşıklık
/// yok). 2026-07-30 denetiminde canlı testte kanıtlandı: süper yönetici dahil
/// herhangi bir admin, mevcut şifresini bilerek tamamen sayısal "12345678" gibi
/// son derece zayıf bir şifreye geçebiliyordu. Artık tüm şifre değiştirme
/// akışları bu ortak kuralı kullanıyor.
/// </summary>
public static class PasswordPolicy
{
    // SORUN (2026-09-23, gerçek API testiyle kanıtlandı): Bu kurallar yalnızca
    // ASCII arıyordu ([A-Z] / [0-9]). Türkçe büyük harfler (Ş, Ğ, Ü, Ö, Ç, İ)
    // "büyük harf" sayılmıyordu; "Şifre123" gibi tamamen geçerli ve güçlü bir
    // şifre "Şifre en az bir büyük harf içermelidir." hatasıyla REDDEDİLİYORDU.
    // Türkçe bir belediye uygulamasında bu doğrudan vatandaşı engelleyen bir kusur.
    // Artık Unicode kategorileri kullanılır: \p{Lu} her dildeki büyük harfi,
    // \p{Nd} her ondalık rakamı kapsar. Kural ZAYIFLAMAZ, yalnızca ASCII dışını
    // da doğru sayar.
    private static readonly Regex UppercaseRegex = new(@"\p{Lu}", RegexOptions.Compiled);
    private static readonly Regex DigitRegex = new(@"\p{Nd}", RegexOptions.Compiled);

    public static void EnsureValid(string? newPassword, string fieldNameForError = "newPassword")
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
            throw new Nexora.Application.Common.Exceptions.ValidationException(
                "Yeni şifre en az 8 karakter olmalıdır.",
                new Dictionary<string, string[]> { [fieldNameForError] = ["Yeni şifre en az 8 karakter olmalıdır."] });

        if (!UppercaseRegex.IsMatch(newPassword))
            throw new Nexora.Application.Common.Exceptions.ValidationException(
                "Yeni şifre en az bir büyük harf içermelidir.",
                new Dictionary<string, string[]> { [fieldNameForError] = ["Yeni şifre en az bir büyük harf içermelidir."] });

        if (!DigitRegex.IsMatch(newPassword))
            throw new Nexora.Application.Common.Exceptions.ValidationException(
                "Yeni şifre en az bir rakam içermelidir.",
                new Dictionary<string, string[]> { [fieldNameForError] = ["Yeni şifre en az bir rakam içermelidir."] });
    }
}
