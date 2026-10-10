using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class FacilityGroupService(IUnitOfWork uow, ICurrentUser current, IFacilitySessionService sessions, IScopedStaffService scopedStaff, IAuditService audit, IUserScopeService userScope) : IFacilityGroupService
{
    public async Task<PagedResult<FacilityGroupDto>> GetPagedAsync(string module, FacilityGroupListParams p, CancellationToken ct)
    {
        var scopedRefIds = current.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, module, ct) : null;
        var instructorGroupIds = await userScope.GetInstructorGroupIdsAsync(current, module, ct);
        var paged = await uow.FacilityGroups.GetPagedAsync(module, p, scopedRefIds, ct, instructorGroupIds);
        var names = await BuildNamesAsync(paged.Items, ct);
        return new PagedResult<FacilityGroupDto>
        {
            Items = paged.Items.Select(g => ToDto(g, names)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<FacilityGroupDto> GetByIdAsync(string module, Guid id, CancellationToken ct)
    {
        var group = await GetOwnedAsync(module, id, ct);
        var names = await BuildNamesAsync([group], ct);
        return ToDto(group, names);
    }

    public async Task<List<FacilityGroupOptionDto>> GetOptionsAsync(string module, Guid? facilityId, CancellationToken ct)
    {
        var groups = facilityId.HasValue
            ? await uow.FacilityGroups.FindAsync(g => g.Module == module && g.FacilityId == facilityId.Value && g.IsActive && g.ParentGroupId != null, ct)
            : await uow.FacilityGroups.FindAsync(g => g.Module == module && g.IsActive && g.ParentGroupId != null, ct);

        var instructorGroupIds = await userScope.GetInstructorGroupIdsAsync(current, module, ct);
        return groups.Where(g => instructorGroupIds is null || instructorGroupIds.Contains(g.Id)).OrderBy(g => g.Name)
            .Select(g => new FacilityGroupOptionDto(g.Id, g.Name, g.FacilityId, g.BranchId, g.Capacity, g.ReserveCapacity))
            .ToList();
    }

    public async Task<FacilityGroupDto> CreateAsync(string module, CreateFacilityGroupRequest req, CancellationToken ct)
    {
        var facility = await EnsureFacilityAndBranchAsync(module, req.FacilityId, req.BranchId, true, ct);

        if (req.ParentGroupId.HasValue)
        {
            var parent = await uow.FacilityGroups.GetByIdAsync(req.ParentGroupId.Value, ct);
            if (parent is null || parent.Module != module)
                throw new NotFoundException("Ana grup bulunamadı.", "PARENT_GROUP_NOT_FOUND");
            if (parent.ParentGroupId.HasValue)
                throw new ConflictException("Alt gruba alt grup eklenemez.", "NESTED_SUBGROUP_NOT_ALLOWED");
        }

        EnsureCapacityWithinFacility(req.Capacity, facility);
        var periodEnd = ResolvePeriodEnd(req.PeriodType, req.PeriodEnd, req.PeriodStart, req.PeriodMonths, req.PeriodCount, req.PeriodUnit, req.PeriodDays);

        var (instructorId, instructorName) = await ResolveInstructorAsync(module, req.InstructorId, ct);
        // Kullanıcı isteği (2026-10-05): yeni grup/seans manuel sıralama hiç kullanılmamışsa da
        // kendi kapsamında (tesis + üst grup) listenin en sonuna eklensin.
        var nextSortOrder = await uow.FacilityGroups.GetMaxSortOrderAsync(req.FacilityId, req.ParentGroupId, ct) + 1;
        var group = FacilityGroup.Create(
            ToData(module, req.FacilityId, req.BranchId, req.ParentGroupId, req.Name, req.Description, req.Type, req.Gender, req.Capacity, req.ReserveCapacity,
                req.AgeMin, req.AgeMax, req.Schedule, req.AttendanceMode, req.Fee, req.Conditions,
                req.PeriodStart, periodEnd, req.AbsenceLimit, req.ConsecutiveAbsenceLimit, req.EntryGraceMinutes, instructorId, instructorName, req.IsActive,
                req.PeriodType, req.PeriodCount, req.ApplicationStartDate, req.ApplicationEndDate, req.AcademyWhitelistEnabled, req.AutoApprove, req.AttendanceLimitOverride, req.AttendanceLimitType, req.AttendanceLimitCount, req.PeriodMonths, req.PeriodUnit, req.PeriodDays, req.ResidencyMode, req.LateTrackingEnabled),
            current.Name, nextSortOrder);

        await uow.FacilityGroups.AddAsync(group, ct);
        await uow.SaveChangesAsync(ct);
        await GrantInstructorScopeAsync(module, instructorId, facility, ct);

        if (req.ParentGroupId.HasValue)
            await sessions.GenerateIfEligibleAsync(module, group.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "FacilityGroup",
            EntityId = group.Id,
            Module = module,
            Description = $"Grup oluşturuldu: {group.Name}",
        }, ct);

        return await GetByIdAsync(module, group.Id, ct);
    }

    public async Task<FacilityGroupDto> CreateSubGroupAsync(string module, CreateSubGroupRequest req, CancellationToken ct)
    {
        var parent = await uow.FacilityGroups.GetByIdAsync(req.ParentGroupId, ct);
        if (parent is null || parent.Module != module)
            throw new NotFoundException("Ana grup bulunamadı.", "PARENT_GROUP_NOT_FOUND");
        if (parent.ParentGroupId.HasValue)
            throw new ConflictException("Alt gruba alt grup eklenemez.", "NESTED_SUBGROUP_NOT_ALLOWED");

        var facility = await EnsureFacilityAndBranchAsync(module, parent.FacilityId, parent.BranchId, false, ct);
        EnsureCapacityWithinFacility(req.Capacity, facility);
        var periodEnd = ResolvePeriodEnd(req.PeriodType ?? parent.PeriodType, req.PeriodEnd, req.PeriodStart, req.PeriodMonths, req.PeriodCount ?? parent.PeriodCount, req.PeriodUnit ?? parent.PeriodUnit, req.PeriodDays ?? parent.PeriodDays);

        var (instructorId, instructorName) = await ResolveInstructorAsync(module, req.InstructorId, ct);
        var nextSortOrder = await uow.FacilityGroups.GetMaxSortOrderAsync(parent.FacilityId, req.ParentGroupId, ct) + 1;
        var group = FacilityGroup.Create(
            ToData(module, parent.FacilityId, parent.BranchId, req.ParentGroupId, req.Name, req.Description, parent.Type, req.Gender, req.Capacity, req.ReserveCapacity,
                req.AgeMin, req.AgeMax, req.Schedule, req.AttendanceMode, req.Fee, req.Conditions,
                req.PeriodStart, periodEnd, req.AbsenceLimit, req.ConsecutiveAbsenceLimit, req.EntryGraceMinutes, instructorId, instructorName, req.IsActive,
                req.PeriodType ?? parent.PeriodType, req.PeriodCount ?? parent.PeriodCount, req.ApplicationStartDate, req.ApplicationEndDate, parent.AcademyWhitelistEnabled, req.AutoApprove, req.AttendanceLimitOverride, req.AttendanceLimitType, req.AttendanceLimitCount, req.PeriodMonths, req.PeriodUnit ?? parent.PeriodUnit, req.PeriodDays ?? parent.PeriodDays, req.ResidencyMode ?? parent.ResidencyMode, req.LateTrackingEnabled),
            current.Name, nextSortOrder);

        await uow.FacilityGroups.AddAsync(group, ct);
        await uow.SaveChangesAsync(ct);
        await sessions.GenerateIfEligibleAsync(module, group.Id, ct);
        await GrantInstructorScopeAsync(module, instructorId, facility, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "FacilityGroup",
            EntityId = group.Id,
            Module = module,
            Description = $"Alt grup oluşturuldu: {group.Name} (ana grup: {parent.Name})",
        }, ct);

        return await GetByIdAsync(module, group.Id, ct);
    }

    // Kullanıcı isteği (2026-10-01): aynı grup/seans (isim, tür, cinsiyet, yaş aralığı,
    // gün/saat programı, dönem, kontenjan, evrak/katılım şartları vb.) başka tesis(ler)de de
    // aynı gün/saatte yürütülebiliyor. Her tesiste elle yeniden girmek yerine admin kaynak
    // kaydı hedef tesis(ler)e tek seferde kopyalayabilir. Kopyalar güvenlik için her zaman
    // PASİF oluşur (facility-exhaustive-form.spec.ts / sıfır-hata ilkesiyle uyumlu: pasif bir
    // kayıt aktive edilene kadar seans üretmez, kontenjan/branş doğru değilse yanlışlıkla
    // katılımcı almaz) — admin hedef tesiste gözden geçirip aktive eder. Ana gruplar (alt
    // grubu olan konteynerler) VE doğrudan seans niteliğindeki yaprak gruplar (kendi
    // kontenjanı/programı olan) aynı mantıkla kopyalanabilir; alt gruplar (ParentGroupId
    // dolu) kopyalanamaz çünkü tek başlarına anlamsızdır — önce ana grupları kopyalanmalı.
    public async Task<CopyFacilityGroupResult> CopyAsync(string module, Guid id, CopyFacilityGroupRequest req, CancellationToken ct)
    {
        var source = await GetOwnedAsync(module, id, ct);
        if (source.ParentGroupId.HasValue)
            throw new ConflictException("Alt gruplar/seanslar doğrudan kopyalanamaz; lütfen ana grubu kopyalayın.", "SUBGROUP_COPY_NOT_ALLOWED");

        var targetIds = (req.TargetFacilityIds ?? []).Distinct().ToList();
        if (targetIds.Count == 0)
            throw new ConflictException("En az bir hedef tesis seçilmelidir.", "COPY_TARGETS_EMPTY");

        var branch = await uow.FacilityBranches.GetByIdAsync(source.BranchId, ct);
        if (branch is null || branch.Module != module)
            throw new NotFoundException("Program bulunamadı.", "BRANCH_NOT_FOUND");
        var instructorName = source.InstructorId.HasValue
            ? await ResolveInstructorNameAsync(module, source.InstructorId, ct)
            : null;

        var results = new List<CopyFacilityGroupItemResult>();
        foreach (var targetFacilityId in targetIds)
        {
            var facility = await uow.Facilities.GetByIdAsync(targetFacilityId, ct);
            if (facility is null || facility.Module != module)
            {
                results.Add(new CopyFacilityGroupItemResult(targetFacilityId, "—", false, null, "Tesis bulunamadı."));
                continue;
            }
            try
            {
                await EnsureFacilityInScopeAsync(module, targetFacilityId, ct);
            }
            catch (ForbiddenException)
            {
                results.Add(new CopyFacilityGroupItemResult(targetFacilityId, facility.Name, false, null, "Bu tesise kopyalama yetkiniz yok."));
                continue;
            }

            try
            {
                EnsureCapacityWithinFacility(source.Capacity, facility);
                var children = req.IncludeSubGroups
                    ? await uow.FacilityGroups.FindAsync(g => g.Module == module && g.ParentGroupId == source.Id, ct)
                    : [];
                foreach (var child in children) EnsureCapacityWithinFacility(child.Capacity, facility);

                var copyName = string.IsNullOrWhiteSpace(req.Name) ? $"{source.Name} (Kopya)" : req.Name.Trim();
                var copy = CloneGroup(module, source, targetFacilityId, null, copyName, req.IncludeContent, instructorName);
                await uow.FacilityGroups.AddAsync(copy, ct);

                foreach (var child in children)
                {
                    var childInstructor = child.InstructorId.HasValue ? await ResolveInstructorNameAsync(module, child.InstructorId, ct) : null;
                    await uow.FacilityGroups.AddAsync(CloneGroup(module, child, targetFacilityId, copy.Id, child.Name, req.IncludeContent, childInstructor), ct);
                }

                await uow.SaveChangesAsync(ct);

                await audit.LogAsync(new AuditEntry
                {
                    Action = AuditAction.Create,
                    EntityType = "FacilityGroup",
                    EntityId = copy.Id,
                    Module = module,
                    Description = $"Grup kopyalandı: {copy.Name} (kaynak: {source.Name}, hedef tesis: {facility.Name})",
                }, ct);

                results.Add(new CopyFacilityGroupItemResult(targetFacilityId, facility.Name, true, copy.Id, null));
            }
            catch (Exception ex) when (ex is ConflictException or NotFoundException)
            {
                results.Add(new CopyFacilityGroupItemResult(targetFacilityId, facility.Name, false, null, ex.Message));
            }
        }

        return new CopyFacilityGroupResult(results);
    }

    private static readonly string[] ContentKeys = ["aboutHtml", "requirements", "applicationConditions", "imageUrl", "images"];

    private FacilityGroup CloneGroup(string module, FacilityGroup source, Guid facilityId, Guid? parentId, string name, bool includeContent, string? instructorName)
    {
        var conditions = string.IsNullOrWhiteSpace(source.ConditionsJson) ? "{}" : source.ConditionsJson;
        if (!includeContent && System.Text.Json.Nodes.JsonNode.Parse(conditions) is System.Text.Json.Nodes.JsonObject obj)
        {
            foreach (var key in ContentKeys) obj.Remove(key);
            conditions = obj.ToJsonString();
        }
        var clone = FacilityGroup.Create(
            ToData(module, facilityId, source.BranchId, parentId, name, source.Description, source.Type, source.Gender,
                source.Capacity, source.ReserveCapacity, source.AgeMin, source.AgeMax,
                JsonSerializer.Deserialize<JsonElement>(string.IsNullOrWhiteSpace(source.ScheduleJson) ? "[]" : source.ScheduleJson),
                source.AttendanceMode,
                JsonSerializer.Deserialize<JsonElement>(string.IsNullOrWhiteSpace(source.FeeJson) ? "{}" : source.FeeJson),
                JsonSerializer.Deserialize<JsonElement>(conditions),
                source.PeriodStart, source.PeriodEnd, source.AbsenceLimit, source.ConsecutiveAbsenceLimit, source.EntryGraceMinutes,
                source.InstructorId, instructorName, false,
                source.PeriodType, source.PeriodCount, source.ApplicationStartDate, source.ApplicationEndDate, source.AcademyWhitelistEnabled,
                source.AutoApprove, source.AttendanceLimitOverride, source.AttendanceLimitType, source.AttendanceLimitCount, source.PeriodMonths,
                source.PeriodUnit, source.PeriodDays, source.ResidencyMode, source.LateTrackingEnabled),
            current.Name);
        clone.SetAcademyWhitelist(source.AcademyWhitelistTcknsJson);
        return clone;
    }

    public async Task<FacilityGroupDto> UpdateAsync(string module, Guid id, UpdateFacilityGroupRequest req, bool confirmAttendanceDeletion, CancellationToken ct)
    {
        var group = await GetOwnedAsync(module, id, ct);
        var facility = await EnsureFacilityAndBranchAsync(module, req.FacilityId, req.BranchId, false, ct);
        EnsureCapacityWithinFacility(req.Capacity, facility);

        if (req.ReserveCapacity < group.ReserveCapacity)
        {
            var activeReserves = await uow.FacilityRegistrations.CountAsync(r => r.GroupId == id && r.Kind == "reserve" && r.Status == "active", ct);
            if (req.ReserveCapacity < activeReserves)
                throw new ConflictException($"Bu grupta {activeReserves} aktif yedek kayıt var; yedek kontenjanı {activeReserves} altına düşürülemez. Önce yedek kayıtları azaltın.", "RESERVE_CAPACITY_BELOW_WAITLIST");
        }

        if (req.ParentGroupId.HasValue)
        {
            if (req.ParentGroupId.Value == id)
                throw new ConflictException("Bir grup kendi üst grubu olamaz.", "SELF_PARENT_NOT_ALLOWED");
            var parent = await uow.FacilityGroups.GetByIdAsync(req.ParentGroupId.Value, ct);
            if (parent is null || parent.Module != module)
                throw new NotFoundException("Ana grup bulunamadı.", "PARENT_GROUP_NOT_FOUND");
            if (parent.ParentGroupId.HasValue)
                throw new ConflictException("Alt gruba alt grup eklenemez.", "NESTED_SUBGROUP_NOT_ALLOWED");
        }

        var periodEnd = ResolvePeriodEnd(req.PeriodType, req.PeriodEnd, req.PeriodStart, req.PeriodMonths, req.PeriodCount, req.PeriodUnit, req.PeriodDays);

        var (instructorId, instructorName) = await ResolveInstructorAsync(module, req.InstructorId, ct);
        group.Update(
            ToData(module, req.FacilityId, req.BranchId, req.ParentGroupId, req.Name, req.Description, req.Type, req.Gender, req.Capacity, req.ReserveCapacity,
                req.AgeMin, req.AgeMax, req.Schedule, req.AttendanceMode, req.Fee, req.Conditions,
                req.PeriodStart, periodEnd, req.AbsenceLimit, req.ConsecutiveAbsenceLimit, req.EntryGraceMinutes, instructorId, instructorName, req.IsActive,
                req.PeriodType, req.PeriodCount, req.ApplicationStartDate, req.ApplicationEndDate, req.AcademyWhitelistEnabled, req.AutoApprove, req.AttendanceLimitOverride, req.AttendanceLimitType, req.AttendanceLimitCount, req.PeriodMonths, req.PeriodUnit, req.PeriodDays, req.ResidencyMode, req.LateTrackingEnabled),
            current.Name);

        await uow.BeginTransactionAsync(ct);
        ScheduleSyncResult syncResult;
        try
        {
            uow.FacilityGroups.Update(group);
            await uow.SaveChangesAsync(ct);
            await GrantInstructorScopeAsync(module, instructorId, facility, ct);
            syncResult = await sessions.SyncAfterScheduleChangeAsync(module, id, confirmAttendanceDeletion, ct);
            await sessions.GenerateIfEligibleAsync(module, id, ct);

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Update,
                EntityType = "FacilityGroup",
                EntityId = group.Id,
                Module = module,
                Description = syncResult.RemovedEmptySessions > 0 || syncResult.ProtectedAttendanceSessions > 0 || syncResult.ProtectedApplicationSessions > 0
                    ? $"Grup güncellendi: {group.Name} (program değişikliği: {syncResult.RemovedEmptySessions} seans senkronize edildi, {syncResult.ProtectedAttendanceSessions} yoklamalı seans yeniden oluşturuldu, {syncResult.ProtectedApplicationSessions} seans aktif başvuru/kayıt nedeniyle korundu)"
                    : $"Grup güncellendi: {group.Name}",
            }, ct);

            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        var result = await GetByIdAsync(module, id, ct);
        return result with { ScheduleSync = syncResult };
    }

    private async Task GrantInstructorScopeAsync(string module, Guid? instructorId, Facility facility, CancellationToken ct)
    {
        if (!instructorId.HasValue) return;
        var instructor = await uow.FacilityInstructors.GetByIdAsync(instructorId.Value, ct);
        if (instructor?.UserId is not Guid userId) return;
        await scopedStaff.AddScopeAsync(userId, module, facility.Id, facility.Name, "Facility", ct);
    }

    public async Task DeleteAsync(string module, Guid id, CancellationToken ct)
    {
        var group = await GetOwnedAsync(module, id, ct);

        if (!group.ParentGroupId.HasValue)
        {
            var subGroups = await uow.FacilityGroups.FindAsync(g => g.Module == module && g.ParentGroupId == id, ct);
            if (subGroups.Count > 0)
                throw new ConflictException($"Bu ana gruba bağlı {subGroups.Count} alt grup olduğu için silinemez.", "PARENT_GROUP_HAS_CHILDREN");
        }

        var (main, waitlist) = await uow.FacilityRegistrations.GetCountsByGroupAsync(id, ct);
        if (main + waitlist > 0)
            throw new ConflictException($"Bu grupta {main + waitlist} kayıtlı kişi olduğu için silinemez.", "GROUP_IN_USE");

        await uow.BeginTransactionAsync(ct);
        try
        {
            var orphanCount = await DeleteGroupCoreAsync(module, group, ct);
            await uow.CommitAsync(ct);
            await LogGroupDeletedAsync(module, group, orphanCount, ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }
    }

    public async Task DeleteAllByFacilityAsync(string module, Guid facilityId, CancellationToken ct)
    {
        var groups = await uow.FacilityGroups.GetByFacilityAsync(module, facilityId, ct);
        if (groups.Count == 0) return;

        await uow.BeginTransactionAsync(ct);
        try
        {
            var results = new List<(FacilityGroup Group, int OrphanCount)>();
            foreach (var group in groups)
            {
                var orphanCount = await DeleteGroupCoreAsync(module, group, ct);
                results.Add((group, orphanCount));
            }
            await uow.CommitAsync(ct);

            foreach (var (group, orphanCount) in results)
                await LogGroupDeletedAsync(module, group, orphanCount, ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }
    }

    private async Task<int> DeleteGroupCoreAsync(string module, FacilityGroup group, CancellationToken ct)
    {
        var groupSessions = await uow.FacilitySessions.GetByGroupAsync(group.Id, ct);

        var orphanApplications = await uow.FacilityApplications.FindAsync(
            a => a.GroupId == group.Id && (a.Status == "approved" || a.Status == "waitlist" || a.Status == "pending"), ct);

        if (groupSessions.Count > 0)
            uow.FacilitySessions.DeleteRange(groupSessions);
        foreach (var app in orphanApplications)
        {
            app.Reject("Grup silindiği için başvuru otomatik olarak kapatıldı.", current.Name);
            uow.FacilityApplications.Update(app);
        }
        group.MarkDeleted(current.Name);
        uow.FacilityGroups.Update(group);
        await uow.SaveChangesAsync(ct);

        return orphanApplications.Count;
    }

    private async Task LogGroupDeletedAsync(string module, FacilityGroup group, int orphanCount, CancellationToken ct)
    {
        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "FacilityGroup",
            EntityId = group.Id,
            Module = module,
            Description = orphanCount > 0
                ? $"Grup silindi: {group.Name} ({orphanCount} başvuru otomatik olarak reddedildi)"
                : $"Grup silindi: {group.Name}",
        }, ct);
    }

    public async Task<FacilityGroupDto> ToggleStatusAsync(string module, Guid id, CancellationToken ct)
    {
        var group = await GetOwnedAsync(module, id, ct);
        if (group.IsActive) group.Deactivate();
        else group.Activate();

        uow.FacilityGroups.Update(group);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "FacilityGroup",
            EntityId = group.Id,
            Module = module,
            Description = group.IsActive
                ? $"Grup aktifleştirildi: {group.Name}"
                : $"Grup pasifleştirildi: {group.Name}",
        }, ct);

        return await GetByIdAsync(module, id, ct);
    }

    public async Task<IReadOnlyList<string>> GetAcademyWhitelistAsync(string module, Guid id, CancellationToken ct)
    {
        var group = await GetOwnedAsync(module, id, ct);
        return FacilityAcademyWhitelist.Parse(group.AcademyWhitelistTcknsJson);
    }

    public async Task SetAcademyWhitelistAsync(string module, Guid id, IReadOnlyList<string> tckns, CancellationToken ct)
    {
        var group = await GetOwnedAsync(module, id, ct);
        var clean = (tckns ?? [])
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .Distinct()
            .ToList();
        group.SetAcademyWhitelist(JsonSerializer.Serialize(clean));
        uow.FacilityGroups.Update(group);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<FacilityGroupDto>> GetTrashAsync(string module, FacilityGroupListParams p, CancellationToken ct)
    {
        var paged = await uow.FacilityGroups.GetTrashAsync(module, p, ct);
        var names = await BuildNamesAsync(paged.Items, ct);
        return new PagedResult<FacilityGroupDto>
        {
            Items = paged.Items.Select(g => ToDto(g, names)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<FacilityGroupDto> RestoreAsync(string module, Guid id, CancellationToken ct)
    {
        var group = await uow.FacilityGroups.GetAnyByIdAsync(id, ct);
        if (group is null || group.Module != module)
            throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, group.FacilityId, ct);

        if (!group.IsDeleted)
            throw new ConflictException("Grup zaten arşivde değil.", "GROUP_NOT_DELETED");

        group.Restore();
        uow.FacilityGroups.Update(group);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "FacilityGroup",
            EntityId = group.Id,
            Module = module,
            Description = $"Grup arşivden geri alındı: {group.Name}",
        }, ct);

        return await GetByIdAsync(module, id, ct);
    }

    public async Task PermanentDeleteAsync(string module, Guid id, CancellationToken ct)
    {
        var group = await uow.FacilityGroups.GetAnyByIdAsync(id, ct);
        if (group is null || group.Module != module)
            throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, group.FacilityId, ct);

        if (!group.IsDeleted)
            throw new ConflictException("Kalıcı silmeden önce grup çöp kutusunda olmalıdır.", "GROUP_NOT_IN_TRASH");

        uow.FacilityGroups.HardRemove(group);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "FacilityGroup",
            EntityId = id,
            Module = module,
            Description = $"Grup kalıcı olarak silindi: {group.Name}",
        }, ct);
    }

    // Kullanıcı isteği (2026-10-05): grup/seans manuel sürükle-bırak sıralama. parentGroupId
    // null ise ana gruplar, doluysa o grubun seansları kapsamında bağımsız sıralama yapılır.
    public async Task ReorderAsync(string module, Guid facilityId, Guid? parentGroupId, IReadOnlyList<Guid> orderedIds, CancellationToken ct)
    {
        await EnsureFacilityInScopeAsync(module, facilityId, ct);
        var all = await uow.FacilityGroups.GetAllForReorderAsync(facilityId, parentGroupId, ct);
        var byId = all.Where(g => g.Module == module).ToDictionary(g => g.Id);

        var order = 1;
        foreach (var id in orderedIds)
        {
            if (!byId.TryGetValue(id, out var group)) continue;
            group.SetSortOrder(order++);
            uow.FacilityGroups.Update(group);
            byId.Remove(id);
        }
        foreach (var group in byId.Values.OrderBy(g => g.SortOrder))
        {
            group.SetSortOrder(order++);
            uow.FacilityGroups.Update(group);
        }
        await uow.SaveChangesAsync(ct);
    }

    private async Task<Facility> EnsureFacilityAndBranchAsync(string module, Guid facilityId, Guid branchId, bool enforceActive, CancellationToken ct)
    {
        var facility = await uow.Facilities.GetByIdAsync(facilityId, ct);
        if (facility is null || facility.Module != module)
            throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, facilityId, ct);
        if (enforceActive && !facility.IsActive)
            throw new ConflictException("Pasif tesise yeni grup eklenemez.", "FACILITY_INACTIVE");
        var branch = await uow.FacilityBranches.GetByIdAsync(branchId, ct);
        if (branch is null || branch.Module != module)
            throw new NotFoundException("Program bulunamadı.", "BRANCH_NOT_FOUND");
        if (enforceActive && !branch.IsActive)
            throw new ConflictException("Pasif programa yeni grup eklenemez.", "BRANCH_INACTIVE");
        return facility;
    }

    private static void EnsureCapacityWithinFacility(int capacity, Facility facility)
    {
        if (facility.Capacity > 0 && capacity > facility.Capacity)
            throw new ConflictException($"Kontenjan, tesis kapasitesinden ({facility.Capacity}) büyük olamaz.", "CAPACITY_EXCEEDS_FACILITY");
    }

    private static DateTime? ResolvePeriodEnd(string? periodType, DateTime? explicitEnd, DateTime? periodStart, int periodMonths, int periodCount, string? periodUnit = "month", int periodDays = 0)
    {
        if (periodUnit == "day" && periodStart.HasValue && periodDays > 0)
            return periodStart.Value.Date.AddDays(periodDays - 1);
        if (periodType == "recurring" && periodStart.HasValue && periodMonths > 0)
            return Nexora.Domain.Common.FacilityPeriods.RollingHorizon(periodStart.Value.Date, periodMonths, Nexora.Domain.Common.TurkeyTime.TodayDate(), 1);
        if (explicitEnd.HasValue) return explicitEnd;
        if (periodStart.HasValue && periodMonths > 0)
            return periodStart.Value.AddMonths(periodMonths * (periodCount > 0 ? periodCount : 1));
        return null;
    }

    private async Task<FacilityGroup> GetOwnedAsync(string module, Guid id, CancellationToken ct)
    {
        var group = await uow.FacilityGroups.GetByIdAsync(id, ct);
        if (group is null || group.Module != module)
            throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, group.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, group.Id, ct);
        return group;
    }

    private async Task EnsureFacilityInScopeAsync(string module, Guid facilityId, CancellationToken ct)
    {
        if (current.Id is not Guid userId) return;
        var scoped = await userScope.GetScopedRefIdsAsync(userId, module, ct);
        if (scoped is not null && !scoped.Contains(facilityId))
            throw new ForbiddenException("Bu tesisin gruplarını düzenleme yetkiniz yok.", "FACILITY_OUT_OF_SCOPE");
    }

    private async Task<GroupNames> BuildNamesAsync(IReadOnlyCollection<FacilityGroup> items, CancellationToken ct)
    {
        var facilityIds = items.Select(g => g.FacilityId).Distinct().ToList();
        var branchIds = items.Select(g => g.BranchId).Distinct().ToList();
        var parentIds = items.Where(g => g.ParentGroupId.HasValue).Select(g => g.ParentGroupId!.Value).Distinct().ToList();
        var facilities = facilityIds.Count > 0 ? await uow.Facilities.FindAsync(x => facilityIds.Contains(x.Id), ct) : new();
        var branches = branchIds.Count > 0 ? await uow.FacilityBranches.FindAsync(x => branchIds.Contains(x.Id), ct) : new();
        var parents = parentIds.Count > 0 ? await uow.FacilityGroups.FindAsync(x => parentIds.Contains(x.Id), ct) : new();
        var itemIds = items.Select(g => g.Id).Distinct().ToList();
        var children = itemIds.Count > 0
            ? await uow.FacilityGroups.FindAsync(x => x.ParentGroupId.HasValue && itemIds.Contains(x.ParentGroupId.Value), ct)
            : new();
        var subCounts = children
            .GroupBy(x => x.ParentGroupId!.Value)
            .ToDictionary(grp => grp.Key, grp => grp.Count());

        var pendingApplications = itemIds.Count > 0
            ? await uow.FacilityApplications.FindAsync(x => x.GroupId.HasValue && itemIds.Contains(x.GroupId.Value) && x.Status == "pending", ct)
            : new();
        var pendingCounts = pendingApplications
            .GroupBy(x => x.GroupId!.Value)
            .ToDictionary(grp => grp.Key, grp => grp.Count());

        var sessionCounts = itemIds.Count > 0
            ? await uow.FacilitySessions.CountActiveByGroupsAsync(itemIds, ct)
            : new();

        // Read the active queue in one query, including children. Historical removals can
        // leave the stored counter stale; list/detail responses must reflect the actual roster.
        var waitlistCounts = await uow.FacilityRegistrations.CountActiveWaitlistByGroupsAsync(
            itemIds.Concat(children.Select(g => g.Id)).Distinct().ToList(), ct);

        var subCapacity = children.GroupBy(x => x.ParentGroupId!.Value).ToDictionary(grp => grp.Key, grp => grp.Sum(c => c.Capacity));
        var subRegistered = children.GroupBy(x => x.ParentGroupId!.Value).ToDictionary(grp => grp.Key, grp => grp.Sum(c => c.RegisteredCount));
        var subWaitlist = children.GroupBy(x => x.ParentGroupId!.Value).ToDictionary(grp => grp.Key, grp => grp.Sum(c => waitlistCounts.GetValueOrDefault(c.Id)));

        return new GroupNames(
            facilities.ToDictionary(x => x.Id, x => x.Name),
            branches.ToDictionary(x => x.Id, x => x.Name),
            parents.ToDictionary(x => x.Id, x => x.Name),
            subCounts,
            pendingCounts,
            sessionCounts,
            subCapacity,
            subRegistered,
            subWaitlist,
            waitlistCounts);
    }

    private async Task<string?> ResolveInstructorNameAsync(string module, Guid? instructorId, CancellationToken ct)
        => (await ResolveInstructorAsync(module, instructorId, ct)).Name;

    private async Task<(Guid? Id, string? Name)> ResolveInstructorAsync(string module, Guid? instructorId, CancellationToken ct)
    {
        if (!instructorId.HasValue) return (null, null);
        var instructor = await uow.FacilityInstructors.GetByIdAsync(instructorId.Value, ct);
        if (instructor is not null && instructor.Module == module) return (instructor.Id, instructor.FullName);

        var user = await uow.AdminUsers.GetByIdAsync(instructorId.Value, ct);
        var role = user is null ? null : await uow.Roles.GetByIdAsync(user.RoleId, ct);
        if (user is null || !user.IsActive || role?.Key != "tpl-egitmen")
            throw new NotFoundException("Eğitmen bulunamadı.", "INSTRUCTOR_NOT_FOUND");

        var linked = (await uow.FacilityInstructors.FindAsync(i => i.Module == module && i.UserId == user.Id, ct)).FirstOrDefault();
        if (linked is not null) return (linked.Id, linked.FullName);

        var created = FacilityInstructor.Create(new FacilityInstructorData(module, user.FullName, null, user.Phone, user.Email, null, true), current.Name);
        created.LinkUser(user.Id);
        await uow.FacilityInstructors.AddAsync(created, ct);
        await uow.SaveChangesAsync(ct);
        return (created.Id, created.FullName);
    }

    private static FacilityGroupData ToData(string module, Guid facilityId, Guid branchId, Guid? parentGroupId, string name, string? description, string type, string gender,
        int capacity, int reserveCapacity, int ageMin, int ageMax, JsonElement schedule, string attendanceMode,
        JsonElement fee, JsonElement conditions, DateTime? periodStart, DateTime? periodEnd, int absenceLimit, int consecutiveAbsenceLimit,
        int entryGraceMinutes, Guid? instructorId, string? instructorName, bool isActive,
        string periodType = "date_range", int periodCount = 0, DateTime? applicationStartDate = null, DateTime? applicationEndDate = null, bool academyWhitelistEnabled = false,
        bool autoApprove = true,
        bool attendanceLimitOverride = false, string attendanceLimitType = "unlimited", int attendanceLimitCount = 0, int periodMonths = 0,
        string periodUnit = "month", int periodDays = 0, string residencyMode = "anyone", bool lateTrackingEnabled = true)
        => new(module, facilityId, branchId, parentGroupId, name, type, gender, capacity, reserveCapacity, ageMin, ageMax,
            RawOr(schedule, "[]"), attendanceMode, RawOr(fee, "{}"), RawOr(conditions, "{}"),
            periodStart, periodEnd, absenceLimit, consecutiveAbsenceLimit, entryGraceMinutes, instructorId, instructorName, isActive, description,
            periodType, periodCount, periodMonths, applicationStartDate, applicationEndDate, academyWhitelistEnabled, autoApprove,
            attendanceLimitOverride, attendanceLimitType, attendanceLimitCount, periodUnit, periodDays, residencyMode, lateTrackingEnabled);

    private static string RawOr(JsonElement el, string fallback)
        => el.ValueKind == JsonValueKind.Undefined ? fallback : el.GetRawText();

    private static FacilityGroupDto ToDto(FacilityGroup g, GroupNames n)
        => new(g.Id, g.Module, g.FacilityId, n.Facilities.GetValueOrDefault(g.FacilityId), g.BranchId, n.Branches.GetValueOrDefault(g.BranchId),
            g.ParentGroupId, g.ParentGroupId.HasValue ? n.Parents.GetValueOrDefault(g.ParentGroupId.Value) : null,
            g.Name, g.Description, g.Type, g.Gender, g.Capacity, g.ReserveCapacity, g.AgeMin, g.AgeMax,
            Parse(g.ScheduleJson, "[]"), g.AttendanceMode, Parse(g.FeeJson, "{}"), Parse(g.ConditionsJson, "{}"),
            g.PeriodStart, g.PeriodEnd, g.PeriodType, g.PeriodCount, g.PeriodMonths, g.ApplicationStartDate, g.ApplicationEndDate, g.AcademyWhitelistEnabled,
            g.AutoApprove,
            g.AttendanceLimitOverride, g.AttendanceLimitType, g.AttendanceLimitCount,
            g.AbsenceLimit, g.ConsecutiveAbsenceLimit, g.EntryGraceMinutes, g.InstructorId, g.InstructorName,
            g.RegisteredCount, n.WaitlistCounts.GetValueOrDefault(g.Id), n.SubCounts.GetValueOrDefault(g.Id), n.PendingCounts.GetValueOrDefault(g.Id), g.PeriodUnit, g.PeriodDays, g.ResidencyMode, g.IsActive, g.CreatedAt, g.DeletedAt, g.DeletedBy, g.LateTrackingEnabled,
            ScheduleSync: null, SessionCount: n.SessionCounts.GetValueOrDefault(g.Id),
            SubGroupCapacity: n.SubCapacity.GetValueOrDefault(g.Id), SubGroupRegistered: n.SubRegistered.GetValueOrDefault(g.Id), SubGroupWaitlist: n.SubWaitlist.GetValueOrDefault(g.Id));

    private static JsonElement Parse(string json, string fallback)
    {
        try { return JsonSerializer.Deserialize<JsonElement>(string.IsNullOrWhiteSpace(json) ? fallback : json); }
        catch { return JsonSerializer.Deserialize<JsonElement>(fallback); }
    }

    private record GroupNames(Dictionary<Guid, string> Facilities, Dictionary<Guid, string> Branches, Dictionary<Guid, string> Parents, Dictionary<Guid, int> SubCounts, Dictionary<Guid, int> PendingCounts, Dictionary<Guid, int> SessionCounts, Dictionary<Guid, int> SubCapacity, Dictionary<Guid, int> SubRegistered, Dictionary<Guid, int> SubWaitlist, Dictionary<Guid, int> WaitlistCounts);
}
