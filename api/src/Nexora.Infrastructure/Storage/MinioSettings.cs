namespace Nexora.Infrastructure.Storage;

public class MinioSettings
{
    public string Endpoint { get; set; } = "";
    public string AccessKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
    public bool UseSSL { get; set; } = false;
    public string PublicBucket { get; set; } = "nexora-public";
    public string PrivateBucket { get; set; } = "nexora-private";
}
