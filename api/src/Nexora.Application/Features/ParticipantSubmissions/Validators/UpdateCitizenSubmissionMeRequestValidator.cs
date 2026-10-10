using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.ParticipantSubmissions.Dtos;

namespace Nexora.Application.Features.ParticipantSubmissions.Validators;

/// <summary>
/// Hata raporu (docs/hata.md #4.4): düzenleme akışı eklendi. Kurallar oluşturma
/// validator'ı ile birebir aynı (aynı uzunluk sınırları, aynı enum kümeleri) — aksi halde
/// "oluştururken kabul edilen" bir metin "düzenlerken reddedilir" hale gelirdi.
/// </summary>
public class UpdateCitizenSubmissionMeRequestValidator : AbstractValidator<UpdateCitizenSubmissionMeRequest>
{
    public UpdateCitizenSubmissionMeRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Başlık zorunludur.")
            .MaximumLength(200).WithMessage("Başlık 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Başlık");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Açıklama zorunludur.")
            .MaximumLength(2000).WithMessage("Açıklama 2000 karakteri aşamaz.");

        RuleFor(x => x.SubmissionType)
            .NotEmpty().WithMessage("Başvuru türü zorunludur.")
            .Must(t => MuhtarlikReference.SubmissionTypes.Contains(t))
            .WithMessage("Geçersiz başvuru türü.");

        RuleFor(x => x.Priority)
            .NotEmpty().WithMessage("Öncelik zorunludur.")
            .Must(p => MuhtarlikReference.Priorities.Contains(p))
            .WithMessage("Geçersiz öncelik.");
    }
}
