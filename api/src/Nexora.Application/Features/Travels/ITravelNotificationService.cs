namespace Nexora.Application.Features.Travels;

/// <summary>
/// Kullanıcı isteği (2026-08-07): birleşik gezi mesaj şablonu sisteminde {{placeholder}}
/// interpolasyonu için gereken sefer bağlamı. NotifyStatusAsync ve reminder job'ı bu ortak
/// tipi kullanır — aynı Render() mantığı her iki tetikleyicide de tutarlı çalışır.
/// </summary>
public record TravelNotificationContext(
    string TravelName,
    DateTime StartDate,
    string Destination,
    string DeparturePoint
);

public interface ITravelNotificationService
{
    /// <summary>
    /// status: application_received, approved, rejected, waitlist, promoted,
    /// promoted_approved, cancelled — şablon sisteminde tanımlı "event" adlarıyla birebir eşleşir.
    /// waitlistPosition yalnızca "waitlist" durumunda {{sira}} değişkeni için kullanılır.
    /// </summary>
    Task SendStatusAsync(Guid participantId, string? phone, string fullName, TravelNotificationContext travel, string status, int? waitlistPosition, CancellationToken ct, string? reason = null);
}
