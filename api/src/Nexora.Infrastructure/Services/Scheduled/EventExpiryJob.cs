using System.Text.Json;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface IEventExpiryJob
{
    Task RunAsync(CancellationToken ct);
}

/// <summary>
/// Kullanıcı isteği (2026-08-29): "herhangi bir etkinlik ve program kaydı citizen portalda
/// nerde tutulacak listesini görmeli, bu da günü geçtiğinde program veya gezi vs bu kayıtlı
/// alandan da kalkmalı veya süresi geçti diye onu soft delete yapmalı". Facility (bkz.
/// FacilityPeriodExpiryJob) ve Travel (bkz. TravelExpiryJob) modüllerinde tarihi geçmiş bir
/// program/sefer hâlâ "Aktif" işaretli kalıp sonsuza kadar admin panelinde/vatandaş portalında
/// aktifmiş gibi görünmeye devam ediyordu — bu ikisi için zaten otomatik pasife çekme job'ı
/// vardı. Events (Etkinlik) modülünde AYNI IsActive/Deactivate() alt yapısı olmasına rağmen
/// bu üçüncü modülde hiç eşdeğer bir job yoktu — tarihi geçmiş bir etkinlik IsActive=true
/// kalmaya devam ediyordu (yalnızca citizen-portal tarafında ApplicationsTab/ApplicationsAllPage
/// isPastDay ile listeleme zamanında gizliyordu, veritabanı kaydı hiç değişmiyordu; bu da
/// FacilityPeriodExpiryJob'ın 2026-08-04 tarihli yorumunda belgelenen aynı boşluğun (a) admin
/// panelinde geçmiş etkinliklerin "Aktif" filtrelenmeden aktif listeyle karışması, (b) doğrudan
/// linkle erişilebilir kalması riskini taşıyordu.
///
/// Event.EndDate zaten IsSingleDay=true olan etkinliklerde StartDate'e eşitleniyor (bkz.
/// Event.cs constructor), yani çok günlük/tek günlük fark etmeksizin doğru "bitiş" alanı budur.
/// Seans (Session) bazlı etkinliklerde de EndDate üst düzeyde tutulur (Session tarihleri
/// EndDate'i aşamaz — form validasyonu ile garanti edilir), bu yüzden ayrıca Session tablosuna
/// bakmaya gerek yoktur (TravelExpiryJob'ın StartDate değil EndDate baz alması ile aynı mantık).
/// </summary>
public class EventExpiryJob(IUnitOfWork uow, IAuditService audit) : IEventExpiryJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        // UAT 2026-09-24: EndDate UTC saklanır (TR gece yarısı = önceki gün 21:00Z). `.Date < today`
        // bugün biten kaydı bugün 00:xx'te pasife çekiyordu; TR gün başlangıcının UTC karşılığıyla kıyaslanır.
        var todayStartUtc = TurkeyTime.TodayStartUtc();

        var expiredEvents = await uow.Events.FindAsync(
            e => e.IsActive && e.EndDate < todayStartUtc, ct);
        if (expiredEvents.Count == 0) return;

        foreach (var e in expiredEvents)
        {
            e.Deactivate();
            uow.Events.Update(e);
        }
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.BulkOperation,
            EntityType = "Event",
            Module = "Events",
            Description = "Tarihi geçen etkinlikler otomatik pasife çekildi",
            ActorUserName = "system/event-expiry",
            AdditionalDataJson = JsonSerializer.Serialize(new { deactivated = expiredEvents.Count, today }),
        }, ct);
    }
}
