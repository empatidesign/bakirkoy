using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels.Validators;

public class TravelBusFormRequestValidator : AbstractValidator<TravelBusFormRequest>
{
    public TravelBusFormRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Araç adı zorunludur.")
            .MaximumLength(150).WithMessage("Araç adı 150 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Araç adı");

        RuleFor(x => x.TemplateId)
            .NotEmpty().WithMessage("Otobüs koltuk şablonu seçimi zorunludur.")
            .When(x => x.VehicleType != "capacity");

        RuleFor(x => x.Capacity)
            .Must(c => c.HasValue && c.Value > 0).WithMessage("Toplam kontenjan 0'dan büyük olmalıdır.")
            .When(x => x.VehicleType == "capacity");
    }
}

