using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class FacilityService(
    IUnitOfWork uow,
    ICurrentUser current,
    IUserScopeService userScope,
    IScopedStaffService scopedStaff,
    IAuditService audit,
    IFacilityGroupService groups) : IFacilityService
{
    public async Task<PagedResult<FacilityDto>> GetPagedAsync(string module, FacilityListParams p, CancellationToken ct)
    {
        var scopedRefIds = current.Id is Guid uid
            ? await userScope.GetScopedRefIdsAsync(uid, module, ct)
            : null;
        var paged = await uow.Facilities.GetPagedAsync(module, p, scopedRefIds, ct);
        var maps = await BuildMapsAsync(module, paged.Items, ct);
        return new PagedResult<FacilityDto>
        {
            Items = paged.Items.Select(f => ToDto(f, maps)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<FacilityDto> GetByIdAsync(string module, Guid id, CancellationToken ct)
    {
        var facility = await GetOwnedAsync(module, id, ct);
        var maps = await BuildMapsAsync(module, [facility], ct);
        return ToDto(facility, maps);
    }

    public async Task<List<FacilityOptionDto>> GetOptionsAsync(string module, CancellationToken ct)
    {
        var items = await uow.Facilities.GetAllByModuleAsync(module, ct);
        var scopedRefIds = current.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, module, ct) : null;
        if (scopedRefIds is not null) items = items.Where(f => scopedRefIds.Contains(f.Id)).ToList();
        return items.Select(f => new FacilityOptionDto(f.Id, f.Name, f.Kind, null, f.Capacity, f.IsActive)).ToList();
    }

    public async Task<FacilitySummaryDto> GetSummaryAsync(string module, CancellationToken ct)
    {
        // Eğitmen modül geneli istatistiği görmez; yalnız atandığı programlar sayılır.
        var instructorGroupIds = await userScope.GetInstructorGroupIdsAsync(current, module, ct);
        if (instructorGroupIds is not null)
        {
            var mine = (await uow.FacilityGroups.GetAllByModuleAsync(module, ct))
                .Where(g => instructorGroupIds.Contains(g.Id)).ToList();
            var activeMine = mine.Where(g => g.IsActive).ToList();
            var facilityIds = mine.Select(g => g.FacilityId).ToHashSet();
            var activeFacilities = (await uow.Facilities.GetAllByModuleAsync(module, ct)).Count(f => f.IsActive && facilityIds.Contains(f.Id));
            return new FacilitySummaryDto(activeFacilities, facilityIds.Count, activeMine.Count,
                activeMine.Count(g => g.Type == "kurs"), activeMine.Count(g => g.Type == "akademi"),
                activeMine.Sum(g => g.RegisteredCount), activeMine.Sum(g => g.WaitlistCount));
        }
        var (activeGroups, courses, academies) = await uow.FacilityGroups.GetGroupStatsAsync(module, ct);
        var (main, waitlist) = await uow.FacilityRegistrations.GetModuleParticipantCountsAsync(module, ct);
        var (active, total) = await uow.Facilities.GetCountsAsync(module, ct);
        return new FacilitySummaryDto(active, total, activeGroups, courses, academies, main, waitlist);
    }

    public async Task<FacilityDto> CreateAsync(string module, CreateFacilityRequest req, CancellationToken ct)
    {
        var number = await uow.Facilities.NextCodeNumberAsync(module, ct);
        var code = $"{FacilityModuleRegistry.Prefix[module]}-{number:D4}";
        // Kullanıcı isteği (2026-10-05): yeni tesis, manuel sıralama hiç kullanılmamışsa da
        // listede en sona (mevcut en yüksek SortOrder'ın +1'i) eklensin.
        var nextSortOrder = await uow.Facilities.GetMaxSortOrderAsync(module, ct) + 1;
        var facility = Facility.Create(
            new FacilityData(module, req.Name, req.Kind, req.ServiceFacilityId, req.Capacity ?? 0,
                req.ManagerId, req.ManagerName, req.ManagerRoleKey, req.ManagerRoleName,
                req.ManagerPhone, req.ManagerEmail, req.EmergencyPhone, req.IsActive),
            code, current.Name, nextSortOrder);

        await uow.Facilities.AddAsync(facility, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Facility",
            EntityId = facility.Id,
            Module = module,
            Description = $"Tesis oluşturuldu: {facility.Name} ({code})",
        }, ct);

        await GrantManagerAccessAsync(facility, req.GrantAccess, req.ManagerId, req.Manager, req.ManagerPhone, req.ManagerEmail, req.EmergencyPhone, req.RoleTemplateKey, req.Tckn, req.DeliveryChannel, ct);

        return await GetByIdAsync(module, facility.Id, ct);
    }

    public async Task<FacilityDto> UpdateAsync(string module, Guid id, UpdateFacilityRequest req, CancellationToken ct)
    {
        var facility = await GetOwnedAsync(module, id, ct);
        var oldName = facility.Name;
        facility.Update(
            new FacilityData(module, req.Name, req.Kind, req.ServiceFacilityId, req.Capacity ?? 0,
                req.ManagerId, req.ManagerName, req.ManagerRoleKey, req.ManagerRoleName,
                req.ManagerPhone, req.ManagerEmail, req.EmergencyPhone, req.IsActive),
            current.Name);

        uow.Facilities.Update(facility);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Facility",
            EntityId = facility.Id,
            Module = module,
            Description = $"Tesis güncellendi: {oldName} -> {facility.Name}",
        }, ct);

        await GrantManagerAccessAsync(facility, req.GrantAccess, req.ManagerId, req.Manager, req.ManagerPhone, req.ManagerEmail, req.EmergencyPhone, req.RoleTemplateKey, req.Tckn, req.DeliveryChannel, ct);

        return await GetByIdAsync(module, id, ct);
    }

    private async Task GrantManagerAccessAsync(
        Facility facility, bool grantAccess, Guid? managerId, string? manager,
        string? managerPhone, string? managerEmail, string? emergencyPhone,
        string? roleTemplateKey, string? tckn, string? deliveryChannel, CancellationToken ct)
    {
        if (!grantAccess || (managerId is Guid mid && mid != Guid.Empty))
            return;

        if (string.IsNullOrWhiteSpace(manager) || string.IsNullOrWhiteSpace(managerEmail))
            throw new ConflictException("Sisteme erişim verilecek kişinin adı ve e-postası zorunludur.", "STAFF_INFO_REQUIRED");

        var staff = await scopedStaff.AssignAsync(new AssignScopedStaffRequest(
            FullName: manager!,
            Tckn: tckn,
            Phone: managerPhone,
            Email: managerEmail!,
            RoleTemplateKey: string.IsNullOrWhiteSpace(roleTemplateKey) ? "tesis-sorumlusu" : roleTemplateKey!,
            ScopeModuleKey: facility.Module,
            ScopeRefId: facility.Id,
            ScopeName: facility.Name,
            ScopeType: "Facility",
            DeliveryChannel: string.IsNullOrWhiteSpace(deliveryChannel) ? "Email" : deliveryChannel!), ct);

        facility.SetManager(staff.AdminUserId, staff.FullName, staff.RoleKey, staff.RoleName, managerPhone, staff.Email, emergencyPhone);
        uow.Facilities.Update(facility);
        await uow.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(string module, Guid id, CancellationToken ct)
    {
        var facility = await GetOwnedAsync(module, id, ct);

        // Kullanıcı isteği: Tesis silinirken artık "önce grupları kaldırın" diye durmuyor —
        // bağlı TÜM gruplar (ve onların seans/başvuru içerikleri) otomatik olarak kaskad
        // silinir. Katılımcıların kayıt/kullanım hakları (FacilityRegistration) ve genel
        // ayarlar/kurallar bu işlemden etkilenmez, veritabanında geçmiş kaydı olarak kalır
        // (bkz. FacilityGroupService.DeleteAllByFacilityAsync).
        await groups.DeleteAllByFacilityAsync(module, id, ct);

        facility.MarkDeleted(current.Name);
        uow.Facilities.Update(facility);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "Facility",
            EntityId = facility.Id,
            Module = module,
            Description = $"Tesis silindi: {facility.Name}",
        }, ct);
    }

    public async Task<FacilityDto> ToggleStatusAsync(string module, Guid id, CancellationToken ct)
    {
        var facility = await GetOwnedAsync(module, id, ct);
        if (facility.IsActive) facility.Deactivate();
        else facility.Activate();

        uow.Facilities.Update(facility);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Facility",
            EntityId = facility.Id,
            Module = module,
            Description = $"Tesis durumu değişti: {facility.Name} -> {(facility.IsActive ? "Aktif" : "Pasif")}",
        }, ct);

        return await GetByIdAsync(module, id, ct);
    }

    public async Task<PagedResult<FacilityDto>> GetTrashAsync(string module, FacilityListParams p, CancellationToken ct)
    {
        var paged = await uow.Facilities.GetTrashAsync(module, p, ct);
        var maps = await BuildMapsAsync(module, paged.Items, ct);
        return new PagedResult<FacilityDto>
        {
            Items = paged.Items.Select(f => ToDto(f, maps)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<FacilityDto> RestoreAsync(string module, Guid id, CancellationToken ct)
    {
        var facility = await uow.Facilities.GetAnyByIdAsync(id, ct);
        if (facility is null || facility.Module != module)
            throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, facility.Id, ct);

        if (!facility.IsDeleted)
            throw new ConflictException("Tesis zaten arşivde değil.", "FACILITY_NOT_DELETED");

        facility.Restore();
        uow.Facilities.Update(facility);
        await uow.SaveChangesAsync(ct);

        return await GetByIdAsync(module, id, ct);
    }

    public async Task PermanentDeleteAsync(string module, Guid id, CancellationToken ct)
    {
        var facility = await uow.Facilities.GetAnyByIdAsync(id, ct);
        if (facility is null || facility.Module != module)
            throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, facility.Id, ct);

        if (!facility.IsDeleted)
            throw new ConflictException("Kalıcı silmeden önce tesis çöp kutusunda olmalıdır.", "FACILITY_NOT_IN_TRASH");

        var groups = await uow.FacilityGroups.GetByFacilityAsync(module, id, ct);
        if (groups.Count > 0)
            throw new ConflictException($"Bu tesise bağlı {groups.Count} grup olduğu için kalıcı olarak silinemez.", "FACILITY_IN_USE");

        uow.Facilities.HardRemove(facility);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "Facility",
            EntityId = facility.Id,
            Module = module,
            Description = $"Tesis kalıcı olarak silindi: {facility.Name}",
            Level = AuditLogLevel.Warning,
        }, ct);
    }

    // Kullanıcı isteği (2026-10-05): manuel sürükle-bırak sıralama — ReorderWaitlistAsync
    // (FacilityRegistrationService) ile aynı desen: gönderilen sırayla numaralandır, listede
    // olmayanları kendi mevcut sırasına göre sona ekle (eş zamanlı başka bir admin yeni tesis
    // eklemiş olabilir — o kayıp olmaz, sadece listenin sonuna düşer).
    public async Task ReorderAsync(string module, IReadOnlyList<Guid> orderedIds, CancellationToken ct)
    {
        var all = await uow.Facilities.GetAllForReorderAsync(module, ct);
        var scopedRefIds = current.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, module, ct) : null;
        if (scopedRefIds is not null) all = all.Where(f => scopedRefIds.Contains(f.Id)).ToList();

        var byId = all.ToDictionary(f => f.Id);
        var order = 1;
        foreach (var id in orderedIds)
        {
            if (!byId.TryGetValue(id, out var facility)) continue;
            facility.SetSortOrder(order++);
            uow.Facilities.Update(facility);
            byId.Remove(id);
        }
        foreach (var facility in byId.Values.OrderBy(f => f.SortOrder))
        {
            facility.SetSortOrder(order++);
            uow.Facilities.Update(facility);
        }
        await uow.SaveChangesAsync(ct);
    }

    // Yetki alanı (scope) kısıtlı bir kullanıcının, kendi liste ekranında görmediği bir
    // tesisin ID'sini biliyorsa bile işlem yapmasını engeller (IDOR önlemi).
    private async Task EnsureFacilityInScopeAsync(string module, Guid facilityId, CancellationToken ct)
    {
        if (current.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, module, ct);
        if (scopedRefIds is not null && !scopedRefIds.Contains(facilityId))
            throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
    }

    private async Task<Facility> GetOwnedAsync(string module, Guid id, CancellationToken ct)
    {
        var facility = await uow.Facilities.GetByIdAsync(id, ct);
        if (facility is null || facility.Module != module)
            throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");

        // Yetki alanı (scope) kısıtlı bir kullanıcının, kendi liste ekranında görmediği bir
        // tesisin ID'sini biliyorsa bile detayına/işlemine erişmesini engeller (IDOR önlemi).
        await EnsureFacilityInScopeAsync(module, facility.Id, ct);

        return facility;
    }

    private async Task<FacilityMaps> BuildMapsAsync(string module, IReadOnlyCollection<Facility> items, CancellationToken ct)
    {
        var ids = items.Select(f => f.Id).ToList();
        var sfIds = items.Where(f => f.ServiceFacilityId.HasValue).Select(f => f.ServiceFacilityId!.Value).Distinct().ToList();

        List<ServiceFacility> sfs = sfIds.Count > 0
            ? await uow.ServiceFacilities.FindAsync(x => sfIds.Contains(x.Id), ct)
            : new();
        Dictionary<Guid, int> groupCounts = ids.Count > 0
            ? await uow.FacilityGroups.CountActiveByFacilitiesAsync(module, ids, ct)
            : new();
        Dictionary<Guid, int> capacitySums = ids.Count > 0
            ? await uow.FacilityGroups.SumActiveCapacityByFacilitiesAsync(module, ids, ct)
            : new();
        Dictionary<Guid, int> mainCounts = ids.Count > 0
            ? await uow.FacilityRegistrations.CountActiveByFacilitiesAsync(ids, "main", ct)
            : new();
        Dictionary<Guid, int> waitCounts = ids.Count > 0
            ? await uow.FacilityRegistrations.CountActiveByFacilitiesAsync(ids, "reserve", ct)
            : new();

        var groups = ids.Count > 0
            ? (await uow.FacilityGroups.GetActiveWithInstructorByModuleAsync(module, ct)).Where(g => ids.Contains(g.FacilityId)).ToList()
            : new();
        var branchIds = groups.Select(g => g.BranchId).Distinct().ToList();
        var branchNames = branchIds.Count > 0
            ? (await uow.FacilityBranches.FindAsync(b => branchIds.Contains(b.Id), ct)).ToDictionary(b => b.Id, b => b.Name)
            : new();
        var today = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TurkeyTz).DayOfWeek;
        var groupInfo = groups.GroupBy(g => g.FacilityId).ToDictionary(g => g.Key, g => new FacilityGroupInfo(
            g.Select(x => branchNames.GetValueOrDefault(x.BranchId)).OfType<string>().Distinct().OrderBy(x => x).ToList(),
            g.Select(x => x.Gender).Distinct().OrderBy(x => x).ToList(),
            g.Sum(x => FacilityScheduleHelper.ParseSlots(x.ScheduleJson)
                .Count(s => s.Day is not null && FacilityScheduleHelper.DayMap.TryGetValue(s.Day.Trim(), out var d) && d == today)),
            g.SelectMany(x => FacilityScheduleHelper.ParseDays(x.ScheduleJson)).Select(d => (int)d).Distinct().Order().ToList()));

        return new FacilityMaps(sfs.ToDictionary(x => x.Id), groupCounts, mainCounts, capacitySums, waitCounts, groupInfo);
    }

    private static FacilityDto ToDto(Facility f, FacilityMaps m)
    {
        ServiceFacility? sf = f.ServiceFacilityId.HasValue && m.ServiceFacilities.TryGetValue(f.ServiceFacilityId.Value, out var found)
            ? found : null;

        return new FacilityDto(
            f.Id, f.Module, f.Code, f.Name, f.Kind,
            f.ServiceFacilityId, sf?.Name, sf?.District, sf?.Address,
            f.Capacity, f.ManagerId, f.ManagerName, f.ManagerRoleKey, f.ManagerRoleName,
            f.ManagerPhone, f.ManagerEmail, f.EmergencyPhone,
            m.GroupCounts.GetValueOrDefault(f.Id),
            m.MainCounts.GetValueOrDefault(f.Id),
            m.CapacitySums.GetValueOrDefault(f.Id),
            m.WaitCounts.GetValueOrDefault(f.Id),
            f.IsActive, f.CreatedAt, f.DeletedAt, f.DeletedBy,
            Branches: m.GroupInfo.GetValueOrDefault(f.Id)?.Branches ?? [],
            Genders: m.GroupInfo.GetValueOrDefault(f.Id)?.Genders ?? [],
            TodaySessionCount: m.GroupInfo.GetValueOrDefault(f.Id)?.TodaySessions ?? 0,
            SessionDays: m.GroupInfo.GetValueOrDefault(f.Id)?.SessionDays ?? [],
            UpdatedAt: f.UpdatedAt ?? f.CreatedAt);
    }

    private static readonly TimeZoneInfo TurkeyTz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    private record FacilityGroupInfo(List<string> Branches, List<string> Genders, int TodaySessions, List<int> SessionDays);

    private record FacilityMaps(
        Dictionary<Guid, ServiceFacility> ServiceFacilities,
        Dictionary<Guid, int> GroupCounts,
        Dictionary<Guid, int> MainCounts,
        Dictionary<Guid, int> CapacitySums,
        Dictionary<Guid, int> WaitCounts,
        Dictionary<Guid, FacilityGroupInfo> GroupInfo);
}
