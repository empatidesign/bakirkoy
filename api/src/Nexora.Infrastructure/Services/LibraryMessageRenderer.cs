using System.Globalization;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Library notification template renderer. Supports {{placeholder}} interpolation shared by
/// automatic library notifications and manual/bulk messaging.
/// </summary>
public static class LibraryMessageRenderer
{
    private static readonly CultureInfo Tr = new("tr-TR");

    public static string Render(string template, string fullName, LibraryNotificationContext ctx)
    {
        var name = fullName ?? string.Empty;
        var spaceIdx = name.IndexOf(' ');
        var firstName = spaceIdx > 0 ? name[..spaceIdx] : name;
        var lastName = spaceIdx > 0 ? name[(spaceIdx + 1)..] : string.Empty;

        return (template ?? string.Empty)
            .Replace("{{ad}}", firstName)
            .Replace("{{soyad}}", lastName)
            .Replace("{{kutuphane}}", ctx.LibraryName)
            .Replace("{{tarih}}", (ctx.Date ?? DateTime.UtcNow).ToString("dd.MM.yyyy", Tr))
            .Replace("{{saat}}", (ctx.Date ?? DateTime.UtcNow).ToString("HH:mm", Tr))
            .Replace("{{sure}}", ctx.DurationMinutes?.ToString(Tr) ?? string.Empty)
            .Replace("{{kitap_sayisi}}", ctx.OverdueCount?.ToString(Tr) ?? string.Empty)
            .Replace("{{durum}}", ctx.StatusInfo ?? string.Empty)
            .Replace("{{mesaj}}", ctx.Message ?? string.Empty);
    }
}
