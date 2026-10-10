using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Participants;
using Nexora.Infrastructure.Services.Email;

namespace Nexora.Infrastructure.Services;

public class ParticipantNotificationService(IUnitOfWork uow, INotificationDispatcher dispatcher) : IParticipantNotificationService
{
    public async Task NotifyAsync(IEnumerable<Guid> participantIds, string message, CancellationToken ct = default)
    {
        var ids = participantIds.Distinct().ToList();
        if (ids.Count == 0 || string.IsNullOrWhiteSpace(message)) return;

        var participants = await uow.Participants.FindAsync(p => ids.Contains(p.Id), ct);
        foreach (var participant in participants)
            await SendAsync(participant, message, ct);
    }

    public async Task NotifySeatMoveAsync(
        Guid participantId,
        string context,
        IReadOnlyList<string> oldSeats,
        IReadOnlyList<string?> newSeats,
        bool manual,
        CancellationToken ct = default)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct);
        if (participant is null) return;

        var message = manual
            ? $"{context}: yeriniz salon/araç düzenlemesi nedeniyle değişti; uygun boş yer bulunamadığından görevli personel sizinle ilgilenecektir."
            : $"{context}: yeriniz değişti. Yeni yeriniz: {string.Join(", ", newSeats.Select(s => string.IsNullOrWhiteSpace(s) ? "manuel yerleştirme" : s))} (önceki: {string.Join(", ", oldSeats)}).";

        await SendAsync(participant, message, ct);
    }

    private async Task SendAsync(Participant participant, string message, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(participant.Phone))
            await dispatcher.SendSmsAsync(participant.Phone!, message, ct);

        if (!string.IsNullOrWhiteSpace(participant.Email))
        {
            var mail = EmailTemplates.Notification(participant.FullName, message);
            await dispatcher.SendEmailAsync(participant.Email!, mail.Subject, mail.HtmlBody, ct);
        }

        if (IsMinor(participant.BirthDate))
        {
            if (!string.IsNullOrWhiteSpace(participant.GuardianPhone))
                await dispatcher.SendSmsAsync(participant.GuardianPhone!, message, ct);

            if (!string.IsNullOrWhiteSpace(participant.GuardianEmail))
            {
                var mail = EmailTemplates.Notification(participant.FullName, message);
                await dispatcher.SendEmailAsync(participant.GuardianEmail!, mail.Subject, mail.HtmlBody, ct);
            }
        }
    }

    private static bool IsMinor(DateTime birthDate)
    {
        var today = DateTime.UtcNow.Date;
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age < 18;
    }
}
