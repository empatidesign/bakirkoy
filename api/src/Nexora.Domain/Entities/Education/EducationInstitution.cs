using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Education;

public class EducationInstitution : BaseEntity
{
    public InstitutionType Type { get; private set; }
    public string Name { get; private set; } = "";
    public string? Faculty { get; private set; }
    public string? Department { get; private set; }
    public DegreeLevel? DegreeLevel { get; private set; }
    public bool IsActive { get; private set; } = true;

    public ICollection<EducationHistory> EducationHistories { get; private set; } = [];

    public static EducationInstitution Create(InstitutionType type, string name, string? faculty, string? department, DegreeLevel? degreeLevel = null)
        => new() { Type = type, Name = name, Faculty = faculty, Department = department, DegreeLevel = degreeLevel, IsActive = true };

    public void Update(InstitutionType type, string name, string? faculty, string? department, DegreeLevel? degreeLevel)
    {
        Type = type;
        Name = name;
        Faculty = faculty;
        Department = department;
        DegreeLevel = degreeLevel;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate() { IsActive = true; UpdatedAt = DateTime.UtcNow; }
    public void Deactivate() { IsActive = false; UpdatedAt = DateTime.UtcNow; }
}
