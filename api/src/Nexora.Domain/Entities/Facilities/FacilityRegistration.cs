using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public class FacilityRegistration : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public Guid FacilityId { get; private set; }
    public Guid GroupId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? ApplicationId { get; private set; }
    public Guid? ParticipantId { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string Tckn { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public DateTime? BirthDate { get; private set; }
    public string? GuardianPhone { get; private set; }
    public string Kind { get; private set; } = "main";
    public int WaitlistOrder { get; private set; }
    public DateTime? MembershipStart { get; private set; }
    public DateTime? PeriodEnd { get; private set; }
    public int PeriodIndex { get; private set; }
    public int AbsenceUsed { get; private set; }
    public int ConsecutiveAbsenceUsed { get; private set; }
    public string Status { get; private set; } = "active";
    public string? RemovedReason { get; private set; }
    public DateTime? RemovedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    public static FacilityRegistration Create(
        string module, Guid facilityId, Guid groupId, Guid branchId, Guid? applicationId, Guid? participantId,
        string fullName, string tckn, string phone, DateTime? birthDate, string? guardianPhone,
        string kind, int waitlistOrder, DateTime? periodEnd, DateTime? membershipStart = null, int periodIndex = 0)
    {
        return new FacilityRegistration
        {
            Module = module,
            FacilityId = facilityId,
            GroupId = groupId,
            BranchId = branchId,
            ApplicationId = applicationId,
            ParticipantId = participantId,
            FullName = fullName.Trim(),
            Tckn = tckn,
            Phone = phone,
            BirthDate = birthDate,
            GuardianPhone = guardianPhone,
            Kind = kind,
            WaitlistOrder = waitlistOrder,
            MembershipStart = kind == "main" ? (membershipStart ?? DateTime.UtcNow) : membershipStart,
            PeriodEnd = periodEnd,
            PeriodIndex = periodIndex,
            Status = "active",
        };
    }

    public void PromoteToMain(DateTime? periodEnd, DateTime? membershipStart = null)
    {
        Kind = "main";
        WaitlistOrder = 0;
        MembershipStart = membershipStart ?? DateTime.UtcNow;
        PeriodEnd = periodEnd;
        AbsenceUsed = 0;
        ConsecutiveAbsenceUsed = 0;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetWaitlistOrder(int order)
    {
        WaitlistOrder = order < 0 ? 0 : order;
        UpdatedAt = DateTime.UtcNow;
    }

    public void DemoteToReserve(int order, int? periodIndex = null)
    {
        Kind = "reserve";
        WaitlistOrder = order < 0 ? 0 : order;
        MembershipStart = null;
        PeriodEnd = null;
        if (periodIndex.HasValue) PeriodIndex = periodIndex.Value;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetUsage(int absence, int consecutiveAbsence)
    {
        AbsenceUsed = absence < 0 ? 0 : absence;
        ConsecutiveAbsenceUsed = consecutiveAbsence < 0 ? 0 : consecutiveAbsence;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Expire()
    {
        Status = "expired";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Remove(string? reason)
    {
        Status = "removed";
        RemovedReason = reason;
        RemovedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    // Denetim bulgusu (docs/tesis-spor-egitim-derin-test-2026-08-31.md P1-5, 2026-09-05 canlı
    // testle doğrulandı): devamsızlıktan otomatik çıkarılan (Status="removed") bir kaydı
    // "Devamsızlık Düzelt" akışıyla geri almanın hiçbir çalışan yolu yoktu — hem tekil
    // (registrations/{id}/revise) hem toplu (attendance/correct) düzeltme uçları roster'ı
    // Status="active" filtresiyle kurduğu için removed kayıt hiç bulunamıyor, 200 OK +
    // {marked:0, removed:0} dönerek "başarılı" görünüp aslında hiçbir şey yapmıyordu.
    // Kişiyi geri almanın tek yolu sıfırdan yeniden kayıt açmaktı (devamsızlık geçmişi/kıdem
    // kaybı, kapasite doluysa yedeğe düşme). Bu metod, düzeltme sonrası devamsızlık sayısı
    // limitin altına indiğinde kaydı tekrar "active" yapar.
    public void Reactivate()
    {
        Status = "active";
        RemovedReason = null;
        RemovedAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkDeleted(string? actor)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = actor;
    }
}
