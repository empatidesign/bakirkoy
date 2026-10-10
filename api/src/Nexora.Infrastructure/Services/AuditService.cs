using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Specialized;

namespace Nexora.Infrastructure.Services;

public class AuditService(IUnitOfWork uow, ICurrentUser currentUser) : IAuditService
{
    public async Task LogAsync(AuditEntry entry, CancellationToken ct = default)
    {
        var log = AuditLog.CreateDetailed(
            entry.ActorUserId ?? currentUser.Id,
            entry.ActorUserName ?? currentUser.Name,
            entry.ActorUserRole ?? currentUser.Role,
            entry.Action,
            entry.Level,
            entry.Result,
            entry.EntityType,
            entry.EntityId,
            entry.Module,
            entry.Description,
            entry.OldValues,
            entry.NewValues,
            entry.ChangesJson,
            currentUser.IpAddress,
            currentUser.UserAgent,
            currentUser.SessionId,
            entry.DurationMs,
            entry.ErrorMessage,
            entry.AdditionalDataJson);

        await uow.AuditLogs.AddAsync(log, ct);
        await uow.SaveChangesAsync(ct);
    }
}
