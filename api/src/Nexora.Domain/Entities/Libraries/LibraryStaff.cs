using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public static class LocationConsentStatus
{
    public const string Unknown = "unknown";
    public const string Granted = "granted";
    public const string Denied = "denied";
    public const string Prompt = "prompt";

    public static bool IsValid(string? s) => s is Unknown or Granted or Denied or Prompt;
}

public class LibraryStaff : BaseEntity
{
    // Kullanıcı talimatı (2026-08-04, revizyon): personel artık iki kaynaktan biriyle
    // tanımlanabilir — ya bir AdminUser (klasik: e-posta/şifre ile giriş yapan yönetici
    // paneli kullanıcısı) ya da bir Participant (mevcut bir vatandaş/katılımcı kaydı —
    // "kişi hem katılımcı hem de görevli olabilir"). Tam olarak biri dolu olmalı.
    // Participant tabanlı personelin AYRI bir "personel QR"ı YOKTUR — kendi normal
    // vatandaş kimlik QR'ını (nxr-cid_ / ICitizenIdentityQrService) kullanır; başka
    // modüllerde (spor salonu vb.) aynı QR ile normal üye gibi davranmaya devam eder,
    // yalnız LibraryWebhookService'te HasDoorAccess=true ise ayrıca personel
    // giriş/çıkış toggle akışına da girebilir.
    public Guid? AdminUserId { get; private set; }
    public Guid? ParticipantId { get; private set; }
    public string FullName { get; private set; } = "";
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? RoleName { get; private set; }
    public List<Guid> WorkingLibraryIds { get; private set; } = [];
    public Guid? LastWorkedLibraryId { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string LocationConsentStatus { get; private set; } = Libraries.LocationConsentStatus.Unknown;
    public DateTime? LocationConsentUpdatedAt { get; private set; }

    public bool CanEditOwnShifts { get; private set; }

    // Kullanıcı talimatı (2026-08-04): "kütüphane görevlisi verilmişse kişi kendi QR'ı ile
    // bütün cihazlarda giriş çıkış yapabilir" — WorkingLibraryIds'ten bağımsız, kapı QR'ı
    // (LibraryWebhookService) yoluyla HERHANGİ bir kütüphanenin cihazında mesai
    // başlatıp/bitirebilme yetkisi. Rol/izin sistemine bağlı değil, doğrudan bu kayıtta
    // tutulan basit bir bayrak (personel katılımcıdan atanabildiği için Role zorunlu değil).
    public bool HasDoorAccess { get; private set; }

    public static LibraryStaff Create(Guid? adminUserId, Guid? participantId, string fullName, string? email, string? phone, string? roleName, List<Guid> workingLibraryIds, bool canEditOwnShifts = false, bool hasDoorAccess = false)
    {
        if (adminUserId is null && participantId is null)
            throw new ArgumentException("AdminUserId veya ParticipantId'den biri zorunludur.");
        // Vatandastan gorevli olusturuldugunda kisisel QR'in korunmasi icin ParticipantId,
        // yetkilerin Yonetici sayfasindan yonetilmesi icin AdminUserId birlikte tutulabilir.

        return new()
        {
            AdminUserId = adminUserId,
            ParticipantId = participantId,
            FullName = fullName.Trim(),
            Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim(),
            Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim(),
            RoleName = string.IsNullOrWhiteSpace(roleName) ? null : roleName.Trim(),
            WorkingLibraryIds = workingLibraryIds ?? [],
            IsActive = true,
            CanEditOwnShifts = canEditOwnShifts,
            HasDoorAccess = hasDoorAccess,
        };
    }

    public void Sync(string fullName, string? email, string? phone, string? roleName, List<Guid> workingLibraryIds, bool canEditOwnShifts, bool hasDoorAccess)
    {
        FullName = fullName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        RoleName = string.IsNullOrWhiteSpace(roleName) ? null : roleName.Trim();
        WorkingLibraryIds = workingLibraryIds ?? [];
        CanEditOwnShifts = canEditOwnShifts;
        HasDoorAccess = hasDoorAccess;
    }

    public void SetLastWorkedLibrary(Guid libraryId) => LastWorkedLibraryId = libraryId;
    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
    public void SetCanEditOwnShifts(bool value) => CanEditOwnShifts = value;

    public void SetLocationConsent(string status)
    {
        LocationConsentStatus = Libraries.LocationConsentStatus.IsValid(status) ? status : Libraries.LocationConsentStatus.Unknown;
        LocationConsentUpdatedAt = DateTime.UtcNow;
    }
}
