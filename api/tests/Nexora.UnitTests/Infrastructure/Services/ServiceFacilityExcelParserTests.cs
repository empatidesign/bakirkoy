using ClosedXML.Excel;
using Nexora.Application.Common.Exceptions;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

/// <summary>
/// docs/TESIS_GIRIS_SABLONU.xlsx ile aynı sütun düzenini kuran, bellek içi Excel dosyaları
/// üzerinden ServiceFacilityExcelParser davranışını doğrular.
/// </summary>
public class ServiceFacilityExcelParserTests
{
    private static readonly string[] Headers =
    [
        "Tesis Adı *", "Tesis Türü", "Durum", "Konum Tipi", "Açık Alan Kategorisi",
        "Alan Büyüklüğü (m2)", "Açıklama", "Hakkında", "İl", "İlçe", "Adres",
        "Enlem (Latitude)", "Boylam (Longitude)", "Yönetici Adı", "Yönetici Telefonu",
        "Yönetici E-posta", "Sisteme Erişim Ver", "Acil Durum Telefonu", "Web Sitesi",
        "Facebook", "Instagram", "Twitter / X", "Hafta İçi Açılış", "Hafta İçi Kapanış",
        "Hafta Sonu Açılış", "Hafta Sonu Kapanış", "Olanaklar", "Erişilebilirlik Özellikleri",
        "Otopark Kapasitesi", "Otopark Türü", "Kapasite (kişi)", "Sunulan Hizmetler",
        "Master QR Aktif",
    ];

    private static MemoryStream BuildWorkbook(params string?[][] dataRows)
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("Tesisler");

        for (var c = 0; c < Headers.Length; c++)
            ws.Cell(1, c + 1).Value = Headers[c];

        var row = 2;
        foreach (var data in dataRows)
        {
            for (var c = 0; c < data.Length; c++)
                if (data[c] is { } v)
                    ws.Cell(row, c + 1).Value = v;
            row++;
        }

