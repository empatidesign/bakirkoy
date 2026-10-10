using ClosedXML.Excel;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.ServiceFacilities.Dtos;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// docs/TESIS_GIRIS_SABLONU.xlsx şablonunu ServiceFacilityRequest listesine çevirir.
///
/// Şablon düzeni: 1. satır başlık, 2. satır alan açıklaması, 3. satır örnek kayıt,
/// 4. satırdan itibaren gerçek veri. Kullanıcı açıklama/örnek satırlarını silmiş
/// olabileceği için veri başlangıcı sabit değil: başlıktan sonraki satırlar taranır ve
/// açıklama/örnek olduğu anlaşılanlar atlanır (bkz. <see cref="ResolveFirstDataRow"/>).
/// </summary>
public static class ServiceFacilityExcelParser
{
    public sealed record ParsedRow(int Row, string RawName, ServiceFacilityRequest? Request, string? Error);

    private const int MaxRows = 5000;

    public static List<ParsedRow> Parse(Stream excelStream)
    {
        XLWorkbook wb;
        try
        {
            wb = new XLWorkbook(excelStream);
        }
        catch (Exception ex) when (ex is IOException or InvalidDataException or FileFormatException)
        {
            throw new ConflictException("Geçersiz veya bozuk Excel dosyası. Lütfen dosyayı kontrol edip tekrar deneyin.", "EXCEL_INVALID_FORMAT");
        }
        using var _wb = wb;

        // Şablonda birden çok sayfa var ("Tesisler", "Listeler", "Açıklama"). Adıyla bulunamazsa
        // ilk sayfaya düşülür ki kullanıcının kendi hazırladığı tek sayfalık dosya da çalışsın.
        var ws = wb.Worksheets.FirstOrDefault(s => s.Name.Trim().Equals("Tesisler", StringComparison.OrdinalIgnoreCase))
            ?? wb.Worksheets.FirstOrDefault()
            ?? throw new ConflictException("Excel dosyasında sayfa bulunamadı.", "EXCEL_EMPTY");

        var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 0;
        if (lastCol == 0 || lastRow < 2)
            throw new ConflictException("Excel dosyasında veri satırı bulunamadı.", "EXCEL_NO_DATA");

        var headers = new string[lastCol + 1];
        for (var col = 1; col <= lastCol; col++)
            headers[col] = Normalize(ws.Cell(1, col).GetString());

        // Sütun eşleme sırası önemlidir: önce başlığın tamamı, sonra içerme denenir ve
        // arama terimleri sırayla tüketilir. Aksi halde "KAPASITE" araması sütun sırası
        // yüzünden "Otopark Kapasitesi" başlığına takılır ve "Kapasite (kişi)" kaybolur.
        int Col(params string[] needles)
        {
            foreach (var needle in needles)
                for (var col = 1; col <= lastCol; col++)
                    if (headers[col].Equals(needle, StringComparison.Ordinal))
                        return col;

            foreach (var needle in needles)
                for (var col = 1; col <= lastCol; col++)
                    if (headers[col].Contains(needle, StringComparison.Ordinal))
                        return col;

            return 0;
        }

        var nameCol = Col("TESIS ADI", "TESISADI", "AD");
        if (nameCol == 0)
            throw new ConflictException("Excel dosyasında \"Tesis Adı\" sütunu bulunamadı.", "EXCEL_NAME_COLUMN_NOT_FOUND");

        var c = new Cols(
            Name: nameCol,
            Type: Col("TESIS TURU", "TUR"),
            Status: Col("DURUM"),
            LocationType: Col("KONUM TIPI"),
            OutdoorCategory: Col("ACIK ALAN KATEGORISI"),
            AreaSize: Col("ALAN BUYUKLUGU"),
            Description: Col("ACIKLAMA"),
            About: Col("HAKKINDA"),
            City: Col("IL"),
            District: Col("ILCE"),
            Address: Col("ADRES"),
            Latitude: Col("ENLEM", "LATITUDE"),
            Longitude: Col("BOYLAM", "LONGITUDE"),
            Manager: Col("YONETICI ADI"),
            ManagerPhone: Col("YONETICI TELEFONU"),
            ManagerEmail: Col("YONETICI E-POSTA", "YONETICI EPOSTA"),
            GrantAccess: Col("SISTEME ERISIM"),
            EmergencyPhone: Col("ACIL DURUM TELEFONU"),
            Website: Col("WEB SITESI"),
            Facebook: Col("FACEBOOK"),
            Instagram: Col("INSTAGRAM"),
            Twitter: Col("TWITTER"),
            WeekdayOpen: Col("HAFTA ICI ACILIS"),
            WeekdayClose: Col("HAFTA ICI KAPANIS"),
            WeekendOpen: Col("HAFTA SONU ACILIS"),
            WeekendClose: Col("HAFTA SONU KAPANIS"),
            Features: Col("OLANAKLAR"),
            Accessibility: Col("ERISILEBILIRLIK"),
            ParkingCapacity: Col("OTOPARK KAPASITESI"),
            ParkingType: Col("OTOPARK TURU"),
            // "KISI" önce denenir: kullanıcı başlığı kısaltıp sadece "Kapasite" yazmışsa da
            // çalışsın diye "KAPASITE" son çare olarak bırakıldı; çakışma aşağıda ayıklanır.
            Capacity: Col("KAPASITE (KISI)", "KISI", "KAPASITE"),
            Services: Col("SUNULAN HIZMETLER"));

        // "Kapasite" araması "Otopark Kapasitesi" sütununa da uyabilir; çakışırsa yok sayılır.
        if (c.Capacity == c.ParkingCapacity) c = c with { Capacity = 0 };

        var firstDataRow = ResolveFirstDataRow(ws, c, lastRow);
        if (lastRow - firstDataRow + 1 > MaxRows)
            throw new ConflictException($"Excel dosyası en fazla {MaxRows} tesis satırı içerebilir. Lütfen dosyayı bölerek yükleyin.", "EXCEL_TOO_MANY_ROWS");

        var rows = new List<ParsedRow>();
        var emptyStreak = 0;

        for (var row = firstDataRow; row <= lastRow; row++)
        {
            var name = Text(ws, row, c.Name);
            if (name.Length == 0 && IsRowEmpty(ws, row, lastCol))
            {
                if (++emptyStreak >= 10) break;
                continue;
            }
            emptyStreak = 0;

            // Formül hücreleri GetString() ile sessizce boş döner; kullanıcıya "ad boş"
            // demek yerine gerçek sebebi bildiriyoruz (CompanyService import'undaki ile aynı politika).
            if (ws.Cell(row, c.Name).HasFormula)
            {
                rows.Add(new ParsedRow(row, "(formül hücresi)", null, "Bu satırda formül içeren bir hücre var. Lütfen düz metin olarak girin."));
                continue;
            }

            if (name.Length == 0)
            {
                rows.Add(new ParsedRow(row, "", null, "Tesis adı boş olamaz."));
                continue;
            }

            var locationType = ParseLocationType(Text(ws, row, c.LocationType));
            var isOutdoor = locationType == "Outdoor";

            if (!TryCoordinate(Text(ws, row, c.Latitude), -90, 90, out var lat))
            {
                rows.Add(new ParsedRow(row, name, null, "Enlem değeri geçersiz. -90 ile 90 arasında ondalık bir sayı girin."));
                continue;
            }
            if (!TryCoordinate(Text(ws, row, c.Longitude), -180, 180, out var lng))
            {
                rows.Add(new ParsedRow(row, name, null, "Boylam değeri geçersiz. -180 ile 180 arasında ondalık bir sayı girin."));
                continue;
            }

            var grantAccess = ParseBool(Text(ws, row, c.GrantAccess));
            var managerName = Text(ws, row, c.Manager);
            var managerEmail = Text(ws, row, c.ManagerEmail);
            if (grantAccess && (managerName.Length == 0 || managerEmail.Length == 0))
            {
                rows.Add(new ParsedRow(row, name, null, "Sisteme erişim verilecek kişinin adı ve e-postası zorunludur."));
                continue;
            }

            var req = new ServiceFacilityRequest(
                Name: name,
                Type: Text(ws, row, c.Type),
                LocationType: locationType,
                OutdoorCategory: isOutdoor ? ParseOutdoorCategory(Text(ws, row, c.OutdoorCategory)) : null,
                AreaSizeM2: isOutdoor ? Int(ws, row, c.AreaSize) : null,
                Description: NullIfEmpty(Text(ws, row, c.Description)),
                About: NullIfEmpty(Text(ws, row, c.About)),
                City: Text(ws, row, c.City),
                District: Text(ws, row, c.District),
                Address: Text(ws, row, c.Address),
                Latitude: lat,
                Longitude: lng,
                ManagerId: null,
                EmergencyPhone: NullIfEmpty(Text(ws, row, c.EmergencyPhone)),
                Website: NullIfEmpty(Text(ws, row, c.Website)),
                Facebook: NullIfEmpty(Text(ws, row, c.Facebook)),
                Instagram: NullIfEmpty(Text(ws, row, c.Instagram)),
                Twitter: NullIfEmpty(Text(ws, row, c.Twitter)),
                WeekdayOpen: Time(ws, row, c.WeekdayOpen),
                WeekdayClose: Time(ws, row, c.WeekdayClose),
                WeekendOpen: Time(ws, row, c.WeekendOpen),
                WeekendClose: Time(ws, row, c.WeekendClose),
                Facilities: SplitList(Text(ws, row, c.Features)),
                AccessibilityFeatures: SplitList(Text(ws, row, c.Accessibility)),
                ParkingCapacity: Int(ws, row, c.ParkingCapacity) ?? 0,
                ParkingType: ParseParkingType(Text(ws, row, c.ParkingType)),
                Capacity: Int(ws, row, c.Capacity),
                OfferedServices: ParseServices(Text(ws, row, c.Services)),
                Images: null)
            {
                Manager = NullIfEmpty(managerName),
                ManagerPhone = NullIfEmpty(Text(ws, row, c.ManagerPhone)),
                ManagerEmail = NullIfEmpty(managerEmail),
                GrantAccess = grantAccess,
            };

            rows.Add(new ParsedRow(row, name, req, null));
        }

        if (rows.Count == 0)
            throw new ConflictException("Excel dosyasında veri satırı bulunamadı.", "EXCEL_NO_DATA");

        return rows;
    }

