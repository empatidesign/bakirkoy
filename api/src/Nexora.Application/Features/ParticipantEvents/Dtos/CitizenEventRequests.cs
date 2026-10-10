namespace Nexora.Application.Features.ParticipantEvents.Dtos;

public record CitizenDiscoverParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? CategoryId { get; init; }
    // Mobil takvimde ay/gün seçimi: verilirse yalnızca bu aralıkla kesişen kartlar döner
    // (tarihler dahil, gün bazında). Göndermeyen istemcilerin davranışı değişmez.
    public DateTime? DateFrom { get; init; }
    public DateTime? DateTo { get; init; }
    // true ise yalnızca oturumdaki kişiye uygun (veya zaten başvurduğu) kartlar döner.
    // Mobil bunu eskiden ilk sayfalar üzerinde istemcide süzüyordu; uygun kayıtlar
    // sonraki sayfalarda kalınca liste boş, "daha fazla" sayacı dolu görünüyordu.
    public bool? OnlyEligible { get; init; }
}

public record CitizenApplicationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Scope { get; init; }
    public string? Status { get; init; }
    public string? Period { get; init; }
}

public record CitizenApplyRequest(Guid? SessionId, Guid? ParticipantId, string? SeatNumber);
