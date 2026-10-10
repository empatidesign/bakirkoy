namespace Nexora.Application.Common.Interfaces;

public interface IDashboardRealtimeNotifier
{
    Task NotifyApplicationChangedAsync(DashboardApplicationEvent payload, CancellationToken ct = default);

    Task NotifyReservationChangedAsync(DashboardReservationEvent payload, CancellationToken ct = default);
}

public record DashboardApplicationEvent(
    string Module,
    string Action,
    Guid ApplicationId,
    Guid? SourceId,
    string? SourceName,
    Guid? ParticipantId,
    string? ParticipantName,
    string Status,
    DateTime At);

public record DashboardReservationEvent(
    string Module,
    string Action,
    Guid ReservationId,
    Guid? SourceId,
    string? SourceName,
    Guid? ParticipantId,
    DateTime At);
