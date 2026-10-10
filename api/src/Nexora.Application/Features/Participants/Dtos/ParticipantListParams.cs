namespace Nexora.Application.Features.Participants.Dtos;

public record ParticipantListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Status { get; init; }
    public string? Gender { get; init; }
    public bool? Verified { get; init; }
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public Guid? GuardianId { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
    // Kullanıcı isteği (2026-10-05): "telefonu olmayan" / "T.C.'si olmayan" katılımcıları
    // bulmak için filtre. HasPhone=false -> Phone null/boş olanlar, true -> dolu olanlar.
    // Tckn şemada zorunlu olsa da (NVI doğrulaması olmadan kayıt oluşmaz) ileride boş
    // bırakılabilecek senaryolar (ör. veri aktarımı/manuel düzeltme) için simetrik tutuldu.
    public bool? HasPhone { get; init; }
    public bool? HasTckn { get; init; }
    // Tek elden filtreleme: "any" (telefon VEYA tc yok), "phone" (telefon yok), "tckn" (tc yok), "both" (ikisi de yok)
    public string? MissingInfo { get; init; }
    // Kullanıcı isteği (2026-10-06): toplu NVİ sorgusu için "NVİ'den hiç sorgulanmamış" (false) /
    // "sorgulanmış" (true) filtresi — LastNviSyncAt alanına bakar.
    public bool? NviSynced { get; init; }
}
