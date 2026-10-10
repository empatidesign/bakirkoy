namespace Nexora.Application.Features.Facilities.Dtos;

public record FacilityRegistrationDto(
    Guid Id,
    string Module,
    Guid FacilityId,
    Guid GroupId,
    string? GroupName,
    Guid BranchId,
    Guid? ParticipantId,
    string FullName,
    string Tckn,
    string Phone,
    DateTime? BirthDate,
    string? GuardianPhone,
    string Kind,
    int WaitlistOrder,
    DateTime? MembershipStart,
    DateTime? PeriodEnd,
    int AbsenceUsed,
    int ConsecutiveAbsenceUsed,
    string Status,
    DateTime CreatedAt
);

public record RegisterParticipantRequest(
    Guid GroupId,
    Guid? ApplicationId,
    Guid? ParticipantId,
    string FullName,
    string Tckn,
    string Phone,
    DateTime? BirthDate,
    string? GuardianPhone,
    DateTime? MembershipDate = null,
    string? Target = null
);

public record RemoveRegistrationRequest(string? Reason);

// V02: bir çıkarma/terfi işleminin ürettiği bildirim, DIŞ transaction commit olana kadar gönderilmez.
// Çıkarma dış bir transaction'a (ör. yoklama/devamsızlık akışı) katıldığında bildirim bilgisi bu DTO
// ile çağırana döner; çağıran commit'ten SONRA gönderir (rollback olursa SMS hiç gitmez).
public record FacilityDeferredNoticeDto(
    string Module,
    string Event,
    string Phone,
    string FullName,
    string? GroupName,
    string? FacilityName,
    string? SessionDate,
    string? SessionTime,
    string? CancelReason,
    int? Limit,
    Guid? ParticipantId
);

public record ReorderWaitlistRequest(Guid GroupId, List<Guid>? OrderedIds);

// Kullanıcı isteği (2026-10-06): TC ile aktarımda hedef liste seçilebilsin.
// "auto" (varsayılan): asıl kontenjan doluysa yedeğe düşer. "main": yalnız asıl, doluysa eklenmez.
// "reserve": doğrudan yedek listenin sonuna eklenir (asıl kontenjan boş olsa bile). Demote ile
// tutarlı: yedek liste kapalıysa veya yedek kontenjanı (0 = gerçek sıfır) doluysa eklenmez.
public static class RegistrationTargets
{
    public const string Auto = "auto";
    public const string Main = "main";
    public const string Reserve = "reserve";

    public static string Normalize(string? target) => target?.Trim().ToLowerInvariant() switch
    {
        Main => Main,
        Reserve => Reserve,
        _ => Auto,
    };
}

public record BulkPreRegisterRequest(Guid GroupId, List<string> Tckns, DateTime? MembershipDate = null, string? Target = null);

// Kullanıcı isteği: eski/mevcut kayıtları sisteme aktarırken sadece TC değil, o kişinin daha önce
// kullandığı devamsızlık hakkı ve hak-edişinin ne zaman biteceği de birlikte girilebilsin — böylece
// aktarılan üyenin kalan hakkı ve bitiş tarihi tam doğru yansır (sıfırdan başlamaz).
public record BulkImportRegistrationRow(
    string Tckn,
    int? AbsenceUsed = null,
    int? ConsecutiveAbsenceUsed = null,
    DateTime? PeriodEnd = null,
    DateTime? MembershipStart = null
);

public record BulkImportRegistrationRequest(Guid GroupId, List<BulkImportRegistrationRow> Rows, string? Target = null);

public record BulkPreRegisterRowResultDto(string Tckn, string Status, string? Reason, Guid? RegistrationId, string? FullName);

public record BulkPreRegisterResultDto(
    int Requested,
    int Registered,
    int Waitlisted,
    int AlreadyRegistered,
    int NotFound,
    int Failed,
    List<BulkPreRegisterRowResultDto> Rows
);
