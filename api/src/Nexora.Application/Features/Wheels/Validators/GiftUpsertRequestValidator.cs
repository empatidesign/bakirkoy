using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Wheels.Dtos;

namespace Nexora.Application.Features.Wheels.Validators;

public class GiftUpsertRequestValidator : AbstractValidator<GiftUpsertRequest>
{
    public GiftUpsertRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Hediye adı zorunludur.")
            .MaximumLength(200).WithMessage("Hediye adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Hediye adı");

        RuleFor(x => x.Points)
            .GreaterThanOrEqualTo(0).WithMessage("Puan değeri negatif olamaz.");

        RuleFor(x => x.StockLimit)
            .GreaterThanOrEqualTo(1).WithMessage("Stok en az 1 olmalıdır.");
    }
}
