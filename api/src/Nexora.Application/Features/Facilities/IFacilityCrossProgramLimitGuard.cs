namespace Nexora.Application.Features.Facilities;

// Kullanıcı isteği (2026-10-05, Kadın ve Aile Merkezi): FacilityParticipationLimitGuard'daki
// desenin aynısı — TÜM giriş yollarında (vatandaş başvuru, admin başvuru/onay) tek kaynaktan
// uygulanan, aynı-program-farklı-tesis engeli + modül-geneli yıllık toplam başvuru tavanı.
public interface IFacilityCrossProgramLimitGuard
{
    Task EnsureAllowedAsync(
        string module,
        Guid branchId,
        Guid facilityId,
        Guid? participantId,
        string? tckn,
        Guid? excludeApplicationId,
        CancellationToken ct);
}
