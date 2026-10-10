using System.Net.Http.Headers;
using System.Security;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Configuration;

namespace Nexora.Infrastructure.Services;

public class SmsService(
    IHttpClientFactory httpClientFactory,
    IOptionsMonitor<SmsSettings> settings,
    IHttpContextAccessor httpContextAccessor,
    IConfiguration config,
    ILogger<SmsService> logger) : ISmsService
{
    private static readonly Regex ErrorCodeRegex = new(@"<ErrorCode>(-?\d+)</ErrorCode>", RegexOptions.Compiled);

    public bool IsMockMode => settings.CurrentValue.UseMockMode;

    public Task<bool> SendOneAsync(string phone, string message, CancellationToken ct = default)
        => SendAsync(message, [phone], ct);

    public async Task<bool> SendAsync(string message, IReadOnlyCollection<string> phones, CancellationToken ct = default)
    {
        var s = settings.CurrentValue;
        var targets = (phones ?? [])
            .Select(FormatPhone)
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Distinct()
            .ToList();

        if (targets.Count == 0)
            return false;

        if (httpContextAccessor.HttpContext is null && !ScheduledNotificationSwitch.SendsEnabled(config))
        {
            logger.LogWarning("[SMS] Arka plan/zamanlanmış gönderim duraklatıldı (NotificationSettings:ScheduledNotificationsEnabled=false). Alıcı={Count} İlk={First}",
                targets.Count, Mask(targets[0]));
            return false;
        }

        if (s.UseMockMode)
        {
            logger.LogInformation("[SMS-MOCK] Gönderim simüle edildi. Alıcı={Count} İlk={First}",
                targets.Count, Mask(targets[0]));
            return true;
        }

        if (!s.HasCredentials)
        {
            logger.LogError("[SMS] Gönderilemedi: kimlik bilgileri/URL yapılandırılmamış (SmsSettings:Username/Password Vault external path'inden gelmeli). UsernameDolu={HasUser} PasswordDolu={HasPass} UrlDolu={HasUrl}",
                !string.IsNullOrWhiteSpace(s.Username), !string.IsNullOrWhiteSpace(s.Password), !string.IsNullOrWhiteSpace(s.Url));
            return false;
        }

        var soapEnvelope = BuildEnvelope(s, message, targets);

        try
        {
            var client = httpClientFactory.CreateClient("sms");
            client.Timeout = TimeSpan.FromSeconds(s.TimeoutSeconds);

            using var content = new StringContent(soapEnvelope, Encoding.UTF8);
            content.Headers.ContentType = new MediaTypeHeaderValue("text/xml") { CharSet = "utf-8" };

            using var request = new HttpRequestMessage(HttpMethod.Post, s.Url) { Content = content };
            request.Headers.TryAddWithoutValidation("SOAPAction", $"\"{s.SoapAction}\"");

            var response = await client.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("[SMS] HTTP {StatusCode}: {Body}", (int)response.StatusCode,
                    body.Length > 500 ? body[..500] : body);
                return false;
            }

            var match = ErrorCodeRegex.Match(body);
            var errorCode = match.Success && int.TryParse(match.Groups[1].Value, out var ec) ? ec : -99;

            if (errorCode == 0)
            {
                logger.LogInformation("[SMS] Gönderildi: {Count} alıcı", targets.Count);
                return true;
            }

            logger.LogWarning("[SMS] Gönderim hatası (ErrorCode={ErrorCode}). Alıcı={Count} Yanıt={Body}",
                errorCode, targets.Count, body.Length > 500 ? body[..500] : body);
            return false;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[SMS] Gönderilemedi: {Message}", ex.Message);
            return false;
        }
    }

    private static string BuildEnvelope(SmsSettings s, string message, IReadOnlyList<string> targets)
    {
        var receivers = string.Concat(targets.Select(p => $"<Receiver>{SecurityElement.Escape(p)}</Receiver>"));

        var requestXml =
            "<SendSms>" +
            $"<Username>{SecurityElement.Escape(s.Username)}</Username>" +
            $"<Password>{SecurityElement.Escape(s.Password)}</Password>" +
            $"<UserCode>{SecurityElement.Escape(s.UserCode)}</UserCode>" +
            $"<AccountId>{SecurityElement.Escape(s.AccountId)}</AccountId>" +
            $"<Originator>{SecurityElement.Escape(s.Originator)}</Originator>" +
            $"<IsCheckBlackList>{s.BlacklistCheck}</IsCheckBlackList>" +
            $"<ValidityPeriod>{s.ValidityPeriod}</ValidityPeriod>" +
            "<SendDate></SendDate>" +
            $"<MessageText>{SecurityElement.Escape(message)}</MessageText>" +
            $"<ReceiverList>{receivers}</ReceiverList>" +
            "</SendSms>";

        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
            $"<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns=\"{s.SoapNamespace}\">" +
            "<soapenv:Header/>" +
            "<soapenv:Body>" +
            "<sendSms>" +
            $"<requestXml><![CDATA[{requestXml}]]></requestXml>" +
            "</sendSms>" +
            "</soapenv:Body>" +
            "</soapenv:Envelope>";
    }

    private static string FormatPhone(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("90") && digits.Length == 12) return digits;
        if (digits.StartsWith('0') && digits.Length == 11) return "90" + digits[1..];
        if (digits.Length == 10) return "90" + digits;
        return digits;
    }

    private static string Mask(string phone)
        => string.IsNullOrEmpty(phone) || phone.Length < 4 ? phone : new string('*', phone.Length - 4) + phone[^4..];
}
