namespace Nexora.Application.Configuration;

public class SmtpSettings
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 465;
    public string Encryption { get; set; } = "ssl";
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = "Bakırköy Belediyesi";
    public int TimeoutSeconds { get; set; } = 30;
    public bool UseMockMode { get; set; } = true;

    public bool HasCredentials =>
        !string.IsNullOrWhiteSpace(Host) &&
        !string.IsNullOrWhiteSpace(Username) &&
        !string.IsNullOrWhiteSpace(Password) &&
        !string.IsNullOrWhiteSpace(FromAddress);
}
