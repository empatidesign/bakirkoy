using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Participants;

public class Participant : BaseEntity
{
    public string Tckn { get; private set; } = "";
    public string FullName { get; private set; } = "";
    public string? PhotoUrl { get; private set; }
    public DateTime BirthDate { get; private set; }
    public Gender Gender { get; private set; }
    public string? Address { get; private set; }
    public string? District { get; private set; }
    public string? City { get; private set; }
    public string? Neighborhood { get; private set; }
    public string? IlceKodu { get; private set; }
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? GuardianPhone { get; private set; }
    public string? GuardianEmail { get; private set; }
    public bool IsMinor { get; private set; }
    public string PasswordHash { get; private set; } = "";
    public ParticipantStatus Status { get; private set; }
    public string? BlockReason { get; private set; }
    public bool IsVerified { get; private set; }
    public bool IsFirstLogin { get; private set; }
    public bool MustChangePassword { get; private set; }
    public DateTime RegisteredAt { get; private set; }
    public DateTime? ReactivatedAt { get; private set; }
    public string? LastEventName { get; private set; }
    public string? AdminNotes { get; private set; }
    public DateTime? WelcomeBonusSeenAt { get; private set; }

    public DateTime? LastNviSyncAt { get; private set; }
    public bool NviResyncPending { get; private set; }

    public void MarkNviResyncPending() => NviResyncPending = true;

    public void MarkNviSynced()
    {
        LastNviSyncAt = DateTime.UtcNow;
        NviResyncPending = false;
    }

    // 2026-07-30 denetiminde eklendi: vatandaş girişinde hesap bazlı brute-force
    // kilidi hiç yoktu (sadece IP bazlı rate-limit vardı, ki bu XFF spoofing ile
    // atlatılabiliyordu — ayrıca düzeltildi). AdminUser'daki aynı desen: 5 yanlış
    // denemede 15 dakika kilit.
    public int FailedLoginCount { get; private set; }
    public DateTime? LockedUntil { get; private set; }

    public bool IsLocked => LockedUntil.HasValue && LockedUntil.Value > DateTime.UtcNow;

    public int SecurityVersion { get; private set; }

    public void BumpSecurityVersion() => SecurityVersion++;

    // Kullanıcı isteği (2026-09-21): kilit süresi botlar tarafından tahmin
    // edilemesin diye jitterSeconds servis katmanında rastgele üretilip eklenir
    // (bkz. AdminUser.RecordFailedLogin).
    public void RecordFailedLogin(int threshold, int lockoutMinutes, int jitterSeconds = 0)
    {
        FailedLoginCount++;
        if (FailedLoginCount >= threshold)
            LockedUntil = DateTime.UtcNow.AddMinutes(lockoutMinutes).AddSeconds(jitterSeconds);
    }

    public void RecordSuccessfulLogin()
    {
        FailedLoginCount = 0;
        LockedUntil = null;
    }

    public void Unlock()
    {
        FailedLoginCount = 0;
        LockedUntil = null;
    }

    // Kullanıcı isteği: KVKK/sözleşme onayı ile bildirim izni (SMS/e-posta/push) onayı ayrı
    // checkbox'lar olarak alınır, kabul edildikten sonra bir daha sorulmaz (bkz. ConsentEndpoints).
    public DateTime? KvkkAcceptedAt { get; private set; }
    public DateTime? NotificationConsentAcceptedAt { get; private set; }

    public bool AcceptKvkk()
    {
        if (KvkkAcceptedAt.HasValue) return false;
        KvkkAcceptedAt = DateTime.UtcNow;
        return true;
    }

    public bool AcceptNotificationConsent()
    {
        if (NotificationConsentAcceptedAt.HasValue) return false;
        NotificationConsentAcceptedAt = DateTime.UtcNow;
        return true;
    }

