namespace Nexora.Application.Features.Devices;

public record LiderTekReadEvent(
    string? SessionId,
    int MessageType,
    string? DeviceId,
    long CardId,
    int DataType,
    string? Data,
    int ReaderNum);

public interface ILiderTekWebhookService
{
    Task<IReadOnlyDictionary<string, object>> HandleAsync(IReadOnlyDictionary<string, string> form, string? presentedKey, CancellationToken ct);
}
