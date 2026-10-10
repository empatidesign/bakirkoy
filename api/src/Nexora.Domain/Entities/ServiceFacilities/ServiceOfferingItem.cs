namespace Nexora.Domain.Entities.ServiceFacilities;

public class ServiceOfferingItem
{
    public string Id { get; set; } = "";
    public string? CatalogId { get; set; }
    public string Name { get; set; } = "";
    public string Module { get; set; } = "";
    public string? Description { get; set; }
    public bool Active { get; set; } = true;
}
