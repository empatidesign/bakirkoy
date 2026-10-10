using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Nexora.Infrastructure.Logging;

public static class ServiceLoggingExtensions
{
    public static IServiceCollection AddServiceWithLogging<TInterface, TImplementation>(
        this IServiceCollection services)
        where TInterface : class
        where TImplementation : class, TInterface
    {
        services.AddScoped<TImplementation>();
        services.AddScoped<TInterface>(sp =>
        {
            var impl = sp.GetRequiredService<TImplementation>();
            var logger = sp.GetRequiredService<ILogger<TImplementation>>();
            return ServiceLoggingProxy<TInterface>.Create(impl, logger);
        });
        return services;
    }
}
