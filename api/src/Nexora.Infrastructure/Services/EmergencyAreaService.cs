using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Application.Features.EmergencyAreas;
using Nexora.Application.Features.EmergencyAreas.Dtos;
using Nexora.Domain.Entities.EmergencyAreas;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class EmergencyAreaService(
    IUnitOfWork uow,
    IAuditService audit,
    ICurrentUser currentUser,
    IUserScopeService userScope,
    IScopedStaffService scopedStaff) : IEmergencyAreaService
{
    public async Task<PagedResult<EmergencyAreaDto>> GetPagedAsync(EmergencyAreaListParams p, CancellationToken ct)
    {
        var scopedRefIds = currentUser.Id is Guid uid
            ? await userScope.GetScopedRefIdsAsync(uid, "emergency-areas", ct)
            : null;
        var paged = await uow.EmergencyAreas.GetPagedAsync(p, scopedRefIds, ct);
        return new PagedResult<EmergencyAreaDto>
        {
            Items = paged.Items.Select(MapDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<EmergencyAreaSummaryDto> GetSummaryAsync(EmergencyAreaListParams p, CancellationToken ct)
        => await uow.EmergencyAreas.GetSummaryAsync(p, ct);

    public async Task<IReadOnlyList<EmergencyAreaMapPointDto>> GetMapPointsAsync(CancellationToken ct)
    {
        var areas = await uow.EmergencyAreas.GetMapPointsAsync(ct);
        return areas.Select(a => new EmergencyAreaMapPointDto(
            a.Id, a.Name, a.Neighborhood, a.Latitude, a.Longitude, a.Capacity, a.Status.ToString())).ToList();
    }

    public Task<IReadOnlyList<EmergencyAreaOptionDto>> GetNeighborhoodOptionsAsync(CancellationToken ct)
        => Task.FromResult(BakirkoyNeighborhoods.Options);

    // Yetki alani (scope) kisitli bir kullanicinin, kendi liste ekraninda gormedigi
    // bir acil toplanma alaninin ID'sini biliyorsa bile erismesini engeller (IDOR onlemi).
    private async Task EnsureInScopeAsync(Guid id, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, "emergency-areas", ct);
        if (scopedRefIds is not null && !scopedRefIds.Contains(id))
            throw new NotFoundException("Acil toplanma alanı bulunamadı.", "EMERGENCY_AREA_NOT_FOUND");
    }

    public async Task<EmergencyAreaDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var area = await uow.EmergencyAreas.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Acil toplanma alanı bulunamadı.", "EMERGENCY_AREA_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);
        return MapDto(area);
    }

    public async Task<EmergencyAreaDto> CreateAsync(EmergencyAreaRequest req, CancellationToken ct)
    {
        var area = EmergencyArea.Create(req.Name, req.Neighborhood, req.Address);
        await ApplyRequestAsync(area, req, ct);

        await uow.EmergencyAreas.AddAsync(area, ct);
        await uow.SaveChangesAsync(ct);

        await GrantManagerAccessAsync(area, req, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "EmergencyArea",
            EntityId = area.Id,
            Module = "EmergencyAreas",
            Description = $"Acil toplanma alanı oluşturuldu: {area.Name}",
            NewValues = JsonSerializer.Serialize(Snapshot(area)),
        }, ct);

        return MapDto(area);
    }

    public async Task<EmergencyAreaDto> UpdateAsync(Guid id, EmergencyAreaRequest req, CancellationToken ct)
    {
        var area = await uow.EmergencyAreas.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Acil toplanma alanı bulunamadı.", "EMERGENCY_AREA_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var before = JsonSerializer.Serialize(Snapshot(area));

        await ApplyRequestAsync(area, req, ct);
        uow.EmergencyAreas.Update(area);
        await uow.SaveChangesAsync(ct);

        await GrantManagerAccessAsync(area, req, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "EmergencyArea",
            EntityId = area.Id,
            Module = "EmergencyAreas",
            Description = $"Acil toplanma alanı güncellendi: {area.Name}",
            OldValues = before,
            NewValues = JsonSerializer.Serialize(Snapshot(area)),
        }, ct);

        return MapDto(area);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var area = await uow.EmergencyAreas.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Acil toplanma alanı bulunamadı.", "EMERGENCY_AREA_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        uow.EmergencyAreas.Delete(area);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "EmergencyArea",
            EntityId = area.Id,
            Module = "EmergencyAreas",
            Description = $"Acil toplanma alanı silindi: {area.Name}",
        }, ct);
    }

    public async Task<EmergencyAreaDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var area = await uow.EmergencyAreas.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Acil toplanma alanı bulunamadı.", "EMERGENCY_AREA_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        area.SetStatus(area.Status == EmergencyAreaStatus.Active ? EmergencyAreaStatus.Passive : EmergencyAreaStatus.Active);
        uow.EmergencyAreas.Update(area);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "EmergencyArea",
            EntityId = area.Id,
            Module = "EmergencyAreas",
            Description = $"Acil toplanma alanı durumu değiştirildi: {area.Name} → {area.Status}",
        }, ct);

        return MapDto(area);
    }

    private async Task ApplyRequestAsync(EmergencyArea area, EmergencyAreaRequest req, CancellationToken ct)
    {
        area.SetBasics(req.Name, req.Neighborhood, req.Address, req.Latitude, req.Longitude, req.Capacity, req.AreaSizeM2, req.Description);
        area.SetEquipment(ToEquipment(req.Equipment));
        await ApplyManagerAsync(area, req, ct);
        area.SetEmergencyPhone(req.EmergencyPhone);
    }

    private async Task ApplyManagerAsync(EmergencyArea area, EmergencyAreaRequest req, CancellationToken ct)
    {
        if (req.ManagerId is Guid managerId && managerId != Guid.Empty)
        {
            var admin = await uow.AdminUsers.GetByIdAsync(managerId, ct)
                ?? throw new ConflictException("Seçilen sorumlu kişi bulunamadı.", "MANAGER_NOT_FOUND");
            var role = await uow.Roles.GetByIdAsync(admin.RoleId, ct);
            area.SetManager(admin.Id, admin.FullName, admin.Phone, admin.Email, role?.Key, role?.Name ?? admin.FullName);
            return;
        }

        area.SetManager(null, (req.Manager ?? "").Trim(), req.ManagerPhone, req.ManagerEmail, null, null);
    }

    private async Task GrantManagerAccessAsync(EmergencyArea area, EmergencyAreaRequest req, CancellationToken ct)
    {
        if (!req.GrantAccess || req.ManagerId is not null)
            return;

        if (string.IsNullOrWhiteSpace(req.Manager) || string.IsNullOrWhiteSpace(req.ManagerEmail))
            throw new ConflictException("Sisteme erişim verilecek kişinin adı ve e-postası zorunludur.", "STAFF_INFO_REQUIRED");

        var staff = await scopedStaff.AssignAsync(new AssignScopedStaffRequest(
            FullName: req.Manager!,
            Tckn: req.Tckn,
            Phone: req.ManagerPhone,
            Email: req.ManagerEmail!,
            RoleTemplateKey: string.IsNullOrWhiteSpace(req.RoleTemplateKey) ? "acil-alan-sorumlusu" : req.RoleTemplateKey!,
            ScopeModuleKey: "emergency-areas",
            ScopeRefId: area.Id,
            ScopeName: area.Name,
            ScopeType: "EmergencyArea",
            DeliveryChannel: string.IsNullOrWhiteSpace(req.DeliveryChannel) ? "Email" : req.DeliveryChannel!), ct);

        area.SetManager(staff.AdminUserId, staff.FullName, req.ManagerPhone, staff.Email, staff.RoleKey, staff.RoleName);
        uow.EmergencyAreas.Update(area);
        await uow.SaveChangesAsync(ct);
    }

    private static EmergencyEquipment ToEquipment(EmergencyEquipmentDto? d) => new()
    {
        Toilet = d?.Toilet ?? false,
        Water = d?.Water ?? false,
        Electricity = d?.Electricity ?? false,
        Generator = d?.Generator ?? false,
        Heating = d?.Heating ?? false,
        TentArea = d?.TentArea ?? false,
    };

    private static EmergencyEquipmentDto ToEquipmentDto(EmergencyEquipment e)
        => new(e.Toilet, e.Water, e.Electricity, e.Generator, e.Heating, e.TentArea);

    private static EmergencyAreaDto MapDto(EmergencyArea a)
        => new(
            a.Id,
            a.Name,
            a.Neighborhood,
            a.Address,
            a.Latitude,
            a.Longitude,
            a.Capacity,
            a.AreaSizeM2,
            ToEquipmentDto(a.Equipment),
            a.ManagerId,
            a.ManagerRoleKey,
            a.ManagerRoleName,
            a.Manager,
            a.ManagerPhone ?? "",
            a.ManagerEmail,
            a.EmergencyPhone,
            a.Description,
            a.Status.ToString(),
            a.CreatedAt,
            a.ExternalSource,
            a.ExternalId,
            a.ExternalSyncedAt);

    private static object Snapshot(EmergencyArea a) => new
    {
        a.Name,
        a.Neighborhood,
        a.Capacity,
        a.AreaSizeM2,
        Status = a.Status.ToString(),
        a.Manager,
    };
}
