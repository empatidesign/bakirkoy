using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

// IDN-Engelsiz (2026-09-11): mobil app AccessibleApplicationDetailScreen için
// eklendi. "accessible-life" modülündeki bir FacilityApplication'a 1-1 bağlanır;
// vatandaşın kendi başvurusuna eklediği engellilik/sağlık bilgisi ve KVKK
// açık rıza onayı burada tutulur. Bu alanlar özel nitelikli kişisel veri
// (KVKK madde 6) olduğundan yalnızca vatandaşın kendi kaydı üzerinden,
// açık rıza kaydı ile birlikte yazılabilir.
public record AccessibleApplicationDetailData(
    Guid FacilityApplicationId,
    string? PrimaryDisabilityType,
    int? DisabilityRate,
    string EmergencyContactName,
    string EmergencyContactPhone,
    bool RequiresWheelchairAccess,
    bool RequiresSignLanguage,
    bool RequiresBraille
);

public class AccessibleApplicationDetail : BaseEntity
{
    public Guid FacilityApplicationId { get; private set; }
    public string? PrimaryDisabilityType { get; private set; }
    public int? DisabilityRate { get; private set; }
    public string EmergencyContactName { get; private set; } = string.Empty;
    public string EmergencyContactPhone { get; private set; } = string.Empty;
    public bool RequiresWheelchairAccess { get; private set; }
    public bool RequiresSignLanguage { get; private set; }
    public bool RequiresBraille { get; private set; }

    // KVKK açık rıza onayı: özel nitelikli veri (madde 6) için ayrı ve
    // geriye dönük değiştirilemez bir kayıt. Sürüm, ilerideki metin
    // güncellemelerinde hangi rıza metnine onay verildiğini izler.
    public string? KvkkConsentVersion { get; private set; }
    public DateTime? KvkkConsentGivenAt { get; private set; }

    public static AccessibleApplicationDetail Create(AccessibleApplicationDetailData d)
    {
        return new AccessibleApplicationDetail
        {
            FacilityApplicationId = d.FacilityApplicationId,
            PrimaryDisabilityType = d.PrimaryDisabilityType,
            DisabilityRate = d.DisabilityRate,
            EmergencyContactName = d.EmergencyContactName,
            EmergencyContactPhone = d.EmergencyContactPhone,
            RequiresWheelchairAccess = d.RequiresWheelchairAccess,
            RequiresSignLanguage = d.RequiresSignLanguage,
            RequiresBraille = d.RequiresBraille,
        };
    }

    public void UpdateDisabilityInfo(AccessibleApplicationDetailData d)
    {
        PrimaryDisabilityType = d.PrimaryDisabilityType;
        DisabilityRate = d.DisabilityRate;
        EmergencyContactName = d.EmergencyContactName;
        EmergencyContactPhone = d.EmergencyContactPhone;
        RequiresWheelchairAccess = d.RequiresWheelchairAccess;
        RequiresSignLanguage = d.RequiresSignLanguage;
        RequiresBraille = d.RequiresBraille;
        UpdatedAt = DateTime.UtcNow;
    }

    // Rıza yalnızca bir kez, ilk defasında kaydedilir; zaten verilmiş bir
    // rızanın üzerine yazılmaz (denetim izini bozmamak için).
    public bool GiveKvkkConsent(string version)
    {
        if (KvkkConsentGivenAt.HasValue) return false;
        KvkkConsentVersion = version;
        KvkkConsentGivenAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }
}
