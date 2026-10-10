using System.Reflection;
using System.Security.Cryptography;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Xml;
using Nexora.Application.Features.Nvi.Dtos;

namespace Nexora.Infrastructure.Services.Nvi;

public static class NviSignedEnvelopeBuilder
{
    private const string TemplateResourceName = "Nexora.Infrastructure.Services.Nvi.Templates.kps-template.xml";

    private const string SoapNs = "http://www.w3.org/2003/05/soap-envelope";
    private const string AddrNs = "http://www.w3.org/2005/08/addressing";
    private const string WsuNs = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd";
    private const string WsseNs = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
    private const string XencNs = "http://www.w3.org/2001/04/xmlenc#";
    private const string DsNs = "http://www.w3.org/2000/09/xmldsig#";

    private static readonly string Template = LoadTemplate();

    public static string Build(
        NviStsResponse sts,
        string soapAction,
        string endpointUrl,
        string bodyInnerXml)
    {
        var doc = new XmlDocument { PreserveWhitespace = true };
        doc.LoadXml(Template);

        var nsm = new XmlNamespaceManager(doc.NameTable);
        nsm.AddNamespace("s", SoapNs);
        nsm.AddNamespace("a", AddrNs);
        nsm.AddNamespace("u", WsuNs);
        nsm.AddNamespace("o", WsseNs);
        nsm.AddNamespace("xenc", XencNs);
        nsm.AddNamespace("ds", DsNs);

        SetNodeValue(doc, nsm, "/s:Envelope/s:Header/a:Action", soapAction);
        SetNodeValue(doc, nsm, "/s:Envelope/s:Header/a:MessageID", $"urn:uuid:{Guid.NewGuid()}");
        SetNodeValue(doc, nsm, "/s:Envelope/s:Header/a:To", endpointUrl);

        var now = DateTime.UtcNow;
        var created = now.ToString("yyyy-MM-ddTHH:mm:ssZ");
        var expires = now.AddMinutes(5).ToString("yyyy-MM-ddTHH:mm:ssZ");

        SetNodeValue(doc, nsm, "/s:Envelope/s:Header/o:Security/u:Timestamp/u:Created", created);
        SetNodeValue(doc, nsm, "/s:Envelope/s:Header/o:Security/u:Timestamp/u:Expires", expires);

        SetNodeValue(doc, nsm,
            "/s:Envelope/s:Header/o:Security/xenc:EncryptedData/ds:KeyInfo/xenc:EncryptedKey/ds:KeyInfo/o:SecurityTokenReference/ds:X509Data/ds:X509IssuerSerial/ds:X509IssuerName",
            sts.X509IssuerName);
        SetNodeValue(doc, nsm,
            "/s:Envelope/s:Header/o:Security/xenc:EncryptedData/ds:KeyInfo/xenc:EncryptedKey/ds:KeyInfo/o:SecurityTokenReference/ds:X509Data/ds:X509IssuerSerial/ds:X509SerialNumber",
            sts.X509SerialNumber);
        SetNodeValue(doc, nsm,
            "/s:Envelope/s:Header/o:Security/xenc:EncryptedData/ds:KeyInfo/xenc:EncryptedKey/xenc:CipherData/xenc:CipherValue",
            sts.EncryptedKeyCipherValue);
        SetNodeValue(doc, nsm,
            "/s:Envelope/s:Header/o:Security/xenc:EncryptedData/xenc:CipherData/xenc:CipherValue",
            sts.EncryptedDataCipherValue);

        var timestampNode = doc.SelectSingleNode("/s:Envelope/s:Header/o:Security/u:Timestamp", nsm)
                            ?? throw new InvalidOperationException("Timestamp node not found in KPS template");

        var timestampDigest = ComputeDigest(timestampNode);
        SetNodeValue(doc, nsm,
            "/s:Envelope/s:Header/o:Security/ds:Signature/ds:SignedInfo/ds:Reference/ds:DigestValue",
            timestampDigest);

        var signedInfoNode = doc.SelectSingleNode("/s:Envelope/s:Header/o:Security/ds:Signature/ds:SignedInfo", nsm)
                             ?? throw new InvalidOperationException("SignedInfo node not found in KPS template");

        var signatureValue = ComputeHmacSignature(signedInfoNode, sts.BinarySecret);
        SetNodeValue(doc, nsm,
            "/s:Envelope/s:Header/o:Security/ds:Signature/ds:SignatureValue",
            signatureValue);

        SetNodeValue(doc, nsm,
            "/s:Envelope/s:Header/o:Security/ds:Signature/ds:KeyInfo/o:SecurityTokenReference/o:KeyIdentifier",
            sts.KeyIdentifier);

        AppendBody(doc, nsm, bodyInnerXml);

        var settings = new XmlWriterSettings
        {
            OmitXmlDeclaration = false,
            Encoding = new UTF8Encoding(false),
            NewLineHandling = NewLineHandling.None,
            Indent = false
        };

        using var ms = new MemoryStream();
        using (var xw = XmlWriter.Create(ms, settings))
        {
            doc.Save(xw);
        }
        return Encoding.UTF8.GetString(ms.ToArray());
    }

    private static void SetNodeValue(XmlDocument doc, XmlNamespaceManager nsm, string xpath, string value)
    {
        var node = doc.SelectSingleNode(xpath, nsm)
                   ?? throw new InvalidOperationException($"XPath not found in KPS template: {xpath}");
        node.InnerText = value;
    }

    private static string ComputeDigest(XmlNode node)
    {
        var canonicalBytes = CanonicalizeExclusive(node);
        var digest = SHA1.HashData(canonicalBytes);
        return Convert.ToBase64String(digest);
    }

    private static string ComputeHmacSignature(XmlNode node, byte[] key)
    {
        var canonicalBytes = CanonicalizeExclusive(node);
        using var hmac = new HMACSHA1(key);
        var signature = hmac.ComputeHash(canonicalBytes);
        return Convert.ToBase64String(signature);
    }

    private static byte[] CanonicalizeExclusive(XmlNode node)
    {
        var transform = new XmlDsigExcC14NTransform();
        var nodeDoc = new XmlDocument { PreserveWhitespace = true };
        nodeDoc.LoadXml(node.OuterXml);
        transform.LoadInput(nodeDoc);
        using var stream = (MemoryStream)transform.GetOutput(typeof(Stream));
        return stream.ToArray();
    }

    private static void AppendBody(XmlDocument doc, XmlNamespaceManager nsm, string bodyInnerXml)
    {
        var envelopeNode = doc.SelectSingleNode("/s:Envelope", nsm)
                           ?? throw new InvalidOperationException("Envelope not found");

        var bodyFragmentDoc = new XmlDocument { PreserveWhitespace = true };
        var bodyWrapped = $"<s:Body xmlns:s=\"{SoapNs}\">{bodyInnerXml}</s:Body>";
        bodyFragmentDoc.LoadXml(bodyWrapped);

        var importedBody = doc.ImportNode(bodyFragmentDoc.DocumentElement!, true);
        envelopeNode.AppendChild(importedBody);
    }

    private static string LoadTemplate()
    {
        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream(TemplateResourceName)
                           ?? throw new InvalidOperationException($"Embedded resource not found: {TemplateResourceName}");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
