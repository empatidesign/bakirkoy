using Hangfire;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.DutyPharmacies;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.DutyPharmacies;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface IDutyPharmacySyncJob
{
    Task RunAsync(CancellationToken ct);
}

/// DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR Hangfire denetimi, madde #5): aynı gerekçe ile
/// [DisableConcurrentExecution] eklendi (bkz. EventAttendanceReminderJob).
[DisableConcurrentExecution(timeoutInSeconds: 300)]
public class DutyPharmacySyncJob(
    IUnitOfWork uow,
    IDutyPharmacySyncClient client,
    ILogger<DutyPharmacySyncJob> logger) : IDutyPharmacySyncJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        IReadOnlyList<DutyPharmacySyncItem> items;
        try
        {
            items = await client.FetchSultangaziAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Nöbetçi eczane senkronizasyonu başarısız oldu.");
            return;
        }

        if (items.Count == 0)
        {
            logger.LogWarning("Nöbetçi eczane servisi Sultangazi için boş liste döndürdü — mevcut veri korunuyor.");
            return;
        }

        var dutyDate = TurkeyTime.Today();

        var existingBySicil = (await uow.DutyPharmacies.FindIncludingDeletedAsync(_ => true, ct))
            .ToDictionary(x => x.Sicil);

        var created = 0;
        var updated = 0;
        foreach (var item in items)
        {
            if (existingBySicil.TryGetValue(item.Sicil, out var existing))
            {
                existing.UpdateFromSync(
                    item.Name, item.Phone, item.Directions, item.Address, item.Neighborhood,
                    item.Latitude, item.Longitude, item.DutyEndTime, dutyDate);
                if (existing.IsDeleted)
                {
                    existing.IsDeleted = false;
                    existing.DeletedAt = null;
                }
                uow.DutyPharmacies.Update(existing);
                updated++;
            }
            else
            {
                var pharmacy = DutyPharmacy.Create(
                    item.Sicil, item.Name, item.Phone, item.Directions, item.Address, item.Neighborhood,
                    item.Latitude, item.Longitude, item.DutyEndTime, dutyDate);
                await uow.DutyPharmacies.AddAsync(pharmacy, ct);
                created++;
            }
        }

        // Kaynak servis günün içinde birden fazla kez senkronize ediliyor (her 3 saatte bir).
        // Aynı gün içinde listeden çıkan eczaneler önceden yalnızca "önceki güne ait" (DutyDate < dutyDate)
        // kayıtlarla sınırlı temizleniyordu; bu yüzden aynı günün eski batch'inden kalan eczaneler
        // silinmeyip yeni batch ile birlikte gösterilmeye devam ediyordu (liste tam anlamıyla güncellenmiyordu).
        // Artık aynı güne ait olup bu senkronizasyonda dönmeyen kayıtlar da stale kabul edilip pasife alınıyor.
        var syncedSicils = items.Select(i => i.Sicil).ToHashSet();
        var stale = existingBySicil.Values.Where(x => !x.IsDeleted && x.DutyDate <= dutyDate && !syncedSicils.Contains(x.Sicil)).ToList();
        foreach (var s in stale)
            uow.DutyPharmacies.Delete(s);

        await uow.SaveChangesAsync(ct);

        logger.LogInformation(
            "Nöbetçi eczane senkronizasyonu tamamlandı: {Created} yeni, {Updated} güncellendi, {DutyDate} tarihli {Total} kayıt.",
            created, updated, dutyDate, items.Count);
    }
}
