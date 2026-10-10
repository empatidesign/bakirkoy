using Nexora.Application.Features.Nvi.Dtos;

namespace Nexora.Application.Features.Nvi;

public interface INviStsClient
{
    Task<NviStsResponse> IssueTokenAsync(
        string username,
        string password,
        string appliesToEndpointUrl,
        CancellationToken ct = default);
}
