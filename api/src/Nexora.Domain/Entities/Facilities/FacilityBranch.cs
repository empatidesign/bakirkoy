using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public record FacilityBranchData(
    string Module,
    string Name,
    string Description,
    int PeriodMonths,
    int AbsenceLimit,
    int ConsecutiveAbsenceLimit,
    bool IsActive,
    string Category = ""
);

public class FacilityBranch : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Category { get; private set; } = string.Empty;
    public int PeriodMonths { get; private set; }
    public int AbsenceLimit { get; private set; }
    public int ConsecutiveAbsenceLimit { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }
    public string? DeletedBy { get; private set; }

    public static FacilityBranch Create(FacilityBranchData d, string? actor)
    {
        var branch = new FacilityBranch { CreatedBy = actor };
        branch.Apply(d);
        return branch;
    }

    public void Update(FacilityBranchData d, string? actor)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    private void Apply(FacilityBranchData d)
    {
        Module = d.Module;
        Name = d.Name.Trim();
        Description = d.Description ?? string.Empty;
        Category = (d.Category ?? string.Empty).Trim();
        PeriodMonths = d.PeriodMonths < 0 ? 0 : d.PeriodMonths;
        AbsenceLimit = d.AbsenceLimit < 0 ? 0 : d.AbsenceLimit;
        ConsecutiveAbsenceLimit = d.ConsecutiveAbsenceLimit < 0 ? 0 : d.ConsecutiveAbsenceLimit;
        IsActive = d.IsActive;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void MarkDeleted(string? actor)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = actor;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }
}
