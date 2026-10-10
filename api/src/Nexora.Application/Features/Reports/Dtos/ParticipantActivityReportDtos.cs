namespace Nexora.Application.Features.Reports.Dtos;

public record ParticipantActivityReportParams
{
    public string? Preset { get; init; }
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public string? Module { get; init; }
    public string? Search { get; init; }
    public int? Page { get; init; }
    public int? Limit { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record ParticipantActivityRowDto(
    Guid? ParticipantId,
    string FullName,
    string? Tckn,
    string? Phone,
    int TotalCount,
    Dictionary<string, int> ModuleBreakdown,
    DateTime FirstActivityAt,
    DateTime LastActivityAt,
    string? LastActivityItemName,
    string? LastActivityModule);

public record ParticipantActivityReportDto(
    string Preset,
    DateTime From,
    DateTime To,
    int Page,
    int Limit,
    int Total,
    int TotalPages,
    List<ParticipantActivityRowDto> Items);

public record ParticipantActivityDetailEntryDto(
    string Module,
    string ModuleLabel,
    string? ItemName,
    DateTime ActivityDate,
    string Status);

public record ParticipantActivityDetailDto(
    Guid? ParticipantId,
    string FullName,
    string? Tckn,
    string? Phone,
    int TotalCount,
    Dictionary<string, int> ModuleBreakdown,
    List<ParticipantActivityDetailEntryDto> Entries);
