using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.ParticipantSubmissions.Dtos;

namespace Nexora.Application.Features.ParticipantSubmissions.Validators;

public class CreateCitizenSubmissionMeRequestValidator : AbstractValidator<CreateCitizenSubmissionMeRequest>
{
    public CreateCitizenSubmissionMeRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Başlık zorunludur.")
            .MaximumLength(200).WithMessage("Başlık 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Başlık");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Açıklama zorunludur.")
            // basvuruhitetmeyenkurallar.md (A-kovası, Muhtarlık #12) canlı testte kanıtlandı: bu alan
            // için validator'da uzunluk sınırı YOKTU — DB kolonu HasMaxLength(2000) ile sınırlıydı,
            // 2000 karakterden uzun bir açıklama göndermek temiz bir 400 yerine ÇIPLAK BİR 500
            // (INTERNAL_SERVER_ERROR) üretiyordu (canlı testte kanıtlandı: 3000 karakterlik açıklama
            // -> 500). DB sınırıyla birebir eşleşen bir validator kuralı ekleniyor.
            .MaximumLength(2000).WithMessage("Açıklama 2000 karakteri aşamaz.");

        RuleFor(x => x.CategoryId)
            .NotEmpty().WithMessage("Kategori seçimi zorunludur.")
            .Must(c => MuhtarlikReference.CategoryOptions.Any(o => o.Value == c))
            .WithMessage("Geçersiz kategori.");

        RuleFor(x => x.SubmissionType)
            .NotEmpty().WithMessage("Başvuru türü zorunludur.")
            .Must(t => MuhtarlikReference.SubmissionTypes.Contains(t))
            .WithMessage("Geçersiz başvuru türü.");

        RuleFor(x => x.Priority)
            .NotEmpty().WithMessage("Öncelik zorunludur.")
            .Must(p => MuhtarlikReference.Priorities.Contains(p))
            .WithMessage("Geçersiz öncelik.");

        // İkamet seçildiğinde mahalle/adres kimliği doğrulanmış kişinin kaydından alınır.
        When(x => x.AddressType == "other", () =>
        {
            RuleFor(x => x.Neighborhood)
                .NotEmpty().WithMessage("Mahalle zorunludur.")
                .Must(n => MuhtarlikReference.Neighborhoods.Contains(n))
                .WithMessage("Geçersiz mahalle.");
            RuleFor(x => x.Address)
                .NotEmpty().WithMessage("Adres zorunludur.")
                .MaximumLength(500).WithMessage("Adres 500 karakteri aşamaz.");
        });

        // Kullanıcı isteği (2026-08-28): "bunun ikametgah adresi mi yoksa farklı bir adreste mi
        // olduğunu seçecek" ve "mahallesi veya Sultangazi genelinde".
        RuleFor(x => x.AddressType)
            .Must(t => t is null || MuhtarlikReference.AddressTypes.Contains(t))
            .WithMessage("Geçersiz adres türü.");

        RuleFor(x => x.Scope)
            .Must(s => s is null || MuhtarlikReference.Scopes.Contains(s))
            .WithMessage("Geçersiz başvuru kapsamı.");
    }
}
