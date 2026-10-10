using Nexora.Application.Features.Nvi.Dtos;

namespace Nexora.Application.Features.Nvi;

public interface INviService
{
    Task<NviPersonAndChildrenResponse> GetPersonAndChildrenAsync(
        string tckn,
        DateTime birthDate,
        int maxChildAge = 18,
        CancellationToken ct = default);

    Task<NviAddressResponse> GetAddressAsync(
        string tckn,
        DateTime birthDate,
        CancellationToken ct = default);
}
