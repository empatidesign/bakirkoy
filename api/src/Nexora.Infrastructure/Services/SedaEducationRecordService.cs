using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Seda;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class SedaEducationRecordService(IUnitOfWork uow, IActivityLogger log, IExcelService excel, IConfiguration config, IAuditService audit, ISedaPeriodService periodService)
    : ISedaEducationRecordService
{
    // Kullanıcı bulgusu (2026-08-12): ToUpperInvariant()/ToLowerInvariant() Türkçe noktasız "ı"
    // harfini yanlış dönüştürür (invariant culture'da özel Türkçe kural yok). Başlık/metin
    // eşleştirmesi bu yüzden "tr-TR" culture ile yapılmalı — bkz. ResolveColumns.
    private static readonly System.Globalization.CultureInfo TurkishCulture = new("tr-TR");

    public async Task<PagedResult<SedaEducationRecordDto>> GetPagedAsync(SedaEducationRecordListParams p, CancellationToken ct)
        => await uow.SedaEducationRecords.GetPagedAsync(p, ct);

    public async Task<List<string>> GetYearsAsync(CancellationToken ct)
        => await uow.SedaEducationRecords.GetYearsAsync(ct);

    public async Task<SedaEducationImportResultDto> ImportAsync(Stream excelStream, string academicYear, Guid? periodId, DateTime? periodStartDate, DateTime? periodEndDate, CancellationToken ct)
    {
        log.LogStep(nameof(ImportAsync), new { academicYear, periodId, periodStartDate, periodEndDate });

        // Kullanıcı isteği (2026-08-12): "hangi tarihler aralığında alınacak dediğinde zaten
        // başlangıç ve bitiş yılı dönemi verecek bize" — admin önceden "Dönemler" ekranında elle
        // bir dönem oluşturmak zorunda kalmadan, sadece bir tarih aralığı vererek dönemi bulur/
        // yoksa otomatik oluşturur (mevcut periodId seçimi de hâlâ desteklenir, geriye dönük uyumlu).
        if (!periodId.HasValue && periodStartDate.HasValue && periodEndDate.HasValue)
        {
            var derivedPeriod = await periodService.FindOrCreateByDateRangeAsync(periodStartDate.Value, periodEndDate.Value, ct);
            periodId = derivedPeriod.Id;
        }

        if (periodId.HasValue)
        {
            var period = await uow.SedaPeriods.GetByIdAsync(periodId.Value, ct)
                ?? throw new NotFoundException("Dönem bulunamadı.", "SEDA_PERIOD_NOT_FOUND");
            // BULGU (2026-09-21 uçtan uca testi): dönemin adı doğrudan AcademicYear'a
            // yazılıyordu, ancak o sütun varchar(9) ("2026-2027" formatı için). Admin
            // panelden elle oluşturulan dönemlerin adı serbest metindir (ör.
            // "2026-2027 SEDA Başvuru Dönemi" = 29 karakter) ve içe aktarım
            // "22001: value too long for type character varying(9)" ile 500 veriyordu —
            // yani kazanan listesi hiç yüklenemiyordu. Dönem adından akademik yıl
            // kalıbı ("YYYY-YYYY" veya "YYYY") çıkarılır; bulunamazsa dönem tarihinden
            // türetilir. Böylece dönem adı serbestçe yazılabilir.
            academicYear = ExtractAcademicYear(period.Name, period.StartDate, period.EndDate);
        }

        // DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR export/import denetimi, madde #1): CompanyService ile
        // aynı düzeltme — bozuk/sahte bir .xlsx dosyası önceden yakalanmamış exception ile 500
        // dönüyordu, artık kullanıcı dostu 409'a çevriliyor.
        XLWorkbook wb;
        try
        {
            wb = new XLWorkbook(excelStream);
        }
        catch (Exception ex) when (ex is IOException or InvalidDataException or System.IO.FileFormatException)
        {
            throw new ConflictException("Geçersiz veya bozuk Excel dosyası. Lütfen dosyayı kontrol edip tekrar deneyin.", "EXCEL_INVALID_FORMAT");
        }
        using var _wb = wb;
        var ws = wb.Worksheets.FirstOrDefault()
            ?? throw new ConflictException("Excel dosyasında sayfa bulunamadı.", "EXCEL_EMPTY");

        var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 0;
        if (lastCol == 0 || lastRow < 2)
            throw new ConflictException("Excel dosyasında veri satırı bulunamadı.", "EXCEL_NO_DATA");

        var maxRows = config.GetValue("SedaSettings:ImportMaxRows", 20000);
        if (lastRow - 1 > maxRows)
            throw new ConflictException($"Excel dosyası en fazla {maxRows} satır içerebilir. Lütfen dosyayı bölerek yükleyin.", "EXCEL_TOO_MANY_ROWS");

        var (tcknCol, nameCol, surnameCol, scoreCol, rankCol, phoneCol, resultCol) = ResolveColumns(ws, lastCol);
        if (tcknCol == 0)
            throw new ConflictException("Excel dosyasında TC kimlik sütunu bulunamadı.", "EXCEL_TCKN_COLUMN_NOT_FOUND");
        if (nameCol == 0)
            throw new ConflictException("Excel dosyasında ad soyad sütunu bulunamadı.", "EXCEL_NAME_COLUMN_NOT_FOUND");

        var existingRows = periodId.HasValue
            ? await uow.SedaEducationRecords.GetByPeriodAsync(periodId.Value, ct)
            : await uow.SedaEducationRecords.GetByYearAsync(academicYear, ct);

        var existing = existingRows
            .ToDictionary(r => r.Tckn, r => r);

        var invalidRows = new List<SedaEducationImportInvalidRowDto>();
        var parsed = new Dictionary<string, ParsedRow>();
        var totalRows = 0;

        // Kullanıcı isteği (2026-08-12): "yüklenen excelde sıralama mı hak kazandı kazanmadı mı
        // yaptığı netler mi neler olduğu verilen excel dökümanına göre alınıp yapılacak" — tanınan
        // sütunlar (TC/Ad/Soyad/Puan/Sıra/Telefon/Sonuç) hariç, başlık satırındaki HER sütun ham
        // header→value olarak DetailsJson'a düşer (veri kaybı olmasın diye).
        var headers = new string[lastCol + 1];
        for (var col = 1; col <= lastCol; col++)
            headers[col] = ws.Cell(1, col).GetString().Trim();
        var knownCols = new HashSet<int> { tcknCol, nameCol, surnameCol, scoreCol, rankCol, phoneCol, resultCol };
        var extraCols = Enumerable.Range(1, lastCol).Where(c => !knownCols.Contains(c) && !string.IsNullOrWhiteSpace(headers[c])).ToList();

        for (var row = 2; row <= lastRow; row++)
        {
            var rawTckn = ws.Cell(row, tcknCol).GetString();
            var tckn = new string(rawTckn.Trim().Where(char.IsDigit).ToArray());

            var fullName = surnameCol > 0
                ? $"{ws.Cell(row, nameCol).GetString().Trim()} {ws.Cell(row, surnameCol).GetString().Trim()}".Trim()
                : ws.Cell(row, nameCol).GetString().Trim();

            if (tckn.Length == 0 && fullName.Length == 0)
                continue;
            totalRows++;

            if (tckn.Length != 11)
            {
                invalidRows.Add(new SedaEducationImportInvalidRowDto(row, "TC kimlik numarası 11 haneli olmalıdır."));
                continue;
            }
            if (fullName.Length == 0)
            {
                invalidRows.Add(new SedaEducationImportInvalidRowDto(row, "Ad soyad bilgisi boş."));
                continue;
            }

            decimal? score = null;
            if (scoreCol > 0)
            {
                var scoreText = ws.Cell(row, scoreCol).GetString().Trim().Replace(',', '.');
                if (!string.IsNullOrWhiteSpace(scoreText) && decimal.TryParse(scoreText, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var parsedScore))
                    score = parsedScore;
            }

            int? rank = null;
            if (rankCol > 0)
            {
                var rankText = ws.Cell(row, rankCol).GetString().Trim();
                if (!string.IsNullOrWhiteSpace(rankText) && int.TryParse(rankText, out var parsedRank))
                    rank = parsedRank;
            }

            string? phone = null;
            if (phoneCol > 0)
            {
                var rawPhone = new string(ws.Cell(row, phoneCol).GetString().Trim().Where(char.IsDigit).ToArray());
                if (rawPhone.Length > 0) phone = NormalizePhone(rawPhone);
            }

            string? resultText = null;
            var isWinner = true;
            if (resultCol > 0)
            {
                resultText = ws.Cell(row, resultCol).GetString().Trim();
                if (!string.IsNullOrWhiteSpace(resultText))
                {
                    // Kullanıcı bulgusu (2026-08-12): ToLowerInvariant()/ToUpperInvariant() Türkçe
                    // noktasız "ı" harfini doğru küçültmez/büyütmez (invariant culture'da özel
                    // Türkçe harf kuralı yok — "HAYIR".ToLowerInvariant() = "hayir", "hayır" DEĞİL,
                    // "Sıra".ToUpperInvariant() = "SıRA", "SIRA" DEĞİL). Canlı testte gerçek bir
                    // Excel importunda "Sıra" sütunu bu yüzden tanınamadı. tr-TR culture kullanılarak
                    // düzeltildi (bkz. TurkishCulture, ResolveColumns).
                    var lower = resultText.ToLower(TurkishCulture);
                    isWinner = !(lower.Contains("kazanma") || lower.Contains("kazanama") || lower.Contains("hayır")
                        || lower.Contains("red") || lower.Contains("elen") || lower.Contains("başarısız"));
                }
            }

            Dictionary<string, string>? extras = null;
            if (extraCols.Count > 0)
            {
                extras = new Dictionary<string, string>();
                foreach (var col in extraCols)
                {
                    var value = ws.Cell(row, col).GetString().Trim();
                    if (!string.IsNullOrWhiteSpace(value)) extras[headers[col]] = value;
                }
            }

            parsed[tckn] = new ParsedRow(fullName, score, rank, phone, isWinner, resultText,
                extras is { Count: > 0 } ? System.Text.Json.JsonSerializer.Serialize(extras) : null);
        }

        var participantIds = await uow.SedaEducationRecords.GetParticipantIdsByTcknsAsync(parsed.Keys.ToList(), ct);

        var added = 0;
        var updated = 0;
        var matched = 0;

        foreach (var (tckn, item) in parsed)
        {
            var fullName = item.FullName;
            var participantId = participantIds.TryGetValue(tckn, out var pid) ? pid : (Guid?)null;
            if (participantId.HasValue) matched++;

            if (existing.TryGetValue(tckn, out var record))
            {
                record.UpdateFullName(fullName);
                if (participantId.HasValue) record.LinkParticipant(participantId.Value);
                if (periodId.HasValue) record.LinkPeriod(periodId.Value);
                // Kullanıcı bulgusu (badger denetimi): Excel'de PUAN sütunu yoksa veya o satırda
                // boşsa item.Score null olur — bu durumda admin panelinden önceden manuel girilmiş
                // bir puanı SESSİZCE SİLMEMELİ. Yalnızca Excel'de gerçekten bir puan varsa güncelle.
                if (item.Score.HasValue) record.UpdateResult(item.Score, item.ResultNote ?? record.ResultNote);
                // Aynı mantık esnek alanlar için de geçerli: Excel'de o sütun hiç yoksa (rankCol/
                // phoneCol/resultCol = 0) mevcut değeri koru, sadece Excel'de o sütun VARSA güncelle.
                record.UpdateFlexibleFields(
                    rankCol > 0 ? item.Rank : record.Rank,
                    phoneCol > 0 ? item.Phone : record.Phone,
                    resultCol > 0 ? item.IsWinner : record.IsWinner,
                    item.DetailsJson);
                uow.SedaEducationRecords.Update(record);
                updated++;
            }
            else
            {
                await uow.SedaEducationRecords.AddAsync(SedaEducationRecord.Create(
                    tckn, fullName, academicYear, participantId, periodId, item.Score,
                    item.ResultNote, item.Rank, item.Phone, item.IsWinner, item.DetailsJson), ct);
                added++;
            }
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Import,
            EntityType = "SedaEducationRecord",
            Module = "Seda",
            Description = $"SEDA eğitim kaydı Excel içe aktarımı ({academicYear}): {added} eklendi, {updated} güncellendi, {invalidRows.Count} geçersiz satır",
            AdditionalDataJson = JsonSerializer.Serialize(new { academicYear, totalRows, added, updated, matched, invalidCount = invalidRows.Count }),
        }, ct);

        return new SedaEducationImportResultDto(
            totalRows, added, updated, matched, parsed.Count - matched, invalidRows);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var record = await uow.SedaEducationRecords.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "SEDA_EDUCATION_RECORD_NOT_FOUND");

        uow.SedaEducationRecords.Delete(record);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "SedaEducationRecord",
            EntityId = record.Id,
            Module = "Seda",
            Description = $"SEDA eğitim kaydı silindi: {record.FullName} ({record.AcademicYear})",
        }, ct);
    }

    public async Task<(byte[] Bytes, string FileName)> ExportExcelAsync(SedaEducationRecordListParams p, CancellationToken ct)
    {
        var items = await uow.SedaEducationRecords.GetAllFilteredAsync(p, ct);
        var title = !string.IsNullOrWhiteSpace(p.AcademicYear) ? p.AcademicYear : "Tüm Yıllar";
        var bytes = excel.BuildSedaEducationRecordExport(items, title);
        var fileName = $"SEDA_Egitim_Alanlar_{TurkeyTime.NowWallClock():yyyyMMdd_HHmm}.xlsx";

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Export,
            EntityType = "SedaEducationRecord",
            Module = "Seda",
            Description = $"SEDA eğitim kaydı listesi Excel'e aktarıldı ({items.Count} kayıt): {title}",
            AdditionalDataJson = JsonSerializer.Serialize(new { count = items.Count, filter = title }),
        }, ct);

        return (bytes, fileName);
    }

    public async Task<SedaEducationRecordDto> UpdateResultAsync(Guid id, decimal? score, string? resultNote, CancellationToken ct)
    {
        var record = await uow.SedaEducationRecords.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "SEDA_EDUCATION_RECORD_NOT_FOUND");

        record.UpdateResult(score, resultNote);
        uow.SedaEducationRecords.Update(record);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "SedaEducationRecord",
            EntityId = record.Id,
            Module = "Seda",
            Description = $"SEDA eğitim sonucu güncellendi: {record.FullName} ({record.AcademicYear})",
        }, ct);

        var items = await uow.SedaEducationRecords.GetAllFilteredAsync(new SedaEducationRecordListParams { Search = record.Tckn }, ct);
        return items.First(x => x.Id == record.Id);
    }

    /// <summary>
    /// Dönem adından akademik yıl etiketini ("2026-2027" ya da "2026") çıkarır.
    /// AcademicYear sütunu varchar(9) olduğu için dönemin serbest metin adı
    /// (ör. "2026-2027 SEDA Başvuru Dönemi") doğrudan yazılamaz — yazılırsa
    /// içe aktarım 500 ile çöker (bkz. ImportAsync içindeki bulgu notu).
    /// Önce ad içinde "YYYY-YYYY"/"YYYY" kalıbı aranır; bulunamazsa dönem
    /// tarihlerinden türetilir (SedaPeriodService.DeriveAcademicYearName ile aynı kural).
    /// </summary>
    private static string ExtractAcademicYear(string? periodName, DateTime startDate, DateTime endDate)
    {
        if (!string.IsNullOrWhiteSpace(periodName))
        {
            var ranged = System.Text.RegularExpressions.Regex.Match(periodName, @"\b(\d{4})\s*-\s*(\d{4})\b");
            if (ranged.Success)
                return $"{ranged.Groups[1].Value}-{ranged.Groups[2].Value}";

            var single = System.Text.RegularExpressions.Regex.Match(periodName, @"\b(\d{4})\b");
            if (single.Success)
                return single.Groups[1].Value;
        }

        return startDate.Year == endDate.Year
            ? $"{startDate.Year}"
            : $"{startDate.Year}-{endDate.Year}";
    }

    private static (int TcknCol, int NameCol, int SurnameCol, int ScoreCol, int RankCol, int PhoneCol, int ResultCol) ResolveColumns(IXLWorksheet ws, int lastCol)
    {
        var headers = new string[lastCol + 1];
        for (var col = 1; col <= lastCol; col++)
            headers[col] = ws.Cell(1, col).GetString().Trim().ToUpper(TurkishCulture);

        var tcknCol = 0;
        for (var col = 1; col <= lastCol; col++)
            if (headers[col].Contains("TC")) { tcknCol = col; break; }
        if (tcknCol == 0)
        {
            for (var col = 1; col <= lastCol; col++)
            {
                var value = new string(ws.Cell(2, col).GetString().Trim().Where(char.IsDigit).ToArray());
                if (value.Length == 11) { tcknCol = col; break; }
            }
        }

        var nameCol = 0;
        var surnameCol = 0;
        var scoreCol = 0;
        for (var col = 1; col <= lastCol; col++)
            if (headers[col].Contains("AD SOYAD")) { nameCol = col; break; }
        if (nameCol == 0)
        {
            for (var col = 1; col <= lastCol; col++)
                if (headers[col].Contains("SOYAD")) { surnameCol = col; break; }
            for (var col = 1; col <= lastCol; col++)
                if (col != surnameCol && col != tcknCol && headers[col].Contains("AD")) { nameCol = col; break; }
            if (nameCol == 0 && surnameCol > 0)
            {
                nameCol = surnameCol;
                surnameCol = 0;
            }
        }

        for (var col = 1; col <= lastCol; col++)
            if (headers[col].Contains("PUAN") || headers[col].Contains("SKOR")) { scoreCol = col; break; }

        // Kullanıcı isteği (2026-08-12): "yüklenen excelde sıralama mı hak kazandı kazanmadı mı
        // yaptığı netler mi neler olduğu verilen excel dökümanına göre alınıp yapılacak" — gerçek
        // dosyanın başlıkları önceden bilinmediği için en olası varyasyonlar taranıyor. Excel'deki
        // gerçek başlıklar bunlardan farklı çıkarsa bu liste kolayca genişletilir (tek dosya, tek
        // metod) — veri kaybolmaz çünkü tanınmayan her sütun zaten DetailsJson'a düşer.
        var rankCol = 0;
        for (var col = 1; col <= lastCol; col++)
            if (headers[col].Contains("SIRA") || headers[col].Contains("SIRALAMA") || headers[col].Contains("RANK")) { rankCol = col; break; }

        var phoneCol = 0;
        for (var col = 1; col <= lastCol; col++)
            if (headers[col].Contains("TELEFON") || headers[col].Contains("TEL ") || headers[col] == "TEL" || headers[col].Contains("GSM") || headers[col].Contains("CEP")) { phoneCol = col; break; }

        var resultCol = 0;
        for (var col = 1; col <= lastCol; col++)
            if (headers[col].Contains("SONUÇ") || headers[col].Contains("SONUC") || headers[col].Contains("DURUM") || headers[col].Contains("KAZAND")) { resultCol = col; break; }

        return (tcknCol, nameCol, surnameCol, scoreCol, rankCol, phoneCol, resultCol);
    }

    private static string NormalizePhone(string digitsOnly)
    {
        // Kullanıcı isteği (2026-08-12): "telefon numaraları ile sorgulayabilmesi" — Excel'de
        // 0555..., 555..., +90555... gibi farklı formatlar olabilir; Participant.Phone ile aynı
        // normalize kurallarına göre karşılaştırılabilsin diye son 10 haneye (alan kodu + numara,
        // ülke kodu/başındaki 0 hariç) indirgenir — bu en güvenilir yöntemdir.
        return digitsOnly.Length >= 10 ? digitsOnly[^10..] : digitsOnly;
    }

    private sealed record ParsedRow(string FullName, decimal? Score, int? Rank, string? Phone, bool IsWinner, string? ResultNote, string? DetailsJson);
}
