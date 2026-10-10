using FluentValidation;
using Nexora.Application.Features.CitizenSubmissions.Dtos;

namespace Nexora.Application.Features.CitizenSubmissions.Validators;

public class UpdateSubmissionStatusRequestValidator : AbstractValidator<UpdateSubmissionStatusRequest>
{
    public UpdateSubmissionStatusRequestValidator()
    {
        RuleFor(x => x.Status)
            .NotEmpty().WithMessage("Durum zorunludur.")
            .Must(s => MuhtarlikReference.StatusActionAllowed.Contains(s))
            .WithMessage("Geçersiz başvuru durumu.");
    }
}
