using FluentValidation;
using Nexora.Domain.Common;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities.Validators;

public class GenerateSessionsRequestValidator : AbstractValidator<GenerateSessionsRequest>
{
    public GenerateSessionsRequestValidator()
    {
        RuleFor(x => x.GroupId).NotEmpty().WithMessage("Grup seçimi zorunludur.");
    }
}

public class CreateManualSessionRequestValidator : AbstractValidator<CreateManualSessionRequest>
{
    public CreateManualSessionRequestValidator()
    {
        RuleFor(x => x.FacilityId).NotEmpty().WithMessage("Tesis seçimi zorunludur.");
        RuleFor(x => x.GroupId).NotEmpty().WithMessage("Grup seçimi zorunludur.");
        RuleFor(x => x.Date)
            .NotEmpty().WithMessage("Tarih zorunludur.")
            .Must(BeValidDate).WithMessage("Geçersiz tarih.")
            .Must(BeNotPast).WithMessage("Geçmiş tarih girilemez.");
        RuleFor(x => x.StartTime).Must(BeValidTime).WithMessage("Başlangıç saati SS:DD biçiminde olmalıdır.");
        RuleFor(x => x.EndTime).Must(BeValidTime).WithMessage("Bitiş saati SS:DD biçiminde olmalıdır.");
        RuleFor(x => x)
            .Must(x => !BeValidTime(x.StartTime) || !BeValidTime(x.EndTime) || string.CompareOrdinal(x.StartTime, x.EndTime) < 0)
            .WithMessage("Başlangıç saati bitiş saatinden önce olmalıdır.");
    }

    private static bool BeValidDate(string d) => DateOnly.TryParse(d, out _);

    private static bool BeNotPast(string d)
        => !DateOnly.TryParse(d, out var date) || date.ToDateTime(TimeOnly.MinValue) >= TurkeyTime.TodayDate();

    private static bool BeValidTime(string? t)
    {
        if (string.IsNullOrEmpty(t) || t.Length != 5 || t[2] != ':') return false;
        return int.TryParse(t.AsSpan(0, 2), out var h) && h is >= 0 and <= 23
            && int.TryParse(t.AsSpan(3, 2), out var m) && m is >= 0 and <= 59;
    }
}
