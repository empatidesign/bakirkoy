using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Departments.Dtos;

namespace Nexora.Application.Features.Departments.Validators;

public class CreateDepartmentRequestValidator : AbstractValidator<CreateDepartmentRequest>
{
    public CreateDepartmentRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Departman adı zorunludur.")
            .MaximumLength(100).WithMessage("Departman adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Departman adı");

        RuleFor(x => x.Description)
            .MaximumLength(300).WithMessage("Açıklama 300 karakteri aşamaz.")
            .When(x => x.Description is not null);
    }
}

public class UpdateDepartmentRequestValidator : AbstractValidator<UpdateDepartmentRequest>
{
    public UpdateDepartmentRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Departman adı zorunludur.")
            .MaximumLength(100).WithMessage("Departman adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Departman adı");

        RuleFor(x => x.Description)
            .MaximumLength(300).WithMessage("Açıklama 300 karakteri aşamaz.")
            .When(x => x.Description is not null);
    }
}
