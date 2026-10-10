using FluentValidation;
using Nexora.Application.Features.DevicePermissions.Dtos;

namespace Nexora.Application.Features.DevicePermissions.Validators;

public class SaveDevicePermissionRequestValidator : AbstractValidator<SaveDevicePermissionRequest>
{
    public SaveDevicePermissionRequestValidator()
    {
        When(x => x.Latitude.HasValue, () =>
            RuleFor(x => x.Latitude!.Value)
                .InclusiveBetween(-90, 90).WithMessage("Enlem -90 ile 90 arasında olmalıdır."));
        When(x => x.Longitude.HasValue, () =>
            RuleFor(x => x.Longitude!.Value)
                .InclusiveBetween(-180, 180).WithMessage("Boylam -180 ile 180 arasında olmalıdır."));
        When(x => !string.IsNullOrWhiteSpace(x.PushToken), () =>
            RuleFor(x => x.PushToken!).MaximumLength(500).WithMessage("Bildirim anahtarı 500 karakteri aşamaz."));
        When(x => !string.IsNullOrWhiteSpace(x.DevicePlatform), () =>
            RuleFor(x => x.DevicePlatform!).MaximumLength(50).WithMessage("Cihaz platformu 50 karakteri aşamaz."));
        When(x => !string.IsNullOrWhiteSpace(x.LocationStatus), () =>
            RuleFor(x => x.LocationStatus!).MaximumLength(50).WithMessage("Konum durumu 50 karakteri aşamaz."));
        When(x => !string.IsNullOrWhiteSpace(x.NotificationStatus), () =>
            RuleFor(x => x.NotificationStatus!).MaximumLength(50).WithMessage("Bildirim durumu 50 karakteri aşamaz."));
    }
}