        var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;
        return ms;
    }

    private static string?[] Row(string name, params (int Index, string Value)[] cells)
    {
        var row = new string?[Headers.Length];
        row[0] = name;
        foreach (var (index, value) in cells)
            row[index] = value;
        return row;
    }

    [Fact]
    public void Parse_MapsAllCoreFields()
    {
        using var stream = BuildWorkbook(Row("Spor Kompleksi",
            (1, "Spor Tesisi"), (3, "Kapalı"), (6, "Açıklama"), (8, "İstanbul"), (9, "Sultangazi"),
            (10, "Cebeci Mah."), (11, "41.106500"), (12, "28.867200"),
            (22, "08:00"), (23, "22:00"), (26, "Klima, WiFi"), (27, "Rampa"),
            (28, "50"), (29, "Ücretsiz"), (30, "200")));

        var parsed = ServiceFacilityExcelParser.Parse(stream);
        var req = Assert.Single(parsed).Request;

        Assert.NotNull(req);
        Assert.Equal("Spor Kompleksi", req.Name);
        Assert.Equal("Spor Tesisi", req.Type);
        Assert.Equal("Indoor", req.LocationType);
        Assert.Equal("İstanbul", req.City);
        Assert.Equal(41.1065, req.Latitude);
        Assert.Equal(28.8672, req.Longitude);
        Assert.Equal("08:00", req.WeekdayOpen);
        Assert.Equal(["Klima", "WiFi"], req.Facilities);
        Assert.Equal(["Rampa"], req.AccessibilityFeatures);
        Assert.Equal(50, req.ParkingCapacity);
        Assert.Equal("Free", req.ParkingType);
        Assert.Equal(200, req.Capacity);
    }

    [Fact]
    public void Parse_TurkishLabels_MapToEnumValues()
    {
        using var stream = BuildWorkbook(Row("Kent Parkı",
            (3, "Açık"), (4, "Kent Ormanı"), (5, "12000"), (29, "Sınırlı")));

        var req = Assert.Single(ServiceFacilityExcelParser.Parse(stream)).Request;

        Assert.NotNull(req);
        Assert.Equal("Outdoor", req.LocationType);
        Assert.Equal("KentOrmani", req.OutdoorCategory);
        Assert.Equal(12000, req.AreaSizeM2);
        Assert.Equal("Limited", req.ParkingType);
    }

    [Fact]
    public void Parse_IndoorFacility_DropsOutdoorOnlyFields()
    {
        using var stream = BuildWorkbook(Row("Kapalı Salon",
            (3, "Kapalı"), (4, "Park"), (5, "5000")));

        var req = Assert.Single(ServiceFacilityExcelParser.Parse(stream)).Request;

        Assert.NotNull(req);
        Assert.Null(req.OutdoorCategory);
        Assert.Null(req.AreaSizeM2);
    }

    [Fact]
    public void Parse_AcceptsCommaDecimalCoordinates()
    {
        using var stream = BuildWorkbook(Row("Virgüllü", (11, "41,1065"), (12, "28,8672")));

        var req = Assert.Single(ServiceFacilityExcelParser.Parse(stream)).Request;

        Assert.NotNull(req);
        Assert.Equal(41.1065, req.Latitude);
        Assert.Equal(28.8672, req.Longitude);
    }

    [Theory]
    [InlineData("999", "28.8")]
    [InlineData("41.1", "-200")]
    [InlineData("abc", "28.8")]
    public void Parse_OutOfRangeCoordinate_ReportsError(string lat, string lng)
    {
        using var stream = BuildWorkbook(Row("Hatalı", (11, lat), (12, lng)));

        var row = Assert.Single(ServiceFacilityExcelParser.Parse(stream));

        Assert.Null(row.Request);
        Assert.NotNull(row.Error);
    }

    [Fact]
    public void Parse_GrantAccessWithoutContact_ReportsError()
    {
        using var stream = BuildWorkbook(Row("Erişim Eksik", (16, "Evet")));

        var row = Assert.Single(ServiceFacilityExcelParser.Parse(stream));

        Assert.Null(row.Request);
        Assert.Contains("erişim", row.Error!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Parse_GrantAccessWithContact_SetsFlag()
    {
        using var stream = BuildWorkbook(Row("Erişimli",
            (13, "Ali Veli"), (15, "ali@x.local"), (16, "Evet")));

        var req = Assert.Single(ServiceFacilityExcelParser.Parse(stream)).Request;

        Assert.NotNull(req);
        Assert.True(req.GrantAccess);
        Assert.Equal("Ali Veli", req.Manager);
        Assert.Equal("ali@x.local", req.ManagerEmail);
    }

    [Fact]
    public void Parse_ServicesWithAndWithoutModule()
    {
        using var stream = BuildWorkbook(Row("Hizmetli", (31, "Yüzme|sports, Danışma")));

        var req = Assert.Single(ServiceFacilityExcelParser.Parse(stream)).Request;

        Assert.NotNull(req);
        Assert.Collection(req.OfferedServices!,
            s => { Assert.Equal("Yüzme", s.Name); Assert.Equal("sports", s.Module); },
            s => { Assert.Equal("Danışma", s.Name); Assert.Equal("info", s.Module); });
    }

    [Fact]
    public void Parse_SkipsTemplateNoteAndSampleRows()
    {
        // 2. satır şablondaki açıklama, 3. satır şablondaki örnek kayıt: ikisi de veri değildir.
        using var stream = BuildWorkbook(
            Row("Zorunlu. En fazla 200 karakter."),
            Row("Sultangazi Spor Kompleksi"),
            Row("Gerçek Tesis"));

        var parsed = ServiceFacilityExcelParser.Parse(stream);

        Assert.Equal("Gerçek Tesis", Assert.Single(parsed).RawName);
    }

    [Fact]
    public void Parse_BlankRowsBetweenRecords_AreIgnored()
    {
        using var stream = BuildWorkbook(
            Row("Birinci"),
            new string?[Headers.Length],
            Row("İkinci"));

        var parsed = ServiceFacilityExcelParser.Parse(stream);

        Assert.Equal(["Birinci", "İkinci"], parsed.Select(p => p.RawName));
    }

    [Fact]
    public void Parse_MissingNameColumn_Throws()
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("Tesisler");
        ws.Cell(1, 1).Value = "İl";
        ws.Cell(2, 1).Value = "İstanbul";
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;

        var ex = Assert.Throws<ConflictException>(() => ServiceFacilityExcelParser.Parse(ms));
        Assert.Equal("EXCEL_NAME_COLUMN_NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public void Parse_CorruptFile_ThrowsInvalidFormat()
    {
        using var ms = new MemoryStream("bu bir excel dosyası değil"u8.ToArray());

        var ex = Assert.Throws<ConflictException>(() => ServiceFacilityExcelParser.Parse(ms));
        Assert.Equal("EXCEL_INVALID_FORMAT", ex.ErrorCode);
    }

    [Fact]
    public void Parse_RealTemplateFile_ReadsDataRows()
    {
        // Şablonun gerçek kopyası: sütun sırası veya başlıkları değişirse bu test kırılır.
        var path = Path.Combine(AppContext.BaseDirectory, "TestData", "TESIS_GIRIS_SABLONU.xlsx");
        Assert.True(File.Exists(path), $"Şablon bulunamadı: {path}");

        using var file = File.OpenRead(path);
        using var wb = new XLWorkbook(file);
        var ws = wb.Worksheet("Tesisler");
        ws.Cell(4, 1).Value = "Şablondan Gelen Tesis";
        ws.Cell(4, 4).Value = "Kapalı";
        ws.Cell(4, 9).Value = "İstanbul";

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;

        var parsed = ServiceFacilityExcelParser.Parse(ms);
        var req = Assert.Single(parsed).Request;

        Assert.NotNull(req);
        Assert.Equal("Şablondan Gelen Tesis", req.Name);
        Assert.Equal("Indoor", req.LocationType);
        Assert.Equal("İstanbul", req.City);
    }
}
