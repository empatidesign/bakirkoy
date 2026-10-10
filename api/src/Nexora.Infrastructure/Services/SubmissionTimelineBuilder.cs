using Nexora.Application.Features.ParticipantSubmissions.Dtos;
using Nexora.Domain.Entities.CitizenSubmissions;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-08-28): "bilimsel bilgi tüm süreler anlatılacak" — başvurunun süreç
/// adımlarını, her adımın bir öncekinden kaç saat sonra gerçekleştiği bilgisiyle birlikte
/// üretir. Muhtar görünümünde kişi adı içeren alanlar (ActorName) hiçbir zaman dışarı verilmez.
/// </summary>
public static class SubmissionTimelineBuilder
{
    public static IReadOnlyList<SubmissionTimelineItemDto> Build(
        IReadOnlyList<CitizenSubmissionEvent> events, bool forCitizen)
    {
        var visible = events
            .Where(e => forCitizen ? e.VisibleToCitizen : e.VisibleToMuhtar)
            .OrderBy(e => e.OccurredAt)
            .ToList();

        var result = new List<SubmissionTimelineItemDto>(visible.Count);
        DateTime? previous = null;

        foreach (var e in visible)
        {
            var hoursSince = previous is DateTime p
                ? Math.Round((e.OccurredAt - p).TotalHours, 1)
                : (double?)null;

            result.Add(new SubmissionTimelineItemDto(
                e.EventType,
                Nexora.Application.Features.CitizenSubmissions.MuhtarlikReference.EventTypeLabel(e.EventType),
                e.Status,
                e.Title,
                e.Note,
                e.ActorType,
                e.OccurredAt,
                hoursSince));

            previous = e.OccurredAt;
        }

        return result;
    }
}
