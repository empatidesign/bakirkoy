namespace Nexora.Application.Configuration;

public class NviSettings
{
    public string EndpointUrl { get; set; } = string.Empty;
    public string TestEndpointUrl { get; set; } = string.Empty;
    public string StsEndpointUrl { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool UseTestMode { get; set; }
    public bool UseMockMode { get; set; } = true;
    public int TimeoutSeconds { get; set; } = 30;

    public string ActiveEndpointUrl => UseTestMode && !string.IsNullOrWhiteSpace(TestEndpointUrl)
        ? TestEndpointUrl
        : EndpointUrl;
}
