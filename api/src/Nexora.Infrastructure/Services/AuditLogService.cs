using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.AuditLogs;
using Nexora.Application.Features.AuditLogs.Dtos;
using Nexora.Domain.Entities.Specialized;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class AuditLogService(IUnitOfWork uow) : IAuditLogService
{
    public async Task<PagedResult<AuditLogListItemDto>> GetPagedAsync(AuditLogListParams p, CancellationToken ct)
    {
        var paged = await uow.AuditLogs.GetPagedAsync(p, ct);
        return new PagedResult<AuditLogListItemDto>
        {
            Items = paged.Items.Select(ToListItem).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<AuditLogDetailDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var log = await uow.AuditLogs.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Log kaydı bulunamadı.", "AUDIT_LOG_NOT_FOUND");
        return ToDetail(log);
    }

    public async Task<AuditLogFilterOptionsDto> GetFilterOptionsAsync(CancellationToken ct)
    {
        var (modules, entityTypes) = await uow.AuditLogs.GetFilterOptionsAsync(ct);
        return new AuditLogFilterOptionsDto(modules, Enum.GetNames<AuditAction>().ToList(), entityTypes);
    }

    private static AuditLogListItemDto ToListItem(AuditLog a)
        => new(a.Id, a.CreatedAt, a.UserId, a.UserName, a.UserRole,
            a.Action.ToString(), a.Level.ToString(), a.Result.ToString(),
            a.EntityType, a.EntityId, a.Module, a.Description, a.IpAddress);

    private static AuditLogDetailDto ToDetail(AuditLog a)
        => new(a.Id, a.CreatedAt, a.UserId, a.UserName, a.UserRole,
            a.Action.ToString(), a.Level.ToString(), a.Result.ToString(),
            a.EntityType, a.EntityId, a.Module, a.Description,
            a.OldValues, a.NewValues, a.ChangesJson, a.IpAddress, a.UserAgent,
            a.SessionId, a.DurationMs, a.ErrorMessage, a.AdditionalDataJson);
}
