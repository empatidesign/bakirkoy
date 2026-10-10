using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Application.Features.ParticipantFacilities.Dtos;
using Microsoft.Extensions.Configuration;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Infrastructure.Services;

public class FacilityRegistrationService(IUnitOfWork uow, ICurrentUser current, IFacilityNotificationService notification, IExcelService excelService, IUserScopeService userScope, IConfiguration config, IFacilityParticipationLimitGuard participationLimitGuard, IFacilityCrossProgramLimitGuard crossProgramLimitGuard) : IFacilityRegistrationService
{
    private string SultangaziDistrictCode => config.GetValue("Residency:SultangaziDistrictCode", ResidencyPolicy.DefaultSultangaziDistrictCode)!;


    // basvuruhitetmeyenkurallar.md sonrası UI-envanteri: admin panelde "Genel Ayarlar > Kontenjan &
    // Yedek Liste > Yedek liste aktif" toggle'ı kaydediliyordu ama hiçbir yerde okunmadığı için
    // fiilen çalışmıyordu — kapatılsa da ReserveCapacity>0 olan gruplarda yedek listeye düşüş devam
    // ediyordu. Artık bu global switch, grup kapasitesi hesaplamasının önünde gerçek bir kapı.
    private async Task<bool> WaitlistEnabledAsync(string module, CancellationToken ct)
    {
        var settings = await uow.FacilitySettings.GetGeneralAsync(module, ct);
        return Nexora.Application.Features.Facilities.FacilitySettingsValues.Bool(settings?.SettingsJson, "waitlistEnabled") ?? true;
    }

    public async Task<FacilityRegistrationDto> RegisterAsync(string module, RegisterParticipantRequest req, CancellationToken ct)
    {
        // COM-CAP-002: farklı iki kullanıcının aynı grubun SON boş kontenjanına eşzamanlı başvurması
        // race condition'ına karşı Postgres transaction-scoped advisory lock ile serileştiriyoruz.
        // GroupId+Tckn (aynı kullanıcı) COM-DUP'ta DB unique index ile korunuyordu; burada farklı
        // kullanıcılar arası "say-sonra-yaz" (check-then-insert) kapasite yarışını kapatıyoruz.
        // Çağıran (örn. ParticipantFacilityService.ApplyAsync) zaten bir transaction açmış olabilir;
        // bu durumda yeni bir transaction AÇMIYORUZ (EF Core iç içe transaction'ı desteklemiyor),
        // sadece kilidi mevcut transaction üzerinde alıyoruz.
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            var dto = await RegisterCoreAsync(module, req, ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
            return dto;
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }
    }

    private async Task<FacilityRegistrationDto> RegisterCoreAsync(string module, RegisterParticipantRequest req, CancellationToken ct)
    {
        var group = await EnsureGroupAsync(module, req.GroupId, ct);

        // Kilit anahtarı: grup GUID'inin ilk 8 baytından türetilen sabit long. Aynı gruba eşzamanlı
        // gelen tüm RegisterAsync çağrıları burada sıraya girer; transaction bitince otomatik açılır.
        await uow.AcquireAdvisoryLockAsync(GroupLockKey(group.Id), ct);

        var roster = await uow.FacilityRegistrations.GetByGroupAsync(req.GroupId, ct);
        var existing = roster.Where(r => r.Tckn == req.Tckn).ToList();
        if (existing.Count > 0)
        {
            var appIds = existing.Where(r => r.ApplicationId.HasValue).Select(r => r.ApplicationId!.Value).Distinct().ToList();
            var liveAppIds = appIds.Count > 0
                ? (await uow.FacilityApplications.FindAsync(a => appIds.Contains(a.Id) && !a.IsDeleted, ct))
                    .Select(a => a.Id).ToHashSet()
                : new HashSet<Guid>();

            var orphans = existing.Where(r =>
                r.ApplicationId.HasValue && !liveAppIds.Contains(r.ApplicationId.Value)).ToList();
            var trulyRegistered = existing.Any(r =>
                !r.ApplicationId.HasValue || liveAppIds.Contains(r.ApplicationId.Value));

            if (trulyRegistered)
                throw new ConflictException("Bu kişi zaten bu gruba kayıtlı.", "ALREADY_REGISTERED");

            foreach (var orphan in orphans)
            {
                orphan.Remove("Yetim kayıt otomatik temizlendi (başvuru iptal/silinmiş)");
                uow.FacilityRegistrations.Update(orphan);
            }
            if (orphans.Count > 0) await uow.SaveChangesAsync(ct);
        }

        await EnsureEligibilityAsync(group, req, ct);

        // K01/V06/Y05: doğrudan admin kayıt (ve toplu ön-kayıt bu yolu kullanır) da dinamik katılım limitine
        // tabidir — grup kilidi altında, admin/vatandaş başvuru yoluyla AYNI ortak guard ile (kimlik-birleşim).
        // BUG FİX (2026-10-02, mega-test-1000 ile bulundu): vatandaş kendi başvurusunu yaptığında
        // (ParticipantFacilityService.ApplyAsync, autoApprove=true), FacilityApplication SATIRI ÖNCE
        // kaydedilip SaveChangesAsync ile DB'ye yazılıyor, SONRA bu RegisterAsync çağrılıyordu —
        // excludeApplicationId=null geçildiği için guard, DAHA ÖNCE KENDİSİ TARAFINDAN KAYDEDİLEN bu
        // başvuruyu da sayıma dahil ediyordu. attendanceLimitCount=1 (en yaygın "dönemde 1 kez" ayarı)
        // olduğunda bu, HER İLK BAŞVURUYU 409 PARTICIPATION_LIMIT_REACHED ile reddediyordu — yani
        // weekly/monthly/yearly + count=1 ayarlı HİÇBİR grupta hiçbir vatandaş (admin manuel kayıt
        // hariç) asla başvuramıyordu. req.ApplicationId artık kendi başvurusunu hariç tutmak için
        // guard'a geçiriliyor (admin'in doğrudan-kayıt yolunda ApplicationId=null olduğu için davranış
        // değişmez, o yol hiçbir zaman bu çift-sayım sorununu yaşamıyordu).
        await participationLimitGuard.EnsureWithinLimitAsync(module, group, req.ParticipantId, req.Tckn, req.BirthDate, req.ApplicationId, ct);
        await crossProgramLimitGuard.EnsureAllowedAsync(module, group.BranchId, group.FacilityId, req.ParticipantId, req.Tckn, req.ApplicationId, ct);

        await EnsureNoSameDayConflictAsync(module, req.Tckn, group, ct);

        string kind;
        int order = 0;
        DateTime? periodEnd = null;
        DateTime? membershipStart = null;
        int periodIndex = 0;
        var waitlistEnabled = await WaitlistEnabledAsync(module, ct);
        var target = RegistrationTargets.Normalize(req.Target);

        // Kullanıcı isteği (2026-10-06): yönetici TC ile aktarırken kişiyi doğrudan YEDEK listeye
        // ekleyebilsin (asıl kontenjan boş olsa bile). DemoteAsync ile aynı kurallar: yedek liste
        // kapalıysa veya yedek kontenjanı (0 = gerçek sıfır) doluysa reddedilir. Akademi gruplarında
        // yedek kavramı yoktur (her zaman sürekli asıl üye).
        if (target == RegistrationTargets.Reserve)
        {
            if (group.Type == "akademi")
                throw new ConflictException("Akademi gruplarında yedek liste yoktur; kişi asıl üye olarak eklenebilir.", "WAITLIST_NOT_SUPPORTED");
            if (!waitlistEnabled)
                throw new ConflictException("Yedek liste kapalı; yedeğe eklenemez.", "WAITLIST_DISABLED");
            var activeReserves = roster.Where(r => r.Kind == "reserve" && r.Status == "active").ToList();
            if (activeReserves.Count >= group.ReserveCapacity)
                throw new ConflictException("Yedek kontenjanı dolu.", "QUOTA_FULL");
            kind = "reserve";
            order = activeReserves.Select(r => r.WaitlistOrder).DefaultIfEmpty(0).Max() + 1;
            if (group.PeriodType == "recurring" && group.PeriodStart.HasValue && group.PeriodMonths > 0)
            {
                var pStart = group.PeriodStart.Value.Date;
                var reference = (req.MembershipDate ?? TurkeyTime.NowWallClock()).Date;
                periodIndex = FacilityPeriods.IndexAt(pStart, group.PeriodMonths, reference < pStart ? pStart : reference);
            }
        }
        else
        // Kullanıcı isteği: Akademi/müsabık gruplar (TC kimlik listesiyle alınan katılımcılar) her
        // zaman "sürekli üye" — kontenjan/yedek mantığına hiç girmez (TC listesi zaten admin'in
        // belirlediği sınır), süre/dönem bitişi yok (PeriodEnd=null => FacilityPeriodExpiryJob asla
        // bu kaydı süresi dolmuş sayıp pasifleştirmez), devamsızlık RecomputeUsageAsync'te sadece
        // izlenir, otomatik çıkarma tetiklemez (bkz. autoRemove kontrolü).
        // YORUM VARSAYIMI (kesinleştirilmedi): Kullanıcı "akademi içinde... müsabık grupsa" dedi —
        // bu, TÜM akademi gruplarının mı yoksa akademi içindeki BELİRLİ bir alt kümenin mi (müsabık)
        // bu davranışa sahip olması gerektiği konusunda belirsiz. Sistemde kurs/akademi dışında üçüncü
        // bir tip veya "müsabık" toggle'ı olmadığı doğrulandı, bu yüzden "type=akademi" == "müsabık"
        // olarak yorumlanıp TÜM akademi gruplarına uygulandı. Eğer kullanıcının kastı sadece akademi
        // içindeki bir alt küme ise (örn. ayrı bir "müsabık" bayrağı gerekiyorsa), bu üç kod noktası
        // (burada + FillVacanciesAsync + PeriodEnd ataması) revize edilmeli.
        if (group.Type == "akademi")
        {
            kind = "main";
            membershipStart = req.MembershipDate ?? TurkeyTime.NowWallClock().Date;
            periodEnd = null;
        }
        else if (group.PeriodType == "recurring" && group.PeriodStart.HasValue && group.PeriodMonths > 0)
        {
            var pStart = group.PeriodStart.Value.Date;
            var months = group.PeriodMonths;
            var reference = (req.MembershipDate ?? TurkeyTime.NowWallClock()).Date;
            var effStart = reference < pStart ? pStart : reference;
            var mEnd = effStart.AddMonths(months);
            periodIndex = FacilityPeriods.IndexAt(pStart, months, effStart);

            var overlapped = FacilityPeriods.Overlapping(pStart, months, effStart, mEnd);
            var mains = roster.Where(r => r.Kind == "main" && r.Status == "active").ToList();
            var roomInAll = group.Capacity <= 0 || overlapped.All(p =>
                mains.Count(m => (m.MembershipStart ?? pStart) < p.End && (m.PeriodEnd ?? DateTime.MaxValue) > p.Start) < group.Capacity);

            if (roomInAll)
            {
                kind = "main";
                membershipStart = effStart;
                periodEnd = mEnd;
            }
            else if (!waitlistEnabled)
            {
                throw new ConflictException("Grup kontenjanı dolu.", "QUOTA_FULL");
            }
            else
            {
                // V03: carry (D02) ile tutarlı — yedek kuyruğu sürekli/tek olduğundan yedek kapasitesi ve
                // yeni sıra dönem-bağımsız TÜM aktif yedekler üzerinden hesaplanır (per-PeriodIndex değil).
                var waitForPeriod = roster.Count(r => r.Kind == "reserve" && r.Status == "active");
                // SORUN (2026-09-23, QA madde 74 — kanıtlanmış canlı bug): ReserveCapacity=0,
                // ana Capacity'deki "0 = sınırsız" kuralıyla YANLIŞLIKLA aynı yorumlanıyordu.
                // Admin panelde "Yedek Kontenjan" alanı varsayılan boş bırakılır ve "0 = sınırsız"
                // ipucu YOK (diğer gerçek sınırsız alanlarının aksine) — yani 0 burada gerçek
                // sıfır anlamına gelir. Eskiden 0 iken yedek liste sınırsız kabul edilip asıl
                // kontenjan dolduktan sonra da sessizce kayıt alınıyordu (frontend "Dolu" gösterip
                // butonu kilitlerken backend hâlâ kabul ediyordu).
                if (waitForPeriod < group.ReserveCapacity)
                {
                    kind = "reserve";
                    order = waitForPeriod + 1;
                }
                else
                {
                    throw new ConflictException("Grup ve yedek kontenjanı dolu.", "QUOTA_FULL");
                }
            }
        }
        else
        {
            var (mainCount, waitlistCount) = await uow.FacilityRegistrations.GetCountsByGroupAsync(req.GroupId, ct);
            if (group.Capacity <= 0 || mainCount < group.Capacity)
            {
                kind = "main";
                membershipStart = group.PeriodStart;
                periodEnd = group.PeriodEnd;
            }
            else if (!waitlistEnabled)
            {
                throw new ConflictException("Grup kontenjanı dolu.", "QUOTA_FULL");
            }
            // Bkz. yukarıdaki not (satır ~141) — ReserveCapacity=0 artık gerçek sıfır sayılır.
            else if (waitlistCount < group.ReserveCapacity)
            {
                kind = "reserve";
                order = waitlistCount + 1;
            }
            else
            {
                throw new ConflictException("Grup ve yedek kontenjanı dolu.", "QUOTA_FULL");
            }
        }

        // "main" hedefi: yönetici yalnızca asıl listeye eklemek istedi; kontenjan doluysa yedeğe düşürme.
        if (target == RegistrationTargets.Main && kind == "reserve")
            throw new ConflictException("Asıl kontenjan dolu.", "QUOTA_FULL");

        var registration = FacilityRegistration.Create(
            module, group.FacilityId, group.Id, group.BranchId, req.ApplicationId, req.ParticipantId,
            req.FullName, req.Tckn, req.Phone, req.BirthDate, req.GuardianPhone, kind, order, periodEnd, membershipStart, periodIndex);

        await uow.FacilityRegistrations.AddAsync(registration, ct);
        await uow.SaveChangesAsync(ct);
        await UpdateGroupCountsAsync(group.Id, ct);
        await uow.SaveChangesAsync(ct);

        return ToDto(registration, group.Name);
    }

