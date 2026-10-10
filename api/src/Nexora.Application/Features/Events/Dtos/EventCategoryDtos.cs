namespace Nexora.Application.Features.Events.Dtos;

public record EventCategoryDto(
    Guid Id,
    string Name,
    string? Description,
    string Color,
    int DefaultPoints,
    int EventCount,
    bool IsActive
);

public record EventCategoryOptionDto(Guid Id, string Name, int DefaultPoints);

public record EventCategorySummaryDto(int Total, int Active, int Passive);
