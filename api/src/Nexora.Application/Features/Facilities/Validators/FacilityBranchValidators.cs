using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities.Validators;

public class CreateFacilityBranchRequestValidator : AbstractValidator<CreateFacilityBranchRequest>
{
    public CreateFacilityBranchRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Program adı zorunludur.")
            .MaximumLength(200).WithMessage("Program adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Program adı");
        RuleFor(x => x.PeriodMonths)
            .GreaterThanOrEqualTo(0).WithMessage("Periyot süresi negatif olamaz.");
        RuleFor(x => x.AbsenceLimit)
            .GreaterThanOrEqualTo(0).WithMessage("Devamsızlık hakkı negatif olamaz.");
        RuleFor(x => x.ConsecutiveAbsenceLimit)
            .GreaterThanOrEqualTo(0).WithMessage("Üst üste devamsızlık hakkı negatif olamaz.");
    }
}

public class UpdateFacilityBranchRequestValidator : AbstractValidator<UpdateFacilityBranchRequest>
{
    public UpdateFacilityBranchRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Program adı zorunludur.")
            .MaximumLength(200).WithMessage("Program adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Program adı");
        RuleFor(x => x.PeriodMonths)
            .GreaterThanOrEqualTo(0).WithMessage("Periyot süresi negatif olamaz.");
        RuleFor(x => x.AbsenceLimit)
            .GreaterThanOrEqualTo(0).WithMessage("Devamsızlık hakkı negatif olamaz.");
        RuleFor(x => x.ConsecutiveAbsenceLimit)
            .GreaterThanOrEqualTo(0).WithMessage("Üst üste devamsızlık hakkı negatif olamaz.");
    }
}