    /// <summary>
    /// Şablondaki açıklama (2.) ve örnek (3.) satırlarını atlar. Kullanıcı bunları silmiş
    /// olabileceği için satır numarasına güvenmek yerine içerik kontrol edilir: örnek satırdaki
    /// tesis adı şablonda sabit, açıklama satırı ise "Zorunlu." ile başlar.
    /// </summary>
    private static int ResolveFirstDataRow(IXLWorksheet ws, Cols c, int lastRow)
    {
        var row = 2;
        while (row <= lastRow && row <= 4)
        {
            var name = Text(ws, row, c.Name);
            var isNote = name.StartsWith("Zorunlu.", StringComparison.OrdinalIgnoreCase);
            var isSample = name.Equals("Sultangazi Spor Kompleksi", StringComparison.OrdinalIgnoreCase);
            if (!isNote && !isSample) break;
            row++;
        }
        return row;
    }

    private static bool IsRowEmpty(IXLWorksheet ws, int row, int lastCol)
    {
        for (var col = 1; col <= lastCol; col++)
            if (ws.Cell(row, col).GetString().Trim().Length > 0)
                return false;
        return true;
    }

    private static string Text(IXLWorksheet ws, int row, int col)
        => col == 0 ? "" : ws.Cell(row, col).GetString().Trim();

