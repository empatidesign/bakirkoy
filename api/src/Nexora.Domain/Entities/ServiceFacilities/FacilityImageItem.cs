namespace Nexora.Domain.Entities.ServiceFacilities;

public class FacilityImageItem
{
    public string Id { get; set; } = "";
    public string Url { get; set; } = "";
    public string? Name { get; set; }
    public long? Size { get; set; }
    public bool IsPrimary { get; set; }
}
