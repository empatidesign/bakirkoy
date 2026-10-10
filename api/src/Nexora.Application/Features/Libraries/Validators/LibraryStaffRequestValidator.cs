using FluentValidation;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Application.Features.Libraries.Validators;

public class LibraryStaffRequestValidator : AbstractValidator<LibraryStaffRequest>
{
    public LibraryStaffRequestValidator()
    {
        // Kullanıcı talimatı (2026-08-04, revizyon): personel ya bir AdminUser'dan ya da
        // mevcut bir Participant/vatandaş kaydından (ID) atanabilir — tam olarak biri.
        RuleFor(x => x)
            .Must(x => (x.AdminUserId is not null) != (x.ParticipantId is not null))
            .WithMessage("Yönetici seçimi veya katılımcı seçiminden yalnızca biri belirtilmelidir.");

        RuleFor(x => x.WorkingLibraryIds)
            .NotEmpty().WithMessage("En az bir kıraathane seçilmelidir.");
    }
}

public class StartShiftRequestValidator : AbstractValidator<StartShiftRequest>
{
    public StartShiftRequestValidator()
    {
        RuleFor(x => x.StaffId)
            .NotEmpty().WithMessage("Personel seçimi zorunludur.");
    }
}
