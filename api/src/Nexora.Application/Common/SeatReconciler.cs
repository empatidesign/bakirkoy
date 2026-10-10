using System.Text.Json;
using Nexora.Application.Common.Interfaces;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Enums;

namespace Nexora.Application.Common;

public static class SeatReconciler
{
    public sealed record Move(Guid ParticipantId, List<string> OldSeats, List<string?> NewSeats, bool Manual);

    public sealed record Result(List<EventApplication> Touched, List<Move> Moves, int Reassigned, int ManualPending);

    public static Result Relocate(Dictionary<string, string> finalStates, string? hallLayoutJson, List<EventApplication> occupantApps)
    {
        var touched = new List<EventApplication>();
        var moves = new List<Move>();

        var displaced = occupantApps
            .Where(a => a.SeatNumber is not null && SeatMath.IsOccupiedState(finalStates.GetValueOrDefault(a.SeatNumber!)))
            .ToList();
        if (displaced.Count == 0) return new Result(touched, moves, 0, 0);

        var segments = SeatGeometry.BuildSegments(hallLayoutJson);
        var allSeatKeys = segments.Keys.ToList();

        var blocked = new HashSet<string>(allSeatKeys.Where(k => SeatMath.IsOccupiedState(finalStates.GetValueOrDefault(k))));
        foreach (var a in occupantApps)
            if (a.SeatNumber is not null && !displaced.Contains(a)) blocked.Add(a.SeatNumber);

        var free = new SortedSet<string>(allSeatKeys.Where(k => !blocked.Contains(k)), SeatGeometry.KeyComparer);

        int reassigned = 0, manualPending = 0;

        var groups = displaced
            .GroupBy(a => a.ParticipantId)
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Min(a => a.SeatNumber!), SeatGeometry.KeyComparer);

        foreach (var group in groups)
        {
            var members = group.OrderBy(a => a.SeatNumber!, SeatGeometry.KeyComparer).ToList();
            var oldSeats = members.Select(a => a.SeatNumber!).ToList();
            var block = SeatGeometry.FindAdjacentBlock(free, members.Count, segments);

            if (block is not null)
            {
                for (var i = 0; i < members.Count; i++)
                {
                    members[i].AssignSeat(block[i]);
                    free.Remove(block[i]);
                    reassigned++;
                    touched.Add(members[i]);
                }
                moves.Add(new Move(group.Key, oldSeats, block.Cast<string?>().ToList(), false));
            }
            else
            {
                var newSeats = new List<string?>();
                foreach (var member in members)
                {
                    var seat = free.Min;
                    if (seat is not null)
                    {
                        member.AssignSeat(seat);
                        free.Remove(seat);
                        reassigned++;
                    }
                    else
                    {
                        member.AssignSeat(null);
                        manualPending++;
                    }
                    newSeats.Add(member.SeatNumber);
                    touched.Add(member);
                }
                moves.Add(new Move(group.Key, oldSeats, newSeats, newSeats.Any(s => s is null)));
            }
        }

        return new Result(touched, moves, reassigned, manualPending);
    }

    public static AuditEntry BuildMoveAudit(string occurrenceCode, string entityType, Guid entityId, string module, Move move)
    {
        var movedTo = move.NewSeats.Where(s => s is not null).ToList();
        var manualNoSeat = move.Manual && movedTo.Count == 0;
        var description = manualNoSeat
            ? $"Koltuk taşıma: {occurrenceCode} için katılımcının yeri kapandı, uygun boş koltuk bulunamadı (manuel yer bekliyor)."
            : $"Koltuk taşıma: {occurrenceCode} için {string.Join(", ", move.OldSeats)} koltuğundaki katılımcı {string.Join(", ", movedTo)} koltuğuna taşındı.";

        return new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = entityType,
            EntityId = entityId,
            Module = module,
            Description = description,
            Result = manualNoSeat ? LogResult.Partial : LogResult.Success,
            Level = move.Manual ? AuditLogLevel.Warning : AuditLogLevel.Info,
            AdditionalDataJson = JsonSerializer.Serialize(new
            {
                occurrenceCode,
                participantId = move.ParticipantId,
                fromSeats = move.OldSeats,
                toSeats = move.NewSeats,
                manualPending = move.Manual,
            }),
        };
    }
}
