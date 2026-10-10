using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.DutyPharmacies;
using Nexora.Application.Features.DutyPharmacies.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.DutyPharmacies;

namespace Nexora.Infrastructure.Services.DutyPharmacies;

public class DutyPharmacyService(IUnitOfWork uow) : IDutyPharmacyService
{
    public async Task<List<CitizenDutyPharmacyDto>> GetActiveAsync(CancellationToken ct)
    {
        var pharmacies = await uow.DutyPharmacies.GetActiveAsync(ct);

        // Bulgu (2026-09-21 uçtan uca testi, J1): repository "en son DutyDate"i döndürüyor,
        // "bugünün tarihi"ni değil. Sync görevi bir gece çalışmazsa vatandaş dünün (ya da
        // daha eskinin) nöbetçisini hiçbir uyarı olmadan bugünün nöbetçisi sanıp kapalı bir
        // eczaneye gidebiliyordu. Kaydı tamamen gizlemek de yanlış olurdu: nöbet gece
        // yarısını aşar, yani sabaha karşı "dünün" kaydı hâlâ geçerli olabilir. Bu yüzden
        // veri gizlenmiyor, bayatlık bilgisi yanıtla birlikte istemciye bildiriliyor.
        var today = TurkeyTime.Today();
        return pharmacies.Select(p => Map(p, p.DutyDate < today)).ToList();
    }

    public async Task<DutyPharmacySyncStatusDto> GetSyncStatusAsync(CancellationToken ct)
    {
        var (lastSyncedAt, lastDutyDate, latestCount) = await uow.DutyPharmacies.GetSyncStatusAsync(ct);
        var isStale = lastDutyDate is null || lastDutyDate.Value < TurkeyTime.Today();
        return new DutyPharmacySyncStatusDto(lastSyncedAt, lastDutyDate, latestCount, isStale);
    }

    private static CitizenDutyPharmacyDto Map(DutyPharmacy p, bool isStale) => new(
        p.Id, p.Name, p.Phone, p.Directions, p.Address, p.Neighborhood,
        p.District, p.Latitude, p.Longitude, p.DutyEndTime, p.DutyDate, p.SyncedAt, isStale);
}
