namespace Nexora.Application.Features.Admin.Dtos;

public record AssignScopedStaffRequest(
    string FullName,
    string? Tckn,
    string? Phone,
    string Email,
    string RoleTemplateKey,
    string ScopeModuleKey,
    Guid ScopeRefId,
    string ScopeName,
    string ScopeType,
    string DeliveryChannel
);
