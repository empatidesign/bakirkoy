using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public record FacilityApplicationData(
    string Module,
    Guid FacilityId,
    Guid BranchId,
    Guid? GroupId,
    Guid? ParticipantId,
    string FullName,
    string Tckn,
    string Phone,
    string? Email,
    DateTime? BirthDate,
    string? GuardianPhone,
    string DocumentsJson,
    string? CustomAnswersJson = null,
    string? Gender = null
);

public class FacilityApplication : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public Guid FacilityId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? GroupId { get; private set; }
    public Guid? ParticipantId { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string Tckn { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public DateTime? BirthDate { get; private set; }
    public string? GuardianPhone { get; private set; }
    // Task 7 bug fix: previously NOT persisted, even though CreateAsync's gender check already
    // resolved and validated it for ParticipantId-null (free-form) applications. Without storing
    // it, AutoApprove's synchronous internal ApproveAsync call (and any later manual approval)
    // re-derived gender from ParticipantId alone, saw ParticipantId==null -> "unknown", and
    // rejected an applicant whose gender had already been confirmed to match the group moments
    // earlier in the very same request — a real false-negative GENDER_NOT_ELIGIBLE regression
    // surfaced by Task 7's required ParticipantId-null gender regression test (matching-gender
    // case). Now persisted so ApproveAsync can reuse the same confirmed value for free-form
    // applicants exactly like it already does for ParticipantId-bound ones (via Participant.Gender).
    public string? Gender { get; private set; }
    public string DocumentsJson { get; private set; } = "[]";
    // Kullanıcı isteği (2026-10-04): grup bazında tanımlı özel evet/hayır sorularının
    // ({"questionId": "yes"|"no"}) yanıtları — belge yükleme ile aynı desen (JSON, başvuru
    // anında gönderilir, başvuru onaylandıktan sonra da değişmez bir kayıt olarak kalır).
    public string CustomAnswersJson { get; private set; } = "{}";
    public DateTime AppliedAt { get; private set; }
    public string Status { get; private set; } = "pending";
    public string? RejectReason { get; private set; }
    public string? ReviewedBy { get; private set; }
    public DateTime? ReviewedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    public static FacilityApplication Create(FacilityApplicationData d, string status = "pending")
    {
        return new FacilityApplication
        {
            Module = d.Module,
            FacilityId = d.FacilityId,
            BranchId = d.BranchId,
            GroupId = d.GroupId,
            ParticipantId = d.ParticipantId,
            FullName = d.FullName.Trim(),
            Tckn = d.Tckn,
            Phone = d.Phone,
            Email = d.Email,
            BirthDate = d.BirthDate,
            GuardianPhone = d.GuardianPhone,
            Gender = d.Gender,
            DocumentsJson = string.IsNullOrWhiteSpace(d.DocumentsJson) ? "[]" : d.DocumentsJson,
            CustomAnswersJson = string.IsNullOrWhiteSpace(d.CustomAnswersJson) ? "{}" : d.CustomAnswersJson,
            AppliedAt = DateTime.UtcNow,
            Status = status,
        };
    }

    public void AssignGroup(Guid groupId, Guid facilityId, Guid branchId)
    {
        GroupId = groupId;
        FacilityId = facilityId;
        BranchId = branchId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Approve(string? actor)
    {
        Status = "approved";
        RejectReason = null;
        ReviewedBy = actor;
        ReviewedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Waitlist(string? actor)
    {
        Status = "waitlist";
        RejectReason = null;
        ReviewedBy = actor;
        ReviewedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reject(string? reason, string? actor)
    {
        Status = "rejected";
        RejectReason = reason;
        ReviewedBy = actor;
        ReviewedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Bulgu (2026-10-04, canlı QA denetimi): vatandaşın kendi iptali önceden Reject() +
    /// soft-delete kullanıyordu (bkz. FacilityApplicationStatuses.Cancelled yorumu). Artık
    /// Event/Travel'daki desenle tutarlı: ayrı bir "cancelled" statüsü, soft-delete YOK —
    /// kayıt Başvurularım geçmişinde görünür kalır.
    /// </summary>
    public void Cancel()
    {
        Status = "cancelled";
        UpdatedAt = DateTime.UtcNow;
    }

    // Kullanıcı isteği: "asıl üyelik hakkı dönem sonunda biterse, aynı gruba/spora tekrar
    // başvurabilmeli". Bağlı FacilityRegistration süresi dolup (Expire()) pasife çekildiğinde bu
    // application sonsuza kadar "approved" kalıyordu — ALREADY_APPLIED kontrolü kişiyi aynı gruba
    // asla tekrar başvuramaz hale getiriyordu (canlı PoC ile doğrulanan gerçek bug). Artık dönemi
    // dolan üyeliğin başvurusu da "expired" olarak işaretlenip yeni başvuruya izin veriliyor.
    public void ExpireMembership()
    {
        if (Status is "rejected" or "expired" or "cancelled") return;
        Status = "expired";
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkDeleted(string? actor)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = actor;
    }
}