    private static string? NullIfEmpty(string value) => value.Length == 0 ? null : value;

    private static int? Int(IXLWorksheet ws, int row, int col)
    {
        var raw = Text(ws, row, col);
        if (raw.Length == 0) return null;
        var digits = new string(raw.Where(ch => char.IsDigit(ch) || ch == '-').ToArray());
        return int.TryParse(digits, out var v) && v >= 0 ? v : null;
    }

    /// <summary>
    /// Saat hücresi. Excel "08:00" girdisini otomatik olarak bir zaman/tarih değerine
    /// çevirebildiği için hem metin hem de gerçek TimeSpan/DateTime biçimi desteklenir.
    /// </summary>
    private static string Time(IXLWorksheet ws, int row, int col)
    {
        if (col == 0) return "";
        var cell = ws.Cell(row, col);

        if (cell.DataType == XLDataType.DateTime && cell.TryGetValue<DateTime>(out var dt))
            return dt.ToString("HH\\:mm");
        if (cell.DataType == XLDataType.TimeSpan && cell.TryGetValue<TimeSpan>(out var ts))
            return $"{(int)ts.TotalHours:00}:{ts.Minutes:00}";

        var raw = cell.GetString().Trim();
        if (raw.Length == 0) return "";
        return TimeSpan.TryParse(raw, out var parsed)
            ? $"{(int)parsed.TotalHours:00}:{parsed.Minutes:00}"
            : raw;
    }

