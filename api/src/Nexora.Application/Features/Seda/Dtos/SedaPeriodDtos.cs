namespace Nexora.Application.Features.Seda.Dtos;

public record SedaPeriodDto(
    Guid Id,
    string Name,
    DateTime StartDate,
    DateTime EndDate,
    int MaxApplications,
    int CurrentApplications,
    string? Description,
    bool IsActive
);

public record SedaPeriodListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
    // Kullanıcı isteği (2026-08-11): "belirli dönemlerde belirli kurslar günü geçmişler olabilir"
    // — gezi/travels modülündeki hidePast desenini (TravelListParams.HidePast) SEDA dönemlerine
    // de uygular. true ise bitiş tarihi geçmiş dönemler listeden çıkarılır.
    public bool? HidePast { get; init; }
}

public record CreateSedaPeriodRequest(
    string Name,
    DateTime StartDate,
    DateTime EndDate,
    int MaxApplications,
    string? Description
);

public record UpdateSedaPeriodRequest(
    string Name,
    DateTime StartDate,
    DateTime EndDate,
    int MaxApplications,
    string? Description
);
