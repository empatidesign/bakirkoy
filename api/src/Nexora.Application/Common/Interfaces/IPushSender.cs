namespace Nexora.Application.Common.Interfaces;

public interface IPushSender
{
    Task SendToParticipantAsync(Guid participantId, string title, string body, IReadOnlyDictionary<string, string>? data, CancellationToken ct = default);
}
