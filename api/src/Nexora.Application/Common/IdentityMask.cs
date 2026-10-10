namespace Nexora.Application.Common;

public static class IdentityMask
{
    public static string MaskTckn(string tckn)
        => tckn.Length == 11 ? string.Concat(tckn.AsSpan(0, 3), new string('*', 8)) : tckn;

    public static string MaskName(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        var chars = name.ToCharArray();
        var wordStart = 0;
        for (var i = 0; i < chars.Length; i++)
        {
            if (chars[i] == ' ')
                wordStart = i + 1;
            else if (i - wordStart >= 2)
                chars[i] = '*';
        }
        return new string(chars);
    }

    public static string MaskNameStrict(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        var chars = name.ToCharArray();
        var wordStart = 0;
        for (var i = 0; i < chars.Length; i++)
        {
            if (chars[i] == ' ')
                wordStart = i + 1;
            else if (i - wordStart >= 1)
                chars[i] = '*';
        }
        return new string(chars);
    }

    public static string MaskPhoneStrict(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return "";
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length > 0 && digits[0] == '0')
            digits = digits[1..];
        if (digits.Length < 5)
            return new string('*', digits.Length);
        var prefix = digits[..3];
        var suffix = digits[^2..];
        return $"{prefix}****{suffix}";
    }

    public static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return "";
        var atIndex = email.IndexOf('@');
        if (atIndex <= 1) return "***" + (atIndex >= 0 ? email[atIndex..] : "");
        var username = email[..atIndex];
        var domain = email[atIndex..];
        var visible = username.Length <= 3 ? username[..1] : username[..2];
        return $"{visible}***{domain}";
    }

    public static string MaskAddress(string? address)
    {
        if (string.IsNullOrWhiteSpace(address)) return "";
        var parts = address.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length <= 2)
            return string.Join(" ", parts.Select(p => p.Length > 2 ? p[..2] + "***" : "***"));

        var maskedParts = parts.Select((p, idx) =>
        {
            if (idx < 2) return p;
            if (p.Any(char.IsDigit) || p.Contains('/') || p.Contains("no", StringComparison.OrdinalIgnoreCase))
                return "***";
            return p.Length > 2 ? p[..2] + "***" : "***";
        });
        return string.Join(" ", maskedParts);
    }

    // SORUN (2026-09-23, kullanıcı bulgusu): admin panelde "Katılımcı Düzenle" formu, liste
    // ekranından gelen ParticipantDto'daki MaskIdentity=true iken maskelenmiş telefon/e-posta
    // değerlerini (ör. "532****33") doğrudan form state'ine dolduruyordu. PhoneInput bileşeni
    // yalnızca rakamları koruduğu için "*" karakterleri silinip elde "53233" gibi eksik/bozuk
    // bir numara kalıyordu — kullanıcı bunu "telefon eksik" olarak görüyordu. Daha da kötüsü,
    // admin telefona hiç dokunmadan formu kaydetse bile bu bozuk değer UpdateContact ile GERÇEK
    // telefon numarasının üzerine yazılıp veri kalıcı olarak bozuluyordu. Bu yardımcı, maskeleme
    // deseniyle eşleşen (ör. "532****33" veya sadece "*" dizisi) girdileri tespit eder; UpdateAsync
    // böyle bir değer görürse "değişmemiş" sayıp mevcut kaydı korur.
    public static bool LooksMasked(string? value)
        => !string.IsNullOrEmpty(value) && value.Contains('*');
}
