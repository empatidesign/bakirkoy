namespace Nexora.Application.Features.Seda.Dtos;

public record SedaEducationRecordDto(
    Guid Id,
    string Tckn,
    string FullName,
    string AcademicYear,
    Guid? ParticipantId,
    string? ParticipantName,
    Guid? PeriodId,
    string? PeriodName,
    decimal? Score,
    string? ResultNote,
    int? Rank,
    string? Phone,
    bool IsWinner,
    string DetailsJson,
    DateTime CreatedAt
);

public record SedaEducationRecordListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? AcademicYear { get; init; }
    public Guid? PeriodId { get; init; }
    public string? Matched { get; init; }
    public bool? MatchedResolved => bool.TryParse(Matched, out var v) ? v : null;
    // Kullanıcı isteği (2026-08-12): "kazandı kazanmadı mı yaptığı" — Excel'de kazanamayan
    // satırlar da olabilir, admin bunları filtreleyebilsin diye.
    public string? Winner { get; init; }
    public bool? WinnerResolved => bool.TryParse(Winner, out var v) ? v : null;
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record SedaEducationImportInvalidRowDto(int Row, string Reason);

public record SedaEducationImportResultDto(
    int TotalRows,
    int Added,
    int Updated,
    int MatchedParticipants,
    int UnmatchedCount,
    List<SedaEducationImportInvalidRowDto> InvalidRows
);

public record SedaEducationItemDto(string AcademicYear, DateTime CreatedAt);

public record SedaEducationRecordResultRequest(decimal? Score, string? ResultNote);

public record CitizenSedaResultDto(bool HasActivePeriod, string? PeriodName, bool IsWinner, decimal? Score, string? ResultNote);

// Kullanıcı isteği (2026-08-12): "her eğitim öğretim yılı için gerekli olacak" — vatandaş sadece
// aktif dönemin değil, kendi adına kayıtlı TÜM yılların sonucunu görebilsin diye çoğul liste.
public record CitizenSedaResultItemDto(
    string AcademicYear,
    string? PeriodName,
    bool IsWinner,
    decimal? Score,
    int? Rank,
    string? ResultNote,
    string DetailsJson,
    string MatchedBy
);
