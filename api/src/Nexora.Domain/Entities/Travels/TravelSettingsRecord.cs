using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Travels;

public class TravelSettingsRecord : BaseEntity
{
    public string GeneralJson { get; private set; } = "{}";
    public string ParticipationJson { get; private set; } = "{}";
    public string PaymentJson { get; private set; } = "{}";
    public string RestrictionsJson { get; private set; } = "[]";
    public string RulesJson { get; private set; } = "[]";
    /// <summary>
    /// Kullanıcı isteği (2026-08-07): Gezi modülündeki tüm mesajlaşma (başvuru, onay, iptal,
    /// yaklaşan gezi hatırlatması, manuel/toplu mesaj) tek bir şablon sisteminde birleştirildi.
    /// Facility/Event modellerindeki aynı desen (JSON dizi, her olay için SMS+bildirim ayrı toggle).
    /// </summary>
    public string NotificationTemplatesJson { get; private set; } = "[]";

    public static TravelSettingsRecord Create() => new();

    public void Update(string generalJson, string participationJson, string paymentJson, string restrictionsJson, string rulesJson, string? notificationTemplatesJson = null)
    {
        GeneralJson = string.IsNullOrWhiteSpace(generalJson) ? "{}" : generalJson;
        ParticipationJson = string.IsNullOrWhiteSpace(participationJson) ? "{}" : participationJson;
        PaymentJson = string.IsNullOrWhiteSpace(paymentJson) ? "{}" : paymentJson;
        RestrictionsJson = string.IsNullOrWhiteSpace(restrictionsJson) ? "[]" : restrictionsJson;
        RulesJson = string.IsNullOrWhiteSpace(rulesJson) ? "[]" : rulesJson;
        if (notificationTemplatesJson is not null)
            NotificationTemplatesJson = string.IsNullOrWhiteSpace(notificationTemplatesJson) ? "[]" : notificationTemplatesJson;
        UpdatedAt = DateTime.UtcNow;
    }
}