    // Kullanıcı isteği (2026-09-28): randevu sistemine (appoinment-app) gizli giriş anahtarı.
    // Admin panelden üretilir, randevu panelinde ilgili kullanıcıya elle girilir; mobilde
    // logoya 3 kez basınca bu anahtarla eşleşen randevu kullanıcısı olarak giriş yapılır.
    public string? AppointmentKey { get; private set; }

    public void SetAppointmentKey(string? key)
    {
        AppointmentKey = key;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetAdminNotes(string? notes)
    {
        AdminNotes = notes;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool MarkWelcomeBonusSeen()
    {
        if (WelcomeBonusSeenAt.HasValue) return false;
        WelcomeBonusSeenAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    // Kullanıcı isteği (2026-08-12): katılım sonrası zorunlu anket algoritması — vatandaşın
    // aynı oturumda/art arda sayfa geçişlerinde birden fazla zorunlu ankete art arda
    // sıkıştırılmaması için, bir zorunlu anket "gösterildi" (uygulamaya girişte
    // PendingSurveySummaryDto.NextEligibleRequiredSurveyId ile sunulduğu an) damgalanır.
    // Bir sonraki zorunlu anket, bu zamandan itibaren en az SurveySettings:MinPromptIntervalMinutes
    // (varsayılan 60dk) geçmeden asla tekrar bloklayıcı modal olarak sunulmaz — bkz.
    // ParticipantSurveyService.GetPendingSummaryAsync.
    public DateTime? LastMandatorySurveyPromptAt { get; private set; }

    public void MarkMandatorySurveyPrompted()
    {
        LastMandatorySurveyPromptAt = DateTime.UtcNow;
    }

    // Kullanıcı isteği (2026-09-20): "günde en fazla 2 anket" — OPSİYONEL (zorunlu olmayan)
    // anket yanıtları için günlük sayaç + son yanıt zamanı. SurveyResponse.ParticipantId
    // anonim anketlerde NULL yazıldığından (bkz. ParticipantSurveyService.SubmitAsync),
    // sayım orada güvenilir yapılamaz; bu yüzden vatandaş bazında ayrı bir sayaç tutulur.
    // Gün, Türkiye saatiyle (TurkeyTime.TodayDate()) sıfırlanır — bkz. ParticipantSurveyService.
    public DateTime? LastOptionalSurveyResponseAt { get; private set; }
    public DateTime? OptionalSurveyCounterDay { get; private set; }
    public int OptionalSurveyResponsesToday { get; private set; }

    /// <summary>Gün değiştiyse sayaç sıfırlanıp 1'den başlar, aynı gündeyse artırılır.</summary>
    public void RecordOptionalSurveyResponse(DateTime dayKey)
    {
        if (OptionalSurveyCounterDay != dayKey)
        {
            OptionalSurveyCounterDay = dayKey;
            OptionalSurveyResponsesToday = 0;
        }
        OptionalSurveyResponsesToday++;
        LastOptionalSurveyResponseAt = DateTime.UtcNow;
    }

    /// <summary>Bugünkü fiili sayı: gün değiştiyse saklanan sayaç bayat sayılır, 0 döner.</summary>
    public int OptionalSurveyResponsesForDay(DateTime dayKey)
        => OptionalSurveyCounterDay == dayKey ? OptionalSurveyResponsesToday : 0;

    public ICollection<ParticipantGuardian> Guardians { get; private set; } = [];
    public ICollection<ParticipantGuardian> Children { get; private set; } = [];

    public static Participant Create(
        string tckn,
        string fullName,
        DateTime birthDate,
        Gender gender,
        bool isMinor,
        string passwordHash,
        string? email,
        string? phone,
        string? guardianPhone,
        string? guardianEmail,
        string? address)
        => new()
        {
            Tckn = tckn,
            FullName = fullName,
            BirthDate = DateTime.SpecifyKind(birthDate, DateTimeKind.Utc),
            Gender = gender,
            Address = address,
            District = ParseDistrict(address),
            IsMinor = isMinor,
            PasswordHash = passwordHash,
            Email = email,
            Phone = phone,
            GuardianPhone = guardianPhone,
            GuardianEmail = guardianEmail,
            Status = ParticipantStatus.Active,
            IsVerified = false,
            IsFirstLogin = true,
            MustChangePassword = true,
            RegisteredAt = DateTime.UtcNow,
        };

    public void Reactivate(
        string fullName,
        DateTime birthDate,
        Gender gender,
        string? address,
        bool isMinor,
        string passwordHash,
        string? email,
        string? phone,
        string? guardianPhone,
        string? guardianEmail)
    {
        IsDeleted = false;
        DeletedAt = null;
        Status = ParticipantStatus.Active;
        BlockReason = null;
        ReactivatedAt = DateTime.UtcNow;
        FullName = fullName;
        BirthDate = DateTime.SpecifyKind(birthDate, DateTimeKind.Utc);
        Gender = gender;
        Address = address;
        District = ParseDistrict(address);
        IsMinor = isMinor;
        PasswordHash = passwordHash;
        Email = email;
        Phone = phone;
        GuardianPhone = guardianPhone;
        GuardianEmail = guardianEmail;
        IsVerified = true;
        IsFirstLogin = false;
        MustChangePassword = false;
        RegisteredAt = DateTime.UtcNow;
    }

    public void UpdateContact(string? email, string? phone, string? guardianPhone, string? guardianEmail)
    {
        Email = email;
        Phone = phone;
        GuardianPhone = guardianPhone;
        GuardianEmail = guardianEmail;
    }

    public void SetAddress(string? address)
    {
        Address = address;
        District = ParseDistrict(address);
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(ParticipantStatus status, string? blockReason = null)
    {
        Status = status;
        BlockReason = status == ParticipantStatus.Blocked ? blockReason : null;
    }

    public void SetPhoto(string? photoUrl) => PhotoUrl = photoUrl;

    public void SetPasswordHash(string passwordHash) => PasswordHash = passwordHash;

    public void CompleteInitialPassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        MustChangePassword = false;
        IsFirstLogin = false;
        FailedLoginCount = 0;
        LockedUntil = null;
        SecurityVersion++;
    }

    public void ResetTemporaryPassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        MustChangePassword = true;
        IsFirstLogin = true;
    }

    public void MarkVerified() => IsVerified = true;

    public void BeginOtpActivation(string passwordHash)
    {
        PasswordHash = passwordHash;
        Status = ParticipantStatus.Passive;
        IsVerified = false;
        IsFirstLogin = false;
        MustChangePassword = false;
        IsDeleted = false;
        DeletedAt = null;
    }

    public void CompleteOtpActivation()
    {
        Status = ParticipantStatus.Active;
        IsVerified = true;
    }

    // Kullanıcı isteği (2026-10-06): eski sistemden aktarılan kayıtlarda ad/cinsiyet eksik ya da
    // hatalı olabiliyor; NVI sorgusunda resmi kimlik bilgisi (ad soyad, doğum tarihi, cinsiyet) uygulanır.
    public void ApplyNviIdentity(string fullName, DateTime birthDate, Gender gender, bool isMinor)
    {
        if (!string.IsNullOrWhiteSpace(fullName)) FullName = fullName;
        BirthDate = DateTime.SpecifyKind(birthDate, DateTimeKind.Utc);
        if (gender != Gender.Unknown) Gender = gender;
        IsMinor = isMinor;
        IsVerified = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateAddress(string? address)
    {
        Address = address;
        District = ParseDistrict(address);
    }

    public void ApplyStructuredAddress(string? fullAddress, string? city, string? district, string? neighborhood, string? ilceKodu)
    {
        Address = fullAddress;
        City = city;
        District = !string.IsNullOrWhiteSpace(district) ? district : ParseDistrict(fullAddress);
        Neighborhood = neighborhood;
        IlceKodu = ilceKodu;
    }

    private static string? ParseDistrict(string? address)
    {
        var parts = address?.Split('/');
        if (parts?.Length >= 2)
            return parts[0].Split(',').LastOrDefault()?.Trim();
        return null;
    }
}
