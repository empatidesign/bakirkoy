namespace Nexora.Application.Features.ParticipantFacilities.Dtos;

public record CitizenFacilityDiscoverParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 20;
    public string? Search { get; init; }
    public Guid? FacilityId { get; init; }
    public Guid? BranchId { get; init; }
    public string? BranchName { get; init; }
    public int? AgeMin { get; init; }
    public int? AgeMax { get; init; }
    public string? Gender { get; init; }
    public bool? OnlySubGroups { get; init; }
    public bool? OnlyAvailable { get; init; }
    public bool? OnlyWithParking { get; init; }
    /// <summary>Yalnızca kontenjanı dolmuş gruplar.</summary>
    public bool? OnlyFull { get; init; }
    public Guid? ParticipantId { get; init; }
    public bool? ShowAll { get; init; }
}

public record CitizenFacilityApplyDocument(string Type, string ObjectName, string FileName, string? Label = null);

public record CitizenFacilityApplyRequest(Guid? ParticipantId, List<CitizenFacilityApplyDocument>? Documents = null, Dictionary<string, string>? CustomAnswers = null);

public record CitizenFacilityDocumentUploadResult(string ObjectName, string FileName, string Url);

public record CitizenFacilityApplicationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 50;
    public string? Module { get; init; }
    public string? Scope { get; init; }
    public string? Status { get; init; }
    // Kullanıcı isteği (2026-09-23): mobil "Genel Arama" ekranı giriş yapmış kullanıcının
    // kendi tesis/program (spor, havuz, kurs vb.) başvuruları içinde de arama yapabilsin diye
    // eklendi — grup/branş adı üzerinden eşleşir (bkz. GetByParticipantsAsync).
    public string? Search { get; init; }
}
