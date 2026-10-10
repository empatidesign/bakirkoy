using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Companies (Firma) modülü bildirim şablon işleyicisi. {{placeholder}} interpolasyonu
/// LibraryMessageRenderer/SedaMessageRenderer ile aynı deseni izler.
/// </summary>
public static class CompanyMessageRenderer
{
    public static string Render(string template, CompanyNotificationContext ctx)
        => (template ?? string.Empty)
            .Replace("{{firma}}", ctx.CompanyName)
            .Replace("{{sifre}}", ctx.Password ?? string.Empty);
}
