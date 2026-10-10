using ClosedXML.Excel;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Infrastructure.Services;

public sealed class ExcelService : IExcelService
{
    private const string HeaderBg = "#1B3D82";
    private const string SubHeaderBg = "#2E5CA8";
    private const string ColHeaderBg = "#3A70C8";
    private const string ZebraRowBg = "#EEF3FB";
    private const string SummaryHeaderBg = "#4A7FD4";

    private static readonly XLColor HeaderColor = XLColor.FromHtml(HeaderBg);
    private static readonly XLColor SubHeaderColor = XLColor.FromHtml(SubHeaderBg);
    private static readonly XLColor ColHeaderColor = XLColor.FromHtml(ColHeaderBg);
    private static readonly XLColor ZebraColor = XLColor.FromHtml(ZebraRowBg);
    private static readonly XLColor SummaryHeaderColor = XLColor.FromHtml(SummaryHeaderBg);

    public byte[] BuildTravelApplicationExport(IReadOnlyList<TravelApplicationDto> items, string reportTitle)
    {
        using var wb = new XLWorkbook();

        AddTravelSheet(wb, items, reportTitle);
        AddTravelPassengerSheet(wb, items);
        AddTravelSeatPlanSheet(wb, items);
        AddTravelSummarySheet(wb, items, reportTitle);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public byte[] BuildEventApplicationExport(IReadOnlyList<ApplicationDto> items, string reportTitle, string? sessionInfo)
    {
        using var wb = new XLWorkbook();

        AddEventApplicationSheet(wb, items, reportTitle, sessionInfo);
        AddEventSessionSheet(wb, items);
        AddEventStatusSheet(wb, items);
        AddEventSummarySheet(wb, items, reportTitle);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public byte[] BuildTravelAttendanceExport(TravelAttendanceRosterDto roster)
    {
        using var wb = new XLWorkbook();

        AddTravelAttendanceSheet(wb, roster);
        AddTravelAttendanceSummarySheet(wb, roster);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public byte[] BuildEventAttendanceExport(IReadOnlyList<ActivityDto> items, string eventName)
    {
        using var wb = new XLWorkbook();

        AddEventAttendanceSheet(wb, items, eventName);
        AddEventAttendanceSummarySheet(wb, items, eventName);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static void AddTravelSheet(XLWorkbook wb, IReadOnlyList<TravelApplicationDto> items, string reportTitle)
    {
        var ws = wb.Worksheets.Add("Başvurular");
        string[] headers = ["Ad Soyad", "TC Kimlik", "Telefon", "E-posta", "Adres", "Mahalle", "Gezi", "Gezi Tarihi", "Başvuru Tarihi", "Durum", "Belge", "Ödeme", "Otobüs", "Koltuk", "Refakatçi", "Misafir", "Başvuruyu Yapan"];

        WriteSheetHeader(ws, "Sultangazi Belediyesi — Gezi Başvuruları", reportTitle, headers);

        int row = 4;
        foreach (var a in items)
        {
            ws.Cell(row, 1).Value = a.ParticipantName;
            ws.Cell(row, 2).Value = a.Tckn;
            ws.Cell(row, 3).Value = a.Phone;
            ws.Cell(row, 4).Value = a.Email;
            ws.Cell(row, 5).Value = a.Address ?? "—";
            ws.Cell(row, 6).Value = a.Neighborhood ?? "—";
            ws.Cell(row, 7).Value = a.TravelName;
            ws.Cell(row, 8).Value = FormatTravelDateRange(a.TravelStartDate, a.TravelEndDate);
            ws.Cell(row, 9).Value = a.ApplicationDate.ToString("dd.MM.yyyy");
            ws.Cell(row, 10).Value = TravelStatusLabel(a.Status);
            ws.Cell(row, 11).Value = DocumentStatusLabel(a.DocumentStatus);
            ws.Cell(row, 12).Value = PaymentStatusLabel(a.PaymentStatus);
            ws.Cell(row, 13).Value = a.BusName ?? "—";
            ws.Cell(row, 14).Value = a.SeatNumber ?? "—";
            ws.Cell(row, 16).Value = a.IsGuest ? "Evet" : "Hayır";
            ws.Cell(row, 17).Value = a.IsGuest ? a.ApplicantName ?? "—" : "—";

            if (row % 2 == 0)
                ApplyZebraRow(ws, row, headers.Length);

            row++;
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static string FormatTravelDateRange(DateTime? start, DateTime? end)
    {
        if (start is null) return "—";
        var s = start.Value.ToString("dd.MM.yyyy");
        if (end is null || end.Value.Date == start.Value.Date) return s;
        return $"{s} – {end.Value:dd.MM.yyyy}";
    }

    private static void AddTravelPassengerSheet(XLWorkbook wb, IReadOnlyList<TravelApplicationDto> items)
    {
        var ws = wb.Worksheets.Add("Yolcular");
        string[] headers = ["Ana Katılımcı", "Yolcu Ad Soyad", "TC Kimlik", "Cinsiyet", "Otobüs", "Koltuk", "Birincil"];

        WriteSheetHeader(ws, "Sultangazi Belediyesi — Yolcu Listesi", "Tüm Yolcular", headers);

        int row = 4;
        foreach (var a in items)
        {
            foreach (var p in a.Passengers)
            {
                ws.Cell(row, 1).Value = a.ApplicantName ?? a.ParticipantName;
                ws.Cell(row, 2).Value = p.ParticipantName;
                ws.Cell(row, 3).Value = p.Tckn;
                ws.Cell(row, 4).Value = GenderLabel(p.Gender);
                ws.Cell(row, 5).Value = p.SeatNumber is not null ? (p.BusName ?? a.BusName ?? "—") : "—";
                ws.Cell(row, 6).Value = p.SeatNumber ?? "—";
                ws.Cell(row, 7).Value = p.IsPrimary ? "Evet" : "Hayır";

                if (row % 2 == 0)
                    ApplyZebraRow(ws, row, headers.Length);

                row++;
            }
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static void AddTravelSeatPlanSheet(XLWorkbook wb, IReadOnlyList<TravelApplicationDto> items)
    {
        var ws = wb.Worksheets.Add("Otobüs Koltuk Planı");
        string[] headers = ["Otobüs", "Koltuk", "Ad Soyad", "TC Kimlik", "Cinsiyet", "Başvuru Sahibi"];

        WriteSheetHeader(ws, "Sultangazi Belediyesi — Koltuk Planı", "Otobüs & Koltuk Dağılımı", headers);

        var groups = items
            .SelectMany(a => a.Passengers
                .Where(p => p.SeatNumber is not null)
                .Select(p => new { BusName = a.BusName ?? "Belirsiz", p.SeatNumber, p.ParticipantName, p.Tckn, p.Gender, ApplicantName = a.ApplicantName ?? a.ParticipantName }))
            .OrderBy(x => x.BusName)
            .ThenBy(x => x.SeatNumber);

        int row = 4;
        foreach (var x in groups)
        {
            ws.Cell(row, 1).Value = x.BusName;
            ws.Cell(row, 2).Value = x.SeatNumber;
            ws.Cell(row, 3).Value = x.ParticipantName;
            ws.Cell(row, 4).Value = x.Tckn;
            ws.Cell(row, 5).Value = GenderLabel(x.Gender);
            ws.Cell(row, 6).Value = x.ApplicantName;

            if (row % 2 == 0)
                ApplyZebraRow(ws, row, headers.Length);

            row++;
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static void AddTravelSummarySheet(XLWorkbook wb, IReadOnlyList<TravelApplicationDto> items, string reportTitle)
    {
        var ws = wb.Worksheets.Add("Özet");

        ws.Cell(1, 1).Value = "Sultangazi Belediyesi";
        StyleTitleCell(ws.Cell(1, 1), 14, HeaderColor);
        ws.Range(1, 1, 1, 4).Merge();

        ws.Cell(2, 1).Value = $"Gezi Başvuruları — {reportTitle}";
        StyleTitleCell(ws.Cell(2, 1), 11, SubHeaderColor);
        ws.Range(2, 1, 2, 4).Merge();

        ws.Cell(3, 1).Value = $"Oluşturulma: {DateTime.Now:dd.MM.yyyy HH:mm}";
        ws.Cell(3, 1).Style.Font.Italic = true;
        ws.Cell(3, 1).Style.Font.FontSize = 10;
        ws.Range(3, 1, 3, 4).Merge();

        ws.Row(1).Height = 28;
        ws.Row(2).Height = 20;
        ws.Row(3).Height = 18;

        int row = 5;
        WriteSummaryRow(ws, row++, "Toplam Başvuru", items.Count, SummaryHeaderColor, isHeader: true);
        WriteSummaryRow(ws, row++, "Onaylandı", items.Count(x => x.Status == "approved"), XLColor.Green);
        WriteSummaryRow(ws, row++, "İnceleniyor", items.Count(x => x.Status == "reviewing"), XLColor.Orange);
        WriteSummaryRow(ws, row++, "Gönderildi", items.Count(x => x.Status == "pending"), XLColor.FromHtml("#3A70C8"));
        WriteSummaryRow(ws, row++, "Reddedildi", items.Count(x => x.Status == "rejected"), XLColor.Red);
        WriteSummaryRow(ws, row++, "Yedek Liste", items.Count(x => x.Status == "waitlist"), XLColor.FromHtml("#8B5CF6"));
        row++;
        WriteSummaryRow(ws, row++, "Belgesi Tamamlandı", items.Count(x => x.DocumentStatus == "verified"), XLColor.Green);
        WriteSummaryRow(ws, row++, "Belge Bekleniyor", items.Count(x => x.DocumentStatus == "submitted"), XLColor.Orange);
        WriteSummaryRow(ws, row++, "Belge Eksik", items.Count(x => x.DocumentStatus == "missing"), XLColor.Red);
        row++;
        WriteSummaryRow(ws, row++, "Ödeme Tamamlandı", items.Count(x => x.PaymentStatus == "paid"), XLColor.Green);
        WriteSummaryRow(ws, row++, "Ödeme Bekleniyor", items.Count(x => x.PaymentStatus == "unpaid"), XLColor.Red);
        WriteSummaryRow(ws, row++, "Muaf", items.Count(x => x.PaymentStatus == "exempt"), XLColor.FromHtml("#6B7280"));
        row++;
        WriteSummaryRow(ws, row, "Toplam Yolcu", items.Sum(x => x.Passengers.Count), XLColor.FromHtml("#3A70C8"));

        ws.Column(1).Width = 30;
        ws.Column(2).Width = 15;
        ws.Column(3).Width = 20;
        ws.Column(4).Width = 20;
    }

    private static void AddEventApplicationSheet(XLWorkbook wb, IReadOnlyList<ApplicationDto> items, string reportTitle, string? sessionInfo)
    {
        var ws = wb.Worksheets.Add("Başvurular");
        string[] headers = ["Kod", "Katılımcı", "TC Kimlik", "Telefon", "E-posta", "Etkinlik", "Koltuk", "Başvuru Tarihi", "Cinsiyet", "Durum"];

        var subTitle = string.IsNullOrWhiteSpace(sessionInfo) ? reportTitle : $"{reportTitle}  |  {sessionInfo}";
        WriteSheetHeader(ws, "Sultangazi Belediyesi — Etkinlik Başvuruları", subTitle, headers, appendTimestamp: false);

        int row = 4;
        foreach (var a in items)
        {
            ws.Cell(row, 1).Value = a.Code;
            ws.Cell(row, 2).Value = a.ParticipantName;
            ws.Cell(row, 3).Value = a.Tckn;
            ws.Cell(row, 4).Value = a.Phone ?? "—";
            ws.Cell(row, 5).Value = a.Email ?? "—";
            ws.Cell(row, 6).Value = a.EventName;
            ws.Cell(row, 7).Value = a.SeatNumber ?? "—";
            ws.Cell(row, 8).Value = a.AppliedAt.ToString("dd.MM.yyyy HH:mm");
            ws.Cell(row, 9).Value = GenderLabel(a.Gender);
            ws.Cell(row, 10).Value = EventStatusLabel(a.Status);

            if (row % 2 == 0)
                ApplyZebraRow(ws, row, headers.Length);

            row++;
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static void AddEventSessionSheet(XLWorkbook wb, IReadOnlyList<ApplicationDto> items)
    {
        var ws = wb.Worksheets.Add("Seans Bazlı");
        string[] headers = ["Seans", "Katılımcı", "TC Kimlik", "Koltuk", "Durum"];

        WriteSheetHeader(ws, "Sultangazi Belediyesi — Seans Bazlı Katılımcılar", "Seans Kırılımı", headers);

        var grouped = items
            .GroupBy(a => a.SessionLabel ?? "Seans Belirtilmemiş")
            .OrderBy(g => g.Key);

        int row = 4;
        foreach (var group in grouped)
        {
            var groupHeader = ws.Range(row, 1, row, headers.Length);
            groupHeader.Merge();
            groupHeader.FirstCell().Value = group.Key;
            groupHeader.Style.Font.Bold = true;
            groupHeader.Style.Font.FontColor = XLColor.White;
            groupHeader.Style.Fill.BackgroundColor = SummaryHeaderColor;
            groupHeader.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            groupHeader.Style.Alignment.Indent = 1;
            ws.Row(row).Height = 18;
            row++;

            foreach (var a in group.OrderBy(x => x.ParticipantName))
            {
                ws.Cell(row, 1).Value = group.Key;
                ws.Cell(row, 2).Value = a.ParticipantName;
                ws.Cell(row, 3).Value = a.Tckn;
                ws.Cell(row, 4).Value = a.SeatNumber ?? "—";
                ws.Cell(row, 5).Value = EventStatusLabel(a.Status);

                if (row % 2 == 0)
                    ApplyZebraRow(ws, row, headers.Length);

                row++;
            }
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static void AddEventStatusSheet(XLWorkbook wb, IReadOnlyList<ApplicationDto> items)
    {
        var ws = wb.Worksheets.Add("Durum Dağılımı");
        string[] headers = ["Katılımcı", "TC Kimlik", "Etkinlik", "Seans", "Durum Tarihi", "Durum"];

        WriteSheetHeader(ws, "Sultangazi Belediyesi — Başvuru Durum Listesi", "Tüm Başvurular", headers);

        var sorted = items.OrderBy(a => a.Status).ThenBy(a => a.ParticipantName);

        int row = 4;
        foreach (var a in sorted)
        {
            ws.Cell(row, 1).Value = a.ParticipantName;
            ws.Cell(row, 2).Value = a.Tckn;
            ws.Cell(row, 3).Value = a.EventName;
            ws.Cell(row, 4).Value = a.SessionLabel ?? "—";
            ws.Cell(row, 5).Value = a.AppliedAt.ToString("dd.MM.yyyy");
            ws.Cell(row, 6).Value = EventStatusLabel(a.Status);

            if (row % 2 == 0)
                ApplyZebraRow(ws, row, headers.Length);

            row++;
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static void AddEventSummarySheet(XLWorkbook wb, IReadOnlyList<ApplicationDto> items, string reportTitle)
    {
        var ws = wb.Worksheets.Add("Özet");

        ws.Cell(1, 1).Value = "Sultangazi Belediyesi";
        StyleTitleCell(ws.Cell(1, 1), 14, HeaderColor);
        ws.Range(1, 1, 1, 4).Merge();

        ws.Cell(2, 1).Value = $"Etkinlik Başvuruları — {reportTitle}";
        StyleTitleCell(ws.Cell(2, 1), 11, SubHeaderColor);
        ws.Range(2, 1, 2, 4).Merge();

        ws.Cell(3, 1).Value = $"Oluşturulma: {DateTime.Now:dd.MM.yyyy HH:mm}";
        ws.Cell(3, 1).Style.Font.Italic = true;
        ws.Cell(3, 1).Style.Font.FontSize = 10;
        ws.Range(3, 1, 3, 4).Merge();

        ws.Row(1).Height = 28;
        ws.Row(2).Height = 20;
        ws.Row(3).Height = 18;

        int row = 5;
        WriteSummaryRow(ws, row++, "Toplam Başvuru", items.Count, SummaryHeaderColor, isHeader: true);
        WriteSummaryRow(ws, row++, "Onaylandı", items.Count(x => x.Status == "approved"), XLColor.Green);
        WriteSummaryRow(ws, row++, "İnceleniyor", items.Count(x => x.Status == "reviewing"), XLColor.Orange);
        WriteSummaryRow(ws, row++, "Bekliyor", items.Count(x => x.Status == "pending"), XLColor.FromHtml("#3A70C8"));
        WriteSummaryRow(ws, row++, "Reddedildi", items.Count(x => x.Status == "rejected"), XLColor.Red);
        row++;
        WriteSummaryRow(ws, row++, "Belgesi Tamamlandı", items.Count(x => x.DocumentStatus == "verified"), XLColor.Green);
        WriteSummaryRow(ws, row++, "Belge Bekleniyor", items.Count(x => x.DocumentStatus == "submitted"), XLColor.Orange);
        WriteSummaryRow(ws, row++, "Belge Eksik", items.Count(x => x.DocumentStatus == "missing"), XLColor.Red);
        row++;
        WriteSummaryRow(ws, row++, "Ödeme Tamamlandı", items.Count(x => x.PaymentStatus == "paid"), XLColor.Green);
        WriteSummaryRow(ws, row++, "Ödeme Bekleniyor", items.Count(x => x.PaymentStatus == "unpaid"), XLColor.Red);
        WriteSummaryRow(ws, row++, "Muaf", items.Count(x => x.PaymentStatus == "exempt"), XLColor.FromHtml("#6B7280"));
        row++;

        var sessionGroups = items.GroupBy(x => x.SessionLabel ?? "Seans Belirtilmemiş").OrderBy(g => g.Key);
        foreach (var g in sessionGroups)
            WriteSummaryRow(ws, row++, g.Key, g.Count(), XLColor.FromHtml("#3A70C8"));

        ws.Column(1).Width = 32;
        ws.Column(2).Width = 15;
        ws.Column(3).Width = 20;
        ws.Column(4).Width = 20;
    }

    private static void WriteSheetHeader(IXLWorksheet ws, string title, string subTitle, string[] headers, bool appendTimestamp = true)
    {
        int colCount = headers.Length;

        var titleCell = ws.Cell(1, 1);
        titleCell.Value = title;
        StyleTitleCell(titleCell, 13, HeaderColor);
        ws.Range(1, 1, 1, colCount).Merge();
        ws.Row(1).Height = 26;

        var subCell = ws.Cell(2, 1);
        subCell.Value = appendTimestamp ? $"{subTitle}  |  {DateTime.Now:dd.MM.yyyy HH:mm}" : subTitle;
        StyleTitleCell(subCell, 10, SubHeaderColor);
        ws.Range(2, 1, 2, colCount).Merge();
        ws.Row(2).Height = 18;

        for (int i = 0; i < colCount; i++)
        {
            var cell = ws.Cell(3, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = ColHeaderColor;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.BottomBorderColor = XLColor.FromHtml("#1B3D82");
        }

        ws.Row(3).Height = 20;
        ws.SheetView.FreezeRows(3);
    }

    private static void FinalizeSheet(IXLWorksheet ws, int colCount)
    {
        for (int i = 1; i <= colCount; i++)
            ws.Column(i).AdjustToContents(3, ws.LastRowUsed()?.RowNumber() ?? 3);

        ws.Style.Alignment.WrapText = false;
        ws.Style.Font.FontName = "Calibri";
        ws.Style.Font.FontSize = 10;
    }

    private static void StyleTitleCell(IXLCell cell, int fontSize, XLColor bg)
    {
        cell.Style.Font.Bold = true;
        cell.Style.Font.FontSize = fontSize;
        cell.Style.Font.FontColor = XLColor.White;
        cell.Style.Fill.BackgroundColor = bg;
        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        cell.Style.Font.FontName = "Calibri";
    }

    private static void ApplyZebraRow(IXLWorksheet ws, int row, int colCount)
    {
        ws.Range(row, 1, row, colCount).Style.Fill.BackgroundColor = ZebraColor;
    }

    private static void WriteSummaryRow(IXLWorksheet ws, int row, string label, int value, XLColor accentColor, bool isHeader = false)
    {
        ws.Cell(row, 1).Value = label;
        ws.Cell(row, 2).Value = value;

        if (isHeader)
        {
            ws.Cell(row, 1).Style.Font.Bold = true;
            ws.Cell(row, 1).Style.Font.FontColor = XLColor.White;
            ws.Cell(row, 1).Style.Fill.BackgroundColor = accentColor;
            ws.Cell(row, 2).Style.Font.Bold = true;
            ws.Cell(row, 2).Style.Font.FontColor = XLColor.White;
            ws.Cell(row, 2).Style.Fill.BackgroundColor = accentColor;
        }
        else
        {
            ws.Cell(row, 1).Style.Font.FontColor = XLColor.Black;
            var indicator = ws.Cell(row, 3);
            indicator.Value = "●";
            indicator.Style.Font.FontColor = accentColor;
            indicator.Style.Font.FontSize = 8;
        }

        ws.Cell(row, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        ws.Row(row).Height = 16;
    }

    private static string TravelStatusLabel(string status) => status switch
    {
        "pending" => "Gönderildi",
        "reviewing" => "İnceleniyor",
        "approved" => "Onaylandı",
        "rejected" => "Reddedildi",
        "waitlist" => "Yedek Liste",
        _ => status,
    };

    private static string EventStatusLabel(string status) => status switch
    {
        "pending" => "Bekliyor",
        "reviewing" => "İnceleniyor",
        "approved" => "Onaylandı",
        "rejected" => "Reddedildi",
        _ => status,
    };

    private static string DocumentStatusLabel(string status) => status switch
    {
        "missing" => "Eksik",
        "submitted" => "Teslim Edildi",
        "verified" => "Doğrulandı",
        _ => status,
    };

    private static string PaymentStatusLabel(string status) => status switch
    {
        "unpaid" => "Ödenmedi",
        "paid" => "Ödendi",
        "exempt" => "Muaf",
        _ => status,
    };

    private static void AddTravelAttendanceSheet(XLWorkbook wb, TravelAttendanceRosterDto roster)
    {
        var ws = wb.Worksheets.Add("Yoklama Listesi");
        string[] headers = ["Ad Soyad", "TC Kimlik", "Otobüs", "Koltuk", "Durum"];

        var subTitle = $"{roster.TravelName}  |  {roster.StartDate:dd.MM.yyyy} – {roster.EndDate:dd.MM.yyyy}";
        WriteSheetHeader(ws, "Sultangazi Belediyesi — Gezi Yoklaması", subTitle, headers);

        int row = 4;
        foreach (var item in roster.Items.OrderBy(x => x.BusName).ThenBy(x => x.SeatNumber).ThenBy(x => x.FullName))
        {
            ws.Cell(row, 1).Value = item.FullName;
            ws.Cell(row, 2).Value = item.Tckn;
            ws.Cell(row, 3).Value = item.BusName ?? "—";
            ws.Cell(row, 4).Value = item.SeatNumber ?? "—";
            ws.Cell(row, 5).Value = AttendanceStatusLabel(item.Status);

            if (row % 2 == 0)
                ApplyZebraRow(ws, row, headers.Length);

            row++;
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static void AddTravelAttendanceSummarySheet(XLWorkbook wb, TravelAttendanceRosterDto roster)
    {
        var ws = wb.Worksheets.Add("Özet");

        ws.Cell(1, 1).Value = "Sultangazi Belediyesi";
        StyleTitleCell(ws.Cell(1, 1), 14, HeaderColor);
        ws.Range(1, 1, 1, 4).Merge();

        ws.Cell(2, 1).Value = $"Gezi Yoklaması — {roster.TravelName}";
        StyleTitleCell(ws.Cell(2, 1), 11, SubHeaderColor);
        ws.Range(2, 1, 2, 4).Merge();

        ws.Cell(3, 1).Value = $"Oluşturulma: {DateTime.Now:dd.MM.yyyy HH:mm}" + (roster.TakenAt.HasValue ? $"  |  Yoklama alındı: {roster.TakenAt.Value:dd.MM.yyyy HH:mm}" : "");
        ws.Cell(3, 1).Style.Font.Italic = true;
        ws.Cell(3, 1).Style.Font.FontSize = 10;
        ws.Range(3, 1, 3, 4).Merge();

        ws.Row(1).Height = 28;
        ws.Row(2).Height = 20;
        ws.Row(3).Height = 18;

        int row = 5;
        WriteSummaryRow(ws, row++, "Toplam Yolcu", roster.Items.Count, SummaryHeaderColor, isHeader: true);
        WriteSummaryRow(ws, row++, "Geldi", roster.Items.Count(x => x.Status == "present"), XLColor.Green);
        WriteSummaryRow(ws, row++, "Geç Geldi", roster.Items.Count(x => x.Status == "late"), XLColor.Orange);
        WriteSummaryRow(ws, row++, "Gelmedi", roster.Items.Count(x => x.Status == "absent"), XLColor.Red);
        WriteSummaryRow(ws, row, "İşaretlenmedi", roster.Items.Count(x => x.Status == "none"), XLColor.FromHtml("#6B7280"));

        ws.Column(1).Width = 30;
        ws.Column(2).Width = 15;
        ws.Column(3).Width = 20;
        ws.Column(4).Width = 20;
    }

    private static void AddEventAttendanceSheet(XLWorkbook wb, IReadOnlyList<ActivityDto> items, string eventName)
    {
        var ws = wb.Worksheets.Add("Katılım Listesi");
        string[] headers = ["Ad Soyad", "TC Kimlik", "Etkinlik", "Seans", "Tarih", "Saat", "Tür", "Yöntem", "Walk-in"];

        WriteSheetHeader(ws, "Sultangazi Belediyesi — Etkinlik Katılım", eventName, headers);

        int row = 4;
        foreach (var a in items.OrderBy(x => x.At))
        {
            ws.Cell(row, 1).Value = a.ParticipantName;
            ws.Cell(row, 2).Value = a.Tckn;
            ws.Cell(row, 3).Value = a.EventName;
            ws.Cell(row, 4).Value = a.SessionLabel ?? "—";
            ws.Cell(row, 5).Value = a.At.ToString("dd.MM.yyyy");
            ws.Cell(row, 6).Value = a.At.ToString("HH:mm");
            ws.Cell(row, 7).Value = ActivityKindLabel(a.Kind);
            ws.Cell(row, 8).Value = ActivityMethodLabel(a.Method);
            ws.Cell(row, 9).Value = a.WalkIn ? "Evet" : "Hayır";

            if (row % 2 == 0)
                ApplyZebraRow(ws, row, headers.Length);

            row++;
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static void AddEventAttendanceSummarySheet(XLWorkbook wb, IReadOnlyList<ActivityDto> items, string eventName)
    {
        var ws = wb.Worksheets.Add("Özet");

        ws.Cell(1, 1).Value = "Sultangazi Belediyesi";
        StyleTitleCell(ws.Cell(1, 1), 14, HeaderColor);
        ws.Range(1, 1, 1, 4).Merge();

        ws.Cell(2, 1).Value = $"Etkinlik Katılım — {eventName}";
        StyleTitleCell(ws.Cell(2, 1), 11, SubHeaderColor);
        ws.Range(2, 1, 2, 4).Merge();

        ws.Cell(3, 1).Value = $"Oluşturulma: {DateTime.Now:dd.MM.yyyy HH:mm}";
        ws.Cell(3, 1).Style.Font.Italic = true;
        ws.Cell(3, 1).Style.Font.FontSize = 10;
        ws.Range(3, 1, 3, 4).Merge();

        ws.Row(1).Height = 28;
        ws.Row(2).Height = 20;
        ws.Row(3).Height = 18;

        var checkIns = items.Where(x => x.Kind == "CheckIn").ToList();
        var checkOuts = items.Where(x => x.Kind == "CheckOut").ToList();

        int row = 5;
        WriteSummaryRow(ws, row++, "Toplam Kayıt", items.Count, SummaryHeaderColor, isHeader: true);
        WriteSummaryRow(ws, row++, "Giriş (Check-in)", checkIns.Count, XLColor.Green);
        WriteSummaryRow(ws, row++, "Çıkış (Check-out)", checkOuts.Count, XLColor.FromHtml("#3A70C8"));
        WriteSummaryRow(ws, row++, "Walk-in (Kayıtsız)", items.Count(x => x.WalkIn), XLColor.Orange);
        row++;

        WriteSummaryRow(ws, row++, "QR ile Giriş", checkIns.Count(x => x.Method == "Qr"), XLColor.FromHtml("#3A70C8"));
        WriteSummaryRow(ws, row++, "Manuel Giriş", checkIns.Count(x => x.Method == "Manual"), XLColor.Orange);
        WriteSummaryRow(ws, row++, "Kiosk ile Giriş", checkIns.Count(x => x.Method == "Kiosk"), XLColor.FromHtml("#8B5CF6"));
        row++;

        var sessionGroups = checkIns.GroupBy(x => x.SessionLabel ?? "Seans Belirtilmemiş").OrderBy(g => g.Key);
        foreach (var g in sessionGroups)
            WriteSummaryRow(ws, row++, g.Key, g.Count(), XLColor.FromHtml("#3A70C8"));

        ws.Column(1).Width = 32;
        ws.Column(2).Width = 15;
        ws.Column(3).Width = 20;
        ws.Column(4).Width = 20;
    }

    private static string AttendanceStatusLabel(string status) => status switch
    {
        "present" => "Geldi",
        "late" => "Geç Geldi",
        "absent" => "Gelmedi",
        "none" => "İşaretlenmedi",
        _ => status,
    };

    private static string ActivityKindLabel(string kind) => kind switch
    {
        "CheckIn" => "Giriş",
        "CheckOut" => "Çıkış",
        _ => kind,
    };

    private static string ActivityMethodLabel(string method) => method switch
    {
        "Qr" => "QR Kodu",
        "Manual" => "Manuel",
        "Kiosk" => "Kiosk",
        _ => method,
    };

    private static string GenderLabel(string gender) => (gender ?? "").Trim().ToLowerInvariant() switch
    {
        "male" or "erkek" or "m" or "1" => "Erkek",
        "female" or "kadın" or "kadin" or "f" or "2" => "Kadın",
        _ => string.IsNullOrWhiteSpace(gender) ? "—" : gender,
    };

    public byte[] BuildSedaApplicationExport(IReadOnlyList<SedaApplicationDto> items, string reportTitle)
    {
        using var wb = new XLWorkbook();
        AddSedaApplicationSheet(wb, items, reportTitle);
        AddSedaSummarySheet(wb, items, reportTitle);
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static void AddSedaApplicationSheet(XLWorkbook wb, IReadOnlyList<SedaApplicationDto> items, string reportTitle)
    {
        var ws = wb.Worksheets.Add("Başvurular");
        string[] headers = [
            "Başvuru No", "Ad", "Soyad", "TC Kimlik", "Doğum Tarihi",
            "Okul", "Sınıf (Gelecek Yıl)", "Eğitim Türü", "Sınav Merkezi",
            "Öğrenci Telefonu", "Veli Telefonu", "Adres",
            "Durum", "Başvuru Tarihi", "İnceleyen", "İnceleme Tarihi", "Notlar"
        ];

        WriteSheetHeader(ws, "Sultangazi Belediyesi — SEDA Eğitim Başvuruları", reportTitle, headers);

        int row = 5;
        foreach (var (item, index) in items.Select((x, i) => (x, i)))
        {
            var isZebra = index % 2 == 1;
            var bgColor = isZebra ? ZebraColor : XLColor.White;

            ws.Cell(row, 1).Value = item.Code;
            ws.Cell(row, 2).Value = item.StudentName;
            ws.Cell(row, 3).Value = item.StudentSurname;
            ws.Cell(row, 4).Value = item.Tckn;
            ws.Cell(row, 5).Value = item.BirthDate.HasValue ? item.BirthDate.Value.ToString("dd.MM.yyyy") : "";
            ws.Cell(row, 6).Value = item.SchoolName;
            ws.Cell(row, 7).Value = item.NextYearGrade;
            ws.Cell(row, 8).Value = item.EducationType;
            ws.Cell(row, 9).Value = item.ExamCenterName;
            ws.Cell(row, 10).Value = item.StudentPhone;
            ws.Cell(row, 11).Value = item.ParentPhone;
            ws.Cell(row, 12).Value = item.Address;
            ws.Cell(row, 13).Value = SedaStatusLabel(item.Status);
            ws.Cell(row, 14).Value = item.AppliedAt.ToString("dd.MM.yyyy HH:mm");
            ws.Cell(row, 15).Value = item.ReviewedBy ?? "";
            ws.Cell(row, 16).Value = item.ReviewedAt.HasValue ? item.ReviewedAt.Value.ToString("dd.MM.yyyy HH:mm") : "";
            ws.Cell(row, 17).Value = item.Notes ?? "";

            var statusColor = item.Status switch
            {
                "approved" => XLColor.FromHtml("#D1FAE5"),
                "rejected" => XLColor.FromHtml("#FEE2E2"),
                _ => bgColor,
            };

            for (int col = 1; col <= headers.Length; col++)
            {
                var cell = ws.Cell(row, col);
                cell.Style.Fill.BackgroundColor = col == 13 ? statusColor : bgColor;
                cell.Style.Font.FontSize = 10;
                cell.Style.Alignment.WrapText = false;
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#D1D5DB");
            }

            ws.Cell(row, 4).Style.NumberFormat.Format = "@";
            ws.Cell(row, 10).Style.NumberFormat.Format = "@";
            ws.Cell(row, 11).Style.NumberFormat.Format = "@";

            row++;
        }

        int[] colWidths = [14, 16, 16, 14, 13, 30, 12, 16, 20, 15, 15, 35, 12, 18, 18, 18, 30];
        for (int i = 0; i < colWidths.Length; i++)
            ws.Column(i + 1).Width = colWidths[i];

        ws.SheetView.FreezeRows(4);
    }

    public byte[] BuildSedaEducationRecordExport(IReadOnlyList<SedaEducationRecordDto> items, string reportTitle)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Sınavı Kazananlar");
        string[] headers = ["TCKN", "Ad Soyad", "Eğitim Yılı", "Katılımcı Eşleşmesi", "Katılımcı Adı", "Kayıt Tarihi"];

        WriteSheetHeader(ws, "Sultangazi Belediyesi — SEDA Eğitim Alanlar", reportTitle, headers);

        int row = 4;
        foreach (var (item, index) in items.Select((x, i) => (x, i)))
        {
            var bgColor = index % 2 == 1 ? ZebraColor : XLColor.White;

            ws.Cell(row, 1).Value = item.Tckn;
            ws.Cell(row, 2).Value = item.FullName;
            ws.Cell(row, 3).Value = item.AcademicYear;
            ws.Cell(row, 4).Value = item.ParticipantId.HasValue ? "Eşleşti" : "Eşleşmedi";
            ws.Cell(row, 5).Value = item.ParticipantName ?? "";
            ws.Cell(row, 6).Value = item.CreatedAt.ToString("dd.MM.yyyy HH:mm");

            for (int col = 1; col <= headers.Length; col++)
            {
                var cell = ws.Cell(row, col);
                cell.Style.Fill.BackgroundColor = bgColor;
                cell.Style.Font.FontSize = 10;
                cell.Style.Alignment.WrapText = false;
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#D1D5DB");
            }

            ws.Cell(row, 1).Style.NumberFormat.Format = "@";
            row++;
        }

        int[] colWidths = [16, 30, 13, 18, 30, 18];
        for (int i = 0; i < colWidths.Length; i++)
            ws.Column(i + 1).Width = colWidths[i];

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static void AddSedaSummarySheet(XLWorkbook wb, IReadOnlyList<SedaApplicationDto> items, string reportTitle)
    {
        var ws = wb.Worksheets.Add("Özet");

        ws.Cell(1, 1).Value = "Sultangazi Belediyesi";
        StyleTitleCell(ws.Cell(1, 1), 14, HeaderColor);
        ws.Range(1, 1, 1, 3).Merge();

        ws.Cell(2, 1).Value = $"SEDA Başvuru Özeti — {reportTitle}";
        StyleTitleCell(ws.Cell(2, 1), 11, SubHeaderColor);
        ws.Range(2, 1, 2, 3).Merge();

        ws.Cell(3, 1).Value = $"Oluşturulma: {DateTime.Now:dd.MM.yyyy HH:mm}";
        ws.Cell(3, 1).Style.Font.Italic = true;
        ws.Cell(3, 1).Style.Font.FontSize = 10;
        ws.Range(3, 1, 3, 3).Merge();

        ws.Row(1).Height = 28;
        ws.Row(2).Height = 20;
        ws.Row(3).Height = 18;

        int row = 5;
        WriteSummaryRow(ws, row++, "Toplam Başvuru", items.Count, SummaryHeaderColor, isHeader: true);
        WriteSummaryRow(ws, row++, "Onaylanan", items.Count(x => x.Status == "approved"), XLColor.Green);
        WriteSummaryRow(ws, row++, "Beklemede", items.Count(x => x.Status == "pending"), XLColor.Orange);
        WriteSummaryRow(ws, row++, "Reddedilen", items.Count(x => x.Status == "rejected"), XLColor.Red);
        row++;

        var bySchool = items.GroupBy(x => x.SchoolName).OrderByDescending(g => g.Count());
        WriteSummaryRow(ws, row++, "Okullara Göre Dağılım", 0, SummaryHeaderColor, isHeader: true);
        foreach (var g in bySchool)
            WriteSummaryRow(ws, row++, g.Key, g.Count(), XLColor.FromHtml("#3A70C8"));
        row++;

        var byGrade = items.GroupBy(x => x.NextYearGrade).OrderBy(g => g.Key);
        WriteSummaryRow(ws, row++, "Sınıfa Göre Dağılım", 0, SummaryHeaderColor, isHeader: true);
        foreach (var g in byGrade)
            WriteSummaryRow(ws, row++, $"{g.Key}. Sınıf", g.Count(), XLColor.FromHtml("#3A70C8"));
        row++;

        var byEducationType = items.GroupBy(x => x.EducationType).OrderBy(g => g.Key);
        WriteSummaryRow(ws, row++, "Eğitim Türüne Göre Dağılım", 0, SummaryHeaderColor, isHeader: true);
        foreach (var g in byEducationType)
            WriteSummaryRow(ws, row++, g.Key, g.Count(), XLColor.FromHtml("#3A70C8"));

        ws.Column(1).Width = 35;
        ws.Column(2).Width = 15;
        ws.Column(3).Width = 20;
    }

    private static string SedaStatusLabel(string status) => status switch
    {
        "approved" => "Onaylandı",
        "pending" => "Beklemede",
        "rejected" => "Reddedildi",
        _ => status,
    };

    public byte[] BuildFacilityApplicationExport(IReadOnlyList<FacilityApplicationDto> items, string reportTitle, string moduleLabel)
    {
        using var wb = new XLWorkbook();
        AddFacilityApplicationSheet(wb, items, reportTitle, moduleLabel);
        AddFacilityApplicationGroupSheet(wb, items);
        AddFacilityApplicationSummarySheet(wb, items, reportTitle, moduleLabel);
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static void AddFacilityApplicationSheet(XLWorkbook wb, IReadOnlyList<FacilityApplicationDto> items, string reportTitle, string moduleLabel)
    {
        var ws = wb.Worksheets.Add("Başvurular");
        string[] headers = ["Sıra No", "Ad Soyad", "TC Kimlik", "Telefon", "E-posta", "Branş/Program", "Grup", "Başvuru Tarihi", "Durum", "Evrak Eksik"];

        WriteSheetHeader(ws, $"Sultangazi Belediyesi — {moduleLabel} Başvuruları", reportTitle, headers);

        int row = 4;
        foreach (var (a, index) in items.Select((x, i) => (x, i)))
        {
            ws.Cell(row, 1).Value = index + 1;
            ws.Cell(row, 2).Value = a.FullName;
            ws.Cell(row, 3).Value = a.Tckn;
            ws.Cell(row, 4).Value = a.Phone;
            ws.Cell(row, 5).Value = a.Email ?? "—";
            ws.Cell(row, 6).Value = a.BranchName ?? "—";
            ws.Cell(row, 7).Value = a.GroupName ?? "—";
            ws.Cell(row, 8).Value = a.AppliedAt.ToString("dd.MM.yyyy HH:mm");
            ws.Cell(row, 9).Value = FacilityStatusLabel(a.Status);
            ws.Cell(row, 10).Value = a.HasMissingDocuments ? "Evet" : "Hayır";
            ws.Cell(row, 3).Style.NumberFormat.Format = "@";
            ws.Cell(row, 4).Style.NumberFormat.Format = "@";

            if (row % 2 == 0)
                ApplyZebraRow(ws, row, headers.Length);

            row++;
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static void AddFacilityApplicationGroupSheet(XLWorkbook wb, IReadOnlyList<FacilityApplicationDto> items)
    {
        var ws = wb.Worksheets.Add("Gruplara Göre");
        string[] headers = ["Sıra No", "Ad Soyad", "TC Kimlik", "Telefon", "Başvuru Tarihi", "Durum"];

        WriteSheetHeader(ws, "Sultangazi Belediyesi — Gruplara Göre Başvurular", "Grup Kırılımı", headers);

        var grouped = items
            .GroupBy(a => a.GroupName ?? "Gruba Bağlı Değil")
            .OrderBy(g => g.Key);

        int row = 4;
        foreach (var group in grouped)
        {
            var groupHeader = ws.Range(row, 1, row, headers.Length);
            groupHeader.Merge();
            groupHeader.FirstCell().Value = $"{group.Key}  ({group.Count()} başvuru)";
            groupHeader.Style.Font.Bold = true;
            groupHeader.Style.Font.FontColor = XLColor.White;
            groupHeader.Style.Fill.BackgroundColor = SummaryHeaderColor;
            groupHeader.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            groupHeader.Style.Alignment.Indent = 1;
            ws.Row(row).Height = 18;
            row++;

            var seq = 1;
            foreach (var a in group.OrderBy(x => x.AppliedAt))
            {
                ws.Cell(row, 1).Value = seq++;
                ws.Cell(row, 2).Value = a.FullName;
                ws.Cell(row, 3).Value = a.Tckn;
                ws.Cell(row, 4).Value = a.Phone;
                ws.Cell(row, 5).Value = a.AppliedAt.ToString("dd.MM.yyyy HH:mm");
                ws.Cell(row, 6).Value = FacilityStatusLabel(a.Status);
                ws.Cell(row, 3).Style.NumberFormat.Format = "@";
                ws.Cell(row, 4).Style.NumberFormat.Format = "@";

                if (row % 2 == 0)
                    ApplyZebraRow(ws, row, headers.Length);

                row++;
            }
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static void AddFacilityApplicationSummarySheet(XLWorkbook wb, IReadOnlyList<FacilityApplicationDto> items, string reportTitle, string moduleLabel)
    {
        var ws = wb.Worksheets.Add("Özet");

        ws.Cell(1, 1).Value = "Sultangazi Belediyesi";
        StyleTitleCell(ws.Cell(1, 1), 14, HeaderColor);
        ws.Range(1, 1, 1, 4).Merge();

        ws.Cell(2, 1).Value = $"{moduleLabel} Başvuruları — {reportTitle}";
        StyleTitleCell(ws.Cell(2, 1), 11, SubHeaderColor);
        ws.Range(2, 1, 2, 4).Merge();

        ws.Cell(3, 1).Value = $"Oluşturulma: {DateTime.Now:dd.MM.yyyy HH:mm}";
        ws.Cell(3, 1).Style.Font.Italic = true;
        ws.Cell(3, 1).Style.Font.FontSize = 10;
        ws.Range(3, 1, 3, 4).Merge();

        ws.Row(1).Height = 28;
        ws.Row(2).Height = 20;
        ws.Row(3).Height = 18;

        int row = 5;
        WriteSummaryRow(ws, row++, "Toplam Başvuru", items.Count, SummaryHeaderColor, isHeader: true);
        WriteSummaryRow(ws, row++, "Onaylı", items.Count(x => x.Status == "approved"), XLColor.Green);
        WriteSummaryRow(ws, row++, "Beklemede", items.Count(x => x.Status == "pending"), XLColor.Orange);
        WriteSummaryRow(ws, row++, "Yedek", items.Count(x => x.Status == "waitlist"), XLColor.FromHtml("#8B5CF6"));
        WriteSummaryRow(ws, row++, "Reddedildi", items.Count(x => x.Status == "rejected"), XLColor.Red);
        row++;

        var byGroup = items.GroupBy(x => x.GroupName ?? "Gruba Bağlı Değil").OrderByDescending(g => g.Count());
        WriteSummaryRow(ws, row++, "Gruplara Göre Dağılım", 0, SummaryHeaderColor, isHeader: true);
        foreach (var g in byGroup)
            WriteSummaryRow(ws, row++, g.Key, g.Count(), XLColor.FromHtml("#3A70C8"));

        ws.Column(1).Width = 35;
        ws.Column(2).Width = 15;
        ws.Column(3).Width = 20;
        ws.Column(4).Width = 20;
    }

    private static string FacilityStatusLabel(string status) => status switch
    {
        "approved" => "Onaylı",
        "pending" => "Beklemede",
        "waitlist" => "Yedek",
        "rejected" => "Reddedildi",
        _ => status,
    };

    public byte[] BuildFacilityRosterExport(IReadOnlyList<FacilityRegistrationDto> items, string groupName, string moduleLabel)
    {
        using var wb = new XLWorkbook();
        AddFacilityRosterSheet(wb, items, groupName, moduleLabel);
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static void AddFacilityRosterSheet(XLWorkbook wb, IReadOnlyList<FacilityRegistrationDto> items, string groupName, string moduleLabel)
    {
        var ws = wb.Worksheets.Add("Katılımcı Listesi");
        string[] headers = ["Sıra No", "Ad Soyad", "TC Kimlik", "Telefon", "Doğum Tarihi", "Durum", "Devamsızlık", "Kayıt Tarihi"];

        WriteSheetHeader(ws, $"Sultangazi Belediyesi — {moduleLabel}", $"{groupName} — Katılımcı Listesi", headers);

        int row = 4;
        foreach (var (r, index) in items.OrderBy(x => x.Kind != "main").ThenBy(x => x.WaitlistOrder).ThenBy(x => x.FullName).Select((x, i) => (x, i)))
        {
            ws.Cell(row, 1).Value = index + 1;
            ws.Cell(row, 2).Value = r.FullName;
            ws.Cell(row, 3).Value = r.Tckn;
            ws.Cell(row, 4).Value = r.Phone;
            ws.Cell(row, 5).Value = r.BirthDate.HasValue ? r.BirthDate.Value.ToString("dd.MM.yyyy") : "—";
            ws.Cell(row, 6).Value = RosterStatusLabel(r.Kind, r.Status);
            ws.Cell(row, 7).Value = r.AbsenceUsed;
            ws.Cell(row, 8).Value = r.CreatedAt.ToString("dd.MM.yyyy HH:mm");
            ws.Cell(row, 3).Style.NumberFormat.Format = "@";
            ws.Cell(row, 4).Style.NumberFormat.Format = "@";

            if (row % 2 == 0)
                ApplyZebraRow(ws, row, headers.Length);

            row++;
        }

        FinalizeSheet(ws, headers.Length);
    }

    private static string RosterStatusLabel(string kind, string status)
    {
        if (status != "active") return status switch
        {
            "expired" => "Süresi Doldu",
            "removed" => "Çıkarıldı",
            _ => status,
        };
        return kind == "main" ? "Aktif (Asıl)" : "Yedek Listede";
    }
}
