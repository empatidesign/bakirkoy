using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class LibraryStaffService(IUnitOfWork uow, IAuditService audit, ICurrentUser currentUser, IUserScopeService userScope,
    IAdminUserManagementService adminManagement) : ILibraryStaffService
{
    private async Task EnsureInScopeAsync(Guid libraryId, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, "library", ct);
        if (scopedRefIds is not null && !scopedRefIds.Contains(libraryId))
            throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
    }

    // Kod denetimi 2026-08-02 (kullanıcı isteği: "WorkingLibraryIds⊆scope kısıtı, tasarım kararı
    // bekliyor" — karar: scoped bir kütüphane yöneticisi personeli YALNIZCA kendi yetki alanındaki
    // kütüphanelere atayabilmeli/görebilmeli). Mutasyonlarda (create/update) istenen
    // WorkingLibraryIds'in TAMAMI scope içinde olmalı — aksi halde scoped bir yönetici, personeli
    // kendi göremediği bir kütüphaneye "gizlice" atayabilir. Görünürlük/silme/durum
    // değiştirmede ise personelin çalıştığı kütüphanelerden EN AZ BİRİ scope'ta olmalı
    // (GetPagedAsync'teki Any-overlap filtresiyle tutarlı).
    private async Task<HashSet<Guid>?> ScopedLibraryIdsAsync(CancellationToken ct)
        => currentUser.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, "library", ct) : null;

    private static void EnsureAllInScope(IEnumerable<Guid> workingLibraryIds, HashSet<Guid>? scopedLibraryIds)
    {
        if (scopedLibraryIds is null) return;
        if (workingLibraryIds.Any(id => !scopedLibraryIds.Contains(id)))
            throw new ForbiddenException("Yalnızca kendi yetki alanınızdaki kütüphanelere personel atayabilirsiniz.", "LIBRARY_OUT_OF_SCOPE");
    }

    private static void EnsureAnyInScope(LibraryStaff staff, HashSet<Guid>? scopedLibraryIds)
    {
        if (scopedLibraryIds is null) return;
        if (!staff.WorkingLibraryIds.Any(scopedLibraryIds.Contains))
            throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");
    }

    public async Task<PagedResult<LibraryStaffDto>> GetPagedAsync(LibraryStaffListParams p, CancellationToken ct)
    {
        var scopedLibraryIds = currentUser.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, "library", ct) : null;
        var paged = await uow.LibraryStaff.GetPagedAsync(p, scopedLibraryIds, ct);
        var activeMap = await ActiveShiftMapAsync(ct);
        return new PagedResult<LibraryStaffDto>
        {
            Items = paged.Items.Select(x => MapStaff(x, activeMap)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<LibraryStaffDto>> GetEligibleAsync(Guid libraryId, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var staff = await uow.LibraryStaff.GetEligibleAsync(libraryId, ct);
        var activeMap = await ActiveShiftMapAsync(ct);
        return staff.Select(x => MapStaff(x, activeMap)).ToList();
    }

    public async Task<LibraryStaffDto> CreateAsync(LibraryStaffRequest req, CancellationToken ct)
    {
        var hasAdmin = req.AdminUserId is not null;
        var hasParticipant = req.ParticipantId is not null;
        if (hasAdmin == hasParticipant)
            throw new ConflictException("AdminUserId veya ParticipantId'den yalnızca biri belirtilmelidir.", "STAFF_SOURCE_INVALID");

        var scopedLibraryIds = await ScopedLibraryIdsAsync(ct);
        EnsureAllInScope(req.WorkingLibraryIds ?? [], scopedLibraryIds);

        LibraryStaff staff;
        if (hasAdmin)
        {
            if (await uow.LibraryStaff.ExistsByAdminUserAsync(req.AdminUserId!.Value, null, ct))
                throw new ConflictException("Bu yönetici zaten personel olarak tanımlı.", "STAFF_ALREADY_EXISTS");
            var admin = await uow.AdminUsers.GetByIdAsync(req.AdminUserId!.Value, ct)
                ?? throw new NotFoundException("Seçilen yönetici bulunamadı.", "ADMIN_NOT_FOUND");
            var roleName = await ResolveRoleNameAsync(admin.RoleId, ct);
            staff = LibraryStaff.Create(admin.Id, null, admin.FullName, admin.Email, admin.Phone, roleName, req.WorkingLibraryIds ?? [], req.CanEditOwnShifts, req.HasDoorAccess);
        }
        else
        {
            var participant = await uow.Participants.GetByIdAsync(req.ParticipantId!.Value, ct)
                ?? throw new NotFoundException("Seçilen katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
            if (await uow.LibraryStaff.ExistsByParticipantAsync(participant.Id, null, ct))
                throw new ConflictException("Bu katılımcı zaten personel olarak tanımlı.", "STAFF_ALREADY_EXISTS");
            if (string.IsNullOrWhiteSpace(participant.Phone))
                throw new ConflictException("Yönetici hesabı oluşturmak için katılımcının telefon numarası tanımlı olmalıdır.", "PARTICIPANT_PHONE_REQUIRED");

            var adminEmail = string.IsNullOrWhiteSpace(participant.Email)
                ? $"participant-{participant.Id:N}@nexora.local"
                : participant.Email;
            var admin = await adminManagement.CreateAsync(new CreateAdminRequest(
                participant.FullName,
                adminEmail,
                participant.Phone,
                "Kütüphane",
                "demo-module-library",
                "Sms",
                req.WorkingLibraryIds), ct);

            staff = LibraryStaff.Create(admin.Id, participant.Id, participant.FullName,
                participant.Email, participant.Phone, "Kütüphane Görevlisi",
                req.WorkingLibraryIds ?? [], req.CanEditOwnShifts, false);
        }

        await uow.LibraryStaff.AddAsync(staff, ct);
        await uow.SaveChangesAsync(ct);
        await Log(AuditAction.Create, staff.Id, $"Personel eklendi: {staff.FullName} ({(hasAdmin ? "yönetici" : "katılımcı")})", ct);
        return MapStaff(staff, new Dictionary<Guid, LibraryShift>());
    }

    public async Task<LibraryStaffDto> UpdateAsync(Guid id, LibraryStaffRequest req, CancellationToken ct)
    {
        var staff = await uow.LibraryStaff.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");
        var scopedLibraryIds = await ScopedLibraryIdsAsync(ct);
        EnsureAnyInScope(staff, scopedLibraryIds);
        EnsureAllInScope(req.WorkingLibraryIds ?? [], scopedLibraryIds);

        // Kod denetimi 2026-08-08 (kullanıcı isteği: mesai sistemi derin denetim) — personel
        // şu an aktif mesaide olduğu kütüphanede çalışıyorsa, o kütüphane WorkingLibraryIds'ten
        // çıkarılamaz. Önceden bu kontrol hiç yoktu: bir yönetici personeli aktif mesaideyken
        // o kütüphaneden "çıkarabiliyordu", bu da mesai devam ederken personelin artık orada
        // çalışma yetkisi görünmemesine (StartCoreAsync'in bir sonraki mesai başlatmada
        // STAFF_NOT_ELIGIBLE fırlatmasına, ama mevcut aktif mesainin listede tutarsız
        // görünmesine) yol açabiliyordu.
        var activeShift = await uow.LibraryShifts.GetActiveByStaffAsync(id, ct);
        if (activeShift is not null && !(req.WorkingLibraryIds ?? []).Contains(activeShift.LibraryId))
            throw new ConflictException(
                $"Personelin şu anda \"{activeShift.LibraryName}\" kıraathanesinde aktif mesaisi var; " +
                "önce mesaiyi bitirin ya da bu kıraathaneyi çalışma listesinden çıkarmayın.",
                "STAFF_ACTIVE_SHIFT_LIBRARY_REMOVED");

        string? roleName = staff.RoleName;
        string fullName = staff.FullName, email = staff.Email ?? "", phone = staff.Phone ?? "";
        if (staff.AdminUserId is Guid adminId)
        {
            var admin = await uow.AdminUsers.GetByIdAsync(adminId, ct);
            if (admin is not null)
            {
                roleName = await ResolveRoleNameAsync(admin.RoleId, ct);
                fullName = admin.FullName; email = admin.Email; phone = admin.Phone ?? "";
            }
        }
        else if (staff.ParticipantId is Guid pid)
        {
            var participant = await uow.Participants.GetByIdAsync(pid, ct);
            if (participant is not null)
            {
                fullName = participant.FullName; email = participant.Email ?? ""; phone = participant.Phone ?? "";
            }
        }

        var editPermissionChanged = staff.CanEditOwnShifts != req.CanEditOwnShifts;
        var doorAccessChanged = staff.HasDoorAccess != req.HasDoorAccess;
        staff.Sync(fullName, email, phone, roleName, req.WorkingLibraryIds ?? [], req.CanEditOwnShifts, req.HasDoorAccess);
        uow.LibraryStaff.Update(staff);
        await uow.SaveChangesAsync(ct);
        await Log(AuditAction.Update, staff.Id, $"Personel güncellendi: {staff.FullName}", ct);
        if (editPermissionChanged)
            await Log(AuditAction.PermissionChange, staff.Id,
                $"Kendi mesaisini düzenleme izni {(req.CanEditOwnShifts ? "verildi" : "kaldırıldı")}: {staff.FullName}", ct);
        if (doorAccessChanged)
            await Log(AuditAction.PermissionChange, staff.Id,
                $"Kapı QR erişimi {(req.HasDoorAccess ? "verildi" : "kaldırıldı")}: {staff.FullName}", ct);
        return MapStaff(staff, await ActiveShiftMapAsync(ct));
    }

    private async Task<string?> ResolveRoleNameAsync(Guid? roleId, CancellationToken ct)
        => roleId is Guid rid ? (await uow.Roles.GetByIdAsync(rid, ct))?.Name : null;

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var staff = await uow.LibraryStaff.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");
        EnsureAnyInScope(staff, await ScopedLibraryIdsAsync(ct));
        if (await uow.LibraryShifts.GetActiveByStaffAsync(id, ct) is not null)
            throw new ConflictException("Aktif mesaisi olan personel silinemez. Önce mesaiyi bitirin.", "STAFF_HAS_ACTIVE_SHIFT");

        uow.LibraryStaff.Delete(staff);
        await uow.SaveChangesAsync(ct);
        await Log(AuditAction.Delete, staff.Id, $"Personel silindi: {staff.FullName}", ct);
    }

    public async Task<LibraryStaffDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var staff = await uow.LibraryStaff.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");
        EnsureAnyInScope(staff, await ScopedLibraryIdsAsync(ct));

        if (staff.IsActive)
        {
            if (await uow.LibraryShifts.GetActiveByStaffAsync(id, ct) is not null)
                throw new ConflictException("Aktif mesaisi olan personel pasife alınamaz.", "STAFF_HAS_ACTIVE_SHIFT");
            staff.Deactivate();
        }
        else staff.Activate();

        uow.LibraryStaff.Update(staff);
        await uow.SaveChangesAsync(ct);
        await Log(AuditAction.StatusChange, staff.Id, $"Personel durumu güncellendi: {staff.FullName} ({(staff.IsActive ? "Aktif" : "Pasif")})", ct);
        return MapStaff(staff, await ActiveShiftMapAsync(ct));
    }

    public async Task<List<LibraryShiftDto>> GetStaffShiftsAsync(Guid staffId, CancellationToken ct)
    {
        var staff = await uow.LibraryStaff.GetByIdAsync(staffId, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");
        EnsureAnyInScope(staff, await ScopedLibraryIdsAsync(ct));
        return (await uow.LibraryShifts.GetByStaffAsync(staffId, ct)).Select(MapShift).ToList();
    }

    public async Task<List<LibraryOptionDto>> GetMyLibrariesAsync(CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return [];
        var staff = await uow.LibraryStaff.GetByAdminUserAsync(uid, ct);
        if (staff is null || !staff.IsActive) return [];
        var libraries = await uow.Libraries.GetActiveAsync(ct);
        return libraries
            .Where(l => staff.WorkingLibraryIds.Contains(l.Id))
            .Select(l => new LibraryOptionDto(l.Id.ToString(), l.Name))
            .ToList();
    }

    public async Task<LibraryStaffDto> SetMyLocationConsentAsync(string status, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid)
            throw new ForbiddenException("Oturum bulunamadı.", "NO_SESSION");
        var staff = await uow.LibraryStaff.GetByAdminUserAsync(uid, ct)
            ?? throw new ConflictException("Personel kaydınız bulunmuyor.", "NOT_STAFF");

        staff.SetLocationConsent(status);
        uow.LibraryStaff.Update(staff);
        await uow.SaveChangesAsync(ct);
        return MapStaff(staff, await ActiveShiftMapAsync(ct));
    }

    private async Task<Dictionary<Guid, LibraryShift>> ActiveShiftMapAsync(CancellationToken ct)
        => (await uow.LibraryShifts.GetAllActiveAsync(ct)).GroupBy(x => x.StaffId).ToDictionary(g => g.Key, g => g.First());

    private async Task Log(AuditAction action, Guid id, string description, CancellationToken ct)
        => await audit.LogAsync(new AuditEntry { Action = action, EntityType = "LibraryStaff", EntityId = id, Module = "Library", Description = description }, ct);

    internal static LibraryStaffDto MapStaff(LibraryStaff x, Dictionary<Guid, LibraryShift> activeMap)
    {
        activeMap.TryGetValue(x.Id, out var activeShift);
        return new(
            x.Id.ToString(), x.AdminUserId?.ToString(), x.FullName, x.Email, x.Phone, x.RoleName,
            x.WorkingLibraryIds.Select(g => g.ToString()).ToList(), x.IsActive,
            activeShift?.Id.ToString(),
            activeShift?.LibraryId.ToString(),
            activeShift?.LibraryName,
            activeShift?.StartTime,
            x.LocationConsentStatus,
            x.LocationConsentUpdatedAt,
            x.CanEditOwnShifts,
            x.ParticipantId?.ToString(),
            x.HasDoorAccess,
            x.ParticipantId is not null ? "participant" : "admin");
    }

    internal static LibraryShiftDto MapShift(LibraryShift x, int anomalousHours = 14)
    {
        // Not: aktif mesaide "şu ana kadarki süre" gösterilir; bitmiş bir mesaide WorkedMinutes
        // null ise (eski toplu/otomatik kapatma kayıtları) null olarak KALIR — frontend bunu
        // "Süre bilinmiyor" olarak gösteriyor (bkz. MesaiTab.tsx/StaffDetailModal.tsx). Bu yüzden
        // burada EffectiveWorkedMinutes (null'ı 0'a çeviren toplama yardımcısı) KULLANILMAZ.
        var workedMinutes = x.Status == "active" ? x.EffectiveWorkedMinutes(DateTime.UtcNow) : x.WorkedMinutes;
        var isAnomalous = workedMinutes.HasValue && workedMinutes.Value > anomalousHours * 60;
        return new(
            x.Id.ToString(), x.StaffId.ToString(), x.StaffName, x.LibraryId.ToString(), x.LibraryName,
            x.StartTime, x.EndTime,
            workedMinutes,
            x.Status, x.InitiationType, x.InitiatedByName, x.Location, x.Notes, x.EndedByIpTakeover,
            x.AutoClosedAtCutoff, x.WasEdited, x.OriginalStartTime, x.OriginalEndTime, x.LastEditedByName, x.LastEditedAt, x.EditReason,
            isAnomalous);
    }
}
