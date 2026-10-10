using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Services.Travels;

public static class TravelChildLimitGuard
{
    public static bool IsMinor(Participant participant)
        => AgeOf(participant.BirthDate) < 18;

    public static async Task<Guid> ResolveGuardianIdAsync(IUnitOfWork uow, Participant main, CancellationToken ct)
    {
        if (!IsMinor(main)) return main.Id;
        var links = await uow.Participants.GetGuardianLinksAsync(main.Id, ct);
        return links.FirstOrDefault()?.GuardianId ?? main.Id;
    }

    public static async Task EnsureAsync(
        IUnitOfWork uow,
        Travel travel,
        Guid guardianId,
        IReadOnlyCollection<Guid> minorIdsBeingAdded,
        IReadOnlyCollection<Guid> excludeApplicationIds,
        CancellationToken ct)
    {
        if (minorIdsBeingAdded.Count == 0) return;
        if (!TravelRestrictionRules.AllowChildren(travel.RestrictionsJson)) return;

        var max = TravelRestrictionRules.MaxChildren(travel.RestrictionsJson);
        if (max >= TravelRestrictionRules.UnlimitedChildren) return;

        var newCount = minorIdsBeingAdded.Distinct().Count();

        var guardianChildIds = (await uow.Participants.GetChildrenAsync(guardianId, ct))
            .Select(c => c.Id)
            .ToList();
        var existing = await uow.TravelApplications.CountActiveChildrenOnTravelAsync(
            travel.Id, guardianChildIds, excludeApplicationIds, ct);

        if (existing + newCount > max)
            throw new ConflictException(
                existing > 0
                    ? $"Bu geziye en fazla {max} çocuk getirebilirsiniz. Bu veliye ait {existing} çocuk zaten kayıtlı."
                    : $"Bu geziye en fazla {max} çocuk getirebilirsiniz.",
                "CHILD_LIMIT");
    }

    private static int AgeOf(DateTime birthDate)
    {
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }
}
