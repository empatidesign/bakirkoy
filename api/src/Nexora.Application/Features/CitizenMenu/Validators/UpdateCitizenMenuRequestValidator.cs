using FluentValidation;
using Nexora.Application.Features.CitizenMenu.Dtos;

namespace Nexora.Application.Features.CitizenMenu.Validators;

public class UpdateCitizenMenuRequestValidator : AbstractValidator<UpdateCitizenMenuRequest>
{
    public UpdateCitizenMenuRequestValidator()
    {
        RuleFor(x => x.Items)
            .NotNull().WithMessage("Menü öğeleri zorunludur.")
            .Must(items => items.All(i => !string.IsNullOrWhiteSpace(i.Key)))
            .WithMessage("Menü öğelerinin anahtarı boş olamaz.");
    }
}
