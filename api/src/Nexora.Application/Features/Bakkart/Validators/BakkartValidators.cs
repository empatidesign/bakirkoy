using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Bakkart.Dtos;

namespace Nexora.Application.Features.Bakkart.Validators;

public class CreateBakkartApplicationRequestValidator : AbstractValidator<CreateBakkartApplicationRequest>
{
    private static readonly string[] AllowedCardTypes = ["Standard", "Student", "Retiree", "SocialSupport"];
    private static readonly string[] AllowedDeliveryTypes = ["Digital", "Physical"];

    public CreateBakkartApplicationRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Ad soyad zorunludur.")
            .MaximumLength(200).WithMessage("Ad soyad 200 karakteri aşamaz.");

        RuleFor(x => x.Tckn)
            .NotEmpty().WithMessage("T.C. kimlik numarası zorunludur.")
            .Must(TcKimlikValidator.IsValid).WithMessage("Geçerli bir T.C. kimlik numarası giriniz.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefon numarası zorunludur.")
            .MaximumLength(20).WithMessage("Telefon numarası 20 karakteri aşamaz.");

        RuleFor(x => x.District)
            .NotEmpty().WithMessage("İkametgah mahallesi zorunludur.");

        RuleFor(x => x.CardType)
            .NotEmpty().WithMessage("Kart tipi zorunludur.")
            .Must(v => AllowedCardTypes.Contains(v)).WithMessage("Geçersiz kart tipi.");

        RuleFor(x => x.DeliveryType)
            .NotEmpty().WithMessage("Teslimat tipi zorunludur.")
            .Must(v => AllowedDeliveryTypes.Contains(v)).WithMessage("Geçersiz teslimat tipi.");
    }
}

public class AdminCreateBakkartApplicationRequestValidator : AbstractValidator<AdminCreateBakkartApplicationRequest>
{
    private static readonly string[] AllowedCardTypes = ["Standard", "Student", "Retiree", "SocialSupport"];

    public AdminCreateBakkartApplicationRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Ad soyad zorunludur.")
            .MaximumLength(200).WithMessage("Ad soyad 200 karakteri aşamaz.");

        RuleFor(x => x.Tckn)
            .NotEmpty().WithMessage("T.C. kimlik numarası zorunludur.")
            .Must(TcKimlikValidator.IsValid).WithMessage("Geçerli bir T.C. kimlik numarası giriniz.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefon numarası zorunludur.")
            .MaximumLength(20).WithMessage("Telefon numarası 20 karakteri aşamaz.");

        RuleFor(x => x.District)
            .NotEmpty().WithMessage("İkametgah mahallesi zorunludur.");

        RuleFor(x => x.CardType)
            .NotEmpty().WithMessage("Kart tipi zorunludur.")
            .Must(v => AllowedCardTypes.Contains(v)).WithMessage("Geçersiz kart tipi.");
    }
}

public class AdjustBakkartCardRequestValidator : AbstractValidator<AdjustBakkartCardRequest>
{
    public AdjustBakkartCardRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => x.BalanceDelta.HasValue || x.PointsDelta.HasValue)
            .WithMessage("Bakiye veya puan değişikliği belirtilmelidir.");

        RuleFor(x => x.Note)
            .MaximumLength(500).WithMessage("Not 500 karakteri aşamaz.");
    }
}
