namespace Nexora.Application.Configuration;

public class PharmacySettings
{
    public string BaseUrl { get; set; } = "";
    public string District { get; set; } = "";
    public int TimeoutSeconds { get; set; } = 20;
    public string SyncCron { get; set; } = "0 */3 * * *";

    public bool HasBaseUrl => !string.IsNullOrWhiteSpace(BaseUrl);
}
