using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Kod denetimi 2026-08-02 (kullanıcı isteği: "WorkingLibraryIds⊆scope kısıtı, tasarım kararı
// bekliyor" öğesinin kapatılması). Önceden LibraryStaffService'te YALNIZCA GetEligibleAsync scope
// kontrolü yapıyordu (libraryId parametresiyle); GetPagedAsync/CreateAsync/UpdateAsync/DeleteAsync/
// ToggleStatusAsync/GetStaffShiftsAsync hiç scope kontrolü yapmıyordu — scope'lu bir kütüphane
// yöneticisi (superadmin olmayan) sistemdeki TÜM personeli görebiliyor, ID bilirse başka
// kütüphanenin personelini silebiliyor/pasifleştirebiliyor, hatta kendi göremediği bir
// kütüphaneye personel atayabiliyordu (WorkingLibraryIds'e gizlice ekleyerek).
public class LibraryStaffServiceScopeTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IUserScopeService> _userScope = new();
    private readonly Mock<ILibraryStaffRepository> _staff = new();
    private readonly Mock<ILibraryShiftRepository> _shifts = new();
    private readonly Mock<IAdminUserRepository> _adminUsers = new();
    private readonly Mock<IRoleRepository> _roles = new();
    private readonly Mock<ILibraryRepository> _libraries = new();
    private readonly Mock<IAdminUserManagementService> _adminManagement = new();
    private readonly LibraryStaffService _service;

    private static readonly Guid AdminUserId = Guid.NewGuid();
    private static readonly Guid ScopedLibraryId = Guid.NewGuid();
    private static readonly Guid OtherLibraryId = Guid.NewGuid();

    public LibraryStaffServiceScopeTests()
    {
        _uow.SetupGet(x => x.LibraryStaff).Returns(_staff.Object);
        _uow.SetupGet(x => x.LibraryShifts).Returns(_shifts.Object);
        _uow.SetupGet(x => x.AdminUsers).Returns(_adminUsers.Object);
        _uow.SetupGet(x => x.Roles).Returns(_roles.Object);
        _uow.SetupGet(x => x.Libraries).Returns(_libraries.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _shifts.Setup(x => x.GetActiveByStaffAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync((LibraryShift?)null);
        _shifts.Setup(x => x.GetAllActiveAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _shifts.Setup(x => x.GetByStaffAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);

        _currentUser.SetupGet(x => x.Id).Returns(AdminUserId);
        _userScope.Setup(x => x.GetScopedRefIdsAsync(AdminUserId, "library", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<Guid> { ScopedLibraryId });

        _service = new LibraryStaffService(_uow.Object, _audit.Object, _currentUser.Object, _userScope.Object, _adminManagement.Object);
    }

    private static LibraryStaff CreateStaff(params Guid[] workingLibraryIds)
        => LibraryStaff.Create(Guid.NewGuid(), null, "Test Personel", "test@example.com", "05551234567", "Rol", [.. workingLibraryIds]);

    [Fact]
    public async Task GetStaffShiftsAsync_scope_disi_personele_erisim_NotFound_firlatir()
    {
        var staff = CreateStaff(OtherLibraryId);
        _staff.Setup(x => x.GetByIdAsync(staff.Id, It.IsAny<CancellationToken>())).ReturnsAsync(staff);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetStaffShiftsAsync(staff.Id, CancellationToken.None));
        Assert.Equal("STAFF_NOT_FOUND", ex.ErrorCode);

        _shifts.Verify(x => x.GetByStaffAsync(staff.Id, It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetStaffShiftsAsync_scope_icindeki_personele_erisim_izin_verir()
    {
        var staff = CreateStaff(ScopedLibraryId, OtherLibraryId);
        _staff.Setup(x => x.GetByIdAsync(staff.Id, It.IsAny<CancellationToken>())).ReturnsAsync(staff);

        var result = await _service.GetStaffShiftsAsync(staff.Id, CancellationToken.None);
        Assert.NotNull(result);
    }

    [Fact]
    public async Task DeleteAsync_scope_disi_personel_silme_NotFound_firlatir()
    {
        var staff = CreateStaff(OtherLibraryId);
        _staff.Setup(x => x.GetByIdAsync(staff.Id, It.IsAny<CancellationToken>())).ReturnsAsync(staff);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.DeleteAsync(staff.Id, CancellationToken.None));
        Assert.Equal("STAFF_NOT_FOUND", ex.ErrorCode);

        _staff.Verify(x => x.Delete(It.IsAny<LibraryStaff>()), Times.Never);
    }

    [Fact]
    public async Task ToggleStatusAsync_scope_disi_personel_ToggleEtme_NotFound_firlatir()
    {
        var staff = CreateStaff(OtherLibraryId);
        _staff.Setup(x => x.GetByIdAsync(staff.Id, It.IsAny<CancellationToken>())).ReturnsAsync(staff);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ToggleStatusAsync(staff.Id, CancellationToken.None));
        Assert.Equal("STAFF_NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public async Task CreateAsync_scope_disi_kutuphaneye_atama_Forbidden_firlatir()
    {
        var admin = Nexora.Domain.Entities.Auth.AdminUser.Create("Yeni Personel", "yeni@example.com", "05551234567", null, "hash", Guid.NewGuid());
        _adminUsers.Setup(x => x.GetByIdAsync(admin.Id, It.IsAny<CancellationToken>())).ReturnsAsync(admin);
        _staff.Setup(x => x.ExistsByAdminUserAsync(admin.Id, null, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var req = new LibraryStaffRequest(admin.Id, null, [ScopedLibraryId, OtherLibraryId], false);

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            _service.CreateAsync(req, CancellationToken.None));
        Assert.Equal("LIBRARY_OUT_OF_SCOPE", ex.ErrorCode);

        _staff.Verify(x => x.AddAsync(It.IsAny<LibraryStaff>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_yalnizca_scope_icindeki_kutuphanelerle_basarili_olur()
    {
        var admin = Nexora.Domain.Entities.Auth.AdminUser.Create("Yeni Personel", "yeni@example.com", "05551234567", null, "hash", Guid.NewGuid());
        _adminUsers.Setup(x => x.GetByIdAsync(admin.Id, It.IsAny<CancellationToken>())).ReturnsAsync(admin);
        _staff.Setup(x => x.ExistsByAdminUserAsync(admin.Id, null, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var req = new LibraryStaffRequest(admin.Id, null, [ScopedLibraryId], false);

        var result = await _service.CreateAsync(req, CancellationToken.None);
        Assert.NotNull(result);
        _staff.Verify(x => x.AddAsync(It.IsAny<LibraryStaff>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_scope_disi_personelin_kaydini_guncelleme_NotFound_firlatir()
    {
        var staff = CreateStaff(OtherLibraryId);
        _staff.Setup(x => x.GetByIdAsync(staff.Id, It.IsAny<CancellationToken>())).ReturnsAsync(staff);

        var req = new LibraryStaffRequest(staff.AdminUserId, null, [OtherLibraryId], false);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.UpdateAsync(staff.Id, req, CancellationToken.None));
        Assert.Equal("STAFF_NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public async Task UpdateAsync_scope_icindeki_personeli_scope_disi_kutuphaneye_ekleme_Forbidden_firlatir()
    {
        var staff = CreateStaff(ScopedLibraryId);
        _staff.Setup(x => x.GetByIdAsync(staff.Id, It.IsAny<CancellationToken>())).ReturnsAsync(staff);

        // Kişi zaten scope içindeki bir kütüphanede çalışıyor (erişim serbest), ama gizlice
        // scope dışı bir kütüphaneye de atanmaya çalışılıyor — bu reddedilmeli.
        var req = new LibraryStaffRequest(staff.AdminUserId, null, [ScopedLibraryId, OtherLibraryId], false);

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            _service.UpdateAsync(staff.Id, req, CancellationToken.None));
        Assert.Equal("LIBRARY_OUT_OF_SCOPE", ex.ErrorCode);

        _staff.Verify(x => x.Update(It.IsAny<LibraryStaff>()), Times.Never);
    }

    [Fact]
    public async Task Unscoped_superadmin_icin_hicbir_kisit_uygulanmaz()
    {
        _userScope.Setup(x => x.GetScopedRefIdsAsync(AdminUserId, "library", It.IsAny<CancellationToken>()))
            .ReturnsAsync((HashSet<Guid>?)null);

        var staff = CreateStaff(OtherLibraryId);
        _staff.Setup(x => x.GetByIdAsync(staff.Id, It.IsAny<CancellationToken>())).ReturnsAsync(staff);

        // Unscoped kullanıcı için scope dışı personele erişim de serbest olmalı (regresyon yok).
        var result = await _service.GetStaffShiftsAsync(staff.Id, CancellationToken.None);
        Assert.NotNull(result);
    }
}