    public async Task EnsureCapacityAvailableAsync(string module, Guid groupId, DateTime? membershipDate, CancellationToken ct)
    {
        var group = await EnsureGroupAsync(module, groupId, ct);
        if (group.Type == "akademi") return;

        await uow.AcquireAdvisoryLockAsync(GroupLockKey(group.Id), ct);

        var waitlistEnabled = await WaitlistEnabledAsync(module, ct);
        var roster = await uow.FacilityRegistrations.GetByGroupAsync(groupId, ct);

        if (group.PeriodType == "recurring" && group.PeriodStart.HasValue && group.PeriodMonths > 0)
        {
            var pStart = group.PeriodStart.Value.Date;
            var months = group.PeriodMonths;
            var reference = (membershipDate ?? TurkeyTime.NowWallClock()).Date;
            var effStart = reference < pStart ? pStart : reference;
            var mEnd = effStart.AddMonths(months);
            var periodIndex = FacilityPeriods.IndexAt(pStart, months, effStart);

            var overlapped = FacilityPeriods.Overlapping(pStart, months, effStart, mEnd);
            var mains = roster.Where(r => r.Kind == "main" && r.Status == "active").ToList();
            var roomInAll = group.Capacity <= 0 || overlapped.All(p =>
                mains.Count(m => (m.MembershipStart ?? pStart) < p.End && (m.PeriodEnd ?? DateTime.MaxValue) > p.Start) < group.Capacity);

            if (roomInAll) return;
            if (!waitlistEnabled) throw new ConflictException("Grup kontenjanı dolu.", "QUOTA_FULL");

            // V03/D02 (carry): yedek kuyruğu sürekli/tek — kapasite ön-kontrolü de RegisterCoreAsync ile
            // birebir aynı şekilde TÜM aktif yedekler üzerinden yapılır (dönem-bazlı süzme değil).
            var waitForPeriod = roster.Count(r => r.Kind == "reserve" && r.Status == "active");
            // Bkz. RegisterAsync içindeki not (satır ~141) — ReserveCapacity=0 gerçek sıfırdır.
            if (waitForPeriod < group.ReserveCapacity) return;
            throw new ConflictException("Grup ve yedek kontenjanı dolu.", "QUOTA_FULL");
        }

        var (mainCount, waitlistCount) = await uow.FacilityRegistrations.GetCountsByGroupAsync(groupId, ct);
        if (group.Capacity <= 0 || mainCount < group.Capacity) return;
        if (!waitlistEnabled) throw new ConflictException("Grup kontenjanı dolu.", "QUOTA_FULL");
        if (waitlistCount < group.ReserveCapacity) return;
        throw new ConflictException("Grup ve yedek kontenjanı dolu.", "QUOTA_FULL");
    }

    public async Task<List<FacilityRegistrationDto>> GetRosterAsync(string module, Guid groupId, CancellationToken ct)
    {
        var group = await EnsureGroupAsync(module, groupId, ct);
        var roster = await uow.FacilityRegistrations.GetByGroupAsync(groupId, ct);
        return roster.Select(r => ToDto(r, group.Name)).ToList();
    }

    public async Task<(byte[] Content, string FileName)> ExportRosterAsync(string module, Guid groupId, CancellationToken ct)
    {
        var group = await EnsureGroupAsync(module, groupId, ct);
        var roster = await uow.FacilityRegistrations.GetByGroupAsync(groupId, ct);
        var items = roster.Select(r => ToDto(r, group.Name)).ToList();
        var moduleLabel = Nexora.Application.Features.ParticipantFacilities.Dtos.FacilityModuleLabels.For(module);

        var bytes = excelService.BuildFacilityRosterExport(items, group.Name, moduleLabel);
        var safeName = string.Concat(group.Name.Where(c => !Path.GetInvalidFileNameChars().Contains(c))).Trim();
        return (bytes, $"{safeName}-katilimci-listesi-{DateTime.Now:yyyyMMdd}.xlsx");
    }

    public async Task<List<FacilityRegistrationDto>> GetWaitlistAsync(string module, Guid groupId, CancellationToken ct)
    {
        var group = await EnsureGroupAsync(module, groupId, ct);
        var waitlist = await uow.FacilityRegistrations.GetWaitlistByGroupAsync(groupId, ct);
        return waitlist.Select(r => ToDto(r, group.Name)).ToList();
    }

