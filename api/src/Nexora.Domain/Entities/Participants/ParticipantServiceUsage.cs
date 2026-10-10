using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Participants;

public class ParticipantServiceUsage : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public Guid ParticipantId { get; private set; }
    public Guid? BranchId { get; private set; }
    public string? BranchName { get; private set; }
    public Guid? FacilityId { get; private set; }
    public string? FacilityName { get; private set; }
    public bool HasReceivedService { get; private set; }
    public DateTime? FirstServiceDate { get; private set; }
    public DateTime? LastServiceDate { get; private set; }
    public string? Note { get; private set; }
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }

    public static ParticipantServiceUsage Create(
        string module,
        Guid participantId,
        Guid? branchId,
        string? branchName,
        Guid? facilityId,
        string? facilityName,
        bool hasReceivedService,
        DateTime? firstServiceDate,
        DateTime? lastServiceDate,
        string? note,
        string? actor)
        => new()
        {
            Module = module,
            ParticipantId = participantId,
            BranchId = branchId,
            BranchName = branchName,
            FacilityId = facilityId,
            FacilityName = facilityName,
            HasReceivedService = hasReceivedService,
            FirstServiceDate = firstServiceDate,
            LastServiceDate = lastServiceDate,
            Note = note,
            CreatedBy = actor,
        };

    public void MarkReceived(DateTime? serviceDate, string? note, string? actor)
    {
        HasReceivedService = true;
        FirstServiceDate ??= serviceDate ?? DateTime.UtcNow;
        LastServiceDate = serviceDate ?? DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(note)) Note = note;
        UpdatedBy = actor;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Update(bool hasReceivedService, DateTime? firstServiceDate, DateTime? lastServiceDate, string? note, string? actor)
    {
        HasReceivedService = hasReceivedService;
        FirstServiceDate = firstServiceDate;
        LastServiceDate = lastServiceDate;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        UpdatedBy = actor;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkDeleted(string? actor)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }
}
