namespace Nexora.Application.Configuration;

public class OtpSettings
{
    public string? MockCode { get; set; }
    public int ExpiresInMinutes { get; set; } = 3;
    public int ResendCooldownSeconds { get; set; } = 180;
    public int FlowLifetimeSeconds { get; set; } = 900;
    public int MaxAttempts { get; set; } = 5;
    public int LockoutMaxFailures { get; set; } = 15;
    public int LockoutWindowSeconds { get; set; } = 3600;

    public int ValiditySeconds => Math.Max(ExpiresInMinutes, 0) * 60;
}