    public async Task RemoveAsync(string module, Guid registrationId, string? reason, CancellationToken ct)
    {
        // D04: durum geçişi + yer boşaltma + terfi tek atomik işlem — ortak grup kilidi + transaction.
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        IReadOnlyList<FacilityDeferredNoticeDto> notices;
        try
        {
            notices = await RemoveCoreAsync(module, registrationId, reason, ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        // V02: bildirimler yalnız BU metot transaction'ı sahiplenip commit ettiyse gönderilir. Dış bir
        // transaction'a katıldıysak (ör. devamsızlık yolu SaveRosterAsync) commit HENÜZ olmamıştır ve
        // dış işlem rollback olabilir → SMS gönderilmez; bildirim gönderimini dış çağıran
        // (RemoveForBatchAsync üzerinden) commit sonrası üstlenir.
        if (ownsTransaction)
            foreach (var n in notices) await SendDeferredAsync(n, ct);
    }

    // V02.2: yoklama/devamsızlık akışı gibi DIŞ bir transaction içinde çağrılır — kaydı çıkarır,
    // ürettiği bildirimleri GÖNDERMEZ, çağırana döndürür. Çağıran dış transaction commit olduktan
    // SONRA gönderir; rollback olursa hiç gitmez.
    public async Task<IReadOnlyList<FacilityDeferredNoticeDto>> RemoveForBatchAsync(string module, Guid registrationId, string? reason, CancellationToken ct)
        => await RemoveCoreAsync(module, registrationId, reason, ct);

    private async Task<IReadOnlyList<FacilityDeferredNoticeDto>> RemoveCoreAsync(string module, Guid registrationId, string? reason, CancellationToken ct)
    {
        var registration = await GetOwnedAsync(module, registrationId, ct);
        var groupId = registration.GroupId;
        PromotedNotice? promoted = null;

        await uow.AcquireAdvisoryLockAsync(GroupLockKey(groupId), ct);
        // V02: kilit sonrası kaydı DB'den GERÇEKTEN yenile — aynı DbContext'in izlediği eski nesneyi
        // tekrar sorgulamak stale kalabilir; Reload ile kilit beklerken değişmiş durumu görürüz.
        await uow.ReloadAsync(registration, ct);
        registration = await GetOwnedAsync(module, registrationId, ct);
        // D04: zaten aktif değilse (ikinci/eşzamanlı çıkarma isteği) yeni yer boşaltma — idempotent no-op.
        if (registration.Status != "active")
            return [];

        var wasMain = registration.Kind == "main";
        var wasReserve = registration.Kind == "reserve";

        registration.Remove(reason);
        uow.FacilityRegistrations.Update(registration);

        // Kullanıcı bulgusu: asıl/yedek listesinden bir kişi manuel olarak çıkarıldığında
        // (Remove), yalnızca FacilityRegistration pasifleştiriliyordu — bağlı FacilityApplication
        // "approved"/"waitlist" statüsünde sonsuza kadar takılı kalıyordu. Bu yüzden başvurular
        // listesinde kişi hâlâ onaylı/yedek görünüyordu, üstelik HasActiveApplicationAsync bu
        // "aktif" statüyü gördüğü için kişi aynı gruba tekrar da başvuramıyordu. Görev: "sadece
        // programdan çıkarma değil, başvuruyu tamamen iptal etmesi gerekiyor" — bağlı başvuru
        // artık burada "rejected" olarak kapatılıyor (mevcut Reject akışıyla tutarlı; "rejected"
        // durumu zaten HasActiveApplicationAsync/AppliedGroupIdsAsync tarafından hariç tutulduğu
        // için kişi isterse aynı gruba yeniden başvurabilir).
        if (registration.ApplicationId.HasValue)
        {
            var app = await uow.FacilityApplications.GetByIdAsync(registration.ApplicationId.Value, ct);
            if (app is not null && app.Status is "approved" or "waitlist" or "pending")
            {
                app.Reject(reason ?? "Kayıt yönetici tarafından programdan çıkarıldı.", current.Name);
                uow.FacilityApplications.Update(app);
            }
        }

        if (wasMain)
        {
            // Z02: çıkarmayı terfi kapasite kontrolünden ÖNCE kalıcılaştır — böylece PromoteNextWaitlistAsync
            // içindeki tam-aralık doluluk sorgusu, boşalan bu kaydı "dolu" saymaz (henüz kaydedilmemiş
            // çıkarılmış kişiyi kapasitede sayıp yanlış ret üretmeyi önler).
            await uow.SaveChangesAsync(ct);
            promoted = await PromoteNextWaitlistAsync(registration.GroupId, ct);
        }
        // Canlı test bulgusu (2026-09-25): bir MAIN kayıt silindiğinde PromoteNextWaitlistAsync
        // kalan yedekleri baştan numaralandırıyordu, ama bir RESERVE (yedek) kayıt doğrudan
        // silindiğinde (örn. sıra ortasından biri) hiçbir yeniden numaralandırma tetiklenmiyordu.
        // Sonuç: sıra numaralarında boşluk kalıyordu (1,2,3 → 1,3) VE bir sonraki yeni yedek
        // kaydı "order = waitlistCount + 1" formülüyle (RegisterCoreAsync/BulkPreRegisterAsync)
        // hesaplandığı için var olan bir kayıtla AYNI sıra numarasını alabiliyordu (kanıtlandı:
        // 3'ü boşalttıktan sonra eklenen yeni kayıt da 3 numarayı aldı, iki farklı kişi aynı sırada
        // göründü). Yedek silindiğinde de kalan yedekler sıkıştırılıp yeniden numaralandırılır.
        else if (wasReserve)
            await CompactWaitlistOrderAsync(registration.GroupId, ct);

        await uow.SaveChangesAsync(ct);
        await UpdateGroupCountsAsync(registration.GroupId, ct);
        await uow.SaveChangesAsync(ct);

        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct);
        var removeEvent = (reason ?? "").Contains("Devamsızlık") ? "absence_limit_reached" : "registration_cancelled";
        var notices = new List<FacilityDeferredNoticeDto>
        {
            new(module, removeEvent, registration.Phone, registration.FullName,
                group?.Name, null, null, null, reason, group?.AbsenceLimit, registration.ParticipantId),
        };
        if (promoted is not null)
            notices.Add(new(promoted.Module, "waitlist_promoted", promoted.Phone, promoted.FullName,
                promoted.GroupName, promoted.FacilityName, promoted.SessionDate, promoted.SessionTime, null, null, promoted.ParticipantId));
        return notices;
    }

    private async Task SendDeferredAsync(FacilityDeferredNoticeDto n, CancellationToken ct)
        => await notification.SendStatusAsync(n.Module, n.Event, n.Phone, n.FullName,
            new FacilityNotificationVars(GroupName: n.GroupName, FacilityName: n.FacilityName,
                SessionDate: n.SessionDate, SessionTime: n.SessionTime, CancelReason: n.CancelReason, Limit: n.Limit), ct, n.ParticipantId);

    // Y02: dış transaction'lı çağıranlar (vatandaş iptali, yoklama akışı) RemoveForBatchAsync'ten topladıkları
    // ertelenmiş bildirimleri commit'ten SONRA bu tek noktadan gönderir — yükselen yedeğin bildirimi kaybolmaz.
    public async Task SendDeferredNoticesAsync(IEnumerable<FacilityDeferredNoticeDto> notices, CancellationToken ct)
    {
        foreach (var n in notices) await SendDeferredAsync(n, ct);
    }

    private async Task SendPromotedNoticeAsync(PromotedNotice? p, CancellationToken ct)
    {
        if (p is null) return;
        await notification.SendStatusAsync(p.Module, "waitlist_promoted", p.Phone, p.FullName,
            new FacilityNotificationVars(GroupName: p.GroupName, FacilityName: p.FacilityName, SessionDate: p.SessionDate, SessionTime: p.SessionTime), ct, p.ParticipantId);
    }

    // V03/D02: carry — yedek kuyruğu sürekli/tek olduğundan tüm aktif yedekler kararlı sırayla
    // (WaitlistOrder → CreatedAt → Id) 1'den yeniden numaralandırılır (dönem-bağımsız).
    private async Task CompactWaitlistOrderAsync(Guid groupId, CancellationToken ct)
    {
        var remaining = (await uow.FacilityRegistrations.GetWaitlistByGroupAsync(groupId, ct))
            .Where(r => r.Status == "active")
            .OrderBy(r => r.WaitlistOrder).ThenBy(r => r.CreatedAt).ThenBy(r => r.Id)
            .ToList();
        foreach (var (r, i) in remaining.Select((r, i) => (r, i)))
        {
            if (r.WaitlistOrder != i + 1)
            {
                r.SetWaitlistOrder(i + 1);
                uow.FacilityRegistrations.Update(r);
            }
        }
    }

    private static (DateTime Start, DateTime End) PromotionEntitlement(FacilityGroup group)
    {
        var today = TurkeyTime.TodayDate();
        var model = FacilityEntitlementModel.Normalize(group.EntitlementModel, group.PeriodType);
        var range = FacilityEntitlement.Compute(model, today, group.PeriodUnit, group.PeriodMonths, group.PeriodDays, group.PeriodStart, group.PeriodEnd);
        return (today, range.End);
    }

    public async Task<FacilityRegistrationDto> PromoteAsync(string module, Guid registrationId, CancellationToken ct)
    {
        var registration = await GetOwnedAsync(module, registrationId, ct);
        var groupId = registration.GroupId;
        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct)
            ?? throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");

        // D04: durum + kapasite kontrolü ile terfi tek atomik işlem — ortak grup kilidi + transaction.
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(GroupLockKey(groupId), ct);
            await uow.ReloadAsync(registration, ct);
            registration = await GetOwnedAsync(module, registrationId, ct);
            // Z01: grup da GERÇEKTEN reload edilir — tekrar sorgu izlenen eski (stale) örneği döndürüp
            // eşzamanlı pasifleştirme/kapasite değişikliğini gizleyebilirdi.
            await uow.ReloadAsync(group, ct);
            group = await uow.FacilityGroups.GetByIdAsync(groupId, ct)
                ?? throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");

            // Y07: manuel terfi de kilit altında GÜNCEL grubun AKTİFLİĞİNİ + dönem bitişini doğrular
            // (pasif/dönemi bitmiş gruba manuel terfi yapılamaz — otomatik terfideki D07 guard'ıyla simetrik).
            if (!group.IsActive)
                throw new ConflictException("Program pasif durumda; yedek asıla alınamaz.", "GROUP_INACTIVE");
            if (group.PeriodEnd.HasValue && TurkeyTime.ToTurkey(group.PeriodEnd.Value).Date < TurkeyTime.TodayDate())
                throw new ConflictException("Bu programın dönemi sona ermiş; yedek asıla alınamaz.", "PERIOD_ENDED");
            if (registration.Status != "active" || registration.Kind != "reserve")
                throw new ConflictException("Yalnızca aktif yedek kayıt asıla alınabilir.", "NOT_RESERVE");

        var (promoteStart, promoteEnd) = PromotionEntitlement(group);
        // Y07: kapasite, kişiye verilecek TAM hak aralığının kapsadığı tüm dönemler için kontrol edilir.
        if (!await HasVacancyForRangeAsync(group, promoteStart, promoteEnd, ct))
            throw new ConflictException("Grup kontenjanı dolu; yedek asıla alınamaz.", "QUOTA_FULL");
        registration.PromoteToMain(promoteEnd, promoteStart);
        uow.FacilityRegistrations.Update(registration);

        if (registration.ApplicationId.HasValue)
        {
            var promotedApplication = await uow.FacilityApplications.GetByIdAsync(registration.ApplicationId.Value, ct);
            if (promotedApplication is not null && promotedApplication.Status == "waitlist")
            {
                promotedApplication.Approve("Yedekten terfi");
                uow.FacilityApplications.Update(promotedApplication);
            }
        }

        await uow.SaveChangesAsync(ct);
        // V03/D02 (carry): yedek kuyruğu SÜREKLİ/TEK — terfi sonrası kalan tüm aktif yedekler kararlı
        // sırayla 1'den yeniden numaralandırılır (RemoveAsync ile aynı sözleşme, dönem-bazlı süzme yok).
        await CompactWaitlistOrderAsync(registration.GroupId, ct);
        await UpdateGroupCountsAsync(registration.GroupId, ct);
        await uow.SaveChangesAsync(ct);

            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        var promoteFacilityName = (await uow.Facilities.GetByIdAsync(registration.FacilityId, ct))?.Name;
        var (promoteSessionDate, promoteSessionTime) = await GetNextSessionDateTimeAsync(registration.GroupId, ct);
        await notification.SendStatusAsync(module, "waitlist_promoted", registration.Phone, registration.FullName,
            new FacilityNotificationVars(GroupName: group.Name, FacilityName: promoteFacilityName, SessionDate: promoteSessionDate, SessionTime: promoteSessionTime), ct, registration.ParticipantId);

        return ToDto(registration, group.Name);
    }

