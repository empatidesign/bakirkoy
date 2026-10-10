using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public record FacilityData(
    string Module,
    string Name,
    string Kind,
    Guid? ServiceFacilityId,
    int Capacity,
    Guid? ManagerId,
    string? ManagerName,
    string? ManagerRoleKey,
    string? ManagerRoleName,
    string? ManagerPhone,
    string? ManagerEmail,
    string? EmergencyPhone,
    bool IsActive
);

public class Facility : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Kind { get; private set; } = "indoor";
    public Guid? ServiceFacilityId { get; private set; }
    public int Capacity { get; private set; }
    public Guid? ManagerId { get; private set; }
    public string? ManagerName { get; private set; }
    public string? ManagerRoleKey { get; private set; }
    public string? ManagerRoleName { get; private set; }
    public string? ManagerPhone { get; private set; }
    public string? ManagerEmail { get; private set; }
    public string? EmergencyPhone { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }
    public string? DeletedBy { get; private set; }

    public bool StaticQrEnabled { get; private set; }
    public string? StaticQrCode { get; private set; }
    public string StaticQrMode { get; private set; } = "attendance";
    // Kullanıcı isteği (2026-09-29, revize 2026-09-29 akşam: "dakika bekleme olayını kaldır,
    // saniye cinsinden olsun, hızlı olsun"): dakika bazlı süreler SANİYE'ye çevrildi. "attendance"
    // (tek QR) modunda giriş/çıkış ayrımı zamana dayalıdır — ilk okutma GİRİŞ sayılır; bu süre
    // dolana kadar tekrar tekrar okutulsa bile hâlâ aynı giriş kaydı geçerlidir (yeni giriş/çıkış
    // üretmez). Süre dolduktan SONRAKİ ilk okutma ÇIKIŞ sayılır. Varsayılan düşük tutulur ki arka
    // arkaya (turnike yerine telefonla) okutmalar hızlı işlensin, çift kayıt oluşmasın.
    public int StaticQrMinExitSeconds { get; private set; } = 3;
    // Çıkıştan sonra aynı kişinin tekrar GİRİŞ sayılabilmesi için beklemesi gereken süre (saniye).
    // Kullanıcı isteği: varsayılan olarak KAPALI (0) — dakikalarca bekletme kaldırıldı, tesis
    // yöneticisi isterse admin panelden (Ayarlar) saniye cinsinden açabilir. split modda (ayrı
    // Giriş/Çıkış QR) da aynı şekilde uygulanır.
    public int StaticQrReentryCooldownSeconds { get; private set; }

    // Kullanıcı isteği (2026-10-05): "tesisler ada göre, eklenme tarihine göre veya manuel
    // sürükle-bırak ile sıralanabilsin". Ad/eklenme tarihi zaten CreatedAt/Name üzerinden
    // sıralanabiliyordu (bkz. FacilityRepository.ApplySort) — eksik olan manuel sıralamaydı.
    // Yeni kayıt, aynı modüldeki mevcut en yüksek SortOrder'ın bir fazlasıyla oluşturulur
    // (bkz. ServiceFacilityManagementService/FacilityCreate akışı) ki varsayılan davranış da
    // oluşturulma sırasını (CreatedAt ile aynı göreli sıra) korusun.
    public int SortOrder { get; private set; }

    public void SetSortOrder(int order)
    {
        SortOrder = order < 0 ? 0 : order;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStaticQrEnabled(bool enabled)
    {
        StaticQrEnabled = enabled;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStaticQrMode(string mode)
    {
        StaticQrMode = mode is "attendance" or "entry" or "entry_exit" or "split" ? mode : "attendance";
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStaticQrTiming(int minExitSeconds, int reentryCooldownSeconds)
    {
        StaticQrMinExitSeconds = minExitSeconds < 0 ? 0 : minExitSeconds;
        StaticQrReentryCooldownSeconds = reentryCooldownSeconds < 0 ? 0 : reentryCooldownSeconds;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RotateStaticQrCode(string code)
    {
        StaticQrCode = code;
        UpdatedAt = DateTime.UtcNow;
    }

    public static Facility Create(FacilityData d, string code, string? actor, int sortOrder = 0)
    {
        var facility = new Facility { Code = code, CreatedBy = actor, SortOrder = sortOrder };
        facility.Apply(d);
        return facility;
    }

    public void Update(FacilityData d, string? actor)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    private void Apply(FacilityData d)
    {
        Module = d.Module;
        Name = d.Name.Trim();
        Kind = d.Kind;
        ServiceFacilityId = d.ServiceFacilityId;
        Capacity = d.Capacity < 0 ? 0 : d.Capacity;
        ManagerId = d.ManagerId;
        ManagerName = d.ManagerName;
        ManagerRoleKey = d.ManagerRoleKey;
        ManagerRoleName = d.ManagerRoleName;
        ManagerPhone = d.ManagerPhone;
        ManagerEmail = d.ManagerEmail;
        EmergencyPhone = d.EmergencyPhone;
        IsActive = d.IsActive;
    }

    public void SetManager(Guid? managerId, string? managerName, string? roleKey, string? roleName, string? phone, string? email, string? emergencyPhone)
    {
        ManagerId = managerId;
        ManagerName = managerName;
        ManagerRoleKey = roleKey;
        ManagerRoleName = roleName;
        ManagerPhone = phone;
        ManagerEmail = email;
        EmergencyPhone = emergencyPhone;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void MarkDeleted(string? actor)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = actor;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }
}
