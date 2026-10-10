using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Wheels;

public class Gift : BaseEntity
{
    public string Name { get; private set; } = "";
    public string? ImageUrl { get; private set; }
    public int Points { get; private set; }
    public int StockLimit { get; private set; }
    public int AwardedCount { get; private set; }
    public List<int> WinnerPattern { get; private set; } = [];
    public string? Description { get; private set; }
    public GiftStatus Status { get; private set; }
    public string ResidencyMode { get; private set; } = "anyone";

    public static Gift Create(string name)
        => new() { Name = name.Trim(), Status = GiftStatus.Active };

    public void SetDetails(string name, string? imageUrl, int points, int stockLimit, IEnumerable<int> winnerPattern, string? description)
    {
        Name = name.Trim();
        ImageUrl = string.IsNullOrWhiteSpace(imageUrl) ? null : imageUrl.Trim();
        Points = points;
        StockLimit = stockLimit;
        WinnerPattern = winnerPattern.Where(n => n > 0).Distinct().OrderBy(n => n).ToList();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
    }

    public void SetResidencyMode(string? mode) => ResidencyMode = Nexora.Domain.Common.EligibilityRules.NormalizeResidencyMode(mode);

    public void SetStatus(GiftStatus status) => Status = status;

    public void SetAwardedCount(int count) => AwardedCount = Math.Max(0, count);

    public void IncrementAwarded() => AwardedCount++;
}
