using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

// IDN-Engelsiz (2026-09-11): Engelsiz Yaşam katılımcısı için tanımlanan
// refakatçi/teslim-alma yetkilisi. ParticipantId üzerinden vatandaşın kendi
// hesabına bağlıdır (başvuru bazlı değil — bir kişinin birden çok gruba
// katılan çocuğu için tek bir refakatçi listesi paylaşılabilir olsun diye).
public class AccessibleCaregiver : BaseEntity
{
    public Guid ParticipantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Tckn { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string Relation { get; private set; } = string.Empty;
    public bool IsAuthorizedPickup { get; private set; }

    public static AccessibleCaregiver Create(
        Guid participantId,
        string name,
        string tckn,
        string phone,
        string relation,
        bool isAuthorizedPickup)
    {
        return new AccessibleCaregiver
        {
            ParticipantId = participantId,
            Name = name,
            Tckn = tckn,
            Phone = phone,
            Relation = relation,
            IsAuthorizedPickup = isAuthorizedPickup,
        };
    }
}
