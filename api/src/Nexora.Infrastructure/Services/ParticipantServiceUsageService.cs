using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Participants;
using Nexora.Application.Features.Participants.Dtos;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Services;

public class ParticipantServiceUsageService(IUnitOfWork uow, ICurrentUser currentUser, IUserScopeService userScope) : IParticipantServiceUsageService
{
    private async Task EnsureInScopeAsync(Guid participantId, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedIds = await userScope.GetScopedParticipantIdsAsync(uid, ct);
        if (scopedIds is not null && !scopedIds.Contains(participantId))
            throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
    }

    private static ParticipantServiceUsageDto ToDto(ParticipantServiceUsage u, Participant? p) => new(
        u.Id,
        u.Module,
        u.ParticipantId,
        p?.FullName,
        p?.Tckn,
        u.BranchId,
        u.BranchName,
        u.FacilityId,
        u.FacilityName,
        u.HasReceivedService,
        u.FirstServiceDate,
        u.LastServiceDate,
        u.Note,
        u.CreatedAt,
        u.UpdatedAt);

    public async Task<ParticipantServiceUsageDto?> GetAsync(string module, Guid participantId, CancellationToken ct)
    {
        await EnsureInScopeAsync(participantId, ct);
        var usage = await uow.ParticipantServiceUsages.GetAsync(module, participantId, ct);
        if (usage is null) return null;
        var participant = await uow.Participants.GetByIdAsync(participantId, ct);
        return ToDto(usage, participant);
    }

    public async Task<Dictionary<Guid, ParticipantServiceUsageDto>> GetManyAsync(
        string module, IReadOnlyCollection<Guid> participantIds, CancellationToken ct)
    {
        if (participantIds.Count == 0) return [];
        if (currentUser.Id is Guid uid)
        {
            var scopedIds = await userScope.GetScopedParticipantIdsAsync(uid, ct);
            if (scopedIds is not null)
            {
                participantIds = participantIds.Where(scopedIds.Contains).ToList();
                if (participantIds.Count == 0) return [];
            }
        }
        var usages = await uow.ParticipantServiceUsages.GetByParticipantIdsAsync(module, participantIds, ct);
        var result = new Dictionary<Guid, ParticipantServiceUsageDto>();
        foreach (var (participantId, usage) in usages)
        {
            result[participantId] = ToDto(usage, null);
        }
        return result;
    }

    public async Task<ParticipantServiceUsageDto> SetAsync(
        string module, Guid participantId, SetParticipantServiceUsageRequest req, string? actor, CancellationToken ct)
    {
        await EnsureInScopeAsync(participantId, ct);
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var existing = await uow.ParticipantServiceUsages.GetAsync(module, participantId, ct);
        if (existing is null)
        {
            var created = ParticipantServiceUsage.Create(
                module, participantId, req.BranchId, req.BranchName, req.FacilityId, req.FacilityName,
                req.HasReceivedService, req.FirstServiceDate, req.LastServiceDate, req.Note, actor);
            await uow.ParticipantServiceUsages.AddAsync(created, ct);
            await uow.SaveChangesAsync(ct);
            return ToDto(created, participant);
        }

        existing.Update(req.HasReceivedService, req.FirstServiceDate, req.LastServiceDate, req.Note, actor);
        await uow.SaveChangesAsync(ct);
        return ToDto(existing, participant);
    }

    public async Task RemoveAsync(string module, Guid participantId, string? actor, CancellationToken ct)
    {
        await EnsureInScopeAsync(participantId, ct);
        var existing = await uow.ParticipantServiceUsages.GetAsync(module, participantId, ct);
        if (existing is null) return;
        existing.MarkDeleted(actor);
        await uow.SaveChangesAsync(ct);
    }
}
