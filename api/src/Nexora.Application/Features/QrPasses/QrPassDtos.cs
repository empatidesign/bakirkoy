namespace Nexora.Application.Features.QrPasses;

public record QrPassDto(
    string Kind,
    string Title,
    string Subtitle,
    string Token,
    int RotationSeconds,
    DateTime? ExpiresAt,
    string? ShortCode,
    string? Module,
    Guid? ReferenceId);

public record QrPassListDto(
    QrPassDto Identity,
    List<QrPassDto> Passes);
