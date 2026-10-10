using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public record FacilityInstructorData(
    string Module,
    string FullName,
    string? Tckn,
    string? Phone,
    string? Email,
    string? Specialty,
    bool IsActive
);

public class FacilityInstructor : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;
    public string? Tckn { get; private set; }
    public string? Phone { get; private set; }
    public string? Email { get; private set; }
    public string? Specialty { get; private set; }
    public Guid? UserId { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }
    public string? DeletedBy { get; private set; }

    public static FacilityInstructor Create(FacilityInstructorData d, string? actor)
    {
        var instructor = new FacilityInstructor { CreatedBy = actor };
        instructor.Apply(d);
        return instructor;
    }

    public void Update(FacilityInstructorData d, string? actor)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    private void Apply(FacilityInstructorData d)
    {
        Module = d.Module;
        FullName = d.FullName.Trim();
        Tckn = d.Tckn;
        Phone = d.Phone;
        Email = d.Email;
        Specialty = d.Specialty;
        IsActive = d.IsActive;
    }

    public void LinkUser(Guid userId) => UserId = userId;

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
