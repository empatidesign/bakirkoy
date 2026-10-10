namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-08-11): Quiz/Anket/Çark(Hediye)/Muhtarlık modüllerinin ortak
/// {{placeholder}} render motoru. Diğer modüllerdeki (Travel/Library/Seda) özel renderer'lardan
/// farklı olarak, modüle özgü değişkenler sabit kodlu değil, çağıran serviste bir sözlük
/// (extraVars) olarak geçirilir — böylece 4 farklı modül için 4 ayrı renderer dosyası yazmak
/// yerine tek motor paylaşılır. {{ad}}/{{soyad}} her zaman otomatik ayrıştırılır.
/// </summary>
public static class ModuleMessageRenderer
{
    public static string Render(string template, string fullName, IReadOnlyDictionary<string, string?>? extraVars = null)
    {
        var name = fullName ?? string.Empty;
        var spaceIdx = name.IndexOf(' ');
        var firstName = spaceIdx > 0 ? name[..spaceIdx] : name;
        var lastName = spaceIdx > 0 ? name[(spaceIdx + 1)..] : string.Empty;

        var result = (template ?? string.Empty)
            .Replace("{{ad}}", firstName)
            .Replace("{{soyad}}", lastName);

        if (extraVars is null) return result;
        foreach (var (key, value) in extraVars)
            result = result.Replace("{{" + key + "}}", value ?? string.Empty);
        return result;
    }
}
