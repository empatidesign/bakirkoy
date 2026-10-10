namespace Nexora.Application.Features.Companies.Dtos;

public record ServiceCategoryRefDto(Guid Id, string Name, string Color);

public record ServiceCategoryDto(
    Guid Id,
    string Name,
    string? Description,
    string Color,
    int CompanyCount,
    bool IsActive);

public record ServiceCategorySummaryDto(int Total, int Active, int Passive);

public record ServiceCategoryListParams
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

public record CreateServiceCategoryRequest(string Name, string? Description, string Color);

public record UpdateServiceCategoryRequest(string Name, string? Description, string Color);

public record CompanyServiceCategoryCreateRequest(string Name);

public record SetCompanyCategoriesRequest(Guid? ServiceCategoryId);
