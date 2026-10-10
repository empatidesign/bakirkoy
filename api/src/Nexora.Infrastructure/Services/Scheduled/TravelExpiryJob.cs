using System.Text.Json;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface ITravelExpiryJob
{
    Task RunAsync(CancellationToken ct);
}

/// <summary>
/// Kullanıcı isteği (2026-08-07): "sefer tarihi geçmiş ise aktif durumda ise ... pasif yap
/// seferleri (seans değil)". FacilityPeriodExpiryJob'ın Gezi (Travel) modülü karşılığı — bitiş
/// tarihi geçmiş VE hâlâ "Aktif" işaretli bir sefer, admin panelinde sonsuza kadar aktif
/// görünmeye devam ediyordu (bkz. "Geçmiş Geziler" filtresi yalnızca listeleme tarafında
/// hidePast ile gizliyordu, IsActive alanı hiç değişmiyordu). Süresi geçmiş seferler artık
/// burada otomatik pasife çekiliyor. StartDate değil EndDate baz alınır — çok günlük bir sefer
/// başlamış ama henüz bitmemişse hâlâ aktif kalmalı.
/// </summary>
public class TravelExpiryJob(IUnitOfWork uow, IAuditService audit) : ITravelExpiryJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        // UAT 2026-09-24: EndDate UTC saklanır (TR gece yarısı = önceki gün 21:00Z). `.Date < today`
        // bugün biten kaydı bugün 00:xx'te pasife çekiyordu; TR gün başlangıcının UTC karşılığıyla kıyaslanır.
        var todayStartUtc = TurkeyTime.TodayStartUtc();

        var expiredTravels = await uow.Travels.FindAsync(
            t => t.IsActive && t.EndDate < todayStartUtc, ct);
        if (expiredTravels.Count == 0) return;

        foreach (var t in expiredTravels)
        {
            t.Deactivate();
            uow.Travels.Update(t);
        }
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.BulkOperation,
            EntityType = "Travel",
            Module = "Travels",
            Description = "Tarihi geçen seferler otomatik pasife çekildi",
            ActorUserName = "system/travel-expiry",
            AdditionalDataJson = JsonSerializer.Serialize(new { deactivated = expiredTravels.Count, today }),
        }, ct);
    }
}
