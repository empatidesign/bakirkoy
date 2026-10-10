using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Halls.Dtos;

namespace Nexora.Application.Features.Halls.Validators;

public class CreateHallRequestValidator : AbstractValidator<CreateHallRequest>
{
    public CreateHallRequestValidator()
    {
        RuleFor(x => x.FacilityId).NotEmpty().WithMessage("Hizmet tesisi seçimi zorunludur.");
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Salon adı zorunludur.")
            .MaximumLength(200).WithMessage("Salon adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Salon adı");
        RuleFor(x => x.Type).NotEmpty().WithMessage("Salon türü zorunludur.");
        RuleFor(x => x.SeatingMode)
            .Must(m => m is "seated" or "standing").WithMessage("Geçersiz oturma modu.");
        RuleFor(x => x.Capacity).GreaterThan(0).WithMessage("Kapasite 0'dan büyük olmalıdır.");
    }
}

public class FeatureGroupRequestValidator : AbstractValidator<FeatureGroupRequest>
{
    public FeatureGroupRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Grup adı zorunludur.")
            .MaximumLength(100).WithMessage("Grup adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Grup adı");
        RuleFor(x => x.Color).NotEmpty().WithMessage("Renk zorunludur.");
    }
}

public class FeatureRequestValidator : AbstractValidator<FeatureRequest>
{
    public FeatureRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Özellik adı zorunludur.")
            .MaximumLength(120).WithMessage("Özellik adı 120 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Özellik adı");
        RuleFor(x => x.Group).NotEmpty().WithMessage("Grup zorunludur.");
    }
}

public class FeatureTemplateRequestValidator : AbstractValidator<FeatureTemplateRequest>
{
    public FeatureTemplateRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Şablon adı zorunludur.")
            .MaximumLength(150).WithMessage("Şablon adı 150 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Şablon adı");
        RuleFor(x => x.FeatureIds).NotEmpty().WithMessage("En az bir özellik seçilmelidir.");
    }
}
