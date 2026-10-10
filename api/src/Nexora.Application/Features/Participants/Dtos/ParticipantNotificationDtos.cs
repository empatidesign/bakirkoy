namespace Nexora.Application.Features.Participants.Dtos;

// Kullanıcı isteği (2026-08-05): katılımcı detayında "giden mesaj veya bildirimler" görüntülensin.
// Notification entity'si zaten bu kişiye gönderilen tüm in-app/push bildirimlerini tutuyor
// (bkz. NotificationService.CreateAsync — her etkinlik/tesis/gezi/kütüphane/vb. durum
// değişikliğinde buraya yazılıyor). SMS gövdesi ayrıca loglanmıyor (bkz. NotificationDispatcher),
// bu yüzden SMS içeriği Notification.Body ile aynı olduğundan burada da görünür.

public record ParticipantNotificationDto(
    Guid Id,
    string Title,
    string Body,
    string Type,
    bool IsRead,
    DateTime CreatedAt,
    string? ReferenceType,
    string? ReferenceId,
    string? FacilityName,
    string? SessionInfo,
    string? StatusInfo);

public record ParticipantNotificationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 20;
}
