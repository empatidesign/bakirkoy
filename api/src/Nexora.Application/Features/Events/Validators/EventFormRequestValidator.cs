using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Events.Dtos;

namespace Nexora.Application.Features.Events.Validators;

public class EventFormRequestValidator : AbstractValidator<EventFormRequest>
{
    public EventFormRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Etkinlik adı zorunludur.")
            .MaximumLength(200).WithMessage("Etkinlik adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Etkinlik adı");

        RuleFor(x => x.CategoryId)
            .NotEmpty().WithMessage("Kategori seçimi zorunludur.");

        RuleFor(x => x.StartDate)
            .NotEmpty().WithMessage("Başlangıç tarihi zorunludur.");

        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("Bitiş tarihi başlangıç tarihinden önce olamaz.")
            .When(x => !x.IsSingleDay);

        RuleFor(x => x.EndTime)
            .Must((r, endTime) => TimeOnly.TryParse(endTime, out var end) && TimeOnly.TryParse(r.StartTime, out var start) && end > start)
            .WithMessage("Bitiş saati başlangıç saatinden sonra olmalıdır.")
            .When(x => x.IsSingleDay && !string.IsNullOrWhiteSpace(x.StartTime) && !string.IsNullOrWhiteSpace(x.EndTime));

        RuleFor(x => x.VenueType)
            .Must(v => v is "indoor" or "outdoor")
            .WithMessage("Geçersiz mekan türü.");

        RuleFor(x => x.Capacity)
            .GreaterThanOrEqualTo(0).WithMessage("Kontenjan negatif olamaz.");

        RuleFor(x => x.ReserveCapacity)
            .GreaterThanOrEqualTo(0).WithMessage("Yedek kontenjan negatif olamaz.");

        RuleFor(x => x.MinAge)
            .GreaterThanOrEqualTo(0).WithMessage("Minimum yaş negatif olamaz.");

        RuleFor(x => x.MaxAge)
            .GreaterThanOrEqualTo(0).WithMessage("Maksimum yaş negatif olamaz.")
            .GreaterThanOrEqualTo(x => x.MinAge)
            .WithMessage("En küçük yaş, en büyük yaştan büyük olamaz.");

        RuleFor(x => x.Access)
            .NotNull().WithMessage("Erişim ayarları (access) zorunludur.");

        RuleFor(x => x.Access.QrRotationSeconds)
            .GreaterThan(0)
            .WithMessage("Değişken QR için yenileme süresi zorunludur.")
            .When(x => x.Access is not null && x.Access.AttendanceEnabled && x.Access.QrEnabled && x.Access.QrType == "rotating");

        RuleFor(x => x.ApplicationStartDate)
            .NotNull().WithMessage("Kayıt zorunlu etkinlikte başvuru başlangıç tarihi zorunludur.")
            .When(x => x.Access is not null && x.Access.RegistrationMode == "required");

        RuleFor(x => x.ApplicationEndDate)
            .NotNull().WithMessage("Kayıt zorunlu etkinlikte başvuru bitiş tarihi zorunludur.")
            .When(x => x.Access is not null && x.Access.RegistrationMode == "required");

        RuleFor(x => x.ApplicationEndDate)
            .Must((r, appEnd) => appEnd!.Value.Date <= (r.EndDate > r.StartDate ? r.EndDate : r.StartDate).Date)
            .WithMessage("Başvuru bitişi, etkinlik bitiş tarihinden sonra olamaz.")
            .When(x => x.ApplicationEndDate.HasValue);
    }
}
