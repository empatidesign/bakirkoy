namespace Nexora.Application.Features.Admin.Dtos;

public record EnsureStaffAccountRequest(
    string FullName,
    string? Tckn,
    string? Phone,
    string Email,
    string RoleTemplateKey,
    string DeliveryChannel
);
