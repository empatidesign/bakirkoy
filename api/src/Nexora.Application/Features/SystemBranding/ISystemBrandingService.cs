using Nexora.Application.Features.SystemBranding.Dtos;

namespace Nexora.Application.Features.SystemBranding;

public interface ISystemBrandingService
{
    Task<SystemBrandingDto> GetAsync(CancellationToken ct);
    Task<UploadSystemLogoResult> UploadLogoAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
    Task<SystemBrandingDto> RemoveLogoAsync(CancellationToken ct);
    Task<UploadSystemLogoResult> UploadHorizontalLogoAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
    Task<SystemBrandingDto> RemoveHorizontalLogoAsync(CancellationToken ct);
}
