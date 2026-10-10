namespace Nexora.Application.Features.Travels.Dtos;

public record TravelApplicationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? TravelId { get; init; }
    public string? Status { get; init; }
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public string? Neighborhood { get; init; }
    public string? Gender { get; init; }
    public string? PaymentStatus { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record TravelApplicationPassengerInput(Guid ParticipantId, string? SeatNumber, string? BusId);

public record TravelApplicationFormRequest(
    Guid TravelId,
    Guid ParticipantId,
    string Status,
    string DocumentStatus,
    string PaymentStatus,
    string? BusId,
    string? SeatNumber,
    string Notes,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    List<TravelApplicationPassengerInput>? Passengers,
    /// <summary>Kullanıcı isteği (2026-08-07): admin, geziye kayıtlı katılımcının gezi kısıtlarına
    /// (ikamet/cinsiyet/yaş) uymadığı durumlarda bile — "serbest ekleme" ile — bilinçli olarak
    /// ekleyebilmeli (ör. özel izinli/istisna bir katılımcı). Bu bayrak yalnızca ikamet/cinsiyet/yaş
    /// kısıtlarını atlar; kontenjan/koltuk/tekrar-başvuru/tarih-çakışması gibi veri bütünlüğü
    /// kontrolleri her zaman uygulanmaya devam eder.</summary>
    bool OverrideEligibility = false
);

public record SetApplicationStatusRequest(string Status, string? Reason = null);

/// <summary>
/// Kullanıcı isteği (2026-08-07): admin bir geziye toplu TC kimlik numarası yapıştırarak
/// (koltuk seçimi olmadan, kontenjan bazlı) yolcu ekleyebilmeli. Sistemde kayıtlı olan
/// TC'ler için doğrudan başvuru oluşturulur; kayıtlı olmayanlara — eğer bir telefon
/// numarası da verilmişse ("TCKN,Telefon" formatında) — üyelik/uygulama daveti SMS'i
/// gönderilir. NVI yalnızca TC+doğum tarihiyle sorgulanabildiği için tek başına TC ile
/// kayıtlı olmayan bir kişinin iletişim bilgisine ulaşılamaz; telefon verilmemişse
/// sonuçta "iletişim bilgisi eksik" olarak işaretlenir.
/// </summary>
public record TravelBulkTcknEntry(string Tckn, string? Phone, string? SeatNumber = null, string? FullName = null);

public record TravelBulkTcknRequest(Guid TravelId, List<TravelBulkTcknEntry> Entries, string? BusId, bool? SendInviteSms = null);

public record TravelParticipationHistoryItem(string TravelName, DateTime StartDate, DateTime EndDate, string Status);

public record TravelBulkTcknResultItem(
    string Tckn,
    string Outcome, // "added" | "invite_sent" | "no_contact" | "duplicate" | "invalid" | "failed"
    string? ParticipantName,
    string? Reason,
    List<TravelParticipationHistoryItem>? History = null
);

public record TravelBulkTcknResult(
    int Total,
    int Added,
    int InvitesSent,
    int Skipped,
    List<TravelBulkTcknResultItem> Items
);
