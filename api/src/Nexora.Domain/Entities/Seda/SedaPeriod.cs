using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Seda;

public class SedaPeriod : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    public int MaxApplications { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }

    public static SedaPeriod Create(string name, DateTime startDate, DateTime endDate, int maxApplications, string? description)
        => new()
        {
            Name = name,
            StartDate = startDate.Date,
            EndDate = endDate.Date,
            MaxApplications = maxApplications,
            Description = description,
            IsActive = false,
        };

    public void Update(string name, DateTime startDate, DateTime endDate, int maxApplications, string? description)
    {
        Name = name;
        StartDate = startDate.Date;
        EndDate = endDate.Date;
        MaxApplications = maxApplications;
        Description = description;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
