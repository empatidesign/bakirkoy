using System.Linq.Expressions;

namespace Nexora.Domain.Entities.Notifications;

public static class NotificationTypes
{
    public const string TeamPrefix = "team-";
    public const string GiftRequest = "gift-request";
    // Kullanıcı isteği (2026-08-08): "sistem içinde bunların kendi bildirimleri olsun" —
    // muhtara yeni başvuru geldiğinde MuhtarNotifier bu tipte bir Notification oluşturuyor
    // (bkz. Nexora.Infrastructure/Services/MuhtarNotifier.cs). Bulgu (canlı denetim,
    // 2026-08-08): TeamVisiblePredicate'e eklenmeden önce bu bildirimler DB'de doğru
    // oluşuyordu ama admin-panel'in bildirim zili (GET /me/team/notifications →
    // GetTeamPagedByRecipientAsync → bu predicate) onları HİÇ GÖSTERMİYORDU — muhtar
    // bildirimi hiçbir zaman göremiyordu. GiftRequest ile aynı pattern'e eklendi.
    public const string MuhtarlikSubmission = "muhtarlik-submission";

    public static readonly Expression<Func<Notification, bool>> TeamVisiblePredicate =
        n => n.Type.StartsWith(TeamPrefix) || n.Type == GiftRequest || n.Type == MuhtarlikSubmission;

    public static bool IsTeamVisible(string type)
        => type.StartsWith(TeamPrefix, StringComparison.Ordinal) || type == GiftRequest || type == MuhtarlikSubmission;
}
