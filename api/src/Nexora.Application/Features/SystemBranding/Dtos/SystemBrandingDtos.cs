namespace Nexora.Application.Features.SystemBranding.Dtos;

public record SystemBrandingDto(string? LogoUrl, string? HorizontalLogoUrl, DateTime? UpdatedAt);

public record UploadSystemLogoResult(string ObjectName, string Url);
