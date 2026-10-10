using FluentValidation;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenRequestContactChangeRequestValidator : AbstractValidator<CitizenRequestContactChangeRequest>
{
    public CitizenRequestContactChangeRequestValidator()
    {
        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.Phone)
            .Must(p => (p ?? "").Count(char.IsDigit) >= 10)
            .WithMessage("Geçerli bir telefon numarası giriniz.")
            .When(x => !string.IsNullOrWhiteSpace(x.Phone));

        // #27 fix: e-posta ve telefon ikisi birden boşaltılamaz — aksi halde
        // vatandaş OTP alacağı hiçbir kanal kalmadan kendini kilitleyebiliyordu.
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.Email) || !string.IsNullOrWhiteSpace(x.Phone))
            .WithMessage("E-posta ve telefonun ikisi birden boş bırakılamaz. En az biri dolu olmalıdır.")
            .WithName("Contact");

        // IDN-11 düzeltmesi: değişiklik tek bir alan (telefon VEYA e-posta) için
        // istenmeli. İkisi birden aynı anda değiştirilmek istenirse hangi hedefe
        // OTP gönderileceği belirsizleşir; istemci iki ayrı istek atmalı.
        RuleFor(x => x)
            .Must(x => string.IsNullOrWhiteSpace(x.Email) || string.IsNullOrWhiteSpace(x.Phone))
            .WithMessage("Telefon ve e-posta aynı anda değiştirilemez. Lütfen tek seferde birini güncelleyin.")
            .WithName("Contact");
    }
}

public class CitizenConfirmContactChangeRequestValidator : AbstractValidator<CitizenConfirmContactChangeRequest>
{
    public CitizenConfirmContactChangeRequestValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("OTP kodu zorunludur.")
            .Length(6).WithMessage("OTP kodu 6 haneli olmalıdır.")
            .Matches(@"^\d{6}$").WithMessage("OTP kodu yalnızca rakamlardan oluşmalıdır.");
    }
}
