using Consul;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Nexora.Infrastructure.Consul;

public class ConsulSettings
{
    public string Address { get; set; } = "";
    public string? Token { get; set; }
    public string ServiceName { get; set; } = "nexora-api";
    public string ServiceId { get; set; } = "nexora-api-1";
    public string ServiceHost { get; set; } = "";
    public int ServicePort { get; set; } = 5000;
}

public class ConsulServiceRegistration(
    IConsulClient consulClient,
    IOptions<ConsulSettings> options,
    ILogger<ConsulServiceRegistration> logger) : IHostedService
{
    private readonly ConsulSettings _settings = options.Value;

    public async Task StartAsync(CancellationToken ct)
    {
        var registration = new AgentServiceRegistration
        {
            ID      = _settings.ServiceId,
            Name    = _settings.ServiceName,
            Address = _settings.ServiceHost,
            Port    = _settings.ServicePort,
            Check   = new AgentServiceCheck
            {
                HTTP                            = $"http://{_settings.ServiceHost}:{_settings.ServicePort}/health",
                Interval                        = TimeSpan.FromSeconds(10),
                Timeout                         = TimeSpan.FromSeconds(5),
                DeregisterCriticalServiceAfter  = TimeSpan.FromMinutes(1)
            }
        };

        try
        {
            await consulClient.Agent.ServiceDeregister(registration.ID, ct);
            await consulClient.Agent.ServiceRegister(registration, ct);
            logger.LogInformation("Registered service {ServiceId} with Consul", _settings.ServiceId);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to register service with Consul");
        }
    }

    public async Task StopAsync(CancellationToken ct)
    {
        try
        {
            await consulClient.Agent.ServiceDeregister(_settings.ServiceId, ct);
            logger.LogInformation("Deregistered service {ServiceId} from Consul", _settings.ServiceId);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to deregister service from Consul");
        }
    }
}
