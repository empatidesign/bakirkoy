namespace Nexora.Application.Features.Team;

public record TeamRealtimeMessage(Guid Id, Guid SenderId, Guid RecipientId, string Text, DateTime SentAt);

public interface ITeamRealtimeNotifier
{
    Task MessageSentAsync(TeamRealtimeMessage message, CancellationToken ct = default);
}
