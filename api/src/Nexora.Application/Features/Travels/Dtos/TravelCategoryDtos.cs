namespace Nexora.Application.Features.Travels.Dtos;

public record TravelCategoryDto(
    Guid Id,
    string Name,
    string Description,
    string Color,
    int TravelCount,
    int TotalCapacity,
    int TotalRegistered,
    bool IsActive,
    DateTime? CreatedAt,
    DateTime? UpdatedAt
);

public record TravelCategoryOptionDto(Guid Id, string Name, string Color);
