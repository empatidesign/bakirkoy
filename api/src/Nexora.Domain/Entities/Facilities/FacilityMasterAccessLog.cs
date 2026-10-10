using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public class FacilityMasterAccessLog : BaseEntity
{
    public Guid ServiceFacilityId { get; private set; }
    public Guid DeviceId { get; private set; }
    public string DeviceCode { get; private set; } = string.Empty;
    public string Direction { get; private set; } = "entry";
    public string Method { get; private set; } = "master_qr";
    public DateTime At { get; private set; }

    public static FacilityMasterAccessLog Create(Guid serviceFacilityId, Guid deviceId, string deviceCode, string direction, string method)
        => new()
        {
            ServiceFacilityId = serviceFacilityId,
            DeviceId = deviceId,
            DeviceCode = deviceCode,
            Direction = direction is "exit" ? "exit" : "entry",
            Method = method is "master_card" ? "master_card" : "master_qr",
            At = DateTime.UtcNow,
        };
}
