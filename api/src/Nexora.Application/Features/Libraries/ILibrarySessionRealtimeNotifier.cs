namespace Nexora.Application.Features.Libraries;

public record LibrarySessionEvent(
    string Action,
    Guid LibraryId,
    string LibraryName,
    string? Status,
    string? Seat,
    DateTime At);

public record LibraryOccupancyEvent(
    Guid LibraryId,
    int Inside,
    int OnBreak,
    int Free,
    int Waiting,
    DateTime At);

public record LibraryQueueCalledEvent(
    Guid LibraryId,
    string LibraryName,
    string? Seat,
    DateTime? CountdownExpiresAt,
    DateTime At);

public record LibraryScanDeniedEvent(
    string Action,
    Guid LibraryId,
    string Message,
    DateTime At);

public interface ILibrarySessionRealtimeNotifier
{
    Task NotifyScanDeniedAsync(Guid participantId, LibraryScanDeniedEvent payload, CancellationToken ct = default);
    Task NotifySessionChangedAsync(Guid participantId, LibrarySessionEvent payload, CancellationToken ct = default);
    Task NotifyOccupancyChangedAsync(LibraryOccupancyEvent payload, CancellationToken ct = default);
    Task NotifyQueueCalledAsync(Guid participantId, LibraryQueueCalledEvent payload, CancellationToken ct = default);
}
