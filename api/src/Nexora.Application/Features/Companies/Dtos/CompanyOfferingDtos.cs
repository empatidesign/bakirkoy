namespace Nexora.Application.Features.Companies.Dtos;

// IDN-İşletme (2026-09-11): mobil BusinessServiceFormScreen'in (createService/
// updateService) çağırdığı hizmet kataloğu CRUD'u için. Campaign'den ayrı bir
// kavram — bkz. Nexora.Domain.Entities.Companies.CompanyOffering.
public record CompanyOfferingDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    string Name,
    string Description,
    string Category,
    decimal MinPrice,
    decimal MaxPrice,
    int MinDurationMinutes,
    int MaxDurationMinutes,
    string? ImageUrl,
    bool IsPopular,
    bool IsActive,
    DateTime CreatedAt
);

public record CreateCompanyOfferingRequest(
    string Name,
    string? Description,
    string Category,
    decimal MinPrice,
    decimal MaxPrice,
    int MinDurationMinutes,
    int MaxDurationMinutes,
    string? ImageUrl,
    bool IsPopular
);

public record UpdateCompanyOfferingRequest(
    string Name,
    string? Description,
    string Category,
    decimal MinPrice,
    decimal MaxPrice,
    int MinDurationMinutes,
    int MaxDurationMinutes,
    string? ImageUrl,
    bool IsPopular,
    bool IsActive
);

public record CompanyOfferingStatsDto(
    int Total,
    int Popular,
    int CategoryCount,
    List<string> Categories
);
