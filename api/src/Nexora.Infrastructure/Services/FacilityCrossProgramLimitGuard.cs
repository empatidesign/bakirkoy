using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Domain.Common;

namespace Nexora.Infrastructure.Services;

// Kullanıcı isteği (2026-10-05, Kadın ve Aile Merkezi): "aşçılık" gibi bir programa bir tesiste
// aktif başvurusu/kaydı olan kişi, AYNI programa FARKLI bir tesiste tekrar başvuramasın —
// "pastacılık" gibi FARKLI bir programa (aynı veya başka tesiste) serbestçe başvurabilsin. Ayrıca
// modül genelinde (tüm program/tesis toplamı) bir takvim yılında en fazla N başvuru hakkı olsun.
// FacilityParticipationLimitGuard'daki sayım deseniyle aynı: kimlik-birleşik (ParticipantId ∪ TCKN),
// "aktif" tanımı FacilityApplicationStatuses.IsActive ile tek kaynaktan (rejected/expired/cancelled
// hariç), kendi rezervasyonu (yedek→asıl terfi, excludeApplicationId) ikinci kez sayılmaz.
public class FacilityCrossProgramLimitGuard(IUnitOfWork uow) : IFacilityCrossProgramLimitGuard
{
    public async Task EnsureAllowedAsync(string module, Guid branchId, Guid facilityId, Guid? participantId, string? tckn, Guid? excludeApplicationId, CancellationToken ct)
    {
        var normalizedTckn = string.IsNullOrWhiteSpace(tckn) ? null : tckn.Trim();
        if (!participantId.HasValue && normalizedTckn is null) return;

        var settings = await uow.FacilitySettings.GetGeneralAsync(module, ct);
        var rule = FacilityCrossProgramRule.Parse(settings?.SettingsJson);
        if (!rule.SameBranchCrossFacilityBlocked && rule.YearlyMaxApplicationsTotal <= 0 && !rule.SameCategoryBlocked) return;

        var currentYear = TurkeyTime.TodayDate().Year;
        var pid = participantId;
        var identityApps = await uow.FacilityApplications.FindAsync(
            a => !a.IsDeleted && a.Module == module
              && a.AppliedAt.Year == currentYear
              && ((pid != null && a.ParticipantId == pid) || (normalizedTckn != null && a.Tckn == normalizedTckn))
              && (excludeApplicationId == null || a.Id != excludeApplicationId), ct);

        // K01/V06/Y05 deseniyle aynı: admin "doğrudan kayıt" / toplu ön-kayıt yolu (FacilityRegistrationService)
        // FacilityApplication satırı OLUŞTURMAZ — bu yüzden ApplicationId==null olan kayıtlar da ayrıca
        // sayılmalı (ApplicationId'si OLAN kayıtlar zaten yukarıda application üzerinden sayıldığından
        // burada hariç tutulur → çift sayım yok).
        // Geçmiş yılda (örn. 2025) yapılmış hiçbir faaliyet aktif yılı (2026) engellemez.
        var directRegs = await uow.FacilityRegistrations.FindAsync(
            r => !r.IsDeleted && r.Module == module && r.ApplicationId == null && r.Status != "removed"
              && r.CreatedAt.Year == currentYear
              && ((pid != null && r.ParticipantId == pid) || (normalizedTckn != null && r.Tckn == normalizedTckn)), ct);

        var targetBranch = await uow.FacilityBranches.GetByIdAsync(branchId, ct);
        var targetName = targetBranch?.Name?.Trim();
        var targetCategory = targetBranch?.Category?.Trim();
        var maxAllowed = rule.YearlyMaxApplicationsTotal > 0 ? rule.YearlyMaxApplicationsTotal : 2;

        if (rule.SameBranchCrossFacilityBlocked)
        {
            var activeAppBranchIds = identityApps
                .Where(a => FacilityApplicationStatuses.IsActive(a.Status) && a.AppliedAt.Year == currentYear)
                .Select(a => a.BranchId)
                .ToHashSet();

            var activeRegBranchIds = directRegs
                .Where(r => r.CreatedAt.Year == currentYear)
                .Select(r => r.BranchId)
                .ToHashSet();

            var allActiveBranchIds = activeAppBranchIds.Union(activeRegBranchIds).ToList();

            var sameBranchActive = allActiveBranchIds.Contains(branchId);
            if (!sameBranchActive && !string.IsNullOrEmpty(targetName) && allActiveBranchIds.Count > 0)
            {
                var existingBranches = await uow.FacilityBranches.FindAsync(b => allActiveBranchIds.Contains(b.Id), ct);
                sameBranchActive = existingBranches.Any(b => string.Equals(b.Name?.Trim(), targetName, StringComparison.OrdinalIgnoreCase));
            }

            if (sameBranchActive)
            {
                throw new ConflictException(
                    $"Daha önce bu programa (\"{(targetName ?? "Seçilen Kurs")}\") başvurunuz/kaydınız bulunmaktadır. Bir dönemde en fazla {maxAllowed} farklı kursa başvurabilirsiniz.",
                    "CROSS_FACILITY_SAME_BRANCH_BLOCKED");
            }

            if (rule.SameCategoryBlocked && !string.IsNullOrEmpty(targetCategory) && allActiveBranchIds.Count > 0)
            {
                var existingBranches = await uow.FacilityBranches.FindAsync(b => allActiveBranchIds.Contains(b.Id), ct);
                var sameCategoryBranch = existingBranches.FirstOrDefault(b =>
                    !string.IsNullOrWhiteSpace(b.Category) &&
                    string.Equals(b.Category.Trim(), targetCategory, StringComparison.OrdinalIgnoreCase));

                if (sameCategoryBranch != null)
                {
                    throw new ConflictException(
                        $"Daha önce aynı kategorideki (\"{targetCategory}\" - {sameCategoryBranch.Name}) bir kursa başvurunuz/kaydınız bulunmaktadır. Bir dönemde en fazla {maxAllowed} farklı kursa başvurabilirsiniz.",
                        "CROSS_FACILITY_SAME_CATEGORY_BLOCKED");
                }
            }
        }

        if (rule.YearlyMaxApplicationsTotal > 0)
        {
            var yearlyCount = identityApps.Count(a =>
                FacilityApplicationStatuses.IsActive(a.Status) && a.AppliedAt.Year == currentYear);
            yearlyCount += directRegs.Count(r => r.CreatedAt.Year == currentYear);
            if (yearlyCount >= rule.YearlyMaxApplicationsTotal)
            {
                throw new ConflictException(
                    $"Bu dönem için izin verilen maksimum kurs başvuru hakkınıza ({rule.YearlyMaxApplicationsTotal}) ulaştınız. Bir dönemde en fazla {rule.YearlyMaxApplicationsTotal} farklı kursa başvurabilirsiniz.",
                    "CROSS_FACILITY_YEARLY_QUOTA_FULL");
            }
        }
    }
}
