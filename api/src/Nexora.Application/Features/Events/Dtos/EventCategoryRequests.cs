namespace Nexora.Application.Features.Events.Dtos;

public record EventCategoryListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CreateEventCategoryRequest(string Name, string? Description, string Color, int DefaultPoints);

public record UpdateEventCategoryRequest(string Name, string? Description, string Color, int DefaultPoints);

/// <summary>Kullanıcı isteği (2026-10-06): kategori/program adlarını tek tek değil toplu ekleme.
/// Her öğe bağımsız işlenir; aynı adlı kayıt varsa o öğe atlanır, diğerleri oluşturulur.</summary>
public record BulkCreateEventCategoryRequest(List<CreateEventCategoryRequest> Items);

public record BulkCreateEventCategoryItemResult(int Index, string Name, bool Success, Guid? Id, string? Error);

public record BulkCreateEventCategoryResult(List<BulkCreateEventCategoryItemResult> Results);
