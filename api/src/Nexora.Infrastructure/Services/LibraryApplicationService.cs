using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class LibraryApplicationService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IUserScopeService userScope,
    INotificationDispatcher dispatcher,
    Nexora.Application.Features.Notifications.INotificationService inApp,
    IActivityLogger log,
    IAuditService audit) : ILibraryApplicationService
{
    private async Task<IReadOnlyCollection<Guid>?> ScopedLibraryIdsAsync(CancellationToken ct)
        => currentUser.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, "library", ct) : null;

    private async Task EnsureLibraryInScopeAsync(Guid? libraryId, CancellationToken ct)
    {
        var scopedIds = await ScopedLibraryIdsAsync(ct);
        if (scopedIds is null) return;
        if (libraryId is null || !scopedIds.Contains(libraryId.Value))
            throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
    }

    public async Task<PagedResult<LibraryApplicationDto>> GetPagedAsync(LibraryApplicationListParams p, CancellationToken ct)
    {
        var paged = await uow.LibraryApplications.GetPagedAsync(p, await ScopedLibraryIdsAsync(ct), ct);
        return new PagedResult<LibraryApplicationDto>
        {
            Items = paged.Items.Select(ToDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<LibraryApplicationDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.LibraryApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        await EnsureLibraryInScopeAsync(app.LibraryId, ct);
        return ToDto(app);
    }

    public async Task<LibraryApplicationSummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var (total, pending, approved, rejected) = await uow.LibraryApplications.GetSummaryAsync(await ScopedLibraryIdsAsync(ct), ct);
        return new LibraryApplicationSummaryDto(total, pending, approved, rejected);
    }

    public async Task<LibraryApplicationDto> CreateAsync(LibraryApplicationRequest req, CancellationToken ct)
    {
        await EnsureLibraryInScopeAsync(req.LibraryId, ct);
        var app = LibraryApplication.Create(
            req.ApplicantName, req.ApplicantSurname, req.Email, req.Phone,
            req.MembershipType, req.Documents, req.LibraryId);
        await uow.LibraryApplications.AddAsync(app, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "LibraryApplication",
            EntityId = app.Id,
            Module = "Library",
            Description = $"Kıraathane üyelik başvurusu alındı: {app.ApplicantName} {app.ApplicantSurname}",
        }, ct);

        return ToDto(app);
    }

    public async Task<LibraryApplicationDto> ApproveAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.LibraryApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        await EnsureLibraryInScopeAsync(app.LibraryId, ct);
        if (app.Status != "pending")
            throw new ConflictException("Yalnızca bekleyen başvurular onaylanabilir.", "NOT_PENDING");
        app.Approve();
        uow.LibraryApplications.Update(app);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Approve,
            EntityType = "LibraryApplication",
            EntityId = app.Id,
            Module = "Library",
            Description = $"Kıraathane üyelik başvurusu onaylandı: {app.ApplicantName} {app.ApplicantSurname}",
            OldValues = "{\"Status\":\"pending\"}",
            NewValues = "{\"Status\":\"approved\"}",
        }, ct);

        await NotifyAsync(app, "Kıraathane üyelik başvurunuz onaylandı.", "Onaylandı", ct);
        return ToDto(app);
    }

    public async Task<LibraryApplicationDto> RejectAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.LibraryApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        await EnsureLibraryInScopeAsync(app.LibraryId, ct);
        if (app.Status != "pending")
            throw new ConflictException("Yalnızca bekleyen başvurular reddedilebilir.", "NOT_PENDING");
        app.Reject();
        uow.LibraryApplications.Update(app);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Reject,
            EntityType = "LibraryApplication",
            EntityId = app.Id,
            Module = "Library",
            Description = $"Kıraathane üyelik başvurusu reddedildi: {app.ApplicantName} {app.ApplicantSurname}",
            OldValues = "{\"Status\":\"pending\"}",
            NewValues = "{\"Status\":\"rejected\"}",
        }, ct);

        await NotifyAsync(app, "Kıraathane üyelik başvurunuz reddedildi.", "Reddedildi", ct);
        return ToDto(app);
    }

    private async Task NotifyAsync(LibraryApplication app, string message, string statusInfo, CancellationToken ct)
    {
        var libName = app.LibraryId.HasValue
            ? (await uow.Libraries.GetByIdAsync(app.LibraryId.Value, ct))?.Name
            : null;
        var body = libName is null ? message : $"{libName}: {message}";

        var participant = string.IsNullOrWhiteSpace(app.Phone)
            ? null
            : (await uow.Participants.FindAsync(x => x.Phone == app.Phone, ct)).FirstOrDefault();

        if (participant is not null)
        {
            try
            {
                await inApp.CreateAsync(participant.Id, "Kıraathane üyelik başvurunuz", body, "application",
                    "library", app.LibraryId?.ToString(), libName, null, statusInfo, ct);
            }
            catch (Exception ex) { log.LogStepResult("LibraryApplicationInAppFailed", new { app.Id, ex.Message }); }
        }

        if (string.IsNullOrWhiteSpace(app.Phone)) return;
        try { await dispatcher.SendSmsAsync(app.Phone, body, ct); }
        catch (Exception ex) { log.LogStepResult("LibraryApplicationSmsFailed", new { app.Id, ex.Message }); }
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.LibraryApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        await EnsureLibraryInScopeAsync(app.LibraryId, ct);
        uow.LibraryApplications.Delete(app);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "LibraryApplication",
            EntityId = app.Id,
            Module = "Library",
            Description = $"Kıraathane üyelik başvurusu silindi: {app.ApplicantName} {app.ApplicantSurname} ({app.Status})",
        }, ct);
    }

    private static LibraryApplicationDto ToDto(LibraryApplication a) => new(
        a.Id, a.ApplicantName, a.ApplicantSurname, a.Email, a.Phone,
        a.MembershipType, a.Documents, a.LibraryId, a.Status, a.CreatedAt, a.UpdatedAt);
}
