using Microsoft.EntityFrameworkCore;
using Moq;
using Nexora.Application.Common.Repositories;
using Nexora.Infrastructure.Persistence;
using Npgsql;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Persistence;

// ULAK-04: TrackingNo unique-index ihlalinde (aynı ms + aynı rastgele son ek) kayıt kaybını önlemek için
// sınırlı yeniden üretim + insert retry. Yerel dayanıklılık; Ulakbell sözleşmesine bağlı değildir.
public class TrackingNoRetryTests
{
    private static DbUpdateException TrackingNoDuplicate() =>
        new("insert failed", new PostgresException(
            "duplicate key", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation,
            constraintName: "IX_CitizenSubmissions_TrackingNo"));

    private static DbUpdateException OtherUniqueViolation() =>
        new("insert failed", new PostgresException(
            "duplicate key", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation,
            constraintName: "IX_CitizenSubmissions_CitizenTc"));

    [Fact]
    public async Task SaveWithRetryAsync_cakismada_yeni_numara_uretip_tekrar_dener()
    {
        var uow = new Mock<IUnitOfWork>();
        uow.SetupSequence(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(TrackingNoDuplicate())
            .ThrowsAsync(TrackingNoDuplicate())
            .ReturnsAsync(1);

        var regenerations = 0;
        await TrackingNoRetry.SaveWithRetryAsync(uow.Object, () => regenerations++, CancellationToken.None);

        Assert.Equal(2, regenerations);
        uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(3));
    }

    [Fact]
    public async Task SaveWithRetryAsync_ilk_denemede_basarili_ise_yeniden_uretmez()
    {
        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var regenerations = 0;
        await TrackingNoRetry.SaveWithRetryAsync(uow.Object, () => regenerations++, CancellationToken.None);

        Assert.Equal(0, regenerations);
        uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SaveWithRetryAsync_baska_unique_ihlalini_yeniden_denemez()
    {
        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ThrowsAsync(OtherUniqueViolation());

        var regenerations = 0;
        await Assert.ThrowsAsync<DbUpdateException>(
            () => TrackingNoRetry.SaveWithRetryAsync(uow.Object, () => regenerations++, CancellationToken.None));

        Assert.Equal(0, regenerations);
        uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SaveWithRetryAsync_deneme_sinirini_asinca_hata_firlatir()
    {
        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ThrowsAsync(TrackingNoDuplicate());

        var regenerations = 0;
        await Assert.ThrowsAsync<DbUpdateException>(
            () => TrackingNoRetry.SaveWithRetryAsync(uow.Object, () => regenerations++, CancellationToken.None, maxAttempts: 3));

        uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(3));
        Assert.Equal(2, regenerations);
    }
}
