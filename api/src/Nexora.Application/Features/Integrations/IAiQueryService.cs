namespace Nexora.Application.Features.Integrations;

public interface IAiQueryService
{
    Task<string> AskAsync(string prompt, string? contextJson, string? preferredProvider, CancellationToken ct);
}

public class AiNotConfiguredException(string message) : Exception(message);
