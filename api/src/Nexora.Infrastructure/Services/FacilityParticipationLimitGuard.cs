using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Infrastructure.Services;

public class FacilityParticipationLimitGuard(IUnitOfWork uow) : IFacilityParticipationLimitGuard
{
    public async Task EnsureWithinLimitAsync(string module, FacilityGroup group, Guid? participantId, string? tckn, DateTime? birthDate, Guid? excludeApplicationId, CancellationToken ct)
    {
        var normalizedTckn = string.IsNullOrWhiteSpace(tckn) ? null : tckn.Trim();
        if (!participantId.HasValue && normalizedTckn is null) return;

        var settings = await uow.FacilitySettings.GetGeneralAsync(module, ct);
        var age = birthDate.HasValue ? FacilityEligibilityRules.AgeAt(birthDate.Value, TurkeyTime.TodayDate()) : (int?)null;
        var (limitType, limitCount) = FacilityParticipationLimit.ResolveEffective(
            settings?.SettingsJson, group.AttendanceLimitOverride, group.AttendanceLimitType, group.AttendanceLimitCount, age);
        var limitWindow = FacilityParticipationLimit.Window(limitType, TurkeyTime.NowWallClock(), FacilityParticipationLimit.MonthlyResetDay(settings?.SettingsJson));
        if (limitWindow is null || limitCount <= 0) return;

        var startUtc = TurkeyTime.ToUtc(limitWindow.Value.Start);
        var endUtc = TurkeyTime.ToUtc(limitWindow.Value.End);
        var pid = participantId;

        // Katılım sayımı KİMLİK-BİRLEŞİK (ParticipantId ∪ TCKN) ve İKİ kaynağın birleşimidir:
        //   (1) başvurular (FacilityApplications, reddedilmemiş ve İPTAL EDİLMEMİŞ) — AppliedAt gerçek UTC damgası.
        //       İptal hakkı yalnız ilk seans/dönem başlangıcından ÖNCE var (CANCEL_WINDOW_PASSED), yani
        //       "cancelled" kayıt her zaman süresi içinde iptal edilmiştir → katılım sayılmaz
        //       (Event/Travel sayaçlarıyla tutarlı). "expired" (tamamlanmış üyelik) sayılmaya devam eder.
        //   (2) YALNIZ doğrudan/ önceden/ içe-aktarma ile oluşmuş, application'ı OLMAYAN kayıtlar
        //       (FacilityRegistrations, ApplicationId == null, kaldırılmamış) — CreatedAt gerçek UTC damgası.
        // ApplicationId'si OLAN kayıtlar zaten (1)'de sayıldığından burada hariç tutulur → çift sayım yok.
        // Yedekten asıla terfi mevcut kaydın Kind'ını değiştirir (yeni kayıt/başvuru yok) → ikinci katılım sayılmaz.
        var appCount = await uow.FacilityApplications.CountAsync(
            a => a.GroupId == group.Id && a.Status != FacilityApplicationStatuses.Rejected && a.Status != FacilityApplicationStatuses.Cancelled
              && ((pid != null && a.ParticipantId == pid) || (normalizedTckn != null && a.Tckn == normalizedTckn))
              && (excludeApplicationId == null || a.Id != excludeApplicationId)
              && a.AppliedAt >= startUtc && a.AppliedAt < endUtc, ct);

        var directRegCount = await uow.FacilityRegistrations.CountAsync(
            r => r.GroupId == group.Id && r.Status != "removed" && r.ApplicationId == null
              && ((pid != null && r.ParticipantId == pid) || (normalizedTckn != null && r.Tckn == normalizedTckn))
              && r.CreatedAt >= startUtc && r.CreatedAt < endUtc, ct);

        if (appCount + directRegCount >= limitCount)
            throw new ConflictException($"Bu programa bu dönemdeki katılım sınırına ({limitCount}) ulaşıldı.", "PARTICIPATION_LIMIT_REACHED");
    }
}
