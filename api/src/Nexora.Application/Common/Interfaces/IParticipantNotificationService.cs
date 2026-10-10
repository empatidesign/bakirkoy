namespace Nexora.Application.Common.Interfaces;

public interface IParticipantNotificationService
{
    Task NotifyAsync(IEnumerable<Guid> participantIds, string message, CancellationToken ct = default);

    Task NotifySeatMoveAsync(
        Guid participantId,
        string context,
        IReadOnlyList<string> oldSeats,
        IReadOnlyList<string?> newSeats,
        bool manual,
        CancellationToken ct = default);
}
