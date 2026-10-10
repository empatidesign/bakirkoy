using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public class FacilityAttendance : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public Guid FacilityId { get; private set; }
    public Guid GroupId { get; private set; }
    public Guid SessionId { get; private set; }
    public Guid? RegistrationId { get; private set; }
    public Guid? ParticipantId { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string Tckn { get; private set; } = string.Empty;
    public string Status { get; private set; } = "absent";
    public string Method { get; private set; } = "roster";
    public DateTime MarkedAt { get; private set; }
    public DateTime? CheckedInAt { get; private set; }
    public DateTime? CheckedOutAt { get; private set; }
    public string? MarkedBy { get; private set; }

    public static FacilityAttendance Create(
        string module, Guid facilityId, Guid groupId, Guid sessionId, Guid? registrationId, Guid? participantId,
        string fullName, string tckn, string status, string method, string? actor)
    {
        return new FacilityAttendance
        {
            Module = module,
            FacilityId = facilityId,
            GroupId = groupId,
            SessionId = sessionId,
            RegistrationId = registrationId,
            ParticipantId = participantId,
            FullName = fullName.Trim(),
            Tckn = tckn,
            Status = status,
            Method = method,
            MarkedAt = DateTime.UtcNow,
            MarkedBy = actor,
        };
    }

    public void SetStatus(string status, string method, string? actor)
    {
        Status = status;
        Method = method;
        MarkedAt = DateTime.UtcNow;
        MarkedBy = actor;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkCheckedIn(string method, string? actor)
    {
        CheckedInAt = DateTime.UtcNow;
        Status = "present";
        Method = method;
        MarkedAt = DateTime.UtcNow;
        MarkedBy = actor;
        UpdatedAt = DateTime.UtcNow;
    }

    // Kod denetimi 2026-08-02 (kullanıcı isteği: tüm giriş yollarında CheckedInAt tutarlılığı):
    // MarkCheckedIn her zaman Status="present" dayatıyor — bu, önceden hesaplanmış "late" (geç geldi)
    // durumunu sessizce eziyordu (bkz. ScanStaticQrAsync). Ayrıca fiziksel turnike/cihaz girişleri hiç
    // CheckedInAt set etmiyordu, bu da RecurringJobsBootstrapper'daki otomatik-çıkış (auto-checkout)
    // job'ının bu kayıtları asla bulamamasına yol açıyordu (CheckedInAt != null filtresi). Bu metod
    // SADECE CheckedInAt'i set eder, Status/Method'a dokunmaz — çağıran taraf zaten doğru Status'u
    // Create()/SetStatus() ile ayrıca vermiş olmalı.
    public void SetCheckedInAt()
    {
        CheckedInAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkExit()
    {
        CheckedOutAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    // Kod denetimi 2026-09-29 (kullanıcı isteği: static-QR zamana dayalı giriş/çıkış — gerçek
    // entegrasyon testiyle bulundu): (SessionId, RegistrationId) çiftinde IX_FacilityAttendances_
    // Session_Registration_ActiveUnique benzersiz indeksi var — aynı seans için aynı kayda İKİNCİ
    // bir satır asla eklenemez (silinmiş olsa bile aynı kısıt geçerli değil ama IsDeleted=false
    // filtreli). Bu yüzden bir çıkıştan sonra aynı kişi aynı seansa TEKRAR giriş yaptığında YENİ
    // satır oluşturulamaz — MEVCUT satır bu metodla "yeniden açılır" (CheckedOutAt temizlenir,
    // CheckedInAt/Status/Method/MarkedAt güncellenir). Geçmiş çıkış zamanı kaybolur ama zaten
    // AttendanceHistoryItemDto tek satır üzerinden en güncel durumu gösterir; çoklu giriş-çıkış
    // turlarının ayrı ayrı geçmişi bu şemada tutulmuyor (kapsam dışı, mevcut şemanın sınırı).
    public void ReenterAfterExit(string status, string method, string? actor)
    {
        CheckedOutAt = null;
        CheckedInAt = DateTime.UtcNow;
        Status = status;
        Method = method;
        MarkedAt = DateTime.UtcNow;
        MarkedBy = actor;
        UpdatedAt = DateTime.UtcNow;
    }
}
