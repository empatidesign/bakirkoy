namespace Nexora.Application.Features.Permissions.Dtos;

public record CatalogModuleDto(
    string Key,
    string Name,
    string Group,
    int DisplayOrder,
    bool Scopable,
    List<string> Actions
);
