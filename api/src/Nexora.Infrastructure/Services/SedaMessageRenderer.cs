using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Services;

public static class SedaMessageRenderer
{
    public static string Render(string template, SedaApplication app)
    {
        var firstName = app.StudentName ?? string.Empty;
        var lastName = app.StudentSurname ?? string.Empty;
        var fullName = string.Join(' ', new[] { firstName, lastName }.Where(x => !string.IsNullOrWhiteSpace(x)));
        var rejectionReason = string.IsNullOrWhiteSpace(app.RejectionReason) ? string.Empty : app.RejectionReason;

        return (template ?? string.Empty)
            .Replace("{{ad}}", firstName)
            .Replace("{{soyad}}", lastName)
            .Replace("{{ogrenci_adi}}", fullName)
            .Replace("{{okul}}", app.SchoolName ?? string.Empty)
            .Replace("{{sinav_merkezi}}", app.ExamCenterName ?? string.Empty)
            .Replace("{{red_nedeni}}", rejectionReason);
    }
}
