namespace Nexora.Application.Features.Libraries.Dtos;

public record TemplateShadowAuditDto(
    Guid LibraryId,
    string LibraryName,
    string? AssignedTemplate,
    string RecomputedTemplate,
    bool HasDrift,
    List<string> CapabilityViolations,
    DateTime AuditedAt);
