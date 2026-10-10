using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Libraries.Dtos;
namespace Nexora.Application.Features.Libraries.Validators;

public class CreateLibraryDeviceRequestValidator : AbstractValidator<CreateLibraryDeviceRequest>
{
    public CreateLibraryDeviceRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Cihaz adı zorunludur.").MaximumLength(200)
            .MustNotContainHtmlArtifacts("Cihaz adı");
        RuleFor(x => x.Direction).Must(d => d is "entry" or "exit").WithMessage("Yön giriş veya çıkış olmalıdır.");
        RuleFor(x => x.WorkMode).Must(m => m is "online" or "offline").WithMessage("Çalışma şekli online veya offline olmalıdır.");
        RuleFor(x => x.Port).InclusiveBetween(1, 65535).WithMessage("Geçerli bir port giriniz.");
        RuleFor(x => x.RelayMs).InclusiveBetween(1, 131071).WithMessage("Röle süresi 1-131071 ms arasında olmalıdır.");
        RuleFor(x => x.OperationMode).Must(m => m is "directional" or "toggle").WithMessage("Çalışma modu 'directional' veya 'toggle' olmalıdır.");
        RuleFor(x => x.ToggleCooldownMinutes).InclusiveBetween(1, 1440).When(x => x.OperationMode == "toggle")
            .WithMessage("Tekrar okutma süresi 1-1440 dakika arasında olmalıdır.");
    }
}

public class UpdateLibraryDeviceRequestValidator : AbstractValidator<UpdateLibraryDeviceRequest>
{
    public UpdateLibraryDeviceRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Cihaz adı zorunludur.").MaximumLength(200)
            .MustNotContainHtmlArtifacts("Cihaz adı");
        RuleFor(x => x.Direction).Must(d => d is "entry" or "exit").WithMessage("Yön giriş veya çıkış olmalıdır.");
        RuleFor(x => x.WorkMode).Must(m => m is "online" or "offline").WithMessage("Çalışma şekli online veya offline olmalıdır.");
        RuleFor(x => x.Port).InclusiveBetween(1, 65535).WithMessage("Geçerli bir port giriniz.");
        RuleFor(x => x.RelayMs).InclusiveBetween(1, 131071).WithMessage("Röle süresi 1-131071 ms arasında olmalıdır.");
        RuleFor(x => x.OperationMode).Must(m => m is "directional" or "toggle").WithMessage("Çalışma modu 'directional' veya 'toggle' olmalıdır.");
        RuleFor(x => x.ToggleCooldownMinutes).InclusiveBetween(1, 1440).When(x => x.OperationMode == "toggle")
            .WithMessage("Tekrar okutma süresi 1-1440 dakika arasında olmalıdır.");
    }
}
