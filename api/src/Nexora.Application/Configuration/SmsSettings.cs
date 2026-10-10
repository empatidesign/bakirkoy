namespace Nexora.Application.Configuration;

public class SmsSettings
{
    public string Url { get; set; } = string.Empty;
    public string SoapNamespace { get; set; } = "https://webservice.asistiletisim.com.tr/SmsProxy";
    public string SoapAction { get; set; } = "https://webservice.asistiletisim.com.tr/SmsProxy/sendSms";
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string UserCode { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    public string Originator { get; set; } = string.Empty;
    public int ValidityPeriod { get; set; } = 60;
    public int BlacklistCheck { get; set; } = 1;
    public int TimeoutSeconds { get; set; } = 15;
    public bool UseMockMode { get; set; } = true;

    public bool HasCredentials => !string.IsNullOrWhiteSpace(Username) && !string.IsNullOrWhiteSpace(Password) && !string.IsNullOrWhiteSpace(Url);
}
