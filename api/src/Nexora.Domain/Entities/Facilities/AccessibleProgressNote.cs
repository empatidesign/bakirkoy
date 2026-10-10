using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

// IDN-Engelsiz (2026-09-11): Engelsiz Yaşam gruplarında görevli personelin
// (antrenör/uzman) katılımcının gelişimi hakkında paylaştığı notlar. Vatandaş
// yalnızca okur; oluşturma/güncelleme admin panelinden yapılır (bu entity'nin
// yazma endpoint'i mobil kapsamda değildir, /me/... altında sadece GET vardır).
public class AccessibleProgressNote : BaseEntity
{
    public Guid FacilityApplicationId { get; private set; }
    public string NoteType { get; private set; } = string.Empty;
    public string? RecommendedAdjustments { get; private set; }
    public string RecordedBy { get; private set; } = string.Empty;
    public DateTime RecordedAt { get; private set; }

    public static AccessibleProgressNote Create(
        Guid facilityApplicationId,
        string noteType,
        string? recommendedAdjustments,
        string recordedBy)
    {
        return new AccessibleProgressNote
        {
            FacilityApplicationId = facilityApplicationId,
            NoteType = noteType,
            RecommendedAdjustments = recommendedAdjustments,
            RecordedBy = recordedBy,
            RecordedAt = DateTime.UtcNow,
        };
    }
}
