using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Quizzes;

public class QuizAgeGroup : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public int MinAge { get; private set; }
    public int MaxAge { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static QuizAgeGroup Create(string name, int minAge, int maxAge, int sortOrder)
        => new()
        {
            Name = name.Trim(),
            MinAge = minAge < 0 ? 0 : minAge,
            MaxAge = maxAge < 0 ? 0 : maxAge,
            SortOrder = sortOrder < 0 ? 0 : sortOrder,
        };

    public void Update(string name, int minAge, int maxAge, int sortOrder)
    {
        Name = name.Trim();
        MinAge = minAge < 0 ? 0 : minAge;
        MaxAge = maxAge < 0 ? 0 : maxAge;
        SortOrder = sortOrder < 0 ? 0 : sortOrder;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public bool Contains(int age)
    {
        if (MinAge > 0 && age < MinAge) return false;
        if (MaxAge > 0 && age > MaxAge) return false;
        return true;
    }
}
