using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Participants;

public class ParticipantGuardian : BaseEntity
{
    public Guid GuardianId { get; private set; }
    public Guid ChildId { get; private set; }
    public string? Relation { get; private set; }

    public Participant? Guardian { get; private set; }
    public Participant? Child { get; private set; }

    public static ParticipantGuardian Create(Guid guardianId, Guid childId, string? relation = null)
        => new()
        {
            GuardianId = guardianId,
            ChildId = childId,
            Relation = relation,
        };
}
