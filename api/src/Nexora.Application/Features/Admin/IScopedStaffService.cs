using Nexora.Application.Features.Admin.Dtos;

namespace Nexora.Application.Features.Admin;

public interface IScopedStaffService
{
    Task<ScopedStaffDto> AssignAsync(AssignScopedStaffRequest req, CancellationToken ct);
    Task<ScopedStaffDto> EnsureAccountAsync(EnsureStaffAccountRequest req, CancellationToken ct);
    Task AddScopeAsync(Guid adminUserId, string scopeModuleKey, Guid scopeRefId, string scopeName, string scopeType, CancellationToken ct);
}
