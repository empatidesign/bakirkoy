namespace Nexora.Application.Features.QrPasses;

public interface IQrPassService
{
    Task<QrPassListDto> GetPassesAsync(Guid participantId, CancellationToken ct);
}
