using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Facilities;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure;

public class FacilityCrossProgramLimitGuardTests
{
    [Fact]
    public async Task Gecmis_yilda_yapilan_basvuru_aktif_yildaki_basvuruyu_engellemez()
    {
        var uow = new Mock<IUnitOfWork>();
        var settingsRepo = new Mock<IFacilitySettingsRepository>();
        var appRepo = new Mock<IFacilityApplicationRepository>();
        var regRepo = new Mock<IFacilityRegistrationRepository>();
        var branchRepo = new Mock<IFacilityBranchRepository>();

        // Aynı branş bloklama ve aynı kategori bloklama aktif
        settingsRepo
            .Setup(s => s.GetGeneralAsync("women-family", It.IsAny<CancellationToken>()))
            .ReturnsAsync(FacilitySettingsRecord.CreateGeneral("women-family", "{\"crossFacilitySameBranchBlocked\":true,\"crossFacilitySameCategoryBlocked\":true,\"crossFacilityYearlyMaxApplications\":2}", "admin"));

        var branchId = Guid.NewGuid();
        var branch = FacilityBranch.Create(new FacilityBranchData("women-family", "Aşçılık", "Mutfak", 1, 1, 10, true), "admin");
        branchRepo.Setup(b => b.GetByIdAsync(branchId, It.IsAny<CancellationToken>())).ReturnsAsync(branch);

        // 2025 yılına ait bir başvuru/kayıt simüle edilsin (sistem şu an 2026'da)
        // FindAsync expression'ı filtrelendiğinde a.AppliedAt.Year == currentYear şartından dolayı 2025 başvurusu dönmeyecek
        appRepo
            .Setup(a => a.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<FacilityApplication, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<FacilityApplication>()); // 2026'da hiç başvuru yok

        regRepo
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<FacilityRegistration, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<FacilityRegistration>());

        uow.Setup(u => u.FacilitySettings).Returns(settingsRepo.Object);
        uow.Setup(u => u.FacilityApplications).Returns(appRepo.Object);
        uow.Setup(u => u.FacilityRegistrations).Returns(regRepo.Object);
        uow.Setup(u => u.FacilityBranches).Returns(branchRepo.Object);

        var guard = new FacilityCrossProgramLimitGuard(uow.Object);

        // Exception fırlatmamalı — 2025 faaliyeti 2026'yı engellemez
        await guard.EnsureAllowedAsync("women-family", branchId, Guid.NewGuid(), Guid.NewGuid(), "11111111110", null, CancellationToken.None);
    }
}
