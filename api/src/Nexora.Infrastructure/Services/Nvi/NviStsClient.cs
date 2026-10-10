using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nexora.Application.Configuration;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.Nvi.Dtos;

namespace Nexora.Infrastructure.Services.Nvi;

public class NviStsClient(
    IOptionsMonitor<NviSettings> settings,
    IHttpClientFactory httpClientFactory,
    ILogger<NviStsClient> logger) : INviStsClient
{
    private const string StsAction = "http://docs.oasis-open.org/ws-sx/ws-trust/200512/RST/Issue";
    private const string TemplateResourceName = "Nexora.Infrastructure.Services.Nvi.Templates.sts-template.xml";

    private static readonly XNamespace SoapNs = "http://www.w3.org/2003/05/soap-envelope";
    private static readonly XNamespace WsuNs = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd";
    private static readonly XNamespace WsseNs = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
    private static readonly XNamespace TrustNs = "http://docs.oasis-open.org/ws-sx/ws-trust/200512";
    private static readonly XNamespace XencNs = "http://www.w3.org/2001/04/xmlenc#";
    private static readonly XNamespace DsNs = "http://www.w3.org/2000/09/xmldsig#";

    private static readonly string Template = LoadTemplate();

    public async Task<NviStsResponse> IssueTokenAsync(
        string username,
        string password,
        string appliesToEndpointUrl,
        CancellationToken ct = default)
    {
        var current = settings.CurrentValue;
        var stsEndpointUrl = current.StsEndpointUrl;
        if (string.IsNullOrWhiteSpace(stsEndpointUrl))
            throw new InvalidOperationException("NVI STS uç noktası yapılandırılmamış.");

        var requestXml = BuildRequest(username, password, appliesToEndpointUrl, stsEndpointUrl);

        var httpClient = httpClientFactory.CreateClient();
        httpClient.Timeout = TimeSpan.FromSeconds(current.TimeoutSeconds);

        using var content = new StringContent(requestXml, Encoding.UTF8);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/soap+xml")
        {
            CharSet = "utf-8",
            Parameters = { new NameValueHeaderValue("action", $"\"{StsAction}\"") }
        };

        logger.LogInformation("Requesting STS token from {Endpoint} for target {Target}", stsEndpointUrl, appliesToEndpointUrl);

        var response = await httpClient.PostAsync(stsEndpointUrl, content, ct);
        var responseXml = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"STS returned HTTP {(int)response.StatusCode}: {Truncate(responseXml, 500)}");

        return ParseResponse(responseXml);
    }

    private static string BuildRequest(string username, string password, string appliesToEndpointUrl, string stsEndpointUrl)
    {
        var now = DateTime.UtcNow;
        var messageId = $"urn:uuid:{Guid.NewGuid()}";
        var created = now.ToString("yyyy-MM-ddTHH:mm:ssZ");
        var expires = now.AddMinutes(10).ToString("yyyy-MM-ddTHH:mm:ssZ");

        return Template
            .Replace("__MESSAGE_ID__", messageId)
            .Replace("__STS_ENDPOINT__", stsEndpointUrl)
            .Replace("__CREATED__", created)
            .Replace("__EXPIRES__", expires)
            .Replace("__USERNAME__", System.Security.SecurityElement.Escape(username))
            .Replace("__PASSWORD__", System.Security.SecurityElement.Escape(password))
            .Replace("__APPLIES_TO__", System.Security.SecurityElement.Escape(appliesToEndpointUrl));
    }

    private static NviStsResponse ParseResponse(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);

        var fault = doc.Descendants(SoapNs + "Fault").FirstOrDefault();
        if (fault != null)
        {
            var reason = fault.Descendants(SoapNs + "Text").FirstOrDefault()?.Value ?? "Unknown STS fault";
            throw new InvalidOperationException($"STS SOAP Fault: {reason}");
        }

        var rstr = doc.Descendants(TrustNs + "RequestSecurityTokenResponse").FirstOrDefault()
                   ?? throw new InvalidOperationException("STS response missing RequestSecurityTokenResponse");

        var requestedSecurityToken = rstr.Element(TrustNs + "RequestedSecurityToken")
                                     ?? throw new InvalidOperationException("STS response missing RequestedSecurityToken");

        var encryptedData = requestedSecurityToken.Element(XencNs + "EncryptedData")
                            ?? throw new InvalidOperationException("STS response missing EncryptedData");

        var encryptedKey = encryptedData.Descendants(XencNs + "EncryptedKey").FirstOrDefault()
                           ?? throw new InvalidOperationException("STS response missing EncryptedKey");

        var x509IssuerSerial = encryptedKey.Descendants(DsNs + "X509IssuerSerial").FirstOrDefault()
                               ?? throw new InvalidOperationException("STS response missing X509IssuerSerial");

        var x509IssuerName = x509IssuerSerial.Element(DsNs + "X509IssuerName")?.Value
                             ?? throw new InvalidOperationException("STS response missing X509IssuerName");
        var x509SerialNumber = x509IssuerSerial.Element(DsNs + "X509SerialNumber")?.Value
                               ?? throw new InvalidOperationException("STS response missing X509SerialNumber");

        var encryptedKeyCipherValue = encryptedKey.Descendants(XencNs + "CipherValue").FirstOrDefault()?.Value
                                      ?? throw new InvalidOperationException("STS response missing EncryptedKey CipherValue");

        var encryptedDataCipherValue = encryptedData
            .Elements(XencNs + "CipherData")
            .Elements(XencNs + "CipherValue")
            .FirstOrDefault()?.Value
            ?? throw new InvalidOperationException("STS response missing EncryptedData CipherValue");

        var binarySecretBase64 = rstr
            .Element(TrustNs + "RequestedProofToken")?
            .Element(TrustNs + "BinarySecret")?.Value
            ?? throw new InvalidOperationException("STS response missing BinarySecret");

        var keyIdentifier = rstr
            .Element(TrustNs + "RequestedUnattachedReference")?
            .Element(WsseNs + "SecurityTokenReference")?
            .Element(WsseNs + "KeyIdentifier")?.Value
            ?? throw new InvalidOperationException("STS response missing KeyIdentifier");

        var lifetime = rstr.Element(TrustNs + "Lifetime");
        var expires = lifetime?.Element(WsuNs + "Expires")?.Value;
        var expiresAt = DateTime.TryParse(expires, out var parsed) ? parsed.ToUniversalTime() : DateTime.UtcNow.AddMinutes(5);

        return new NviStsResponse(
            BinarySecret: Convert.FromBase64String(binarySecretBase64),
            KeyIdentifier: keyIdentifier,
            X509IssuerName: x509IssuerName,
            X509SerialNumber: x509SerialNumber,
            EncryptedKeyCipherValue: encryptedKeyCipherValue,
            EncryptedDataCipherValue: encryptedDataCipherValue,
            ExpiresAt: expiresAt);
    }

    private static string LoadTemplate()
    {
        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream(TemplateResourceName)
                           ?? throw new InvalidOperationException($"Embedded resource not found: {TemplateResourceName}");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    private static string Truncate(string s, int max)
        => s.Length <= max ? s : s[..max];
}
