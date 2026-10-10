namespace Nexora.Application.Common.Interfaces;

public interface IEmailService
{
    bool IsMockMode { get; }

    Task<bool> SendAsync(string toEmail, string subject, string htmlBody, string? toName = null, CancellationToken ct = default);

    Task<bool> SendManyAsync(IReadOnlyCollection<string> toEmails, string subject, string htmlBody, CancellationToken ct = default);
}
