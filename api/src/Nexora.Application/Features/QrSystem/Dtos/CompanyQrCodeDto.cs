namespace Nexora.Application.Features.QrSystem.Dtos;

public record CompanyQrCodeDto(
    Guid Id,
    Guid CompanyId,
    string StaticCode,
    bool IsActive,
    DateTime? ValidUntil,
    string? Purpose,
    DateTime CreatedAt
);