    private static bool TryCoordinate(string raw, double min, double max, out double? value)
    {
        value = null;
        if (raw.Length == 0) return true;

        // Kullanıcı "41,1065" (virgüllü) da yazabilir; her iki biçim de kabul edilir.
        var normalized = raw.Replace(',', '.');
        if (!double.TryParse(normalized, System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var parsed))
            return false;
        if (parsed < min || parsed > max) return false;

        value = parsed;
        return true;
    }

    private static bool ParseBool(string raw) => Normalize(raw) switch
    {
        "EVET" or "VAR" or "TRUE" or "1" or "X" => true,
        _ => false,
    };

    private static string ParseLocationType(string raw) => Normalize(raw) switch
    {
        "ACIK" or "OUTDOOR" or "ACIK ALAN" => "Outdoor",
        _ => "Indoor",
    };

    private static string? ParseOutdoorCategory(string raw) => Normalize(raw) switch
    {
        "KENT ORMANI" or "KENTORMANI" => "KentOrmani",
        "PARK" => "Park",
        "MEYDAN" => "Meydan",
        "SAHIL" => "Sahil",
        "ACIK SAHA" or "ACIKSAHA" => "AcikSaha",
        "DIGER" => "Diger",
        _ => null,
    };

    private static string ParseParkingType(string raw) => Normalize(raw) switch
    {
        "UCRETLI" or "PAID" => "Paid",
        "SINIRLI" or "LIMITED" => "Limited",
        _ => "Free",
    };

    private static List<string> SplitList(string raw)
        => raw.Length == 0
            ? []
            : raw.Split([',', ';', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                 .Distinct(StringComparer.OrdinalIgnoreCase)
                 .ToList();

    /// <summary>
    /// "Yüzme|sports, Fitness" biçimini ayrıştırır. Modül belirtilmezse "info" atanır.
    /// </summary>
    private static List<ServiceOfferingDto> ParseServices(string raw)
        => SplitList(raw).Select(entry =>
        {
            var parts = entry.Split('|', 2, StringSplitOptions.TrimEntries);
            var module = parts.Length > 1 && parts[1].Length > 0 ? parts[1].ToLowerInvariant() : "info";
            return new ServiceOfferingDto(Guid.NewGuid().ToString("N"), null, parts[0], module, null, true);
        }).ToList();

    /// <summary>
    /// Türkçe karakterleri ASCII karşılıklarına indirger ve büyük harfe çevirir; böylece
    /// "Tesis Türü", "TESİS TÜRÜ" ve "tesis turu" aynı sütuna eşlenir.
    ///
    /// DİKKAT: sadeleştirme ToUpperInvariant'tan ÖNCE yapılmalıdır. Invariant kültür küçük
    /// noktasız "ı" (U+0131) harfini büyütmez; önce büyütülürse "Açık" -> "AÇıK" olur ve
    /// "ACIK" karşılaştırması tutmaz.
    /// </summary>
    private static string Normalize(string value)
        => value.Trim()
            .Replace('ı', 'i').Replace('İ', 'i')
            .Replace('ş', 's').Replace('Ş', 's')
            .Replace('ğ', 'g').Replace('Ğ', 'g')
            .Replace('ü', 'u').Replace('Ü', 'u')
            .Replace('ö', 'o').Replace('Ö', 'o')
            .Replace('ç', 'c').Replace('Ç', 'c')
            .ToUpperInvariant();

    private sealed record Cols(
        int Name, int Type, int Status, int LocationType, int OutdoorCategory, int AreaSize,
        int Description, int About, int City, int District, int Address, int Latitude, int Longitude,
        int Manager, int ManagerPhone, int ManagerEmail, int GrantAccess, int EmergencyPhone,
        int Website, int Facebook, int Instagram, int Twitter,
        int WeekdayOpen, int WeekdayClose, int WeekendOpen, int WeekendClose,
        int Features, int Accessibility, int ParkingCapacity, int ParkingType, int Capacity, int Services);
}