    public async Task<FacilityRegistrationDto> DemoteAsync(string module, Guid registrationId, CancellationToken ct)
    {
        var registration = await GetOwnedAsync(module, registrationId, ct);
        var groupId = registration.GroupId;
        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct)
            ?? throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");

        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(GroupLockKey(groupId), ct);
            await uow.ReloadAsync(registration, ct);
            registration = await GetOwnedAsync(module, registrationId, ct);
            // Z01: grup da gerçekten reload edilir (izlenen stale örnek yerine güncel yedek kapasitesi/durum).
            await uow.ReloadAsync(group, ct);
            if (registration.Status != "active" || registration.Kind != "main")
                throw new ConflictException("Yalnızca aktif asıl kayıt yedeğe alınabilir.", "NOT_MAIN");

        var waitlist = await uow.FacilityRegistrations.GetWaitlistByGroupAsync(registration.GroupId, ct);
        // V02: yedeğe alma yedek kapasitesini aşmamalı. ReserveCapacity=0 GERÇEK sıfırdır (sınırsız değil) —
        // 0 yedekte demote reddedilir. Yedek liste kapalıysa da demote yapılmaz.
        if (!await WaitlistEnabledAsync(module, ct))
            throw new ConflictException("Yedek liste kapalı; asıl yedeğe alınamaz.", "WAITLIST_DISABLED");
        if (waitlist.Count(r => r.Status == "active") >= group.ReserveCapacity)
            throw new ConflictException("Yedek kontenjanı dolu; asıl yedeğe alınamaz.", "QUOTA_FULL");
        var lastOrder = waitlist.Where(r => r.Status == "active").Select(r => r.WaitlistOrder).DefaultIfEmpty(0).Max();
        registration.DemoteToReserve(lastOrder + 1);
        uow.FacilityRegistrations.Update(registration);

        if (registration.ApplicationId.HasValue)
        {
            var app = await uow.FacilityApplications.GetByIdAsync(registration.ApplicationId.Value, ct);
            if (app is not null && app.Status == "approved")
            {
                app.Waitlist("Asıldan yedeğe alındı");
                uow.FacilityApplications.Update(app);
            }
        }

        await uow.SaveChangesAsync(ct);
        await UpdateGroupCountsAsync(registration.GroupId, ct);
        await uow.SaveChangesAsync(ct);

            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        var facilityName = (await uow.Facilities.GetByIdAsync(registration.FacilityId, ct))?.Name;
        await notification.SendStatusAsync(module, "application_waitlisted", registration.Phone, registration.FullName,
            new FacilityNotificationVars(GroupName: group.Name, FacilityName: facilityName), ct, registration.ParticipantId);

