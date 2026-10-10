using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Popups;

/// <summary>Ne zaman tetiklenir. first_login: vatandaş HİÇ giriş yapmamışsa (ilk girişte) bir
/// kez gösterilir (tekrar tetiklenmez — RepeatIntervalHours'tan bağımsız, tek seferliktir).
/// every_login: her oturum açılışında (ana sayfa ilk yüklendiğinde) kontrol edilir.
/// module_enter: belirli bir modül/alan (TriggerModuleKey) rotasına girildiğinde kontrol edilir.</summary>
public static class PopupTriggerTypes
{
    public const string FirstLogin = "first_login";
    public const string EveryLogin = "every_login";
    public const string ModuleEnter = "module_enter";

    public static readonly string[] All = [FirstLogin, EveryLogin, ModuleEnter];
    public static bool IsValid(string v) => All.Contains(v);
}

public record PopupCampaignData(
    string Title,
    bool IsMandatory,
    bool AllowDismissForever,
    int RepeatIntervalHours,
    string TriggerType,
    string? TriggerModuleKey,
    DateTime? StartDate,
    DateTime? EndDate,
    int MinDisplaySeconds,
    bool IsActive,
    int Priority,
    List<PopupMediaItem> MediaItems);

/// <summary>
/// Kullanıcı isteği (2026-09-20): admin panelden yönetilen, vatandaş uygulamasında gösterilen
/// zorunlu/bilgilendirme popup'ları. İçerik birden fazla resim/video/metin öğesinden oluşabilir
/// (karusel — bkz. <see cref="PopupMediaItem"/>). Zorunlu popup, vatandaş "okudum/izledim" onayı
/// verene kadar her girişte tekrar gösterilir (MandatoryAnnouncementGate ile aynı davranış,
/// ama zengin medya destekli). Bilgilendirme popup'ları vatandaşa "bir daha gösterme" seçeneği
/// sunabilir (<see cref="AllowDismissForever"/>) ve/veya belirli bir aralıkla tekrar gösterilebilir
/// (<see cref="RepeatIntervalHours"/> — 0 = her tetiklenmede göster).
/// Tetikleme: ilk giriş, her giriş, veya belirli bir modüle girildiğinde (<see cref="TriggerType"/>).
/// Zamanlama: belirli tarih aralığı (<see cref="StartDate"/>/<see cref="EndDate"/>) ve/veya asgari
/// gösterim süresi (<see cref="MinDisplaySeconds"/> — özellikle video/uzun metin dışındaki
/// resim/kısa içeriklerde kullanıcının en az bu süre boyunca ekranda tutulmasını sağlar).
/// </summary>
public class PopupCampaign : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public bool IsMandatory { get; private set; }
    public bool AllowDismissForever { get; private set; }
    public int RepeatIntervalHours { get; private set; }
    public string TriggerType { get; private set; } = PopupTriggerTypes.EveryLogin;
    public string? TriggerModuleKey { get; private set; }
    public DateTime? StartDate { get; private set; }
    public DateTime? EndDate { get; private set; }
    public int MinDisplaySeconds { get; private set; }
    public bool IsActive { get; private set; } = true;
    public int Priority { get; private set; }
    public int ViewCount { get; private set; }
    public int AcknowledgeCount { get; private set; }
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }

    public List<PopupMediaItem> MediaItems { get; private set; } = [];

    public static PopupCampaign Create(PopupCampaignData d, string? actor)
    {
        var p = new PopupCampaign { CreatedBy = actor };
        p.Apply(d);
        return p;
    }

    public void Update(PopupCampaignData d, string? actor)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    private void Apply(PopupCampaignData d)
    {
        Title = d.Title.Trim();
        IsMandatory = d.IsMandatory;
        // Zorunlu popup okundu onayı olmadan kapatılamaz; "bir daha gösterme" seçeneği
        // yalnızca bilgilendirme (opsiyonel) popup'larda anlamlıdır.
        AllowDismissForever = !d.IsMandatory && d.AllowDismissForever;
        RepeatIntervalHours = Math.Max(0, d.RepeatIntervalHours);
        TriggerType = PopupTriggerTypes.IsValid(d.TriggerType) ? d.TriggerType : PopupTriggerTypes.EveryLogin;
        TriggerModuleKey = TriggerType == PopupTriggerTypes.ModuleEnter
            ? (string.IsNullOrWhiteSpace(d.TriggerModuleKey) ? null : d.TriggerModuleKey.Trim())
            : null;
        StartDate = d.StartDate.HasValue ? DateTime.SpecifyKind(d.StartDate.Value, DateTimeKind.Utc) : null;
        EndDate = d.EndDate.HasValue ? DateTime.SpecifyKind(d.EndDate.Value, DateTimeKind.Utc) : null;
        MinDisplaySeconds = Math.Max(0, d.MinDisplaySeconds);
        IsActive = d.IsActive;
        Priority = d.Priority;
        MediaItems = d.MediaItems
            .Select((m, i) => new PopupMediaItem { Order = i, Type = m.Type, Url = m.Url, Text = m.Text })
            .ToList();
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void IncrementViewCount() => ViewCount++;
    public void IncrementAcknowledgeCount() => AcknowledgeCount++;
}
