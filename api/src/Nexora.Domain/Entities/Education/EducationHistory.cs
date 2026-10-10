using Nexora.Domain.Common;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Education;

public class EducationHistory : BaseEntity
{
    public Guid ParticipantId { get; private set; }
    public Guid? InstitutionId { get; private set; }
    public EducationLevel Level { get; private set; }
    public int StartYear { get; private set; }
    public int? EndYear { get; private set; }
    public bool IsGraduated { get; private set; }

    public Participant Participant { get; private set; } = null!;
    public EducationInstitution? Institution { get; private set; }

    public static EducationHistory Create(
        Guid participantId,
        Guid? institutionId,
        EducationLevel level,
        int startYear,
        int? endYear,
        bool isGraduated)
        => new()
        {
            ParticipantId = participantId,
            InstitutionId = institutionId,
            Level = level,
            StartYear = startYear,
            EndYear = endYear,
            IsGraduated = isGraduated,
        };

    public void Update(Guid? institutionId, EducationLevel level, int startYear, int? endYear, bool isGraduated)
    {
        InstitutionId = institutionId;
        Level = level;
        StartYear = startYear;
        EndYear = endYear;
        IsGraduated = isGraduated;
        UpdatedAt = DateTime.UtcNow;
    }
}
