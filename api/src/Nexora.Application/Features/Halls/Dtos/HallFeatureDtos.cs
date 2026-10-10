namespace Nexora.Application.Features.Halls.Dtos;

public record HallFeatureGroupDto(string Id, string Name, string Color);

public record HallFeatureDto(string Id, string Name, string Group);

public record HallFeatureCatalogDto(List<HallFeatureGroupDto> Groups, List<HallFeatureDto> Features);

public record HallFeatureTemplateDto(string Id, string Name, string? Description, List<string> FeatureIds);

public record FeatureGroupRequest(string Name, string Color);

public record FeatureRequest(string Name, string Group);

public record FeatureTemplateRequest(string Name, string? Description, List<string> FeatureIds);
