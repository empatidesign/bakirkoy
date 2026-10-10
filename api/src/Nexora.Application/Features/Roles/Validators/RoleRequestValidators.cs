using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Roles.Dtos;

namespace Nexora.Application.Features.Roles.Validators;

public class CreateRoleRequestValidator : AbstractValidator<CreateRoleRequest>
{
    public CreateRoleRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Rol adı zorunludur.")
            .MaximumLength(100).WithMessage("Rol adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Rol adı");

        RuleFor(x => x.Description)
            .MaximumLength(300).WithMessage("Açıklama 300 karakteri aşamaz.")
            .When(x => x.Description is not null);
    }
}

public class UpdateRoleRequestValidator : AbstractValidator<UpdateRoleRequest>
{
    public UpdateRoleRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Rol adı zorunludur.")
            .MaximumLength(100).WithMessage("Rol adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Rol adı");

        RuleFor(x => x.Description)
            .MaximumLength(300).WithMessage("Açıklama 300 karakteri aşamaz.")
            .When(x => x.Description is not null);
    }
}
