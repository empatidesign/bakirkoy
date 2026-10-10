namespace Nexora.Application.Features.Facilities.Dtos;

public record FacilityListParams
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

public record FacilityBranchListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Category { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record FacilityGroupListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? FacilityId { get; init; }
    public Guid? BranchId { get; init; }
    public Guid? ParentGroupId { get; init; }
    public bool? IsParent { get; init; }
    public string? Type { get; init; }
    public string? Gender { get; init; }
    public bool? IsActive { get; init; }
    // Kullanıcı isteği (2026-08-07): "engelsiz yaşamda bunu yap" — Travels modülündeki
    // "hidePast" davranışının FacilityTemplate tabanlı tüm modüllere (Engelsiz Yaşam, Spor,
    // Kaşif Çocuk, Yüzme Havuzu, Gençlik/İzci Kampı, Bilim Merkezi) ortak uygulanması. Dönemi
    // (PeriodEnd) geçmiş gruplar/seanslar varsayılan olarak listeden gizlenir; kullanıcı
    // filtreden "Geçmiş Dönemleri Göster" açarsa true gönderilmez, tümü görünür.
    public bool? HidePast { get; init; }
    // Kullanıcı isteği (2026-08-11): "Gezi Seferleri" listesindeki başlangıç/bitiş tarih aralığı
    // filtresiyle aynı desen — dönem başlangıcı bu tarihten sonra, dönem bitişi bu tarihten önce
    // olan gruplar/seanslar listelenir. Recurring/süresiz (PeriodEnd null) gruplar StartDate/EndDate
    // filtresinden HidePast ile aynı mantıkla muaf tutulur (aksi halde hiçbir zaman görünmezler).
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record FacilityInstructorListParams
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

public record FacilityApplicationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? FacilityId { get; init; }
    public Guid? BranchId { get; init; }
    public Guid? GroupId { get; init; }
    public string? Status { get; init; }
    public DateTime? Date { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

// Kullanıcı isteği (2026-10-05): tesisler/gruplar/seanslar manuel sürükle-bırak ile sıralama —
// ReorderWaitlistRequest (FacilityRegistrationDtos.cs) ile aynı desen: sıralı ID listesi gönderilir.
public record ReorderFacilitiesRequest(List<Guid>? OrderedIds);

public record ReorderFacilityGroupsRequest(Guid FacilityId, Guid? ParentGroupId, List<Guid>? OrderedIds);

