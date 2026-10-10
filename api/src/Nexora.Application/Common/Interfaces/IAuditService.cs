namespace Nexora.Application.Common.Interfaces;

public interface IAuditService
{
    Task LogAsync(AuditEntry entry, CancellationToken ct = default);
}
