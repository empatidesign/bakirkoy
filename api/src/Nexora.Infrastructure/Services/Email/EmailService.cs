using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Configuration;

namespace Nexora.Infrastructure.Services.Email;

public class EmailService(IOptionsMonitor<SmtpSettings> settings, ILogger<EmailService> logger) : IEmailService
{
    public bool IsMockMode => settings.CurrentValue.UseMockMode;

    public Task<bool> SendAsync(string toEmail, string subject, string htmlBody, string? toName = null, CancellationToken ct = default)
        => SendInternalAsync([(toEmail, toName)], subject, htmlBody, ct);

    public Task<bool> SendManyAsync(IReadOnlyCollection<string> toEmails, string subject, string htmlBody, CancellationToken ct = default)
        => SendInternalAsync((toEmails ?? []).Select(e => (e, (string?)null)).ToList(), subject, htmlBody, ct);

    private async Task<bool> SendInternalAsync(IReadOnlyCollection<(string Email, string? Name)> recipients, string subject, string htmlBody, CancellationToken ct)
    {
        var s = settings.CurrentValue;
        var targets = (recipients ?? [])
            .Where(r => IsValidEmail(r.Email))
            .DistinctBy(r => r.Email.Trim().ToLowerInvariant())
            .ToList();

        if (targets.Count == 0)
            return false;

        if (s.UseMockMode)
        {
            logger.LogInformation("[EMAIL-MOCK] Gönderim simüle edildi. Alıcı={Count} Konu={Subject}", targets.Count, subject);
            return true;
        }

        if (!s.HasCredentials)
        {
            logger.LogError("[EMAIL] Gönderilemedi: SMTP yapılandırılmamış (SmtpSettings:Host/Username/Password/FromAddress).");
            return false;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(s.FromName, s.FromAddress));
        foreach (var (email, name) in targets)
            message.To.Add(new MailboxAddress(name ?? email, email));
        message.Subject = subject;
        message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

        try
        {
            using var client = new SmtpClient { Timeout = s.TimeoutSeconds * 1000 };
            await client.ConnectAsync(s.Host, s.Port, ResolveSecurity(s), ct);
            await client.AuthenticateAsync(s.Username, s.Password, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            logger.LogInformation("[EMAIL] Gönderildi: {Count} alıcı Konu={Subject}", targets.Count, subject);
            return true;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[EMAIL] Gönderilemedi: {Message}", ex.Message);
            return false;
        }
    }

    private static SecureSocketOptions ResolveSecurity(SmtpSettings s) =>
        (s.Encryption ?? "").ToLowerInvariant() switch
        {
            "ssl" => SecureSocketOptions.SslOnConnect,
            "tls" or "starttls" => SecureSocketOptions.StartTls,
            "none" => SecureSocketOptions.None,
            _ => s.Port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls,
        };

    private static bool IsValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        var at = email.IndexOf('@');
        return at > 0 && at < email.Length - 1 && email.IndexOf('.', at + 1) > at;
    }
}
