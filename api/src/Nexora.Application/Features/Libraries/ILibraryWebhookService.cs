namespace Nexora.Application.Features.Libraries;

public interface ILibraryWebhookService
{
    Task<IReadOnlyDictionary<string, object>> HandleAsync(IReadOnlyDictionary<string, string> form, string? presentedKey, CancellationToken ct);
}
