namespace Nexora.Application.Features.Admin.Dtos;

public record AdminListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Role { get; init; }
    public Guid? RoleId { get; init; }
    public string? Department { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
    public string? FacilityModule { get; init; }
}
