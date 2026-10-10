namespace Nexora.Application.Features.Departments.Dtos;

public record DepartmentListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CreateDepartmentRequest(string Name, string? Description);

public record UpdateDepartmentRequest(string Name, string? Description);
