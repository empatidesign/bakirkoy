using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nexora.Application.Configuration;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.Nvi.Dtos;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services.Nvi;

public class NviService(
    IOptionsMonitor<NviSettings> settings,
    IHttpClientFactory httpClientFactory,
    INviStsClient stsClient,
    ILogger<NviService> logger) : INviService
{
    private const string KpsNs = "http://kps.nvi.gov.tr/2011/01/01";
    private const string KpsAdresNs = "http://kps.nvi.gov.tr/2021/04/01";
    private const string SoapEnvNs = "http://www.w3.org/2003/05/soap-envelope";
    private const string SoapAction = "http://kps.nvi.gov.tr/2011/01/01/YakinlikListesiAraTCNoServis/Sorgula";
    private const string AddressSoapAction = "http://kps.nvi.gov.tr/2021/04/01/KimlikNoSorgulaAdresServis/Sorgula";
    private const string GenericError = "Kimlik doğrulama servisine şu an ulaşılamıyor. Lütfen daha sonra tekrar deneyin.";

    private static readonly HashSet<int> ChildRelationKods = [7, 9];

    public async Task<NviPersonAndChildrenResponse> GetPersonAndChildrenAsync(
        string tckn,
        DateTime birthDate,
        int maxChildAge = 18,
        CancellationToken ct = default)
    {
        var current = settings.CurrentValue;
        var endpointUrl = current.ActiveEndpointUrl;

        logger.LogInformation(
            "[NVI-DIAG] UseMockMode={Mock} UsernameDolu={HasUser} PasswordDolu={HasPass} Endpoint={Endpoint} Sts={Sts} Timeout={Timeout}",
            current.UseMockMode,
            !string.IsNullOrWhiteSpace(current.Username),
            !string.IsNullOrWhiteSpace(current.Password),
            string.IsNullOrWhiteSpace(endpointUrl) ? "(bos)" : endpointUrl,
            string.IsNullOrWhiteSpace(current.StsEndpointUrl) ? "(bos)" : current.StsEndpointUrl,
            current.TimeoutSeconds);

        if (string.IsNullOrWhiteSpace(endpointUrl))
        {
            logger.LogError("[NVI-DIAG] NVI çağrısı yapılamadı: endpoint yapılandırılmamış (Vault/Consul'dan EndpointUrl gelmedi).");
            return Fail();
        }

        if (string.IsNullOrWhiteSpace(current.Username) || string.IsNullOrWhiteSpace(current.Password))
        {
            logger.LogError(
                "[NVI-DIAG] NVI çağrısı yapılamadı: kimlik bilgileri yapılandırılmamış. UsernameDolu={HasUser} PasswordDolu={HasPass} — Vault yüklenmedi/okunamadı (Nvi:Username/Password Vault external path'inden gelmeli).",
                !string.IsNullOrWhiteSpace(current.Username),
                !string.IsNullOrWhiteSpace(current.Password));
            return Fail();
        }

        string? soapRequest = null;
        try
        {
            logger.LogInformation(
                "NVI STS token alınıyor ({Mode}), hedef {Endpoint}",
                current.UseTestMode ? "TEST" : "PROD",
                endpointUrl);

            var stsResponse = await stsClient.IssueTokenAsync(current.Username, current.Password, endpointUrl, ct);

            var body = BuildSorgulaBody(tckn, birthDate, "Aile");
            soapRequest = NviSignedEnvelopeBuilder.Build(stsResponse, SoapAction, endpointUrl, body);

            var httpClient = httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(current.TimeoutSeconds);

            using var content = new StringContent(soapRequest, Encoding.UTF8);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/soap+xml")
            {
                CharSet = "utf-8",
                Parameters = { new NameValueHeaderValue("action", $"\"{SoapAction}\"") }
            };

            logger.LogInformation(
                "NVI servisi çağrılıyor ({Endpoint}), TC önek {TcPrefix}",
                endpointUrl,
                tckn.Length >= 4 ? tckn[..4] : "****");

            var response = await httpClient.PostAsync(endpointUrl, content, ct);
            var responseXml = await response.Content.ReadAsStringAsync(ct);

            // Task 11 (security, 2026-09-07): bu satır önceden ham NVI SOAP XML yanıtını (vatandaşın
            // tam kimlik verisi: ad, adres, aile/çocuk ilişkileri) {RawXml} parametresiyle Information
            // seviyesinde düz metin olarak logluyordu — gerçek, ciddi bir bulgu (bkz. task-11-report.md).
            // Ham gövde artık hiç loglanmıyor; teşhis için yanında zaten loglanan TC önek/HTTP durum kodu
            // yeterli, XML içindeki alanları seçici olarak redakte etmek yerine tamamen çıkarmak daha
            // basit ve daha güvenli.
            logger.LogInformation(
                "[NVI-RAW] NVI yanıtı alındı (TC önek {TcPrefix}, HTTP {StatusCode}, gövde uzunluğu {Length})",
                tckn.Length >= 4 ? tckn[..4] : "****",
                (int)response.StatusCode,
                responseXml.Length);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "NVI servisi {StatusCode} döndü: {Body}",
                    response.StatusCode,
                    responseXml.Length > 500 ? responseXml[..500] : responseXml);
                return Fail();
            }

            return ParseSoapResponse(responseXml, maxChildAge);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogError("NVI servisi {Seconds} saniye sonra zaman aşımına uğradı", current.TimeoutSeconds);
            return Fail();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "NVI servisi çağrılırken hata oluştu");
            return Fail();
        }
    }

    public Task<NviRawResult> DebugRawAsync(
        string tckn,
        DateTime birthDate,
        bool useTestMode,
        string? tur,
        CancellationToken ct = default)
    {
        var body = BuildSorgulaBody(tckn, birthDate, string.IsNullOrWhiteSpace(tur) ? "Aile" : tur);
        return PostSignedAsync(useTestMode, SoapAction, body, parse: true, ct);
    }

    public Task<NviRawResult> DebugAddressRawAsync(
        string tckn,
        DateTime birthDate,
        bool useTestMode,
        string addressServiceName,
        CancellationToken ct = default)
    {
        var action = string.IsNullOrWhiteSpace(addressServiceName)
            ? AddressSoapAction
            : $"{KpsAdresNs}/{addressServiceName.Trim()}/Sorgula";
        var body = BuildAddressSorgulaBody(tckn, birthDate);
        return PostSignedAsync(useTestMode, action, body, parse: false, ct);
    }

    private async Task<NviRawResult> PostSignedAsync(
        bool useTestMode,
        string soapAction,
        string bodyInnerXml,
        bool parse,
        CancellationToken ct)
    {
        var current = settings.CurrentValue;
        var endpointUrl = useTestMode && !string.IsNullOrWhiteSpace(current.TestEndpointUrl)
            ? current.TestEndpointUrl
            : current.EndpointUrl;

        if (string.IsNullOrWhiteSpace(endpointUrl))
            return new NviRawResult(endpointUrl, 0, null, null, null, "NVI uç noktası yapılandırılmamış.");
        if (string.IsNullOrWhiteSpace(current.Username) || string.IsNullOrWhiteSpace(current.Password))
            return new NviRawResult(endpointUrl, 0, null, null, null, "NVI kimlik bilgileri yapılandırılmamış.");

        string? soapRequest = null;
        try
        {
            var stsResponse = await stsClient.IssueTokenAsync(current.Username, current.Password, endpointUrl, ct);
            soapRequest = NviSignedEnvelopeBuilder.Build(stsResponse, soapAction, endpointUrl, bodyInnerXml);

            var httpClient = httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(current.TimeoutSeconds);

            using var content = new StringContent(soapRequest, Encoding.UTF8);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/soap+xml")
            {
                CharSet = "utf-8",
                Parameters = { new NameValueHeaderValue("action", $"\"{soapAction}\"") }
            };

            var response = await httpClient.PostAsync(endpointUrl, content, ct);
            var responseXml = await response.Content.ReadAsStringAsync(ct);


            var parsed = parse && response.IsSuccessStatusCode ? ParseSoapResponse(responseXml, 18) : null;
            return new NviRawResult(
                endpointUrl,
                (int)response.StatusCode,
                soapRequest,
                responseXml,
                parsed,
                response.IsSuccessStatusCode ? null : $"NVI HTTP {(int)response.StatusCode}");
        }
        catch (Exception ex)
        {
            return new NviRawResult(endpointUrl, 0, soapRequest, null, null, ex.Message);
        }
    }

    private static string BuildAddressSorgulaBody(string tckn, DateTime birthDate)
    {
        var bd = NormalizeNviBirthDate(birthDate);
        return $"""
            <tns:Sorgula xmlns:tns="{KpsAdresNs}">
              <tns:kriterListesi>
                <tns:KimlikNoileAdresSorguKriteri>
                  <tns:DogumAy>{bd.Month}</tns:DogumAy>
                  <tns:DogumGun>{bd.Day}</tns:DogumGun>
                  <tns:DogumYil>{bd.Year}</tns:DogumYil>
                  <tns:KimlikNo>{tckn}</tns:KimlikNo>
                </tns:KimlikNoileAdresSorguKriteri>
              </tns:kriterListesi>
            </tns:Sorgula>
            """;
    }

    public async Task<NviAddressResponse> GetAddressAsync(
        string tckn,
        DateTime birthDate,
        CancellationToken ct = default)
    {
        var current = settings.CurrentValue;
        var body = BuildAddressSorgulaBody(tckn, birthDate);
        var raw = await PostSignedAsync(current.UseTestMode, AddressSoapAction, body, parse: false, ct);

        if (!string.IsNullOrWhiteSpace(raw.ErrorMessage) || string.IsNullOrWhiteSpace(raw.ResponseXml))
            return new NviAddressResponse(false, "Adres bilgisi alınamadı.", null);

        return ParseAddressResponse(raw.ResponseXml);
    }

    private static NviAddressResponse ParseAddressResponse(string responseXml)
    {
        try
        {
            var doc = XDocument.Parse(responseXml);
            XNamespace kps = KpsAdresNs;

            var yerlesim = doc.Descendants(kps + "YerlesimYeriAdresi").FirstOrDefault();
            if (yerlesim == null)
                return new NviAddressResponse(false, "Adres bilgisi bulunamadı.", null);

            var detay = yerlesim.Element(kps + "IlIlceMerkezAdresi") ?? yerlesim.Element(kps + "KoyAdresi");
            var acikAdres = yerlesim.Element(kps + "AcikAdres")?.Value;
            var il = detay?.Element(kps + "Il")?.Value;

            if (string.IsNullOrWhiteSpace(acikAdres) && string.IsNullOrWhiteSpace(il))
                return new NviAddressResponse(false, "Adres bilgisi bulunamadı.", null);

            var address = new NviAddressDto(
                FullAddress: acikAdres,
                City: il,
                District: detay?.Element(kps + "Ilce")?.Value,
                Neighborhood: detay?.Element(kps + "Mahalle")?.Value ?? detay?.Element(kps + "Koy")?.Value,
                DistrictCode: detay?.Element(kps + "IlceKodu")?.Value);

            return new NviAddressResponse(true, null, address);
        }
        catch
        {
            return new NviAddressResponse(false, "Adres yanıtı işlenemedi.", null);
        }
    }

    public record NviRawResult(
        string EndpointUrl,
        int HttpStatusCode,
        string? RequestXml,
        string? ResponseXml,
        NviPersonAndChildrenResponse? Parsed,
        string? ErrorMessage);

    private static NviPersonAndChildrenResponse Fail()
        => new(false, GenericError, null, []);

    private static DateTime NormalizeNviBirthDate(DateTime birthDate)
        => birthDate.Kind == DateTimeKind.Utc ? Nexora.Domain.Common.TurkeyTime.ToTurkey(birthDate) : birthDate;

    private static string BuildSorgulaBody(string tckn, DateTime birthDate, string tur)
    {
        var bd = NormalizeNviBirthDate(birthDate);
        return $"""
            <tns:Sorgula xmlns:tns="{KpsNs}">
              <tns:kriterListesi>
                <tns:YakinlikListesiAraTCNoSorguKriteri>
                  <tns:DogumAy>{bd.Month}</tns:DogumAy>
                  <tns:DogumGun>{bd.Day}</tns:DogumGun>
                  <tns:DogumYil>{bd.Year}</tns:DogumYil>
                  <tns:TCKimlikNo>{tckn}</tns:TCKimlikNo>
                  <tns:Tur>{tur}</tns:Tur>
                </tns:YakinlikListesiAraTCNoSorguKriteri>
              </tns:kriterListesi>
            </tns:Sorgula>
            """;
    }

    private NviPersonAndChildrenResponse ParseSoapResponse(string responseXml, int maxChildAge)
    {
        try
        {
            var doc = XDocument.Parse(responseXml);

            XNamespace soap11 = "http://schemas.xmlsoap.org/soap/envelope/";
            XNamespace soap12 = SoapEnvNs;
            XNamespace kps = KpsNs;

            var fault = doc.Descendants(soap12 + "Fault").FirstOrDefault()
                        ?? doc.Descendants(soap11 + "Fault").FirstOrDefault();
            if (fault != null)
            {
                var reason = fault.Descendants(soap12 + "Text").FirstOrDefault()?.Value
                             ?? fault.Element("faultstring")?.Value
                             ?? "bilinmeyen hata";
                logger.LogError("NVI SOAP Fault: {Reason}", reason);
                return Fail();
            }

            var aileBilgisi = doc.Descendants(kps + "YakinlikServisiAileBilgisi").FirstOrDefault();
            if (aileBilgisi == null)
            {
                logger.LogError("NVI yanıtında AileBilgisi bulunamadı");
                return Fail();
            }

            var hata = aileBilgisi.Element(kps + "HataBilgisi");
            if (hata != null)
            {
                var aciklama = hata.Element(kps + "Aciklama")?.Value;
                var kod = hata.Element(kps + "Kod")?.Value;
                if (!string.IsNullOrWhiteSpace(aciklama) && kod != "0")
                {
                    logger.LogError("NVI hata bilgisi ({Kod}): {Aciklama}", kod, aciklama);
                    return new NviPersonAndChildrenResponse(false, "Kimlik bilgileri doğrulanamadı. Lütfen girdiğiniz bilgileri kontrol edin.", null, []);
                }
            }

            var kisiBilgisi = aileBilgisi.Element(kps + "KisiBilgisi");
            var person = ParsePerson(kisiBilgisi, kps);
            if (person == null)
            {
                logger.LogError("NVI yanıtında kişi bilgisi ayrıştırılamadı");
                return new NviPersonAndChildrenResponse(false, "Kimlik bilgileri doğrulanamadı. Lütfen girdiğiniz bilgileri kontrol edin.", null, []);
            }

            var children = new List<NviChildDto>();
            var aileKisiList = aileBilgisi.Element(kps + "AileKisiListesi");
            if (aileKisiList != null)
            {
                foreach (var aileKisi in aileKisiList.Elements(kps + "YakinlikServisiAileKisiBilgisi"))
                {
                    var child = TryParseChild(aileKisi, kps, maxChildAge);
                    if (child != null) children.Add(child);
                }
            }

            return new NviPersonAndChildrenResponse(true, null, person, children);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "NVI yanıtı ayrıştırılırken hata oluştu");
            return Fail();
        }
    }

    private static NviPersonDto? ParsePerson(XElement? kisiBilgisi, XNamespace kps)
    {
        if (kisiBilgisi == null) return null;

        var tc = kisiBilgisi.Element(kps + "TCKimlikNo")?.Value ?? string.Empty;
        var temel = kisiBilgisi.Element(kps + "TemelBilgisi");
        if (temel == null || string.IsNullOrWhiteSpace(tc)) return null;

        var ad = temel.Element(kps + "Ad")?.Value ?? string.Empty;
        var soyad = temel.Element(kps + "Soyad")?.Value ?? string.Empty;
        var cinsiyet = MapGender(ParseParametreAciklama(temel.Element(kps + "Cinsiyet"), kps));
        var dogumTarih = ParseTarihBilgisi(temel.Element(kps + "DogumTarih"), kps);

        if (dogumTarih == null) return null;

        return new NviPersonDto(tc, ad, soyad, dogumTarih.Value, cinsiyet, null);
    }

    private static NviChildDto? TryParseChild(XElement aileKisi, XNamespace kps, int maxChildAge)
    {
        var yakinlikElement = aileKisi.Element(kps + "Yakinlik");
        var yakinlik = ParseParametreAciklama(yakinlikElement, kps);
        var yakinlikKod = ParseParametreKod(yakinlikElement, kps);

        var isChild = (yakinlikKod.HasValue && ChildRelationKods.Contains(yakinlikKod.Value))
                      || IsChildByAciklama(yakinlik);
        if (!isChild) return null;

        var tc = aileKisi.Element(kps + "TCKimlikNo")?.Value ?? string.Empty;
        var temel = aileKisi.Element(kps + "TemelBilgisi");
        if (temel == null || string.IsNullOrWhiteSpace(tc)) return null;

        var ad = temel.Element(kps + "Ad")?.Value ?? string.Empty;
        var soyad = temel.Element(kps + "Soyad")?.Value ?? string.Empty;
        var cinsiyet = MapGender(ParseParametreAciklama(temel.Element(kps + "Cinsiyet"), kps));
        var dogumTarih = ParseTarihBilgisi(temel.Element(kps + "DogumTarih"), kps);
        if (dogumTarih == null) return null;

        var age = CalculateAge(dogumTarih.Value, DateTime.UtcNow);
        if (age >= maxChildAge) return null;

        return new NviChildDto(tc, ad, soyad, dogumTarih.Value, cinsiyet, null);
    }

    private static Gender MapGender(string aciklama)
    {
        if (string.IsNullOrWhiteSpace(aciklama)) return Gender.Male;
        var tr = CultureInfo.GetCultureInfo("tr-TR");
        var lower = aciklama.ToLower(tr);
        return lower.StartsWith('k') ? Gender.Female : Gender.Male;
    }

    private static string ParseParametreAciklama(XElement? parametre, XNamespace kps)
    {
        if (parametre == null) return string.Empty;
        return parametre.Element(kps + "Aciklama")?.Value ?? string.Empty;
    }

    private static int? ParseParametreKod(XElement? parametre, XNamespace kps)
    {
        var kodStr = parametre?.Element(kps + "Kod")?.Value;
        return int.TryParse(kodStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var kod) ? kod : null;
    }

    private static bool IsChildByAciklama(string yakinlik)
    {
        if (string.IsNullOrWhiteSpace(yakinlik)) return false;
        var tr = CultureInfo.GetCultureInfo("tr-TR");
        var lower = yakinlik.ToLower(tr);
        return lower.Contains("oğlu")
            || lower.Contains("oğul")
            || lower.Contains("kızı")
            || lower.Contains("kız")
            || lower.Contains("çocuk");
    }

    private static DateTime? ParseTarihBilgisi(XElement? tarih, XNamespace kps)
    {
        if (tarih == null) return null;
        var yilStr = tarih.Element(kps + "Yil")?.Value;
        var ayStr = tarih.Element(kps + "Ay")?.Value;
        var gunStr = tarih.Element(kps + "Gun")?.Value;

        if (!int.TryParse(yilStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var yil) || yil < 1900)
            return null;
        if (!int.TryParse(ayStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var ay) || ay is < 1 or > 12)
            ay = 1;
        if (!int.TryParse(gunStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var gun) || gun is < 1 or > 31)
            gun = 1;

        try
        {
            return DateTime.SpecifyKind(new DateTime(yil, ay, gun), DateTimeKind.Utc);
        }
        catch
        {
            return null;
        }
    }

    private static int CalculateAge(DateTime birth, DateTime today)
    {
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age)) age--;
        return age;
    }
}
