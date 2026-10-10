using FluentValidation;
using Nexora.Application.Features.Admin.Dtos;

namespace Nexora.Application.Features.Admin.Validators;

public class UpdateAdminRequestValidator : AbstractValidator<UpdateAdminRequest>
{
    public UpdateAdminRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Ad Soyad zorunludur.")
            .MaximumLength(100).WithMessage("Ad Soyad 100 karakteri aşamaz.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefon numarası zorunludur.")
            .MinimumLength(10).WithMessage("Geçerli bir telefon numarası giriniz.")
            .MaximumLength(20).WithMessage("Telefon 20 karakteri aşamaz.");

        RuleFor(x => x.Role)
            .NotEmpty().WithMessage("Rol seçimi zorunludur.");
    }
}
