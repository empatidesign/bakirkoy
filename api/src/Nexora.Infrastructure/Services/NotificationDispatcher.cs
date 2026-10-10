using Nexora.Application.Common.Interfaces;

namespace Nexora.Infrastructure.Services;

public class NotificationDispatcher(ISmsService sms, IEmailService email, IActivityLogger log) : INotificationDispatcher
{
    public async Task<bool> SendSmsAsync(string phone, string message, CancellationToken ct = default)
    {
        log.LogStepResult("SendSms", new { phone = Mask(phone), length = message?.Length ?? 0 });
        if (string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(message)) return false;
        return await sms.SendOneAsync(phone, message, ct);
    }

    public async Task SendEmailAsync(string emailAddress, string subject, string htmlBody, CancellationToken ct = default)
    {
        log.LogStepResult("SendEmail", new { email = MaskEmail(emailAddress), subject });
        if (string.IsNullOrWhiteSpace(emailAddress)) return;
        await email.SendAsync(emailAddress, subject, htmlBody, null, ct);
    }

    public Task SendPushAsync(string recipient, string title, string message, CancellationToken ct = default)
    {
        log.LogStepResult("SendPush", new { recipient, title, length = message?.Length ?? 0 });
        return Task.CompletedTask;
    }

    private static string Mask(string phone)
        => string.IsNullOrEmpty(phone) || phone.Length < 4 ? phone : new string('*', phone.Length - 4) + phone[^4..];

    private static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return "";
        var at = email.IndexOf('@');
        if (at <= 1) return "***" + (at >= 0 ? email[at..] : "");
        return email[0] + new string('*', at - 1) + email[at..];
    }
}
