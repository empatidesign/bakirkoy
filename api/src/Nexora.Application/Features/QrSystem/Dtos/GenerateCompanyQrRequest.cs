namespace Nexora.Application.Features.QrSystem.Dtos;

public record GenerateCompanyQrRequest(
    string? Purpose,
    DateTime? ValidUntil
);
