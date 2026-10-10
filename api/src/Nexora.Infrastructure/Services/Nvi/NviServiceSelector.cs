using Microsoft.Extensions.Options;
using Nexora.Application.Configuration;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.Nvi.Dtos;

namespace Nexora.Infrastructure.Services.Nvi;

public class NviServiceSelector(
    IOptionsMonitor<NviSettings> settings,
    NviMockService mockService,
    NviService realService) : INviService
{
    public Task<NviPersonAndChildrenResponse> GetPersonAndChildrenAsync(
        string tckn,
        DateTime birthDate,
        int maxChildAge = 18,
        CancellationToken ct = default)
    {
        INviService impl = settings.CurrentValue.UseMockMode ? mockService : realService;
        return impl.GetPersonAndChildrenAsync(tckn, birthDate, maxChildAge, ct);
    }

    public Task<NviAddressResponse> GetAddressAsync(
        string tckn,
        DateTime birthDate,
        CancellationToken ct = default)
    {
        INviService impl = settings.CurrentValue.UseMockMode ? mockService : realService;
        return impl.GetAddressAsync(tckn, birthDate, ct);
    }
}
