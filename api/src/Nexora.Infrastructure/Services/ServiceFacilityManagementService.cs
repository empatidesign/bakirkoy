using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Application.Features.ServiceFacilities;
using Nexora.Application.Features.ServiceFacilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class ServiceFacilityManagementService(
    IUnitOfWork uow,
    IAuditService audit,
    ICurrentUser currentUser,
    IUserScopeService userScope,
    IScopedStaffService scopedStaff,
    IServiceProvider serviceProvider,
    IQrTokenService qr,
    IConfiguration config,
    IOptionsMonitor<MinioSettings> minioOptions) : IServiceFacilityService
{
    public async Task<PagedResult<ServiceFacilityDto>> GetPagedAsync(ServiceFacilityListParams p, CancellationToken ct)
    {
        var scopedRefIds = currentUser.Id is Guid uid
            ? await userScope.GetScopedRefIdsAsync(uid, "service-facilities", ct)
            : null;
        var paged = await uow.ServiceFacilities.GetPagedAsync(p, scopedRefIds, ct);
        return new PagedResult<ServiceFacilityDto>
        {
            Items = paged.Items.Select(MapDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<IReadOnlyList<ServiceFacilityOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var scopedRefIds = currentUser.Id is Guid uid
            ? await userScope.GetScopedRefIdsAsync(uid, "service-facilities", ct)
            : null;
        var facilities = await uow.ServiceFacilities.GetActiveOptionsAsync(scopedRefIds, ct);
        return facilities.Select(f => new ServiceFacilityOptionDto(f.Id, f.Name, f.LocationType.ToString())).ToList();
    }

    public async Task<ServiceFacilitySummaryDto> GetSummaryAsync(ServiceFacilityListParams p, CancellationToken ct)
        => await uow.ServiceFacilities.GetSummaryAsync(p, ct);

    public async Task<IReadOnlyList<FacilityMapPointDto>> GetMapPointsAsync(CancellationToken ct)
    {
        var facilities = await uow.ServiceFacilities.GetMapPointsAsync(ct);
        return facilities.Select(f => new FacilityMapPointDto(
            f.Id,
            f.Name,
            f.Type,
            f.Status.ToString(),
            f.LocationType.ToString(),
            f.District,
            f.City,
            f.Latitude,
            f.Longitude,
            f.ServiceCount,
            PrimaryUrl(f.Images.FirstOrDefault(i => i.IsPrimary) ?? f.Images.FirstOrDefault()))).ToList();
    }

    private async Task EnsureInScopeAsync(Guid id, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, "service-facilities", ct);
        if (scopedRefIds is not null && !scopedRefIds.Contains(id))
            throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
    }

    public async Task<ServiceFacilityDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var facility = await uow.ServiceFacilities.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);
        return MapDto(facility);
    }

    public async Task<MasterQrDto> GetMasterQrAsync(Guid id, CancellationToken ct)
    {
        var facility = await uow.ServiceFacilities.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);
        if (!facility.MasterQrEnabled)
            return new MasterQrDto(null, 0, false);

        var windowSeconds = config.GetValue("MasterQr:WindowSeconds", 60);
        var token = qr.Generate(facility.Id, MasterQrContext(facility.Id), windowSeconds);
        return new MasterQrDto(token, windowSeconds, true);
    }

    public async Task ToggleMasterQrAsync(Guid id, bool enabled, CancellationToken ct)
    {
        var facility = await uow.ServiceFacilities.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);
        facility.SetMasterQrEnabled(enabled);
        uow.ServiceFacilities.Update(facility);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SystemConfig,
            EntityType = "ServiceFacility",
            EntityId = facility.Id,
            Module = "ServiceFacilities",
            Description = enabled
                ? $"Master QR etkinleştirildi: {facility.Name}"
                : $"Master QR devre dışı bırakıldı: {facility.Name}",
        }, ct);
    }

    public async Task<MasterCardRotateDto> RotateMasterCardAsync(Guid id, CancellationToken ct)
    {
        var facility = await uow.ServiceFacilities.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var plain = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N")[..8];
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plain)));
        facility.RotateMasterCardCode(hash);
        uow.ServiceFacilities.Update(facility);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SystemConfig,
            EntityType = "ServiceFacility",
            EntityId = facility.Id,
            Module = "ServiceFacilities",
            Description = $"Master kart kodu yenilendi: {facility.Name}",
        }, ct);

        return new MasterCardRotateDto(plain);
    }

    private static string MasterQrContext(Guid id) => $"facility-master:{id}";

    public async Task<IReadOnlyList<ServiceFacilityModuleUsageDto>> GetModuleUsageAsync(Guid id, CancellationToken ct)
    {
        var facility = await uow.ServiceFacilities.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var result = new List<ServiceFacilityModuleUsageDto>();
        foreach (var module in FacilityModuleRegistry.All)
        {
            var existing = (await uow.Facilities.FindAsync(f => f.Module == module && f.ServiceFacilityId == facility.Id, ct))
                .FirstOrDefault();
            result.Add(existing is null
                ? new ServiceFacilityModuleUsageDto(module, false, null, null, null)
                : new ServiceFacilityModuleUsageDto(module, true, existing.Id, existing.Name, existing.IsActive));
        }
        return result;
    }

    public async Task<AssignServiceFacilityModulesResultDto> AssignModulesAsync(Guid id, AssignServiceFacilityModulesRequest req, CancellationToken ct)
    {
        var facility = await uow.ServiceFacilities.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        int assigned = 0, alreadyAssigned = 0;
        var failed = new List<string>();

        foreach (var module in req.Modules.Distinct())
        {
            if (!FacilityModuleRegistry.IsValid(module)) { failed.Add(module); continue; }

            try
            {
                var exists = await uow.Facilities.AnyAsync(f => f.Module == module && f.ServiceFacilityId == facility.Id, ct);
                if (exists) { alreadyAssigned++; continue; }

                var number = await uow.Facilities.NextCodeNumberAsync(module, ct);
                var code = $"{FacilityModuleRegistry.Prefix[module]}-{number:D4}";
                var newFacility = Facility.Create(
                    new FacilityData(module, facility.Name, facility.LocationType == FacilityLocationType.Outdoor ? "outdoor" : "indoor",
                        facility.Id, facility.Capacity ?? 0, null, null, null, null, null, null, null, true),
                    code, currentUser.Name);

                await uow.Facilities.AddAsync(newFacility, ct);
                await uow.SaveChangesAsync(ct);
                assigned++;
            }
            catch
            {
                failed.Add(module);
            }
        }

        if (assigned > 0)
        {
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Create,
                EntityType = "ServiceFacility",
                EntityId = facility.Id,
                Module = "ServiceFacilities",
                Description = $"Hizmet tesisi {assigned} modüle atandı: {facility.Name} ({string.Join(", ", req.Modules)})",
            }, ct);
        }

        return new AssignServiceFacilityModulesResultDto(assigned, alreadyAssigned, failed);
    }

    public async Task<ServiceFacilityDto> CreateAsync(ServiceFacilityRequest req, CancellationToken ct)
    {
        var facility = ServiceFacility.Create(req.Name, req.Type ?? "", ParseLocation(req.LocationType));
        await ApplyRequestAsync(facility, req, ct);

        await uow.ServiceFacilities.AddAsync(facility, ct);
        await uow.SaveChangesAsync(ct);

        await GrantManagerAccessAsync(facility, req, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "ServiceFacility",
            EntityId = facility.Id,
            Module = "ServiceFacilities",
            Description = $"Hizmet tesisi oluşturuldu: {facility.Name}",
            NewValues = JsonSerializer.Serialize(Snapshot(facility)),
        }, ct);

        return MapDto(facility);
    }

    public async Task<ServiceFacilityImportResultDto> ImportAsync(Stream excelStream, CancellationToken ct)
    {
        var parsed = ServiceFacilityExcelParser.Parse(excelStream);

        var existingNames = await uow.ServiceFacilities.GetExistingNamesAsync(ct);

        var results = new List<ServiceFacilityImportRowResultDto>(parsed.Count);
        int added = 0, skipped = 0, failed = 0;

        foreach (var row in parsed)
        {
            ct.ThrowIfCancellationRequested();

            if (row.Request is null)
            {
                results.Add(new ServiceFacilityImportRowResultDto(row.Row, row.RawName, "Hata", row.Error));
                failed++;
                continue;
            }

            if (!existingNames.Add(row.Request.Name.Trim()))
            {
                results.Add(new ServiceFacilityImportRowResultDto(row.Row, row.RawName, "Atlandı", "Bu adda bir tesis zaten var."));
                skipped++;
                continue;
            }

            try
            {
                await CreateAsync(row.Request, ct);
                results.Add(new ServiceFacilityImportRowResultDto(row.Row, row.RawName, "Eklendi", null));
                added++;
            }
            catch (Exception ex) when (ex is Nexora.Application.Common.Exceptions.ValidationException or ConflictException)
            {
                existingNames.Remove(row.Request.Name.Trim());
                results.Add(new ServiceFacilityImportRowResultDto(row.Row, row.RawName, "Hata", ex.Message));
                failed++;
            }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "ServiceFacility",
            Module = "ServiceFacilities",
            Description = $"Excel'den toplu tesis içe aktarımı: {added} eklendi, {skipped} atlandı, {failed} hatalı.",
        }, ct);

        return new ServiceFacilityImportResultDto(parsed.Count, added, skipped, failed, results);
    }

    public async Task<ServiceFacilityDto> UpdateAsync(Guid id, ServiceFacilityRequest req, CancellationToken ct)
    {
        var facility = await uow.ServiceFacilities.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var before = JsonSerializer.Serialize(Snapshot(facility));

        await ApplyRequestAsync(facility, req, ct);
        uow.ServiceFacilities.Update(facility);
        await uow.SaveChangesAsync(ct);

        await GrantManagerAccessAsync(facility, req, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "ServiceFacility",
            EntityId = facility.Id,
            Module = "ServiceFacilities",
            Description = $"Hizmet tesisi güncellendi: {facility.Name}",
            OldValues = before,
            NewValues = JsonSerializer.Serialize(Snapshot(facility)),
        }, ct);

        return MapDto(facility);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var facility = await uow.ServiceFacilities.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var halls = await uow.Halls.GetByFacilityAsync(id, ct);
        foreach (var hall in halls) uow.Halls.Delete(hall);

        uow.ServiceFacilities.Delete(facility);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "ServiceFacility",
            EntityId = facility.Id,
            Module = "ServiceFacilities",
            Description = halls.Count > 0
                ? $"Hizmet tesisi silindi: {facility.Name} (bağlı {halls.Count} salon da silindi)"
                : $"Hizmet tesisi silindi: {facility.Name}",
        }, ct);
    }

    public async Task<ServiceFacilityDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var facility = await uow.ServiceFacilities.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        facility.SetStatus(facility.Status == FacilityStatus.Active ? FacilityStatus.Passive : FacilityStatus.Active);
        uow.ServiceFacilities.Update(facility);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "ServiceFacility",
            EntityId = facility.Id,
            Module = "ServiceFacilities",
            Description = $"Hizmet tesisi durumu değiştirildi: {facility.Name} → {facility.Status}",
        }, ct);

        return MapDto(facility);
    }

    public Task<IReadOnlyList<FacilityServiceCatalogItemDto>> GetServiceCatalogAsync(CancellationToken ct)
        => Task.FromResult(FacilityServiceCatalog.Items);

    public async Task<FacilityImageDto> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var storage = serviceProvider.GetService<IFileStorageService>()
            ?? throw new ConflictException("Dosya depolama servisi yapılandırılmamış.", "STORAGE_NOT_CONFIGURED");

        var bucket = minioOptions.CurrentValue.PublicBucket;
        var result = await storage.UploadAsync(stream, fileName, contentType, bucket, ct);

        return new FacilityImageDto(
            result.ObjectName,
            FileUrl.Public(result.ObjectName),
            fileName,
            result.SizeBytes >= 0 ? result.SizeBytes : null,
            false);
    }

    private async Task ApplyRequestAsync(ServiceFacility facility, ServiceFacilityRequest req, CancellationToken ct)
    {
        facility.SetBasics(req.Name, req.Type ?? "", ParseLocation(req.LocationType), ParseOutdoor(req.OutdoorCategory), req.AreaSizeM2, req.Description, req.About);
        facility.SetLocation(req.City ?? "", req.District ?? "", req.Address ?? "", req.Latitude, req.Longitude);
        await ApplyManagerAsync(facility, req, ct);
        facility.SetContact(req.EmergencyPhone, req.Website, req.Facebook, req.Instagram, req.Twitter);
        facility.SetHours(req.WeekdayOpen, req.WeekdayClose, req.WeekendOpen, req.WeekendClose);
        facility.SetFeatures(req.Facilities ?? [], req.AccessibilityFeatures ?? [], req.ParkingCapacity, ParseParking(req.ParkingType), req.Capacity);
        facility.SetOfferedServices((req.OfferedServices ?? []).Select(ToOffering).ToList());
        facility.SetImages((req.Images ?? []).Select(ToImage).ToList());
    }

    private async Task ApplyManagerAsync(ServiceFacility facility, ServiceFacilityRequest req, CancellationToken ct)
    {
        if (req.ManagerId is null || req.ManagerId == Guid.Empty)
        {
            facility.SetManager(null, req.Manager?.Trim() ?? "", req.ManagerPhone, req.ManagerEmail, null, null);
            return;
        }

        var admin = await uow.AdminUsers.GetByIdAsync(req.ManagerId.Value, ct)
            ?? throw new ConflictException("Seçilen yönetici bulunamadı.", "MANAGER_NOT_FOUND");

        var role = await uow.Roles.GetByIdAsync(admin.RoleId, ct);

        facility.SetManager(admin.Id, admin.FullName, admin.Phone, admin.Email, role?.Key, role?.Name ?? admin.FullName);
    }

    private async Task GrantManagerAccessAsync(ServiceFacility facility, ServiceFacilityRequest req, CancellationToken ct)
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
            RoleTemplateKey: string.IsNullOrWhiteSpace(req.RoleTemplateKey) ? "tesis-sorumlusu" : req.RoleTemplateKey!,
            ScopeModuleKey: "service-facilities",
            ScopeRefId: facility.Id,
            ScopeName: facility.Name,
            ScopeType: "Facility",
            DeliveryChannel: string.IsNullOrWhiteSpace(req.DeliveryChannel) ? "Email" : req.DeliveryChannel!), ct);

        facility.SetManager(staff.AdminUserId, staff.FullName, req.ManagerPhone, staff.Email, staff.RoleKey, staff.RoleName);
        uow.ServiceFacilities.Update(facility);
        await uow.SaveChangesAsync(ct);
    }

    private static FacilityLocationType ParseLocation(string? value)
        => Enum.TryParse<FacilityLocationType>(value, out var v) ? v : FacilityLocationType.Indoor;

    private static FacilityOutdoorCategory? ParseOutdoor(string? value)
        => Enum.TryParse<FacilityOutdoorCategory>(value, out var v) ? v : null;

    private static FacilityParkingType ParseParking(string? value)
        => Enum.TryParse<FacilityParkingType>(value, out var v) ? v : FacilityParkingType.Free;

    private static ServiceOfferingItem ToOffering(ServiceOfferingDto d) => new()
    {
        Id = string.IsNullOrWhiteSpace(d.Id) ? Guid.NewGuid().ToString("N") : d.Id,
        CatalogId = d.CatalogId,
        Name = d.Name,
        Module = d.Module,
        Description = d.Description,
        Active = d.Active,
    };

    private static FacilityImageItem ToImage(FacilityImageDto d) => new()
    {
        Id = d.Id,
        Url = "",
        Name = d.Name,
        Size = d.Size,
        IsPrimary = d.IsPrimary,
    };

    private static ServiceOfferingDto ToOfferingDto(ServiceOfferingItem s)
        => new(s.Id, s.CatalogId, s.Name, s.Module, s.Description, s.Active);

    private static string? PrimaryUrl(FacilityImageItem? img)
        => img is null ? null : FileUrl.Public(img.Id);

    private static FacilityImageDto ToImageDto(FacilityImageItem i)
        => new(i.Id, FileUrl.Public(i.Id), i.Name, i.Size, i.IsPrimary);

    private static ServiceFacilityDto MapDto(ServiceFacility f)
    {
        var primary = f.Images.FirstOrDefault(i => i.IsPrimary) ?? f.Images.FirstOrDefault();
        return new ServiceFacilityDto(
            f.Id,
            f.Name,
            f.Type,
            f.Status.ToString(),
            f.LocationType.ToString(),
            f.OutdoorCategory?.ToString(),
            f.AreaSizeM2,
            f.Description,
            f.About,
            f.City,
            f.District,
            f.Address,
            f.Latitude,
            f.Longitude,
            f.ManagerId,
            f.Manager,
            f.ManagerPhone ?? "",
            f.ManagerEmail ?? "",
            f.ManagerRoleKey,
            f.ManagerRoleName,
            f.EmergencyPhone,
            f.Website,
            f.Facebook,
            f.Instagram,
            f.Twitter,
            f.WeekdayOpen,
            f.WeekdayClose,
            f.WeekendOpen,
            f.WeekendClose,
            f.Facilities,
            f.AccessibilityFeatures,
            f.ParkingCapacity,
            f.ParkingType.ToString(),
            f.Capacity,
            f.OfferedServices.Where(s => !string.IsNullOrWhiteSpace(s.CatalogId)).Select(s => s.CatalogId!).ToList(),
            f.OfferedServices.Select(ToOfferingDto).ToList(),
            f.ServiceCount,
            f.Images.Select(ToImageDto).ToList(),
            PrimaryUrl(primary),
            f.CreatedAt);
    }

    private static object Snapshot(ServiceFacility f) => new
    {
        f.Name,
        f.Type,
        Status = f.Status.ToString(),
        LocationType = f.LocationType.ToString(),
        f.City,
        f.District,
        f.Manager,
        f.ServiceCount,
    };
}