        return ToDto(registration, group.Name);
    }

    public async Task ReorderWaitlistAsync(string module, Guid groupId, IReadOnlyList<Guid> orderedIds, CancellationToken ct)
    {
        await EnsureGroupAsync(module, groupId, ct);
        // V03/D02 (carry): yedek kuyruğu SÜREKLİ/TEK olduğundan admin de grubun tüm aktif yedeklerini
        // tek bir liste olarak yeniden sıralar (dönem-bazlı ayrı kuyruk YOK — kıdem dönem geçişinde korunur).
        var waitlist = (await uow.FacilityRegistrations.GetWaitlistByGroupAsync(groupId, ct))
            .Where(r => r.Status == "active").ToList();
        var byId = waitlist.ToDictionary(r => r.Id);

        var order = 1;
        foreach (var id in orderedIds)
        {
            if (!byId.TryGetValue(id, out var reg)) continue;
            reg.SetWaitlistOrder(order++);
            uow.FacilityRegistrations.Update(reg);
            byId.Remove(id);
        }
        foreach (var reg in byId.Values.OrderBy(r => r.WaitlistOrder))
        {
            reg.SetWaitlistOrder(order++);
            uow.FacilityRegistrations.Update(reg);
        }
        await uow.SaveChangesAsync(ct);
    }

    public async Task<int> RebalanceAsync(string module, Guid? groupId, CancellationToken ct)
    {
        var groups = groupId.HasValue
            ? [await EnsureGroupAsync(module, groupId.Value, ct)]
            : await uow.FacilityGroups.GetAllByModuleAsync(module, ct);

        var demotedTotal = 0;
        foreach (var group in groups)
        {
            if (group.Capacity <= 0) continue;
            var roster = await uow.FacilityRegistrations.GetByGroupAsync(group.Id, ct);
            var isRecurring = group.PeriodType == "recurring" && group.PeriodStart.HasValue && group.PeriodMonths > 0;

            // Canlı test bulgusu (2026-09-25, aynı ailede 4. ve EN CİDDİ bug): recurring
            // (periyodik) gruplarda her dönem kendi bağımsız kontenjanına sahiptir (bkz.
            // RegisterCoreAsync). Bu fonksiyon ise TÜM dönemlerin main kayıtlarını tek bir
            // "activeMains.Count > group.Capacity" kontrolüyle karşılaştırıyordu — 3 ayrı
            // dönemde her biri kendi kapasitesinde (2/2) MEŞRU şekilde dolu 6 main kaydı varken,
            // bu kontrol "6 > 2" görüp fazlalık 4 kaydı (2. ve 3. dönemlerin tamamını) yanlışlıkla
            // yedeğe düşürüyordu (canlı test: demoted=4, hâlbuki hiçbirinin düşürülmemesi
            // gerekiyordu — kanıtlandı). Artık recurring gruplarda main kayıtlar önce PeriodIndex'e
            // göre gruplanır, kapasite kontrolü HER DÖNEM için ayrı ayrı yapılır.
            var periodGroups = isRecurring
                ? roster.Where(r => r.Kind == "main" && r.Status == "active")
                    .GroupBy(r => r.PeriodIndex)
                    .Select(g => (PeriodIndex: (int?)g.Key, Mains: g.OrderBy(r => r.CreatedAt).ToList()))
                    .ToList()
                : [((int?)null, roster.Where(r => r.Kind == "main" && r.Status == "active").OrderBy(r => r.CreatedAt).ToList())];

            foreach (var (periodIndex, activeMains) in periodGroups)
            {
                if (activeMains.Count <= group.Capacity) continue;

                // V03/D02 (carry): yedek kuyruğu SÜREKLİ/TEK — yedeğe düşen fazlalık asıllar global
                // kuyruğun sonuna eklenir (dönem-bazlı ayrı kuyruk YOK).
                var order = roster.Where(r => r.Kind == "reserve" && r.Status == "active")
                    .Select(r => r.WaitlistOrder).DefaultIfEmpty(0).Max();

                foreach (var reg in activeMains.Skip(group.Capacity))
                {
                    reg.DemoteToReserve(++order);
                    uow.FacilityRegistrations.Update(reg);
                    if (reg.ApplicationId.HasValue)
                    {
                        var app = await uow.FacilityApplications.GetByIdAsync(reg.ApplicationId.Value, ct);
                        if (app is not null && app.Status == "approved")
                        {
                            app.Waitlist("Kontenjan yeniden dengelendi");
                            uow.FacilityApplications.Update(app);
                        }
                    }
                    demotedTotal++;
                }
                await uow.SaveChangesAsync(ct);
            }

            await CompactWaitlistByDateAsync(group.Id, ct);
            await UpdateGroupCountsAsync(group.Id, ct);
            await uow.SaveChangesAsync(ct);
        }
        return demotedTotal;
    }

    // Hata #20: RegisteredCount/WaitlistCount önbellek kolonu, PeriodType='recurring' gruplarda
    // (Spor Salonu/Havuz/Gençlik-İzcilik Kampı/Bilim Merkezi'ndeki neredeyse tüm gruplar) gerçek
    // roster ile senkronize olmuyordu — canlı veride 13+ grupta admin panel ve vatandaş tarafı
    // "0/30 boş" gösterirken grup fiilen doluydu. Kısa vadeli düzeltme: tüm aktif recurring
    // grupların önbelleğini UpdateGroupCountsAsync ile tek seferde yeniden hesaplayan admin-only
    // reconciliation endpoint'i. (Uzun vadeli, periyodik bir job önerisi rapor #20'de belirtildi;
    // zaman/karmaşıklık kısıtı nedeniyle bu iterasyonda yalnızca manuel tetiklenen reconciliation
    // eklendi — bkz. tamamlama raporu.)
    //
    // Denetim bulgusu (docs/tesis-spor-egitim-derin-test-2026-08-31.md P2-1, 2026-09-05 canlı
    // testle doğrulandı): filtre yalnızca PeriodType='recurring' grupları görüyordu — canlı
    // ortamda aktif grupların %78'i (month=524, date_range=14, recurring=131 toplam 669'da) bu
    // filtre dışında kalıyordu, bunların 116'sı fiilen sayaç driftine uğramış durumdaydı.
    // UpdateGroupCountsAsync zaten HER İKİ PeriodType dalını doğru işliyor (recurring için
    // dönem-bazlı sayım, diğerleri için GetCountsByGroupAsync) — filtreyi genişletmek risksiz.
    public async Task<int> ReconcileGroupCountsAsync(string? module, CancellationToken ct)
    {
        var groups = string.IsNullOrWhiteSpace(module)
            ? await uow.FacilityGroups.FindAsync(g => g.IsActive, ct)
            : (await uow.FacilityGroups.GetAllByModuleAsync(module, ct))
                .Where(g => g.IsActive).ToList();

        var updated = 0;
        foreach (var group in groups)
        {
            var beforeMain = group.RegisteredCount;
            var beforeWait = group.WaitlistCount;
            await UpdateGroupCountsAsync(group.Id, ct);
            if (group.RegisteredCount != beforeMain || group.WaitlistCount != beforeWait)
                updated++;
        }
        await uow.SaveChangesAsync(ct);
        return updated;
    }

    public async Task<BulkPreRegisterResultDto> BulkPreRegisterAsync(string module, BulkPreRegisterRequest req, CancellationToken ct)
    {
        await EnsureGroupAsync(module, req.GroupId, ct);

        var rows = new List<BulkPreRegisterRowResultDto>();
        var registered = 0;
        var waitlisted = 0;
        var alreadyRegistered = 0;
        var notFound = 0;
        var failed = 0;

        var seen = new HashSet<string>();
        var distinctTckns = new List<string>();
        foreach (var raw in req.Tckns)
        {
            var tckn = new string((raw ?? "").Where(char.IsDigit).ToArray());
            if (tckn.Length != 11)
            {
                rows.Add(new BulkPreRegisterRowResultDto((raw ?? "").Trim(), "invalid", "TC kimlik 11 haneli olmalıdır.", null, null));
                failed++;
                continue;
            }
            if (seen.Add(tckn)) distinctTckns.Add(tckn);
        }

        foreach (var tckn in distinctTckns)
        {
            var participant = await uow.Participants.GetByTcknAsync(tckn, ct);
            if (participant is null)
            {
                rows.Add(new BulkPreRegisterRowResultDto(tckn, "not_found", "Bu TC ile sistemde kayıtlı katılımcı bulunamadı.", null, null));
                notFound++;
                continue;
            }

            try
            {
                var result = await RegisterAsync(module, new RegisterParticipantRequest(
                    req.GroupId, null, participant.Id, participant.FullName, participant.Tckn,
                    participant.Phone ?? "05000000000", participant.BirthDate, participant.GuardianPhone,
                    req.MembershipDate, req.Target), ct);

                if (result.Kind == "reserve")
                {
                    var reason = RegistrationTargets.Normalize(req.Target) == RegistrationTargets.Reserve
                        ? "Yedek listeye eklendi."
                        : "Asıl kontenjan dolu, yedek listeye eklendi.";
                    rows.Add(new BulkPreRegisterRowResultDto(tckn, "waitlisted", reason, result.Id, participant.FullName));
                    waitlisted++;
                }
                else
                {
                    rows.Add(new BulkPreRegisterRowResultDto(tckn, "registered", null, result.Id, participant.FullName));
                    registered++;
                }
            }
            catch (ConflictException ex) when (ex.ErrorCode == "ALREADY_REGISTERED")
            {
                rows.Add(new BulkPreRegisterRowResultDto(tckn, "already_registered", "Bu kişi zaten bu gruba kayıtlı.", null, participant.FullName));
                alreadyRegistered++;
            }
            catch (ConflictException ex)
            {
                rows.Add(new BulkPreRegisterRowResultDto(tckn, "failed", ex.Message, null, participant.FullName));
                failed++;
            }
        }

        return new BulkPreRegisterResultDto(
            req.Tckns.Count, registered, waitlisted, alreadyRegistered, notFound, failed, rows);
    }

    // Kullanıcı isteği: eski sistemden/kağıt kayıtlardan üye taşırken sadece TC değil, o kişinin
    // hâlihazırda kullanmış olduğu devamsızlık hakkı ve mevcut hak-edişinin ne zaman biteceği de
    // birlikte girilebilsin — aktarılan üye sıfırdan değil, kaldığı yerden devam etsin. Katılımcı
    // sistemde önceden kayıtlı olmayabilir (henüz vatandaş portalına hiç girmemiş olabilir); bu
    // durumda ParticipantId=null ile TC/isim bilgisiyle kayıt oluşturulur (BulkPreRegister'dan farkı
    // budur — "not_found" olarak reddetmek yerine kabul eder).
    public async Task<BulkPreRegisterResultDto> BulkImportRegistrationAsync(string module, BulkImportRegistrationRequest req, CancellationToken ct)
    {
        var group = await EnsureGroupAsync(module, req.GroupId, ct);

        var rows = new List<BulkPreRegisterRowResultDto>();
        var registered = 0;
        var waitlisted = 0;
        var alreadyRegistered = 0;
        var notFound = 0;
        var failed = 0;

        foreach (var row in req.Rows)
        {
            var tckn = new string((row.Tckn ?? "").Where(char.IsDigit).ToArray());
            if (tckn.Length != 11)
            {
                rows.Add(new BulkPreRegisterRowResultDto((row.Tckn ?? "").Trim(), "invalid", "TC kimlik 11 haneli olmalıdır.", null, null));
                failed++;
                continue;
            }

            var participant = await uow.Participants.GetByTcknAsync(tckn, ct);
            var fullName = participant?.FullName ?? "Aktarılan Üye";
            var phone = participant?.Phone ?? "05000000000";
            var birthDate = participant?.BirthDate;
            var guardianPhone = participant?.GuardianPhone;

            // V02.3: her satır kendi transaction'ında işlenir — advisory kilit transaction-scoped
            // olduğundan (pg_advisory_xact_lock) transaction olmadan koruma sağlamaz. Böylece toplu
            // aktarımda da "say-sonra-yaz" kapasite yarışı gerçekten kapatılır, satır başına hata izole kalır.
            var ownsTransaction = !uow.HasActiveTransaction;
            if (ownsTransaction) await uow.BeginTransactionAsync(ct);
            try
            {
                await uow.AcquireAdvisoryLockAsync(GroupLockKey(group.Id), ct);
                var roster = await uow.FacilityRegistrations.GetByGroupAsync(req.GroupId, ct);
                if (roster.Any(r => r.Tckn == tckn))
                {
                    if (ownsTransaction) await uow.CommitAsync(ct);
                    rows.Add(new BulkPreRegisterRowResultDto(tckn, "already_registered", "Bu kişi zaten bu gruba kayıtlı.", null, fullName));
                    alreadyRegistered++;
                    continue;
                }

                await EnsureEligibilityAsync(group, new RegisterParticipantRequest(
                    req.GroupId, null, participant?.Id, fullName, tckn, phone, birthDate, guardianPhone), ct);

                // K01/V06/Y05: içe-aktarma da grup kilidi altında ortak dinamik katılım limitine tabidir.
                await participationLimitGuard.EnsureWithinLimitAsync(module, group, participant?.Id, tckn, birthDate, null, ct);
                await crossProgramLimitGuard.EnsureAllowedAsync(module, group.BranchId, group.FacilityId, participant?.Id, tckn, null, ct);

                var waitlistEnabled = await WaitlistEnabledAsync(module, ct);
                var target = RegistrationTargets.Normalize(req.Target);

                string kind;
                int order = 0;
                DateTime? periodEnd;
                DateTime membershipStart;
                int periodIndex = 0;

                if (target == RegistrationTargets.Reserve)
                {
                    // Kullanıcı isteği (2026-10-06): eski kayıtlar doğrudan yedek listeye de aktarılabilsin.
                    // RegisterCoreAsync / DemoteAsync ile aynı kurallar.
                    string? reserveError = null;
                    var activeReserves = roster.Where(r => r.Kind == "reserve" && r.Status == "active").ToList();
                    if (group.Type == "akademi") reserveError = "Akademi gruplarında yedek liste yoktur.";
                    else if (!waitlistEnabled) reserveError = "Yedek liste kapalı; yedeğe eklenemez.";
                    else if (activeReserves.Count >= group.ReserveCapacity) reserveError = "Yedek kontenjanı dolu.";
                    if (reserveError is not null)
                    {
                        if (ownsTransaction) await uow.CommitAsync(ct);
                        rows.Add(new BulkPreRegisterRowResultDto(tckn, "failed", reserveError, null, fullName));
                        failed++;
                        continue;
                    }
                    kind = "reserve";
                    order = activeReserves.Select(r => r.WaitlistOrder).DefaultIfEmpty(0).Max() + 1;
                    membershipStart = row.MembershipStart ?? group.PeriodStart ?? TurkeyTime.NowWallClock().Date;
                    periodEnd = row.PeriodEnd;
                    if (group.PeriodType == "recurring" && group.PeriodStart.HasValue && group.PeriodMonths > 0)
                    {
                        var pStart = group.PeriodStart.Value.Date;
                        var reference = (row.MembershipStart ?? TurkeyTime.NowWallClock()).Date;
                        periodIndex = FacilityPeriods.IndexAt(pStart, group.PeriodMonths, reference < pStart ? pStart : reference);
                    }
                }
                else if (group.Type == "akademi")
                {
                    // Akademi/müsabık: kontenjan/yedek mantığı yok, her zaman sürekli asıl üye, süre yok.
                    kind = "main";
                    membershipStart = row.MembershipStart ?? TurkeyTime.NowWallClock().Date;
                    periodEnd = null;
                }
                else if (group.PeriodType == "recurring" && group.PeriodStart.HasValue && group.PeriodMonths > 0)
                {
                    var pStart = group.PeriodStart.Value.Date;
                    var months = group.PeriodMonths;
                    var reference = (row.MembershipStart ?? TurkeyTime.NowWallClock()).Date;
                    var effStart = reference < pStart ? pStart : reference;
                    var mEnd = effStart.AddMonths(months);
                    periodIndex = FacilityPeriods.IndexAt(pStart, months, effStart);
                    membershipStart = effStart;
                    periodEnd = row.PeriodEnd ?? mEnd;

                    // Z04: kapasite kontrolü GERÇEKTEN kaydedilecek [effStart, periodEnd] aralığı üzerinden
                    // yapılır — kısa açık bitiş varsayılan tam süreye UZATILMAZ (eski `max(periodEnd, mEnd)`
                    // kısa hakkı gereksiz yere uzun aralıkta kontrol edip Nisan'daki başka asıl yüzünden
                    // yanlışlıkla "dolu" sayabiliyordu). Geçersiz/degenere aralıkta (bitiş ≤ başlangıç)
                    // varsayılan süreye düşülür.
                    var overlapEnd = periodEnd.Value > effStart ? periodEnd.Value : mEnd;
                    var overlapped = FacilityPeriods.Overlapping(pStart, months, effStart, overlapEnd);
                    var mains = roster.Where(r => r.Kind == "main" && r.Status == "active").ToList();
                    var roomInAll = group.Capacity <= 0 || overlapped.All(p =>
                        mains.Count(m => (m.MembershipStart ?? pStart) < p.End && (m.PeriodEnd ?? DateTime.MaxValue) > p.Start) < group.Capacity);

                    if (roomInAll)
                    {
                        kind = "main";
                    }
                    else if (target != RegistrationTargets.Main && waitlistEnabled && roster.Count(r => r.Kind == "reserve" && r.Status == "active") < group.ReserveCapacity)
                    {
                        kind = "reserve";
                        order = roster.Count(r => r.Kind == "reserve" && r.Status == "active") + 1;
                    }
                    else
                    {
                        if (ownsTransaction) await uow.CommitAsync(ct);
                        rows.Add(new BulkPreRegisterRowResultDto(tckn, "failed", target == RegistrationTargets.Main ? "Asıl kontenjan dolu." : "Grup ve yedek kontenjanı dolu.", null, fullName));
                        failed++;
                        continue;
                    }
                }
                else
                {
                    var mainCount = roster.Count(r => r.Kind == "main" && r.Status == "active");
                    var waitlistCount = roster.Count(r => r.Kind == "reserve" && r.Status == "active");
                    membershipStart = row.MembershipStart ?? group.PeriodStart ?? TurkeyTime.NowWallClock().Date;
                    periodEnd = row.PeriodEnd ?? group.PeriodEnd;
                    if (group.Capacity <= 0 || mainCount < group.Capacity)
                    {
                        kind = "main";
                    }
                    else if (target != RegistrationTargets.Main && waitlistEnabled && waitlistCount < group.ReserveCapacity)
                    {
                        kind = "reserve";
                        order = waitlistCount + 1;
                    }
                    else
                    {
                        if (ownsTransaction) await uow.CommitAsync(ct);
                        rows.Add(new BulkPreRegisterRowResultDto(tckn, "failed", target == RegistrationTargets.Main ? "Asıl kontenjan dolu." : "Grup ve yedek kontenjanı dolu.", null, fullName));
                        failed++;
                        continue;
                    }
                }

                var registration = FacilityRegistration.Create(
                    module, group.FacilityId, group.Id, group.BranchId, null, participant?.Id,
                    fullName, tckn, phone, birthDate, guardianPhone, kind, order, periodEnd, membershipStart, periodIndex);
                if (row.AbsenceUsed.HasValue || row.ConsecutiveAbsenceUsed.HasValue)
                    registration.SetUsage(row.AbsenceUsed ?? 0, row.ConsecutiveAbsenceUsed ?? 0);

                await uow.FacilityRegistrations.AddAsync(registration, ct);
                await uow.SaveChangesAsync(ct);
                await UpdateGroupCountsAsync(group.Id, ct);
                await uow.SaveChangesAsync(ct);
                if (ownsTransaction) await uow.CommitAsync(ct);

                if (kind == "reserve")
                {
                    rows.Add(new BulkPreRegisterRowResultDto(tckn, "waitlisted", target == RegistrationTargets.Reserve ? "Yedek listeye eklendi." : "Asıl kontenjan dolu, yedek listeye eklendi.", registration.Id, fullName));
                    waitlisted++;
                }
                else
                {
                    rows.Add(new BulkPreRegisterRowResultDto(tckn, "registered", null, registration.Id, fullName));
                    registered++;
                }
            }
            catch (Exception ex)
            {
                if (ownsTransaction)
                {
                    await uow.RollbackAsync(ct);
                    // Y01: rollback sonrası bu satırın eklediği bekleyen entity'ler sonraki satıra sızmasın.
                    uow.ClearChangeTracker();
                }
                rows.Add(new BulkPreRegisterRowResultDto(tckn, "failed", ex.Message, null, fullName));
                failed++;
            }
        }

        return new BulkPreRegisterResultDto(
            req.Rows.Count, registered, waitlisted, alreadyRegistered, notFound, failed, rows);
    }

    public async Task FillVacanciesAsync(Guid groupId, CancellationToken ct)
    {
        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct);
        if (group is null || !group.IsActive) return;

        // V02: yer doldurma da ortak grup kilidi + transaction içinde — eşzamanlı doldurma/kayıt yarışı
        // kapatılır; bildirimler yalnız commit sonrası gönderilir.
        var notices = new List<PromotedNotice>();
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(GroupLockKey(groupId), ct);
            for (var guard = 0; guard < 500; guard++)
            {
                var waitBefore = (await uow.FacilityRegistrations.GetWaitlistByGroupAsync(groupId, ct)).Count;
                if (waitBefore == 0 || !await HasVacancyAsync(group, ct)) break;
                var notice = await PromoteNextWaitlistAsync(groupId, ct);
                await uow.SaveChangesAsync(ct);
                if (notice is null) break;
                notices.Add(notice);
                var waitAfter = (await uow.FacilityRegistrations.GetWaitlistByGroupAsync(groupId, ct)).Count;
                if (waitAfter >= waitBefore) break;
            }
            await UpdateGroupCountsAsync(groupId, ct);
            await uow.SaveChangesAsync(ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        foreach (var n in notices) await SendPromotedNoticeAsync(n, ct);
    }

    private async Task<bool> HasVacancyAsync(FacilityGroup group, CancellationToken ct)
    {
        if (group.Capacity <= 0) return true;
        if (group.PeriodType == "recurring" && group.PeriodStart.HasValue && group.PeriodMonths > 0)
        {
            var pStart = group.PeriodStart.Value.Date;
            var months = group.PeriodMonths;
            var now = TurkeyTime.TodayDate();
            var effStart = now < pStart ? pStart : now;
            var idx = FacilityPeriods.IndexAt(pStart, months, effStart);
            var period = FacilityPeriods.Bounds(pStart, months, idx);
            var roster = await uow.FacilityRegistrations.GetByGroupAsync(group.Id, ct);
            var occ = roster.Count(r => r.Kind == "main" && r.Status == "active"
                && (r.MembershipStart ?? pStart) < period.End && (r.PeriodEnd ?? DateTime.MaxValue) > period.Start);
            return occ < group.Capacity;
        }
        var (main, _) = await uow.FacilityRegistrations.GetCountsByGroupAsync(group.Id, ct);
        return main < group.Capacity;
    }

    // Y07: terfide kişiye verilecek GERÇEK hak aralığı [start, end] recurring grupta birden fazla dönemi
    // kapsayabilir; kapasite bu aralığın KAPSADIĞI TÜM dönemlerde boş olmalı (RegisterCore ile aynı kural) —
    // yalnız mevcut dönem doluluğuna bakmak, ileri dönemi dolu olan bir gruba terfiyle kapasite aşımına yol açardı.
    private async Task<bool> HasVacancyForRangeAsync(FacilityGroup group, DateTime start, DateTime end, CancellationToken ct)
    {
        if (group.Capacity <= 0) return true;
        if (!(group.PeriodType == "recurring" && group.PeriodStart.HasValue && group.PeriodMonths > 0))
            return await HasVacancyAsync(group, ct);

        var pStart = group.PeriodStart.Value.Date;
        var months = group.PeriodMonths;
        var roster = await uow.FacilityRegistrations.GetByGroupAsync(group.Id, ct);
        var mains = roster.Where(r => r.Kind == "main" && r.Status == "active").ToList();
        var overlapped = FacilityPeriods.Overlapping(pStart, months, start.Date, end.Date);
        return overlapped.All(p =>
            mains.Count(m => (m.MembershipStart ?? pStart) < p.End && (m.PeriodEnd ?? DateTime.MaxValue) > p.Start) < group.Capacity);
    }

    private sealed record PromotedNotice(string Module, string Phone, string FullName, string? GroupName, string? FacilityName, string? SessionDate, string? SessionTime, Guid? ParticipantId);

    private async Task<PromotedNotice?> PromoteNextWaitlistAsync(Guid groupId, CancellationToken ct)
    {
        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct);
        if (group is null || !group.IsActive) return null;

        // basvuruhitetmeyenkurallar.md sonrası UI-envanteri: admin panelde "Genel Ayarlar > Kontenjan
        // & Yedek Liste > Otomatik yükselt" toggle'ı kaydediliyordu ama hiçbir yerde okunmadığı için
        // fiilen çalışmıyordu — kapatılsa da asıldan iptal/çıkarma olunca yedek sıradaki üye yine
        // otomatik terfi ediyordu. Artık bu switch gerçekten kontrol ediliyor: kapalıysa terfi
        // yapılmaz, yer boş kalır (admin manuel PromoteAsync ile terfi ettirebilir).
        var settings = await uow.FacilitySettings.GetGeneralAsync(group.Module, ct);
        var autoPromote = Nexora.Application.Features.Facilities.FacilitySettingsValues.Bool(settings?.SettingsJson, "waitlistAutoPromote") ?? true;
        if (!autoPromote) return null;

        var waitlist = await uow.FacilityRegistrations.GetWaitlistByGroupAsync(groupId, ct);

        // D01: terfi eden kişiye programda tanımlı tam kişisel süre asıla geçince verilir
        // (personal_duration → bugün+süre; fixed_calendar → grup bitişi). Manuel PromoteAsync ile aynı.
        // D02: dönem geçişinde yedek kıdemi korunur — aktif program kuyruğu PeriodIndex'e göre süzülmez;
        // kararlı sıra WaitlistOrder → CreatedAt → Id ile belirlenir.
        var (promoteMembershipStart, promotePeriodEnd) = PromotionEntitlement(group);

        // Z02: otomatik terfi de kişiye verilecek TAM kişisel süre boyunca kapasiteyi kontrol eder (manuel
        // PromoteAsync ile AYNI kural). Boşalan slot mevcut dönemde olsa da, verilecek hak ileri bir DOLU
        // dönemi kapsıyorsa terfi yapılmaz — aksi halde otomatik devamsızlık→yedek yolunda ileri dönem
        // kapasitesi sessizce aşılıyordu. Aralık tüm adaylar için aynı olduğundan, yer yoksa terfi edilmez.
        if (!await HasVacancyForRangeAsync(group, promoteMembershipStart, promotePeriodEnd, ct))
            return null;

        FacilityRegistration? next = null;
        foreach (var candidate in waitlist.OrderBy(r => r.WaitlistOrder).ThenBy(r => r.CreatedAt).ThenBy(r => r.Id))
        {
            if (await IsRegistrationEligibleAsync(group, candidate, ct))
            {
                next = candidate;
                break;
            }
        }
        if (next is null) return null;

        next.PromoteToMain(promotePeriodEnd, promoteMembershipStart);
        uow.FacilityRegistrations.Update(next);

        if (next.ApplicationId.HasValue)
        {
            var promotedApplication = await uow.FacilityApplications.GetByIdAsync(next.ApplicationId.Value, ct);
            if (promotedApplication is not null && promotedApplication.Status == "waitlist")
            {
                promotedApplication.Approve("Yedekten terfi");
                uow.FacilityApplications.Update(promotedApplication);
            }
        }

        foreach (var r in waitlist.Where(w => w.Id != next.Id).OrderBy(w => w.WaitlistOrder).ThenBy(w => w.CreatedAt).ThenBy(w => w.Id).Select((w, i) => (w, i)))
        {
            r.w.SetWaitlistOrder(r.i + 1);
            uow.FacilityRegistrations.Update(r.w);
        }

        // V02: bildirim BURADA gönderilmez — çağıran (Remove/FillVacancies) transaction gerçekten
        // COMMIT olduktan sonra gönderir; rollback olursa SMS gitmez. Terfi bilgisi payload olarak döner.
        var facilityName = group is not null ? (await uow.Facilities.GetByIdAsync(group.FacilityId, ct))?.Name : null;
        var (nextSessionDate, nextSessionTime) = await GetNextSessionDateTimeAsync(next.GroupId, ct);
        return new PromotedNotice(next.Module, next.Phone, next.FullName, group?.Name, facilityName, nextSessionDate, nextSessionTime, next.ParticipantId);
    }

    // Yedekten terfi bildiriminde "ilk katılım tarihi/saati" olarak GEÇMİŞ değil, henüz gerçekleşmemiş
    // bir sonraki aktif seansı döndürür — kişi bugünkü/geçmiş bir seansa sonradan eklenmiş gibi
    // görünmemeli (kullanıcı isteği: "Kişi Pazartesi günü aynı seansa sonradan eklenmemelidir").
    // Kullanıcı talebi (2026-09-25): kişi hak kazandığında (başvuru onayı/yedekten terfi) bildirimde
    // gösterilen "ilk katılım" seansı, hak kazanılan GÜN HARİÇ olmak üzere sonraki ilk seans olmalı.
    // Önceden ">= today" kullanıldığı için, terfi/onay bugün gerçekleştiğinde bugünkü seans (saati
    // geçmiş olsa da, ya da katılımcının yetişemeyeceği kadar yakın olsa da) bildiriliyordu — canlı
    // testte kanıtlandı: bugün terfi ettirilen kişiye "İlk katılımınız: <BUGÜNÜN TARİHİ>" gönderildi.
    // Artık "> today" ile bugünkü seanslar hariç tutulup ilk sonraki gün baz alınıyor.
    private async Task<(string? Date, string? Time)> GetNextSessionDateTimeAsync(Guid groupId, CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        var sessions = await uow.FacilitySessions.GetByGroupAsync(groupId, ct);
        var next = sessions
            .Where(s => !s.IsCancelled && s.Date.Date > today)
            .OrderBy(s => s.Date).ThenBy(s => s.StartTime)
            .FirstOrDefault();
        if (next is null) return (null, null);
        return (next.Date.ToString("dd.MM.yyyy"), next.StartTime);
    }

    // Terfi anında grubun GÜNCEL yaş/cinsiyet şartını karşılıyor mu diye tekrar kontrol eder.
    // Grup ayarları başvuru anından beri değişmiş olabilir (COM-CAP-006).
    private async Task<bool> IsRegistrationEligibleAsync(FacilityGroup group, FacilityRegistration registration, CancellationToken ct)
    {
        if (group.Gender != "mixed" && registration.ParticipantId.HasValue)
        {
            var participant = await uow.Participants.GetByIdAsync(registration.ParticipantId.Value, ct);
            if (participant is not null
                && FacilityEligibilityRules.CheckGender(group.Gender, participant.Gender) is not null)
                return false;
        }

        if (registration.BirthDate.HasValue)
        {
            var age = AgeFromBirthDate(registration.BirthDate.Value);
            if (group.AgeMin > 0 && age < group.AgeMin) return false;
            if (group.AgeMax > 0 && age > group.AgeMax) return false;
        }

        return true;
    }

    private static int AgeFromBirthDate(DateTime birth)
    {
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    // V03/D02 (carry): yedek kuyruğu SÜREKLİ/TEK — RebalanceAsync sonunda da grubun tüm aktif yedekleri
    // tek bir kararlı sırayla (WaitlistOrder → CreatedAt) 1'den yeniden numaralandırılır (dönem-bazlı
    // ayrı kuyruk YOK). CompactWaitlistOrderAsync ile aynı sözleşme.
    private async Task CompactWaitlistByDateAsync(Guid groupId, CancellationToken ct)
    {
        var ordered = (await uow.FacilityRegistrations.GetWaitlistByGroupAsync(groupId, ct))
            .Where(r => r.Status == "active")
            .OrderBy(r => r.WaitlistOrder == 0 ? int.MaxValue : r.WaitlistOrder)
            .ThenBy(r => r.CreatedAt).ThenBy(r => r.Id)
            .ToList();
        for (var i = 0; i < ordered.Count; i++)
        {
            if (ordered[i].WaitlistOrder != i + 1)
            {
                ordered[i].SetWaitlistOrder(i + 1);
                uow.FacilityRegistrations.Update(ordered[i]);
            }
        }
    }

    private async Task UpdateGroupCountsAsync(Guid groupId, CancellationToken ct)
    {
        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct);
        if (group is null) return;
        int main, waitlist;
        if (group.PeriodType == "recurring" && group.PeriodStart.HasValue && group.PeriodMonths > 0)
        {
            var pStart = group.PeriodStart.Value.Date;
            var months = group.PeriodMonths;
            var now = TurkeyTime.TodayDate();
            var effStart = now < pStart ? pStart : now;
            var activeIdx = FacilityPeriods.IndexAt(pStart, months, effStart);
            var period = FacilityPeriods.Bounds(pStart, months, activeIdx);
            var roster = await uow.FacilityRegistrations.GetByGroupAsync(groupId, ct);
            main = roster.Count(r => r.Kind == "main" && r.Status == "active"
                && (r.MembershipStart ?? pStart) < period.End && (r.PeriodEnd ?? DateTime.MaxValue) > period.Start);
            // V03/D02 (carry): asıl kontenjan dönem-bazlı (aynı anda o dönemde kaç kişi aktif) ama yedek
            // kuyruğu SÜREKLİ/TEK — bekleyen sayacı da tüm aktif yedekleri sayar (dönem-bazlı süzme değil),
            // aksi halde dönem geçişinde kıdemini koruyan yedekler sayaçtan düşüp "0 yedek" görünüyordu.
            waitlist = roster.Count(r => r.Kind == "reserve" && r.Status == "active");
        }
        else
        {
            (main, waitlist) = await uow.FacilityRegistrations.GetCountsByGroupAsync(groupId, ct);
        }
        group.SetCounts(main, waitlist);
        uow.FacilityGroups.Update(group);
    }

    // Denetim bulgusu (docs/tesis-spor-egitim-derin-test-2026-08-31.md P1-4, 2026-09-05 canlı
    // testle doğrulandı): kuralın gerekçesi ("aynı gün/saatte yalnızca bir programa katılabilir")
    // FİZİKSEL bir kısıt — kişi aynı anda iki farklı yerde olamaz. Ama kontrol .Where(r => r.Module
    // == module) ile kendi modülüyle sınırlıydı, bu yüzden aynı modülde (ör. sports->sports) doğru
    // reddedilirken farklı modüller arasında (ör. sports pazartesi 09:00 + pool pazartesi 09:00)
    // hiç kontrol edilmiyordu. Canlı kanıt: aynı kişi aynı gün/saat için sports modülünde 2. kayıt
    // denediğinde 409 SAME_DAY_CONFLICT alırken, aynı gün/saati pool modülünde denediğinde 201
    // Created ile kabul ediliyordu — kontenjan israfı (kişi iki yerde birden yer tutup en az birine
    // hiç gidemiyor). Modül filtresi kaldırıldı; kural artık gerçekten modülden bağımsız.
    private async Task EnsureNoSameDayConflictAsync(string module, string tckn, FacilityGroup target, CancellationToken ct)
    {
        if (target.PeriodStart is null || target.PeriodEnd is null) return;
        var targetDays = FacilityScheduleHelper.ParseDays(target.ScheduleJson);
        if (targetDays.Count == 0) return;

        var others = await uow.FacilityRegistrations.GetActiveMainByTcknAsync(tckn, ct);
        foreach (var reg in others)
        {
            if (reg.GroupId == target.Id) continue;
            var other = await uow.FacilityGroups.GetByIdAsync(reg.GroupId, ct);
            if (other is null || other.PeriodStart is null || other.PeriodEnd is null) continue;
            if (!FacilityScheduleHelper.PeriodsOverlap(target.PeriodStart.Value, target.PeriodEnd.Value, other.PeriodStart.Value, other.PeriodEnd.Value)) continue;

            // Vatandaş yolundaki mesajla simetrik: operatör hangi gün/saatte hangi programın
            // engellediğini görmeden kaydı çözemiyordu.
            var overlap = FacilityScheduleHelper.FindOverlap(target.ScheduleJson, other.ScheduleJson);
            if (overlap is not null)
                throw new ConflictException(
                    $"Bu katılımcı {overlap.Describe()} saatinde {FacilityModuleLabels.For(reg.Module)} hizmetindeki \"{other.Name}\" programına kayıtlı. Aynı gün ve saatte yalnızca bir programa katılabilir.",
                    "SAME_DAY_CONFLICT");
        }
    }

    // BULGU-1: grup kısıtları (cinsiyet / yaş aralığı / ikamet-uyruk) yalnızca vatandaşın kendi
    // başvuru akışında (ParticipantFacilityService) uygulanıyordu; admin panelden doğrudan kayıt ve
    // başvuru onaylama yolları (FacilityApplicationService.ApproveAsync / BulkApproveAsync) bu
    // kuralların hiçbirine tabi değildi — kadın-only gruba erkek, 18-25 gruba 55 yaşındaki kişi,
    // foreign_only gruba T.C. vatandaşı 201 ile kabul ediliyordu. Kural kaynağı artık tek yerde
    // (FacilityEligibilityRules); iki yol da onu çağırıyor, ayrışamaz.
    private async Task EnsureEligibilityAsync(FacilityGroup group, RegisterParticipantRequest req, CancellationToken ct)
    {
        var participant = req.ParticipantId is Guid pid
            ? await uow.Participants.GetByIdAsync(pid, ct)
            : await uow.Participants.GetByTcknAsync(req.Tckn, ct);

        // Katılımcı sistemde hiç yoksa (eski sistemden kağıt kayıt aktarımı) cinsiyet/ikamet verisi
        // yoktur — kural uygulanamaz, kayıt engellenmez. Yaş kısıtı istekteki doğum tarihinden
        // bağımsız olarak yine uygulanır.
        if (participant is null)
        {
            if (req.BirthDate is not DateTime birth) return;
            var ageOnly = FacilityEligibilityRules.CheckAge(
                group.AgeMin, group.AgeMax, FacilityEligibilityRules.AgeAt(birth, TurkeyTime.TodayDate()));
            if (ageOnly is not null) throw new ConflictException(ageOnly.Message, ageOnly.ErrorCode);
            return;
        }

        var violation = FacilityEligibilityRules.CheckAll(
            group, participant, req.Tckn, TurkeyTime.TodayDate(), SultangaziDistrictCode);

        if (violation is not null)
            throw new ConflictException(violation.Message, violation.ErrorCode);
    }

    private async Task<FacilityGroup> EnsureGroupAsync(string module, Guid groupId, CancellationToken ct)
    {
        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct);
        if (group is null || group.Module != module)
            throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");
        if (!group.IsActive)
            throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");
        // Kullanıcı isteği (2026-08-04): tarihi geçmiş (dönemi bitmiş) bir grup/program vatandaşın
        // kendi başvuru akışında (ApplyAsync → FacilityApplicationWindow.Check) zaten reddediliyordu,
        // ama admin panelinden DOĞRUDAN kayıt açan uçlar (POST /{module}/registrations →
        // RegisterAsync, toplu TC ön-kayıt/aktarım → BulkPreRegisterAsync/BulkImportRegistrationAsync)
        // bu kontrolden hiç geçmiyordu — hepsi tek ortak kapı olan bu metodu çağırır. Sonuç: İzcilik
        // Kampı (ve tüm diğer tesis modülleri — spor, havuz, gençlik kampı, bilim merkezi, kaşif,
        // engelsiz yaşam) için dönemi/tarihi geçmiş bir programa admin üzerinden hâlâ kayıt
        // açılabiliyordu. Akademi tipi gruplarda PeriodEnd genelde null olduğu için (sürekli üyelik)
        // bu kontrol onları etkilemez; yalnızca gerçekten bir bitiş tarihi tanımlıysa uygulanır.
        // KİMLİK 2026-08-27: PeriodEnd UTC saklanır; ToTurkey dönüşümü olmadan .Date
        // karşılaştırması gece yarısı-03:00 arası dönemi yanlışlıkla bitmiş sayardı.
        if (group.PeriodEnd.HasValue && TurkeyTime.ToTurkey(group.PeriodEnd.Value).Date < TurkeyTime.TodayDate())
            throw new ConflictException("Bu programın dönemi sona ermiş. Yeni kayıt açılamaz.", "PERIOD_ENDED");
        await EnsureFacilityInScopeAsync(module, group.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, group.Id, ct);
        return group;
    }

    // Not: current.Id vatandaş (Participant) ise uow.AdminUsers'ta bulunamaz ve UserScopeService bunu
    // "unscoped" (tam erişim) olarak değerlendirir — bu yüzden bu kontrol vatandaşın kendi başvuru/
    // kayıt akışını (ApplyAsync -> RegisterAsync) etkilemez, yalnızca tesis-scope'lu personeli sınırlar.
    private async Task EnsureFacilityInScopeAsync(string module, Guid facilityId, CancellationToken ct)
    {
        if (current.Id is not Guid userId) return;
        var scoped = await userScope.GetScopedRefIdsAsync(userId, module, ct);
        if (scoped is not null && !scoped.Contains(facilityId))
            throw new ForbiddenException("Bu tesisin kayıtlarını düzenleme yetkiniz yok.", "FACILITY_OUT_OF_SCOPE");
    }

    // GUID'in ilk 8 baytından deterministik bir long üretir (aynı GroupId her zaman aynı kilit anahtarını verir).
    private static long GroupLockKey(Guid groupId) => BitConverter.ToInt64(groupId.ToByteArray(), 0);

    private async Task<FacilityRegistration> GetOwnedAsync(string module, Guid id, CancellationToken ct)
    {
        var registration = await uow.FacilityRegistrations.GetByIdAsync(id, ct);
        if (registration is null || registration.Module != module)
            throw new NotFoundException("Kayıt bulunamadı.", "REGISTRATION_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, registration.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, registration.GroupId, ct);
        return registration;
    }

    private static FacilityRegistrationDto ToDto(FacilityRegistration r, string? groupName)
        => new(r.Id, r.Module, r.FacilityId, r.GroupId, groupName, r.BranchId, r.ParticipantId,
            r.FullName, r.Tckn, r.Phone, r.BirthDate, r.GuardianPhone, r.Kind, r.WaitlistOrder,
            r.MembershipStart, r.PeriodEnd, r.AbsenceUsed, r.ConsecutiveAbsenceUsed, r.Status, r.CreatedAt);
}
