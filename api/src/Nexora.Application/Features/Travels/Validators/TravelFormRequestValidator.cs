using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using FluentValidation;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels.Validators;

public class TravelFormRequestValidator : AbstractValidator<TravelFormRequest>
{
    // SORUN 3 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı):
    // frontend'in EmailInput hata mesajı kozmetikti, hiçbir katman gerçek format
    // kontrolü yapmıyordu — "gecersiz-email-format" (@ işareti bile yok) backend'e
    // sorunsuzca kaydediliyordu. citizen-portal/admin-panel EmailInput ile aynı regex.
    private static readonly Regex EmailRegex = new(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.Compiled);

    public TravelFormRequestValidator()
    {
        RuleFor(x => x.RouteId)
            .NotEmpty().WithMessage("Gezi (rota) seçimi zorunludur.");

        RuleFor(x => x.StartDate)
            .NotEmpty().WithMessage("Gidiş tarihi zorunludur.");

        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("Dönüş tarihi gidiş tarihinden önce olamaz.");

        RuleFor(x => x.RegistrationEndDate)
            .GreaterThanOrEqualTo(x => x.RegistrationStartDate)
            .WithMessage("Kayıt bitiş tarihi kayıt başlangıcından önce olamaz.");

        RuleFor(x => x.Capacity)
            .GreaterThan(0).WithMessage("Kontenjan en az 1 olmalıdır.");

        RuleFor(x => x.CancellationDeadlineHours)
            .InclusiveBetween(0, 720).WithMessage("İptal süresi 0 ile 720 saat arasında olmalıdır.");

        RuleFor(x => x.Crew)
            .Must(HasValidDriverTcknIfProvided)
            .WithMessage("Şoför TC kimlik numarası girildiyse 11 haneli olmalıdır.");

        RuleFor(x => x.Crew)
            .Must(HasValidGuideAccessInfo)
            .WithMessage("Sisteme erişim verilecek sorumlu kişinin adı ve e-postası zorunludur.");

        RuleFor(x => x.Crew)
            .Must(HasValidResponsibleEmailFormatIfProvided)
            .WithMessage("Sorumlu kişinin e-postası girildiyse geçerli bir formatta olmalıdır.");
    }

    private static bool HasValidDriverTcknIfProvided(JsonElement crew)
    {
        if (crew.ValueKind != JsonValueKind.Object) return true;
        if (!crew.TryGetProperty("driver", out var driver) || driver.ValueKind != JsonValueKind.Object) return true;
        if (!driver.TryGetProperty("tckn", out var tcknEl) || tcknEl.ValueKind != JsonValueKind.String) return true;
        var tckn = tcknEl.GetString();
        if (string.IsNullOrWhiteSpace(tckn)) return true;
        return tckn.Length == 11 && tckn.All(char.IsDigit);
    }

    private static bool HasValidGuideAccessInfo(JsonElement crew)
    {
        if (crew.ValueKind != JsonValueKind.Object) return true;
        if (!crew.TryGetProperty("responsible", out var responsible) || responsible.ValueKind != JsonValueKind.Object) return true;

        var grantAccess = responsible.TryGetProperty("grantAccess", out var grantEl)
            && (grantEl.ValueKind == JsonValueKind.True
                || (grantEl.ValueKind == JsonValueKind.String && bool.TryParse(grantEl.GetString(), out var b) && b));
        if (!grantAccess) return true;

        var id = responsible.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String ? idEl.GetString() : null;
        if (Guid.TryParse(id, out var guid) && guid != Guid.Empty) return true;

        var name = responsible.TryGetProperty("name", out var nameEl) && nameEl.ValueKind == JsonValueKind.String ? nameEl.GetString() : null;
        var email = responsible.TryGetProperty("email", out var emailEl) && emailEl.ValueKind == JsonValueKind.String ? emailEl.GetString() : null;

        return !string.IsNullOrWhiteSpace(name) && !string.IsNullOrWhiteSpace(email);
    }

    private static bool HasValidResponsibleEmailFormatIfProvided(JsonElement crew)
    {
        if (crew.ValueKind != JsonValueKind.Object) return true;
        if (!crew.TryGetProperty("responsible", out var responsible) || responsible.ValueKind != JsonValueKind.Object) return true;
        if (!responsible.TryGetProperty("email", out var emailEl) || emailEl.ValueKind != JsonValueKind.String) return true;
        var email = emailEl.GetString();
        if (string.IsNullOrWhiteSpace(email)) return true;
        return EmailRegex.IsMatch(email.Trim());
    }
}
