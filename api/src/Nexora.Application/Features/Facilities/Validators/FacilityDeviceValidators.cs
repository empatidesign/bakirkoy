using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Application.Features.Facilities.Validators;

public class CreateFacilityDeviceRequestValidator : AbstractValidator<CreateFacilityDeviceRequest>
{
    public CreateFacilityDeviceRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Cihaz adı zorunludur.")
            .MaximumLength(200).WithMessage("Cihaz adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Cihaz adı");

        RuleFor(x => x.Scope)
            .Must(s => s is null || FacilityDeviceScope.IsValid(s))
            .WithMessage("Geçersiz cihaz kapsamı.");

        RuleFor(x => x.ServiceFacilityId)
            .NotNull().WithMessage("Genel giriş cihazı için tesis seçilmelidir.")
            .When(x => x.Scope == FacilityDeviceScope.FacilityGeneral);


        RuleFor(x => x.HallId)
            .NotNull().WithMessage("Etkinlik cihazı için salon seçilmelidir.")
            .When(x => x.Scope == FacilityDeviceScope.Event);
    }
}

public class UpdateFacilityDeviceRequestValidator : AbstractValidator<UpdateFacilityDeviceRequest>
{
    public UpdateFacilityDeviceRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Cihaz adı zorunludur.")
            .MaximumLength(200).WithMessage("Cihaz adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Cihaz adı");

        RuleFor(x => x.Scope)
            .Must(s => s is null || FacilityDeviceScope.IsValid(s))
            .WithMessage("Geçersiz cihaz kapsamı.");

        RuleFor(x => x.HallId)
            .NotNull().WithMessage("Etkinlik cihazı için salon seçilmelidir.")
            .When(x => x.Scope == FacilityDeviceScope.Event);
    }
}
