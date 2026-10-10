using Microsoft.Extensions.Diagnostics.HealthChecks;
using Minio;
using Minio.DataModel.Args;

namespace Nexora.Infrastructure.HealthChecks;

public class MinioHealthCheck(IMinioClient minio) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            await minio.ListBucketsAsync(ct);
            return HealthCheckResult.Healthy("MinIO is reachable");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("MinIO is unreachable", ex);
        }
    }
}
