namespace Nexora.Application.Features.QrSystem.Dtos;

public record CitizenQrTokenDto(
    string Token,
    int WindowSeconds,
    DateTime GeneratedAt
);
