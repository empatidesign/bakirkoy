using System.Text.Json;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface IFacilityPeriodExpiryJob
{
    Task RunAsync(CancellationToken ct);
}

public class FacilityPeriodExpiryJob(IUnitOfWork uow, IAuditService audit, IFacilityRegistrationService registration, IFacilitySessionService sessions) : IFacilityPeriodExpiryJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        // Bulgu (2026-08-26, Hangfire denetimi): ham DateTime.UtcNow.Date yerine TurkeyTime
        // kullanılıyor — kardeş job TravelExpiryJob ile tutarlı, PeriodEnd/PeriodStart gibi
        // TurkeyDateTimeConverter üzerinden UTC-encode edilmiş Türkiye-yerel tarihlerle
        // karşılaştırmada gün kaymasını önler (bkz. TUR3 Hangfire raporu #3).
        var today = TurkeyTime.TodayDate();

        var recurringActive = await uow.FacilityGroups.FindAsync(
            g => g.IsActive && g.PeriodType == "recurring" && g.PeriodStart != null && g.PeriodMonths > 0, ct);
        var rolled = 0;
        foreach (var g in recurringActive)
        {
            var desired = FacilityPeriods.RollingHorizon(g.PeriodStart!.Value.Date, g.PeriodMonths, today, 1);
            if (g.PeriodEnd is not null && g.PeriodEnd.Value.Date >= desired.Date) continue;
            g.ExtendPeriodEnd(desired);
            uow.FacilityGroups.Update(g);
            await uow.SaveChangesAsync(ct);
            await sessions.GenerateIfEligibleAsync(g.Module, g.Id, ct);
            rolled++;
        }
        if (rolled > 0)
        {
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.BulkOperation,
                EntityType = "FacilityGroup",
                Module = "Facilities",
                Description = "Tekrarlı tesis programlarının dönemleri ilerletildi ve yeni dönem seansları üretildi",
                ActorUserName = "system/facility-period-roll",
                AdditionalDataJson = JsonSerializer.Serialize(new { rolled, today }),
            }, ct);
        }

        // Kullanıcı isteği (2026-08-04): dönemi/tarihi geçmiş bir grup/program (İzcilik Kampı dahil
        // tüm tesis modülleri) admin panelinde sonsuza kadar "Aktif" görünmeye devam ediyordu — bu
        // yalnızca vatandaşın kendi başvuru ekranında (FacilityApplicationWindow.Check, sadece
        // ApplyAsync tarafında) gizleniyordu, IsActive alanı hiç değişmiyordu. Sonuç: (a) vatandaş
        // "Aktif" görünen ama fiilen tarihi geçmiş bir programın detay sayfasına doğrudan linkle
        // erişebiliyordu, (b) admin panelinde filtrelenmedikçe geçmiş programlar aktif liste ile
        // karışıyordu. Süresi dolan gruplar artık burada otomatik pasife çekiliyor — bu, akademi
        // tipi (PeriodEnd genelde null, sürekli üyelik) grupları etkilemez, yalnızca gerçek bir
        // bitiş tarihi geçmiş VE hâlâ aktif işaretli gruplar için çalışır.
        var expiredGroups = await uow.FacilityGroups.FindAsync(
            g => g.IsActive && g.PeriodEnd != null && g.PeriodEnd.Value.Date < today, ct);
        if (expiredGroups.Count > 0)
        {
            foreach (var g in expiredGroups)
            {
                g.Deactivate();
                uow.FacilityGroups.Update(g);
            }
            await uow.SaveChangesAsync(ct);

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.BulkOperation,
                EntityType = "FacilityGroup",
                Module = "Facilities",
                Description = "Dönemi sona eren tesis programları otomatik pasife çekildi",
                ActorUserName = "system/facility-period-expiry",
                AdditionalDataJson = JsonSerializer.Serialize(new { deactivated = expiredGroups.Count, today }),
            }, ct);
        }

        var due = await uow.FacilityRegistrations.GetPeriodExpiredActiveAsync(today, ct);
        if (due.Count == 0) return;

        // Kullanıcı isteği: dönemi/hakkı dolan bir asıl üyelik pasife çekildiğinde, bağlı başvuru
        // (FacilityApplication) da "expired" işaretlenmeli — aksi halde ALREADY_APPLIED kontrolü
        // kişiyi aynı gruba/spora bir daha asla başvuramaz hale getiriyordu (canlı PoC'de doğrulandı:
        // 409 ALREADY_APPLIED). Yeni yıl/yeni dönem/başka bir katılım hakkı doğduğunda kişi tekrar
        // başvurabilsin diye application da senkron kapatılıyor.
        var appIds = due.Where(r => r.ApplicationId.HasValue).Select(r => r.ApplicationId!.Value).Distinct().ToList();
        if (appIds.Count > 0)
        {
            var apps = await uow.FacilityApplications.FindAsync(a => appIds.Contains(a.Id), ct);
            foreach (var app in apps)
            {
                app.ExpireMembership();
                uow.FacilityApplications.Update(app);
            }
        }

        foreach (var reg in due)
        {
            reg.Expire();
            uow.FacilityRegistrations.Update(reg);
        }
        await uow.SaveChangesAsync(ct);

        foreach (var groupId in due.Select(r => r.GroupId).Distinct())
            await registration.FillVacanciesAsync(groupId, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.BulkOperation,
            EntityType = "FacilityRegistration",
            Module = "Facilities",
            Description = "Dönemi sona eren tesis kayıtları kapatıldı",
            ActorUserName = "system/facility-period-expiry",
            AdditionalDataJson = JsonSerializer.Serialize(new { expired = due.Count, today }),
        }, ct);
    }
}
