using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenIdentity;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Infrastructure.Services;

public class FacilityAttendanceService(
    IUnitOfWork uow,
    ICurrentUser current,
    IUserScopeService userScope,
    IFacilityRegistrationService registration,
    IFacilityNotificationService notification,
    IQrTokenService qr,
    ICitizenIdentityQrService cidQr,
    IFacilityDoorController door,
    IConfiguration config) : IFacilityAttendanceService
{
    public async Task<List<AttendanceRosterItemDto>> GetRosterAsync(string module, Guid sessionId, CancellationToken ct)
    {
        var session = await GetSessionAsync(module, sessionId, ct);
        // Kod denetimi 2026-08-08 (kullanıcı isteği: "yoklamalı yoklamasız cihazlı cihazsız tüm
        // testlerinin sorunsuz aynı mantıkta çalışması" + "kişilerin sadece kendi tesislerini
        // görmesi"): bu metod (yoklama listesini görüntüleme) daha önce hiç scope kontrolü
        // yapmıyordu — CorrectAsync/ReviseByRegistrationAsync yapıyordu ama asıl yoklama akışının
        // girişi olan GetRosterAsync/SaveAsync yapmıyordu. Sonuç: tesis-kısıtlı (scoped) bir
        // yönetici/eğitmen, sessionId'sini bilirse/tahmin ederse yetkisi olmayan bir tesisin
        // yoklama listesini görebiliyor ve (SaveAsync altta) değiştirebiliyordu — modül/cihaz
        // durumundan bağımsız her senaryoda geçerli bir yetkilendirme açığıydı.
        await EnsureFacilityInScopeAsync(module, session.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, session.GroupId, ct);
        var group = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct);
        var roster = await uow.FacilityRegistrations.GetByGroupAsync(session.GroupId, ct);
        var attendance = await uow.FacilityAttendances.GetBySessionAsync(sessionId, ct);
        var byReg = attendance.Where(a => a.RegistrationId.HasValue).ToDictionary(a => a.RegistrationId!.Value);

        // Kullanıcı bulgusu (1 Ağustos'ta onaylanan başvuru 26.07.2026 tarihli seansın yoklama
        // listesinde görünüyor): GetByGroupAsync gruptaki TÜM aktif kayıtları döndürür ve tarih
        // filtresi uygulamaz. Bir katılımcının kaydı (onayı) seans tarihinden SONRA oluşturulduysa
        // o kişi henüz gruba dahil değilken geçmişte kalmış/gelecekteki o seansta yoklamaya tabi
        // gösterilmemeli — kayıt ne zaman onaylanırsa onaylansın, yalnızca onay tarihi ve sonrasındaki
        // seanslarda listelenmeli. Zaten geçmişte alınmış (attendanceTaken) bir yoklamayı bozmamak
        // için, bu kişi için o seansta zaten bir yoklama kaydı varsa (byReg) yine de gösterilir.
        // D05: kişi seansta ancak kendi hak aralığındaysa (MembershipStart..PeriodEnd) yoklamaya girer.
        // MembershipStart yoksa (eski/kişisel-tarihsiz kayıt) kayıt oluşturma tarihine (CreatedAt, UTC→yerel)
        // düşülür. Zaten alınmış bir yoklama (byReg) her durumda gösterilir (geçmişi bozma).
        var offsetMinutes = config.GetValue("FacilitySettings:LocalTimeZoneOffsetMinutes", 180);
        roster = roster.Where(r =>
            (r.MembershipStart.HasValue
                ? FacilitySessionEligibility.IsEligible(session.Date, r.MembershipStart, r.PeriodEnd, session.IsCancelled)
                : r.CreatedAt.AddMinutes(offsetMinutes).Date <= session.Date.Date)
            || byReg.ContainsKey(r.Id)).ToList();

        return roster.Select(r => new AttendanceRosterItemDto(
            r.Id, r.ParticipantId, r.FullName, r.Tckn, r.Kind, r.AbsenceUsed, r.ConsecutiveAbsenceUsed,
            byReg.TryGetValue(r.Id, out var att) ? att.Status : "none",
            byReg.TryGetValue(r.Id, out var qrAtt) && qrAtt.CheckedInAt.HasValue,
            group?.AbsenceLimit ?? 0, group?.ConsecutiveAbsenceLimit ?? 0)).ToList();
    }

    public async Task<SaveAttendanceResult> SaveAsync(string module, SaveAttendanceRequest req, CancellationToken ct)
    {
        var session = await GetSessionAsync(module, req.SessionId, ct);
        // Kod denetimi 2026-08-08: bkz. GetRosterAsync'teki not — yoklama KAYDETME akışı da
        // scope kontrolünden geçmiyordu (CorrectAsync yapıyordu, SaveAsync yapmıyordu). Bu
        // asimetri, tesis-kısıtlı bir hesabın yetkisi olmayan bir tesiste yoklama alabilmesine
        // izin veriyordu.
        await EnsureFacilityInScopeAsync(module, session.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, session.GroupId, ct);
        if (session.AttendanceTakenAt.HasValue)
            throw new ConflictException("Bu seansın yoklaması zaten alınmış, tekrar değiştirilemez.", "ATTENDANCE_ALREADY_TAKEN");
        return await SaveRosterAsync(module, session, req, false, ct);
    }

    public async Task<SaveAttendanceResult> CorrectAsync(string module, SaveAttendanceRequest req, CancellationToken ct)
    {
        var session = await GetSessionAsync(module, req.SessionId, ct);
        await EnsureFacilityInScopeAsync(module, session.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, session.GroupId, ct);
        return await SaveRosterAsync(module, session, req, true, ct);
    }

    private async Task EnsureFacilityInScopeAsync(string module, Guid facilityId, CancellationToken ct)
    {
        if (current.Id is not Guid userId) return;
        var scoped = await userScope.GetScopedRefIdsAsync(userId, module, ct);
        if (scoped is not null && !scoped.Contains(facilityId))
            throw new ForbiddenException("Bu tesisin yoklamasını düzenleme yetkiniz yok.", "FACILITY_OUT_OF_SCOPE");
    }

    /// <summary>
    /// Bu tesisin (alan cihazı) veya bağlı hizmet tesisinin (genel giriş cihazı) aktif bir QR/turnike
    /// giriş cihazı var mı? Yoksa "geldi" işaretlemeden önce QR girişi zorunluluğu uygulanmaz —
    /// aksi halde cihazsız tesislerde yönetici hiçbir zaman yoklama alamaz hale gelir.
    /// </summary>
    private async Task<bool> FacilityHasActiveCheckInDeviceAsync(string module, Guid facilityId, CancellationToken ct)
    {
        var areaDevices = await uow.FacilityDevices.GetByFacilityAsync(module, facilityId, ct);
        if (areaDevices.Any(d => d.IsActive)) return true;

        var facility = await uow.Facilities.GetByIdAsync(facilityId, ct);
        if (facility?.ServiceFacilityId is not Guid sfId) return false;

        var generalDevices = await uow.FacilityDevices.GetByServiceFacilityAsync(module, sfId, ct);
        return generalDevices.Any(d => d.IsActive);
    }

    private async Task<SaveAttendanceResult> SaveRosterAsync(string module, FacilitySession session, SaveAttendanceRequest req, bool isCorrection, CancellationToken ct)
    {
        var group = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct)
            ?? throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");

        if (group.AttendanceMode == "off")
            throw new ConflictException("Bu grupta yoklama sistemi kapalı. Yoklama kaydı alınamaz.", "ATTENDANCE_DISABLED");

        // Kullanıcı isteği: Yoklama yalnızca seans başlangıç saati ile bitiş saati arasında alınabilir.
        // Seans başlamadan "Geldi/Gelmedi/Geç Geldi" işaretlenemez; seans bittikten sonra normal
        // yönetici/eğitmen tarafından yeni yoklama girilemez/değiştirilemez. Yetkili "Devamsızlık
        // Düzelt" (isCorrection, facility-attendance.edit izni) akışı bu zaman kısıtından muaftır —
        // bu, denetim/telafi amaçlı bilinçli bir istisna olup ayrı yetki kontrolüyle korunur.
        if (!isCorrection)
        {
            var now = LocalNow();
            if (!TryParseTime(session.StartTime, out var sh, out var sm))
                throw new ConflictException("Seansın başlangıç saati tanımlı değil.", "SESSION_TIME_INVALID");
            var sessionStart = session.Date.Date.AddHours(sh).AddMinutes(sm);
            if (now < sessionStart)
                throw new ConflictException("Seans henüz başlamadı. Yoklama alınamaz.", "SESSION_NOT_STARTED");

            if (TryParseTime(session.EndTime, out var eh, out var em))
            {
                var sessionEnd = session.Date.Date.AddHours(eh).AddMinutes(em);
                if (now > sessionEnd)
                    throw new ConflictException("Seans sona erdi. Yeni yoklama girilemez.", "SESSION_ENDED");
            }
        }

        // Kullanıcı isteği: "Geç Gelme Takibi" grup ayarında kapalıysa "Geç Geldi" durumu backend'de
        // de kabul edilmemeli — bu kontrol yalnızca frontend'de yapılırsa istemci atlatılabilir.
        if (!group.LateTrackingEnabled && req.Marks.Any(m => NormalizeStatus(m.Status) == "late"))
            throw new ConflictException("Bu grupta \"Geç Gelme Takibi\" kapalı. Geç Geldi durumu seçilemez.", "LATE_TRACKING_DISABLED");

        // Denetim bulgusu (docs/tesis-spor-egitim-derin-test-2026-08-31.md P1-5, 2026-09-05
        // canlı testle doğrulandı): normal yoklama roster'ı yalnızca Status="active" kayıtları
        // içerir (kişi çıkarılınca artık listede görünmemeli — doğru davranış). Ancak
        // "Devamsızlık Düzelt" (isCorrection=true) akışında amaç tam tersi: devamsızlıktan
        // Status="removed" olmuş bir kaydı bulup düzeltebilmek. isCorrection=true iken removed
        // kayıtlar da roster'a dahil edilir, aksi halde mark.RegistrationId hiç bulunamayıp
        // sessizce atlanıyordu — canlı kanıt: absenceLimit=3 grupta removed bir kayda revise
        // çağrısı önce {marked:0,removed:0} dönüyordu (hiçbir şey yapmadan "başarılı" görünüyordu).
        var roster = isCorrection
            ? (await uow.FacilityRegistrations.FindAsync(r => r.GroupId == session.GroupId, ct)).ToDictionary(r => r.Id)
            : (await uow.FacilityRegistrations.GetByGroupAsync(session.GroupId, ct)).ToDictionary(r => r.Id);
        var existing = (await uow.FacilityAttendances.GetBySessionAsync(session.Id, ct))
            .Where(a => a.RegistrationId.HasValue).ToDictionary(a => a.RegistrationId!.Value);

        // "Geldi/Geç" için önce QR/manuel turnike girişi zorunluluğu, YALNIZCA bu tesiste gerçekten
        // aktif bir giriş cihazı (QR kiosk/turnike) tanımlıysa uygulanır. Cihazı olmayan tesislerde
        // (bugün itibarıyla 263 gerçek tesisin 262'si) bu şart hiçbir zaman sağlanamayacağından
        // yöneticiyi ilk yoklamada kilitler — bu yüzden cihazsız tesislerde tamamen manuel yoklamaya izin verilir.
        var hasCheckInDevice = await FacilityHasActiveCheckInDeviceAsync(module, session.FacilityId, ct);
        if (!isCorrection && hasCheckInDevice)
        {
            var presentWithoutEntry = new List<string>();
            var absentWithEntry = new List<string>();
            foreach (var mark in req.Marks)
            {
                if (!roster.TryGetValue(mark.RegistrationId, out var reg)) continue;
                var status = NormalizeStatus(mark.Status);
                var enteredViaQr = existing.TryGetValue(mark.RegistrationId, out var att) && att.CheckedInAt.HasValue;
                if (status != "absent" && !enteredViaQr) presentWithoutEntry.Add(reg.FullName);
                else if (status == "absent" && enteredViaQr) absentWithEntry.Add(reg.FullName);
            }
            if (presentWithoutEntry.Count > 0)
                throw new ConflictException(
                    $"Şu kişiler tesise QR ile giriş yapmamıştır, \"geldi\" olarak işaretlenemez: {string.Join(", ", presentWithoutEntry)}.",
                    "ATTENDANCE_NOT_CHECKED_IN");
            if (absentWithEntry.Count > 0 && !req.Confirm)
                throw new ConflictException(
                    $"Şu kişiler tesise QR ile giriş yapmıştır, \"gelmedi\" olarak işaretlediniz: {string.Join(", ", absentWithEntry)}. Yine de kaydetmek istiyor musunuz?",
                    "ATTENDANCE_ENTERED_BUT_ABSENT_CONFIRM");
        }

        var marked = 0;
        var removed = 0;
        var changed = new HashSet<Guid>();
        var deferredNotices = new List<FacilityDeferredNoticeDto>();
        await uow.BeginTransactionAsync(ct);
        try
        {
            // V05: iki eşzamanlı yoklama düzeltmesi kapasiteyi aşabiliyordu — her ikisi de DB'deki aktif
            // asıl sayısını (baseActiveMains) commit'ten önce okuyup ayrı ayrı reactivate ediyordu. Grup
            // düzeyinde transaction-scoped advisory kilit ile aynı gruba gelen yoklama/düzeltme işlemleri
            // seri hale getirilir; ikinci işlem birincinin commit'ini bekler, güncel sayıyı görür.
            // RemoveForBatchAsync da aynı kilidi (re-entrant) alır — tek transaction içinde sorunsuz.
            await uow.AcquireAdvisoryLockAsync(GroupLockKey(session.GroupId), ct);

            // Z01: kilit ALINDIKTAN SONRA karar verilecek veriyi GERÇEKTEN tazele. Kilit öncesi yüklenen
            // nesneler aynı DbContext tarafından izlendiğinden, sorguyu TEKRARLAMAK onların skalar alanlarını
            // DB'den yenilemez (EF izlenen örneği döndürür). Bu yüzden önce izleyici TEMİZLENİR, sonra yazım
            // kararına giren TÜM veri (session/group/roster/attendance) DB'den taze yüklenir. Kilit öncesi
            // yalnız okuma yapıldığından (yetki/kapsam/QR/zaman ön kontrolleri) temizlemede kayıp olmaz.
            uow.ClearChangeTracker();
            session = await uow.FacilitySessions.GetByIdAsync(session.Id, ct)
                ?? throw new NotFoundException("Seans bulunamadı.", "SESSION_NOT_FOUND");
            group = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct)
                ?? throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");
            roster = isCorrection
                ? (await uow.FacilityRegistrations.FindAsync(r => r.GroupId == session.GroupId, ct)).ToDictionary(r => r.Id)
                : (await uow.FacilityRegistrations.GetByGroupAsync(session.GroupId, ct)).ToDictionary(r => r.Id);
            existing = (await uow.FacilityAttendances.GetBySessionAsync(session.Id, ct))
                .Where(a => a.RegistrationId.HasValue).ToDictionary(a => a.RegistrationId!.Value);

            foreach (var mark in req.Marks)
            {
                if (!roster.TryGetValue(mark.RegistrationId, out var reg)) continue;
                var status = NormalizeStatus(mark.Status);

                if (existing.TryGetValue(mark.RegistrationId, out var att))
                {
                    if (att.Status != status) changed.Add(mark.RegistrationId);
                    att.SetStatus(status, isCorrection ? "correction" : "roster", current.Name);
                    uow.FacilityAttendances.Update(att);
                }
                else
                {
                    // V04/D05: YENİ yoklama yalnız kişinin hak aralığında (MembershipStart..PeriodEnd) ve
                    // iptal olmayan seanslar için yazılır. Normal yoklamada ek olarak aktif ASIL kayıt şartı
                    // vardır (terfi/kayıt öncesi ya da yedek kayda present/absent yazılmaz). DÜZELTME (isCorrection)
                    // removed/yedek kaydın MEVCUT satırını düzeltebilir (yukarıdaki dal), ANCAK uygun olmayan
                    // bir seansa geriye dönük SAHTE yeni satır üretemez — bu yüzden hak-aralığı kontrolü
                    // düzeltmede de YENİ satır üretiminde uygulanır.
                    var eligibleSession = FacilitySessionEligibility.IsEligible(session.Date, reg.MembershipStart, reg.PeriodEnd, session.IsCancelled);
                    if (!isCorrection && (reg.Kind != "main" || reg.Status != "active" || !eligibleSession))
                        continue;
                    // Y04: düzeltmede YENİ satır yalnız kişinin o seansta GERÇEK (tarihli) asıl hakkı varsa
                    // üretilir. Üyelik tarihi BOŞ (yedek/hak başlamamış) kayıtta `IsEligible(null, null)` → true
                    // döndüğünden "sınırsız hak" gibi yorumlanıp sahte yeni satır üretilirdi; yeni satır için
                    // tarihli üyelik ŞART. Mevcut tarihsel satırın düzeltmesi (üst dal) bundan etkilenmez.
                    if (isCorrection && (!reg.MembershipStart.HasValue || !eligibleSession))
                        continue;
                    changed.Add(mark.RegistrationId);
                    var created = FacilityAttendance.Create(module, session.FacilityId, group.Id, session.Id,
                        reg.Id, reg.ParticipantId, reg.FullName, reg.Tckn, status, isCorrection ? "correction" : "roster", current.Name);
                    await uow.FacilityAttendances.AddAsync(created, ct);
                }
                marked++;
            }

            session.MarkAttendanceTaken();
            uow.FacilitySessions.Update(session);
            await uow.SaveChangesAsync(ct);

            var toRemove = await RecomputeUsageAsync(group, req.Marks.Select(m => m.RegistrationId).Distinct().ToList(), roster, ct, isCorrection);
            await uow.SaveChangesAsync(ct);

            foreach (var regId in toRemove)
            {
                // V02.2: çıkarma bu DIŞ transaction'a katılır (RemoveForBatchAsync bildirim GÖNDERMEZ) —
                // devamsızlık-limiti + yedek-terfi bildirimleri commit'ten SONRA gönderilmek üzere toplanır.
                deferredNotices.AddRange(await registration.RemoveForBatchAsync(module, regId, "Devamsızlık hakkı doldu", ct));
                removed++;
            }
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        // Kullanıcı isteği (2026-10-05): Yoklama SMS gönderimi sistem ayarlarından veya ana sayfadan
        // açılıp kapatılabilir. Varsayılan olarak kapalıdır (pasif) — yönetici açmadan yoklamalarda
        // vatandaşlara/velilere SMS gitmez.
        var generalSettings = uow.FacilitySettings != null ? await uow.FacilitySettings.GetGeneralAsync(module, ct) : null;
        var attendanceSmsEnabled = FacilitySettingsValues.Bool(generalSettings?.SettingsJson, "attendanceSmsEnabled") ?? false;

        if (attendanceSmsEnabled)
        {
            foreach (var n in deferredNotices)
                await notification.SendStatusAsync(n.Module, n.Event, n.Phone, n.FullName,
                    new FacilityNotificationVars(GroupName: n.GroupName, FacilityName: n.FacilityName,
                        SessionDate: n.SessionDate, SessionTime: n.SessionTime, CancelReason: n.CancelReason, Limit: n.Limit), ct, n.ParticipantId);

            var notifyResults = req.Marks
                .Where(m => roster.ContainsKey(m.RegistrationId) && (!isCorrection || changed.Contains(m.RegistrationId)))
                .Select(m => (roster[m.RegistrationId], NormalizeStatus(m.Status)))
                // Kullanıcı isteği: "Devamsızlık Takibi" kapalıyken (tracking_only/off) devamsızlık
                // bildirimi hiç gönderilmemeli. Geldi/Geç bildirimleri (yoklama bilgisi) etkilenmez.
                .Where(r => r.Item2 != "absent" || group.AttendanceMode == "full")
                .ToList();
            if (notifyResults.Count > 0)
                await notification.NotifyAttendanceAsync(session, group.Name, notifyResults, ct);
        }

        return new SaveAttendanceResult(marked, removed);
    }

    public async Task<List<AttendanceHistoryItemDto>> GetHistoryByRegistrationAsync(string module, Guid registrationId, CancellationToken ct)
    {
        var registration = await uow.FacilityRegistrations.GetByIdAsync(registrationId, ct);
        if (registration is null || registration.Module != module)
            throw new NotFoundException("Kayıt bulunamadı.", "REGISTRATION_NOT_FOUND");
        // Kod denetimi 2026-08-08: devamsızlık geçmişi görüntüleme de scope kontrolünden geçmiyordu.
        await EnsureFacilityInScopeAsync(module, registration.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, registration.GroupId, ct);

        var atts = await uow.FacilityAttendances.GetByRegistrationAsync(registrationId, ct);
        if (atts.Count == 0) return [];

        var sessionIds = atts.Select(a => a.SessionId).Distinct().ToList();
        var sessions = (await uow.FacilitySessions.FindAsync(s => sessionIds.Contains(s.Id), ct))
            .ToDictionary(s => s.Id);

        return atts
            .Where(a => sessions.ContainsKey(a.SessionId))
            .OrderByDescending(a => sessions[a.SessionId].Date)
            .Select(a =>
            {
                var s = sessions[a.SessionId];
                return new AttendanceHistoryItemDto(a.Id, s.Id, s.Date, s.StartTime, s.EndTime, a.Status, a.Method, a.CheckedInAt.HasValue, a.MarkedAt, a.MarkedBy);
            })
            .ToList();
    }

    public async Task<SaveAttendanceResult> ReviseByRegistrationAsync(string module, Guid registrationId, ReviseAttendanceRequest req, CancellationToken ct)
    {
        var registration = await uow.FacilityRegistrations.GetByIdAsync(registrationId, ct);
        if (registration is null || registration.Module != module)
            throw new NotFoundException("Kayıt bulunamadı.", "REGISTRATION_NOT_FOUND");

        var session = await GetSessionAsync(module, req.SessionId, ct);
        if (session.GroupId != registration.GroupId)
            throw new ConflictException("Seçilen seans bu kayda ait değil.", "SESSION_GROUP_MISMATCH");

        await EnsureFacilityInScopeAsync(module, session.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, session.GroupId, ct);

        var saveReq = new SaveAttendanceRequest(session.Id, [new AttendanceMark(registrationId, req.Status)], req.Confirm);
        return await SaveRosterAsync(module, session, saveReq, true, ct);
    }

    public async Task<AttendanceRosterItemDto> CheckInAsync(string module, Guid sessionId, string tckn, CancellationToken ct)
    {
        var session = await GetSessionAsync(module, sessionId, ct);
        // Kod denetimi 2026-08-08: manuel TCKN girişi de yoklama akışının bir parçası — bkz.
        // GetRosterAsync/SaveAsync'teki aynı not, aynı kök neden.
        await EnsureFacilityInScopeAsync(module, session.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, session.GroupId, ct);
        var group = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct)
            ?? throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");

        var roster = await uow.FacilityRegistrations.GetByGroupAsync(session.GroupId, ct);
        var reg = roster.FirstOrDefault(r => r.Tckn == tckn)
            ?? throw new NotFoundException("Bu seansın grubunda bu kişi bulunamadı.", "NOT_IN_ROSTER");

        if (group.AttendanceMode == "off")
            throw new ConflictException("Bu grupta yoklama sistemi kapalı. Giriş kaydı alınamaz.", "ATTENDANCE_DISABLED");

        if (reg.PeriodEnd.HasValue && reg.PeriodEnd.Value.Date < LocalNow().Date)
            throw new ConflictException("Bu kaydın dönemi sona ermiştir. Giriş yapılamaz.", "PERIOD_ENDED");

        // Kullanıcı isteği: Manuel TCKN girişi de seans başlangıç/bitiş penceresiyle sınırlı olmalı —
        // bu kural yalnızca frontend'de değil, backend'de de zorunludur.
        var checkInNow = LocalNow();
        if (!TryParseTime(session.StartTime, out var ciSh, out var ciSm))
            throw new ConflictException("Seansın başlangıç saati tanımlı değil.", "SESSION_TIME_INVALID");
        var checkInSessionStart = session.Date.Date.AddHours(ciSh).AddMinutes(ciSm);
        if (checkInNow < checkInSessionStart)
            throw new ConflictException("Seans henüz başlamadı. Giriş kaydı alınamaz.", "SESSION_NOT_STARTED");
        if (TryParseTime(session.EndTime, out var ciEh, out var ciEm))
        {
            var checkInSessionEnd = session.Date.Date.AddHours(ciEh).AddMinutes(ciEm);
            if (checkInNow > checkInSessionEnd)
                throw new ConflictException("Seans sona erdi. Giriş kaydı alınamaz.", "SESSION_ENDED");
        }

        var existing = (await uow.FacilityAttendances.GetBySessionAsync(sessionId, ct)).FirstOrDefault(a => a.RegistrationId == reg.Id);
        if (existing is not null)
        {
            existing.SetStatus("present", "manual", current.Name);
            existing.SetCheckedInAt();
            uow.FacilityAttendances.Update(existing);
        }
        else
        {
            var created = FacilityAttendance.Create(module, session.FacilityId, group.Id, sessionId,
                reg.Id, reg.ParticipantId, reg.FullName, reg.Tckn, "present", "manual", current.Name);
            // Kod denetimi 2026-08-02: bu gerçek bir fiziksel giriş kaydı (/attendance/check-in) —
            // CheckedInAt set edilmezse RecurringJobsBootstrapper'daki otomatik-çıkış job'ı bu kaydı
            // asla bulamaz ve kişi kapasitede sonsuza kadar "içeride" görünebilir.
            created.SetCheckedInAt();
            await uow.FacilityAttendances.AddAsync(created, ct);
        }

        session.MarkAttendanceTaken();
        uow.FacilitySessions.Update(session);
        await uow.SaveChangesAsync(ct);

        await RecomputeUsageAsync(group, [reg.Id], roster.ToDictionary(r => r.Id), ct);
        await uow.SaveChangesAsync(ct);

        return new AttendanceRosterItemDto(reg.Id, reg.ParticipantId, reg.FullName, reg.Tckn, reg.Kind, reg.AbsenceUsed, reg.ConsecutiveAbsenceUsed, "present");
    }

    public async Task<AttendanceCheckInResultDto> CheckInByFacilityAsync(string module, Guid facilityId, string code, string method, CancellationToken ct)
    {
        var facility = await uow.Facilities.GetByIdAsync(facilityId, ct);
        if (facility is null || facility.Module != module)
            throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        // Kod denetimi 2026-08-08: bu uç (/attendance/manual ve /attendance/qr) doğrudan
        // facilityId parametresi alıyor ve panel oturumu (AdminOrAbove) gerektiriyor — tesis-
        // kısıtlı bir hesap, facilityId'yi elle değiştirerek yetkisi olmayan bir tesiste manuel/QR
        // giriş kaydı oluşturabiliyordu. Fiziksel cihaz (apiKey ile kimliklenen DeviceCheckInAsync)
        // bu kapsamın dışındadır, ayrı bir kimlik doğrulama mekanizması kullanır.
        await EnsureFacilityInScopeAsync(module, facilityId, ct);

        var today = LocalNow().Date;
        var sessions = (await uow.FacilitySessions.GetByDayAsync(module, facilityId, today, ct)).Where(s => !s.IsCancelled).ToList();
        if (sessions.Count == 0)
            return new AttendanceCheckInResultDto(false, "", "", "none", today, "Bugün bu tesiste seans yok.");

        var openBefore = config.GetValue("FacilitySettings:CheckinOpenMinutesBefore", 30);
        var localNow = LocalNow();
        var sawExpired = false;
        var sawOutOfWindow = false;
        foreach (var session in sessions)
        {
            var roster = await uow.FacilityRegistrations.GetByGroupAsync(session.GroupId, ct);
            var reg = roster.FirstOrDefault(r => r.Tckn == code);
            if (reg is null) continue;
            if (reg.PeriodEnd.HasValue && reg.PeriodEnd.Value.Date < today)
            {
                sawExpired = true;
                continue;
            }

            var grpWin = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct);
            if (grpWin?.AttendanceMode == "off") continue;
            string entryStatus = "present";
            if (TryParseTime(session.StartTime, out var wh, out var wm))
            {
                var wstart = session.Date.Date.AddHours(wh).AddMinutes(wm);
                // Kullanıcı isteği: Yoklama/giriş penceresi seans BİTİŞ saatine kadar açık kalmalı —
                // önceden EntryGraceMinutes (genelde birkaç dakika) sert bir üst sınır olarak
                // kullanılıyordu, bu da seans hâlâ devam ederken meşru geç girişleri reddediyordu.
                // EntryGraceMinutes artık yalnızca "present" / "late" ayrımını belirlemek için kullanılır.
                DateTime wend;
                if (TryParseTime(session.EndTime, out var weh, out var wem))
                    wend = session.Date.Date.AddHours(weh).AddMinutes(wem);
                else
                    wend = wstart.AddMinutes(grpWin?.EntryGraceMinutes ?? 0);

                if (localNow < wstart.AddMinutes(-openBefore) || localNow > wend)
                {
                    sawOutOfWindow = true;
                    continue;
                }
                if (grpWin?.LateTrackingEnabled == true && localNow > wstart.AddMinutes(grpWin?.EntryGraceMinutes ?? 0))
                    entryStatus = "late";
            }

            var existing = (await uow.FacilityAttendances.GetBySessionAsync(session.Id, ct)).FirstOrDefault(a => a.RegistrationId == reg.Id);
            if (existing is not null)
            {
                existing.SetStatus(entryStatus, method, current.Name);
                existing.SetCheckedInAt();
                uow.FacilityAttendances.Update(existing);
            }
            else
            {
                var created = FacilityAttendance.Create(module, facilityId, session.GroupId, session.Id,
                    reg.Id, reg.ParticipantId, reg.FullName, reg.Tckn, entryStatus, method, current.Name);
                // Kod denetimi 2026-08-02: kiosk (manuel/QR) girişi de fiziksel giriş kaydıdır,
                // CheckedInAt set edilmezse otomatik-çıkış job'ı bu kaydı bulamaz.
                created.SetCheckedInAt();
                await uow.FacilityAttendances.AddAsync(created, ct);
            }

            session.MarkAttendanceTaken();
            uow.FacilitySessions.Update(session);
            await uow.SaveChangesAsync(ct);

            var group = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct);
            if (group is not null)
            {
                await RecomputeUsageAsync(group, [reg.Id], roster.ToDictionary(r => r.Id), ct);
                await uow.SaveChangesAsync(ct);
            }

            return new AttendanceCheckInResultDto(true, reg.FullName, group?.Name ?? "", entryStatus, session.Date, "Giriş kaydedildi.");
        }

        return new AttendanceCheckInResultDto(false, "", "", "none", today,
            sawExpired ? "Bu kişinin kaydının dönemi sona ermiştir."
            : sawOutOfWindow ? "Giriş penceresi bu saatte kapalı. Lütfen seans saatinde giriş yapın."
            : "Bu kişi bugün bu tesiste bir gruba kayıtlı değil.");
    }

    public async Task<DeviceCheckInResultDto> DeviceCheckInAsync(string module, string deviceCode, string apiKey, string code, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(deviceCode) || string.IsNullOrWhiteSpace(apiKey))
            return new(false, "Cihaz kimlik bilgisi eksik.", null, null, null);

        var device = (await uow.FacilityDevices.FindAsync(d => d.DeviceCode == deviceCode, ct)).FirstOrDefault();
        if (device is null || !device.IsActive) return new(false, "Cihaz tanınmadı veya pasif durumda.", null, null, null);
        if (!FixedEquals(device.ApiKey, apiKey)) return new(false, "Cihaz yetkisi geçersiz.", null, null, null);

        return await RunDeviceCheckInAsync(device, code, ct);
    }

    public async Task<DeviceCheckInResultDto> DeviceCheckInByDeviceAsync(FacilityDevice device, string code, CancellationToken ct)
    {
        if (device is null || !device.IsActive) return new(false, "Cihaz tanınmadı veya pasif durumda.", null, null, null);
        if (string.IsNullOrWhiteSpace(device.Module)) return new(false, "Cihaz bir hizmet türüne bağlı değil.", null, null, null);
        return await RunDeviceCheckInAsync(device, code, ct);
    }

    private async Task<DeviceCheckInResultDto> RunDeviceCheckInAsync(FacilityDevice device, string code, CancellationToken ct)
    {
        static DeviceCheckInResultDto Deny(string msg) => new(false, msg, null, null, null);

        if (string.IsNullOrWhiteSpace(code))
            return Deny("Geçersiz okuma. Lütfen tekrar deneyin.");

        if (device.Scope == FacilityDeviceScope.Event)
            return await RunEventDeviceCheckInAsync(device, code, ct);

        var isGeneral = device.Scope == FacilityDeviceScope.FacilityGeneral;
        if (isGeneral && device.ServiceFacilityId is null)
            return Deny("Genel giriş cihazı bir tesise bağlı değil.");
        if (!isGeneral && device.FacilityId is null)
            return Deny("Cihaz bir alana bağlı değil.");

        var serviceFacilityId = await ResolveServiceFacilityIdAsync(device, isGeneral, ct);
        if (serviceFacilityId is not null)
        {
            var masterResult = await TryMasterAccessAsync(device, serviceFacilityId.Value, code, ct);
            if (masterResult is not null) return masterResult;
        }

        var now = LocalNow();
        var windowSeconds = config.GetValue("QrSettings:RotationSeconds", 60);

        var qrCache = new Dictionary<string, bool>();
        async Task<bool> QrEnabledAsync(string m)
        {
            if (!qrCache.TryGetValue(m, out var en))
            {
                var st = await uow.FacilitySettings.GetGeneralAsync(m, ct);
                en = FacilitySettingsValues.Bool(st?.SettingsJson, "qrTurnstileEnabled") != false;
                qrCache[m] = en;
            }
            return en;
        }

        var candidates = new List<FacilityRegistration>();

        if (qr.IsRotatingToken(code) && qr.TryParseSubjectId(code, out var registrationId))
        {
            var reg = await uow.FacilityRegistrations.GetByIdAsync(registrationId, ct);
            if (reg is null || reg.Status != "active") return Deny("Geçerli bir kaydınız bulunamadı.");
            if (!await RegInDeviceScopeAsync(device, reg, isGeneral, ct))
                return Deny("Bu cihazın bağlı olduğu yerde kayıtlı bir seansınız bulunmuyor.");
            if (!qr.Verify(code, registrationId, $"facility:{reg.Module}", windowSeconds))
                return Deny("QR süresi doldu. Lütfen uygulamadan güncel QR kodunu gösterin.");
            candidates.Add(reg);
        }
        else
        {
            var tckn = new string(code.Trim().Where(char.IsDigit).ToArray());
            if (tckn.Length != 11)
                return Deny("Geçersiz kimlik. Lütfen geçerli bir kart okutun veya uygulamadan QR gösterin.");

            foreach (var r in (await uow.FacilityRegistrations.GetActiveMainByTcknAsync(tckn, ct)).Where(r => r.Status == "active"))
                if (await RegInDeviceScopeAsync(device, r, isGeneral, ct))
                    candidates.Add(r);

            if (candidates.Count == 0)
                return Deny(isGeneral ? "Bu tesiste kayıtlı bir seansınız bulunmuyor." : "Bu tesiste kayıtlı bir seansınız bulunmuyor.");
        }

        candidates = candidates.Where(r => !r.PeriodEnd.HasValue || r.PeriodEnd.Value.Date >= now.Date).ToList();
        if (candidates.Count == 0) return Deny("Kaydınızın dönemi sona ermiş.");

        var openBefore = config.GetValue("FacilitySettings:CheckinOpenMinutesBefore", 30);
        var evals = new List<DeviceCheckInEval>();
        foreach (var r in candidates)
        {
            var group = await uow.FacilityGroups.GetByIdAsync(r.GroupId, ct);
            if (group is null || group.AttendanceMode == "off") continue;

            var todaySessions = (await uow.FacilitySessions.GetByGroupAsync(r.GroupId, ct))
                .Where(s => !s.IsCancelled && s.Date.Date == now.Date)
                .OrderBy(s => s.StartTime)
                .ToList();

            FacilitySession? openSession = null;
            FacilityAttendance? openEntry = null;
            foreach (var s in todaySessions)
            {
                // Kod denetimi 2026-09-29 (kullanıcı isteği: zamana dayalı giriş/çıkış testinde
                // gerçek entegrasyon testiyle bulundu): CheckedOutAt.HasValue kontrolü olmadan bu
                // sorgu, çıkışı yapılmış (present/late statüsü hâlâ değişmemiş ama CheckedOutAt
                // set edilmiş) bir kaydı da "açık seans" sayıyordu — bu da aynı kişinin çıkıştan
                // sonra AYNI seansa bir daha asla giriş yapamamasına yol açıyordu (yapısal bug,
                // reentry-cooldown özelliğinden bağımsız, ondan önce de mevcuttu).
                var att = (await uow.FacilityAttendances.GetBySessionAsync(s.Id, ct))
                    .FirstOrDefault(a => a.RegistrationId == r.Id && (a.Status == "present" || a.Status == "late") && !a.CheckedOutAt.HasValue);
                if (att is not null) { openSession = s; openEntry = att; break; }
            }

            FacilitySession? eligible = null;
            foreach (var s in todaySessions)
            {
                if (!TryParseTime(s.StartTime, out var h, out var m)) continue;
                var start = s.Date.Date.AddHours(h).AddMinutes(m);
                // Kullanıcı isteği: giriş penceresi seans bitişine kadar açık kalmalı; EntryGraceMinutes
                // yalnızca present/late ayrımı için kullanılır, sert üst sınır değildir.
                var end = TryParseTime(s.EndTime, out var eh, out var em)
                    ? s.Date.Date.AddHours(eh).AddMinutes(em)
                    : start.AddMinutes(group.EntryGraceMinutes);
                if (now >= start.AddMinutes(-openBefore) && now <= end)
                { eligible = s; break; }
            }

            evals.Add(new DeviceCheckInEval(r, group, openSession, openEntry, eligible, todaySessions.Count > 0));
        }
        if (evals.Count == 0) return Deny("Grup bulunamadı.");

        var openEval = evals.FirstOrDefault(e => e.OpenEntry is not null && e.OpenEntry.CheckedOutAt is null);
        var wantExit = device.Direction == "exit" || (device.Direction == "both" && openEval is not null);
        if (wantExit)
        {
            if (openEval is null)
            {
                var closed = evals.FirstOrDefault(e => e.OpenEntry is not null && e.OpenSession is not null);
                if (closed is not null)
                    return new(false, "Çıkış zaten yapılmış. QR kullanılmış.", closed.Reg.FullName, closed.Group.Name, SessionRange(closed.OpenSession!));
                return Deny("Giriş kaydınız bulunmadığı için çıkış yapılamaz. Önce giriş yapın.");
            }
            if (!await QrEnabledAsync(openEval.Reg.Module))
                return Deny("QR turnike entegrasyonu kapalı. Lütfen kiosk ile giriş yapın.");

            openEval.OpenEntry!.MarkExit();
            uow.FacilityAttendances.Update(openEval.OpenEntry);
            await uow.SaveChangesAsync(ct);
            await TriggerDoorAsync(device, "exit", ct);
            return new(true, "Çıkış onaylandı.", openEval.Reg.FullName, openEval.Group.Name, SessionRange(openEval.OpenSession!));
        }

        var entryEval = evals.FirstOrDefault(e => e.Eligible is not null && (e.OpenSession is null || e.OpenSession.Id != e.Eligible.Id));
        if (entryEval is null)
        {
            var already = evals.FirstOrDefault(e => e.Eligible is not null && e.OpenSession is not null && e.OpenSession.Id == e.Eligible.Id);
            if (already is not null)
                return new(false, "Bu seans için giriş zaten yapılmış. QR kullanılmış.", already.Reg.FullName, already.Group.Name, SessionRange(already.Eligible!));
            // KİMLİK 2026-07-29 (kullanıcı isteği): "Seansınız yok" mesajı iki farklı durumu net ayırt
            // etsin — (a) bugün bu tesiste hiç seans/program tanımlı değil, (b) seans var ama şu an
            // giriş penceresi (openBefore/entryGraceMinutes) dışında.
            var hasAnySessionToday = evals.Any(e => e.HasAnySessionToday);
            return Deny(hasAnySessionToday
                ? "Şu an giriş saatiniz değil. Seansınızın giriş penceresi dışındasınız."
                : "Bu tesiste bugün için tanımlı bir seansınız/programınız bulunmuyor.");
        }

        if (!await QrEnabledAsync(entryEval.Reg.Module))
            return Deny("QR turnike entegrasyonu kapalı. Lütfen kiosk ile giriş yapın.");

        var reg2 = entryEval.Reg;
        var eligibleSession = entryEval.Eligible!;
        var deviceEntryStatus = "present";
        if (entryEval.Group.LateTrackingEnabled && TryParseTime(eligibleSession.StartTime, out var deh, out var dem))
        {
            var deviceSessionStart = eligibleSession.Date.Date.AddHours(deh).AddMinutes(dem);
            if (LocalNow() > deviceSessionStart.AddMinutes(entryEval.Group.EntryGraceMinutes))
                deviceEntryStatus = "late";
        }
        var attendance = FacilityAttendance.Create(reg2.Module, reg2.FacilityId, entryEval.Group.Id, eligibleSession.Id,
            reg2.Id, reg2.ParticipantId, reg2.FullName, reg2.Tckn, deviceEntryStatus, "device",
            isGeneral ? $"device:{device.DeviceCode}:genel" : $"device:{device.DeviceCode}");
        // Kod denetimi 2026-08-02 (başka bir ajanın bağımsız raporuyla iki kez doğrulanan gerçek hata):
        // fiziksel turnike/cihaz girişi CheckedInAt set etmiyordu — RecurringJobsBootstrapper'daki
        // FacilityAutoCheckoutJob bu kayıtları ("a.CheckedInAt != null" filtresi) asla bulamıyordu,
        // yani turnikeden giren biri kapasitede sonsuza kadar "içeride" görünebiliyordu. Ayrıca
        // GetRosterAsync'teki "QR ile girdi mi?" göstergesi (qrAtt.CheckedInAt.HasValue) turnike
        // kullanıcıları için yanlış şekilde false dönüyordu.
        //
        // Kod denetimi 2026-08-08 (crab ajanı bulgusu, P1): kapı tetikleme eskiden attendance kaydı
        // commit edildikten SONRA yapılıyordu — kapı/kilit açılamazsa kullanıcıya hata dönüyordu ama
        // sistemde kişi zaten "geldi" olarak işaretlenmiş oluyordu (tutarsız durum). Şimdi kapı önce
        // tetikleniyor; açılamazsa hiçbir DB yazımı yapılmadan exception fırlatılıyor.
        await TriggerEntryDoorAsync(device, ct);

        attendance.SetCheckedInAt();
        await uow.FacilityAttendances.AddAsync(attendance, ct);
        eligibleSession.MarkAttendanceTaken();
        uow.FacilitySessions.Update(eligibleSession);
        await uow.SaveChangesAsync(ct);

        await RecomputeUsageAsync(entryEval.Group, [reg2.Id], new Dictionary<Guid, FacilityRegistration> { [reg2.Id] = reg2 }, ct);
        await uow.SaveChangesAsync(ct);

        return new(true, isGeneral ? "Tesise giriş onaylandı." : "Giriş onaylandı.", reg2.FullName, entryEval.Group.Name, SessionRange(eligibleSession));
    }

    private sealed record DeviceCheckInEval(
        FacilityRegistration Reg,
        FacilityGroup Group,
        FacilitySession? OpenSession,
        FacilityAttendance? OpenEntry,
        FacilitySession? Eligible,
        bool HasAnySessionToday = false);

    private static string SessionRange(FacilitySession s) => $"{s.StartTime}-{s.EndTime}";

    // Kod denetimi 2026-10-06: EventAccessConfigDto.TurnstileEnabled okuması — ayrı bir JSON
    // deserialize bağımlılığı kurmamak için minimal, hataya karşı toleranslı bir kontrol.
    // Varsayılan (alan eksikse/parse hatasında) TRUE'dur — admin açıkça "false" kaydetmediyse
    // mevcut davranış (her zaman açık) korunur, geriye dönük uyumluluk bozulmaz.
    private static bool EventAccessAllowsTurnstile(string? accessJson)
    {
        if (string.IsNullOrWhiteSpace(accessJson)) return true;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(accessJson);
            if (doc.RootElement.ValueKind != System.Text.Json.JsonValueKind.Object) return true;
            if (!doc.RootElement.TryGetProperty("turnstileEnabled", out var v)) return true;
            return v.ValueKind != System.Text.Json.JsonValueKind.False;
        }
        catch { return true; }
    }

    private async Task<DeviceCheckInResultDto> RunEventDeviceCheckInAsync(FacilityDevice device, string code, CancellationToken ct)
    {
        static DeviceCheckInResultDto Deny(string msg) => new(false, msg, null, null, null);

        if (device.HallId is null)
            return Deny("Etkinlik cihazı bir salona bağlı değil.");

        var hall = await uow.Halls.GetByIdAsync(device.HallId.Value, ct);
        if (hall is null)
            return Deny("Cihazın bağlı olduğu salon bulunamadı.");

        Guid participantId;
        if (qr.IsRotatingToken(code))
        {
            var (ok, pid) = await cidQr.TryVerifyAsync(code, ct);
            if (!ok) return Deny("QR süresi doldu veya geçersiz. Lütfen güncel QR gösterin.");
            participantId = pid;
        }
        else
        {
            var tckn = new string(code.Trim().Where(char.IsDigit).ToArray());
            if (tckn.Length != 11)
                return Deny("Geçersiz kimlik. Lütfen geçerli bir kart okutun veya uygulamadan QR gösterin.");
            var participant = (await uow.Participants.FindAsync(p => p.Tckn == tckn, ct)).FirstOrDefault();
            if (participant is null) return Deny("Kayıtlı katılımcı bulunamadı.");
            participantId = participant.Id;
        }

        var part = await uow.Participants.GetByIdAsync(participantId, ct);
        if (part is null) return Deny("Katılımcı bulunamadı.");

        var now = LocalNow();
        var windowMin = config.GetValue("FacilityScan:EntryWindowMinutes", 30);
        var window = TimeSpan.FromMinutes(windowMin);

        var apps = await uow.EventApplications.FindAsync(
            a => a.ParticipantId == participantId && a.Status == "approved", ct);
        if (apps.Count == 0)
            return Deny("Bu salondaki etkinlik için onaylı başvurunuz bulunmuyor.");

        Event? matchedEvent = null;
        Session? matchedSession = null;
        foreach (var app in apps)
        {
            var ev = await uow.Events.GetByIdAsync(app.EventId, ct);
            if (ev is null || ev.HallId != device.HallId) continue;

            if (app.SessionId.HasValue)
            {
                var session = await uow.Sessions.GetByIdAsync(app.SessionId.Value, ct);
                if (session is null || session.Date.Date != now.Date) continue;
                if (!TimeSpan.TryParse(session.StartTime, out var startTs)) continue;
                var sessionStart = session.Date.Date.Add(startTs);
                if (now >= sessionStart.Subtract(window) && now <= sessionStart.Add(window))
                { matchedEvent = ev; matchedSession = session; break; }
            }
            else
            {
                if (now >= ev.StartDate.Subtract(window) && now <= ev.EndDate.Add(window))
                { matchedEvent = ev; break; }
            }
        }

        if (matchedEvent is null)
            return Deny("Şu an bu salonda giriş yapabileceğiniz bir etkinlik/seans yok.");

        // Kod denetimi 2026-10-06 (kullanıcı isteği: "QR okutma her yerde aynı mantıkta çalışsın"
        // denetimi sırasında bulundu): Facility'nin cihaz akışı qrTurnstileEnabled ayarını kontrol
        // ediyordu, Event'in cihaz akışı hiçbir erişim ayarına bakmıyordu — admin "Turnike Sistemi"
        // kapatsa bile cihaz girişi çalışmaya devam ederdi.
        if (!EventAccessAllowsTurnstile(matchedEvent.AccessJson))
            return Deny("Bu etkinlikte turnike girişi kapalı.");

        var sessionLabel = matchedSession is not null ? $"{matchedSession.StartTime}-{matchedSession.EndTime}" : matchedEvent.StartTime;

        var todayActs = (await uow.EventActivities.FindAsync(
                a => a.EventId == matchedEvent.Id && a.ParticipantId == participantId, ct))
            .Where(a => a.At.AddMinutes(180).Date == now.Date)
            .OrderBy(a => a.At)
            .ToList();
        var hasOpenCheckIn = todayActs.Count > 0 && todayActs.Last().Kind == "check_in";

        var wantExit = device.Direction == "exit" || (device.Direction == "both" && hasOpenCheckIn);

        if (wantExit)
        {
            if (!hasOpenCheckIn)
                return Deny("Giriş kaydınız bulunmadığı için çıkış yapılamaz. Önce giriş yapın.");
            // Kod denetimi 2026-10-06 (kullanıcı isteği: "QR okutma her yerde aynı mantıkta
            // çalışsın" denetimi sırasında bulundu): Facility'nin aksine burada kapı DB commit'ten
            // SONRA tetikleniyordu — kapı/kilit açılamazsa kullanıcıya hata dönüyordu ama attendance
            // kaydı zaten yazılmıştı (2026-08-08 crab bulgusuyla aynı atomiklik sorunu, Facility'de
            // düzeltilmişti ama Event'e hiç uygulanmamıştı). Kapı önce tetikleniyor, açılamazsa
            // hiçbir DB yazımı yapılmadan exception fırlatılıyor.
            await TriggerDoorAsync(device, "exit", ct);
            var checkout = EventActivity.Create("check_out", DateTime.UtcNow, matchedEvent.Id, matchedSession?.Id, participantId,
                part.FullName, part.Tckn, "Turnike", "Katıldı", false, 0);
            await uow.EventActivities.AddAsync(checkout, ct);
            await uow.SaveChangesAsync(ct);
            return new(true, "Çıkış onaylandı.", part.FullName, $"{matchedEvent.Name} · {hall.Name}", sessionLabel);
        }

        if (hasOpenCheckIn)
            return new(false, "Bu etkinliğe giriş zaten yapılmış.", part.FullName, $"{matchedEvent.Name} · {hall.Name}", sessionLabel);

        await TriggerEntryDoorAsync(device, ct);
        var checkin = EventActivity.Create("check_in", DateTime.UtcNow, matchedEvent.Id, matchedSession?.Id, participantId,
            part.FullName, part.Tckn, "Turnike", "Katıldı", false, 0);
        await uow.EventActivities.AddAsync(checkin, ct);
        await uow.SaveChangesAsync(ct);
        return new(true, "Etkinlik girişi onaylandı.", part.FullName, $"{matchedEvent.Name} · {hall.Name}", sessionLabel);
    }

    private async Task<bool> RegInDeviceScopeAsync(FacilityDevice device, FacilityRegistration reg, bool isGeneral, CancellationToken ct)
    {
        if (isGeneral)
        {
            if (device.ServiceFacilityId is null) return false;
            var fac = await uow.Facilities.GetByIdAsync(reg.FacilityId, ct);
            return fac is not null && fac.ServiceFacilityId == device.ServiceFacilityId;
        }
        if (reg.FacilityId != device.FacilityId || reg.Module != device.Module) return false;

        // KİMLİK 2026-07-29 (kullanıcı isteği): Alan cihazı hangi gruba eklenirse eklensin, o alandaki
        // TÜM grup/seansların yoklamasını kabul eder — cihazı tek bir gruba daraltan eski GroupId
        // filtresi artık uygulanmıyor (device.GroupId hâlâ DB'de tutulur, sadece bilgi amaçlı/gösterim
        // için, check-in kapsamını daraltmak için kullanılmıyor).
        return true;
    }

    private async Task<FacilityDoorTriggerResult> TriggerDoorAsync(FacilityDevice device, string direction, CancellationToken ct)
        => await door.TriggerAsync(new FacilityDoorTriggerRequest(
            device.Id, device.Name, direction,
            device.IpAddress, device.Port, device.Username, device.Password,
            device.RelayNo, device.RelayMs, device.HttpPath, device.TriggerLockOnSuccess,
            device.WebhookUrl), ct);

    private async Task TriggerEntryDoorAsync(FacilityDevice device, CancellationToken ct)
    {
        var result = await TriggerDoorAsync(device, "entry", ct);
        if (!result.Opened)
            throw new ConflictException(
                result.ErrorMessage ?? "Kapı/turnike açılamadı. Lütfen görevliye başvurun.",
                result.ErrorCode ?? "DOOR_TRIGGER_FAILED");
    }

    private async Task<Guid?> ResolveServiceFacilityIdAsync(FacilityDevice device, bool isGeneral, CancellationToken ct)
    {
        if (isGeneral) return device.ServiceFacilityId;
        if (device.FacilityId is null) return null;
        var facility = await uow.Facilities.GetByIdAsync(device.FacilityId.Value, ct);
        return facility?.ServiceFacilityId;
    }

    private async Task<DeviceCheckInResultDto?> TryMasterAccessAsync(FacilityDevice device, Guid serviceFacilityId, string code, CancellationToken ct)
    {
        var sf = await uow.ServiceFacilities.GetByIdAsync(serviceFacilityId, ct);
        if (sf is null || !sf.MasterQrEnabled) return null;

        string method;
        if (qr.IsRotatingToken(code) && qr.TryParseSubjectId(code, out var subjectId) && subjectId == serviceFacilityId)
        {
            var windowSeconds = config.GetValue("MasterQr:WindowSeconds", 60);
            if (!qr.Verify(code, serviceFacilityId, $"facility-master:{serviceFacilityId}", windowSeconds)) return null;
            method = "master_qr";
        }
        else if (!string.IsNullOrWhiteSpace(sf.MasterCardCodeHash))
        {
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));
            if (!FixedEquals(hash, (sf.MasterCardCodeHash ?? string.Empty).ToUpperInvariant())) return null;
            method = "master_card";
        }
        else return null;

        var direction = device.Direction == "exit" ? "exit" : "entry";
        var log = FacilityMasterAccessLog.Create(serviceFacilityId, device.Id, device.DeviceCode, direction, method);
        await uow.FacilityMasterAccessLogs.AddAsync(log, ct);
        await uow.SaveChangesAsync(ct);

        await TriggerDoorAsync(device, direction, ct);
        return new DeviceCheckInResultDto(true, "Master erişim onaylandı.", "Yetkili Erişim", null, null);
    }

    private DateTime LocalNow()
        => DateTime.UtcNow.AddMinutes(config.GetValue("FacilitySettings:LocalTimeZoneOffsetMinutes", 180));

    // V05: FacilityRegistrationService.GroupLockKey ile AYNI türetme — aynı GroupId aynı advisory kilit
    // anahtarını verir; böylece yoklama transaction'ı ile RemoveForBatchAsync aynı kilidi (re-entrant) paylaşır.
    private static long GroupLockKey(Guid groupId) => BitConverter.ToInt64(groupId.ToByteArray(), 0);

    private static bool FixedEquals(string? a, string? b)
    {
        var ab = Encoding.UTF8.GetBytes(a ?? "");
        var bb = Encoding.UTF8.GetBytes(b ?? "");
        return ab.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ab, bb);
    }

    private static bool TryParseTime(string? t, out int hour, out int minute)
    {
        hour = 0; minute = 0;
        if (string.IsNullOrEmpty(t) || !t.Contains(':')) return false;
        var parts = t.Split(':');
        return parts.Length >= 2 && int.TryParse(parts[0], out hour) && int.TryParse(parts[1], out minute);
    }

    private async Task<List<Guid>> RecomputeUsageAsync(FacilityGroup group, List<Guid> registrationIds, Dictionary<Guid, FacilityRegistration> roster, CancellationToken ct, bool isCorrection = false)
    {
        var toRemove = new List<Guid>();
        var reactivated = false;
        if (group.AttendanceMode == "off") return toRemove;
        // V05: aynı düzeltme batch'inde birden fazla removed kayıt geri alınırken kapasite aşılmasın —
        // DB'deki aktif asıl sayısı bir kez okunur, bu batch içinde reactivate edilenler ayrıca sayılır.
        var baseActiveMains = group.Capacity <= 0 ? 0
            : await uow.FacilityRegistrations.CountAsync(r => r.GroupId == group.Id && r.Kind == "main" && r.Status == "active" && !r.IsDeleted, ct);
        var reactivatedThisBatch = 0;
        // Kullanıcı isteği: Akademi/müsabık gruplar (TC kimlik listesiyle alınan, sürekli katılımcı)
        // devamsızlık nedeniyle otomatik çıkarılmaz ve yerine yedek terfi ettirilmez — sadece yoklama
        // takip edilir (AbsenceUsed/ConsecutiveAbsenceUsed hâlâ raporlama için güncellenir, ama limit
        // dolması kaydı pasifleştirmez). Bu davranış yalnızca Kurs tipindeki gruplarda geçerlidir.
        var autoRemove = group.AttendanceMode == "full" && group.Type != "akademi";

        var sessions = await uow.FacilitySessions.GetByGroupAsync(group.Id, ct);
        var sessionById = sessions.ToDictionary(s => s.Id);

        foreach (var regId in registrationIds)
        {
            if (!roster.TryGetValue(regId, out var reg)) continue;
            // Denetim bulgusu (P1-5): normal akışta yalnızca "active" kayıtlar işlenir (mevcut
            // davranış). Düzeltme (isCorrection) akışında "removed" kayıtlar da işlenmeli — aksi
            // halde devamsızlıktan çıkarılmış bir kişinin yoklaması düzeltildiğinde (ör. mazeret
            // kabul edilip "absent" -> "present" yapıldığında) sayaç yeniden hesaplanamaz ve kayıt
            // asla geri aktifleşemez.
            if (reg.Status != "active" && !(isCorrection && reg.Status == "removed")) continue;
            // D05: yalnızca kişinin hak aralığında (MembershipStart..PeriodEnd) ve iptal olmayan
            // seansların yoklaması devamsızlık sayımına girer — terfi/kayıt öncesi ve iptal seanslar
            // geriye dönük devamsızlık üretmez. Sıralama seans tarihi + saat + kararlı Id ile deterministik.
            var atts = (await uow.FacilityAttendances.FindAsync(a => a.RegistrationId == regId, ct))
                .Where(a => sessionById.ContainsKey(a.SessionId))
                .Where(a => FacilitySessionEligibility.IsEligible(
                    sessionById[a.SessionId].Date, reg.MembershipStart, reg.PeriodEnd, sessionById[a.SessionId].IsCancelled))
                .OrderBy(a => sessionById[a.SessionId].Date)
                .ThenBy(a => sessionById[a.SessionId].StartTime)
                .ThenBy(a => a.Id)
                .ToList();

            var totalAbsences = atts.Count(a => a.Status == "absent");
            var consecutiveAbsences = 0;
            for (var i = atts.Count - 1; i >= 0; i--)
            {
                if (atts[i].Status == "absent") consecutiveAbsences++;
                else break;
            }
            // Kullanıcı isteği: "Devamsızlık Takibi" kapalıyken (tracking_only) devamsızlık SAYISI
            // hiç hesaplanmamalı/gösterilmemeli — bireysel Geldi/Gelmedi işaretleri (yukarıdaki atts)
            // kaydedilmeye devam eder, ama SetUsage'a yansıyan toplam/üst-üste devamsızlık sayacı
            // yalnızca "full" modda güncellenir.
            if (group.AttendanceMode == "full")
            {
                reg.SetUsage(totalAbsences, consecutiveAbsences);
                uow.FacilityRegistrations.Update(reg);
            }

            var breachesLimit = group.AbsenceLimit > 0 && totalAbsences >= group.AbsenceLimit
                || group.ConsecutiveAbsenceLimit > 0 && consecutiveAbsences >= group.ConsecutiveAbsenceLimit;

            if (autoRemove && reg.Status == "active" && breachesLimit)
                toRemove.Add(reg.Id);
            // Denetim bulgusu (P1-5): düzeltme sonrası devamsızlık sayısı artık limitin altındaysa
            // (mazeret kabul edildi, yanlış işaretlenmişti vb.) removed kayıt tekrar active yapılır.
            // Limit hâlâ aşılıyorsa (ör. başka bir seansta hâlâ absent) kayıt removed kalır — sessiz
            // no-op yerine kullanıcıya "marked" sayısıyla en azından yoklama düzeltmesinin işlendiği
            // görünür, ama kayıt bilinçli olarak dışarıda kalmaya devam eder.
            // D06: yalnızca DEVAMSIZLIK nedeniyle çıkarılmış kayıt geri alınabilir (manuel/diğer nedenle
            // çıkarma veya süresi biten hak otomatik dirilmez) VE ancak boş yer varsa (kapasite sessizce
            // aşılmaz). Boş yer yoksa kayıt removed kalır — yönetici manuel karar verir (SMS/bildirim
            // altyapısı bağlanınca uyarı buraya eklenecek: TODO(sms)).
            // Y03: geri alım (reactivate) yalnız grup AKTİF ve kişinin hak süresi HÂLÂ geçerliyken yapılır —
            // pasifleştirilmiş gruba veya dönemi bitmiş hakka devamsızlık düzeltmesiyle kişi geri alınmaz.
            else if (isCorrection && reg.Status == "removed" && !breachesLimit
                && (reg.RemovedReason ?? "").Contains("Devamsızlık")
                && group.IsActive
                && (!reg.PeriodEnd.HasValue || reg.PeriodEnd.Value.Date >= LocalNow().Date)
                && (group.Capacity <= 0 || (baseActiveMains + reactivatedThisBatch) < group.Capacity))
            {
                reg.Reactivate();
                uow.FacilityRegistrations.Update(reg);
                reactivatedThisBatch++;
                reactivated = true;
                // V05: geri alınan kaydın bağlı başvurusu da "approved"a döner (çıkarmada "rejected" yapılmıştı) —
                // aksi halde başvuru listesinde kişi reddedilmiş görünür, kayıt-başvuru tutarsız kalır.
                if (reg.ApplicationId.HasValue)
                {
                    var linkedApp = await uow.FacilityApplications.GetByIdAsync(reg.ApplicationId.Value, ct);
                    if (linkedApp is not null && linkedApp.Status == "rejected")
                    {
                        linkedApp.Approve("Yoklama düzeltmesiyle geri alındı");
                        uow.FacilityApplications.Update(linkedApp);
                    }
                }
            }
        }
        if (reactivated)
        {
            // GetCountsByGroupAsync ham bir DB sorgusu (EF change tracker'dan bağımsız) — reg.Reactivate()
            // henüz SaveChangesAsync ile flush edilmediyse Status="active" değişikliğini göremez ve
            // sayaç yanlış (eski) değerde kalır. Sorgudan önce kaydedilmesi şart.
            await uow.SaveChangesAsync(ct);
            var (main, waitlist) = await uow.FacilityRegistrations.GetCountsByGroupAsync(group.Id, ct);
            group.SetCounts(main, waitlist);
            uow.FacilityGroups.Update(group);
        }
        return toRemove;
    }

    /// <summary>
    /// Kullanıcı bulgusu (2026-08-04): mobil QR ile fiziksel turnike/kiosk girişinde
    /// (ScanEndpoints /api/v1/scan/facility-entry → FacilityEntryScanService) bu metod eşleşen
    /// bir seans/pencere bulamadığında sessizce hiçbir şey yapmadan dönüyordu — ama çağıran taraf
    /// bunu her zaman "giriş başarılı" (Granted: true, kapı/turnike açılıyor) olarak yorumluyordu.
    /// Yani seansın günü/saati henüz gelmemişken veya seans bittikten sonra bile QR okutan kişi
    /// içeri alınabiliyordu. Artık gerçekten eşleşen açık bir seans bulunup bulunmadığı bool
    /// olarak döndürülüyor; çağıran taraf bunu kullanarak isteği reddedebilir.
    /// </summary>
    public async Task<bool> RecordQrEntryAsync(string module, Guid serviceFacilityId, Guid participantId, CancellationToken ct)
    {
        var facilities = await uow.Facilities.FindAsync(f => f.ServiceFacilityId == serviceFacilityId && f.Module == module, ct);
        if (facilities.Count == 0) return false;

        var today = LocalNow().Date;
        var now = LocalNow();
        var openBefore = config.GetValue("FacilitySettings:CheckinOpenMinutesBefore", 30);

        FacilitySession? target = null;
        FacilityRegistration? targetReg = null;
        var bestDelta = double.MaxValue;
        foreach (var facility in facilities)
        {
            var sessions = (await uow.FacilitySessions.GetByDayAsync(module, facility.Id, today, ct)).Where(s => !s.IsCancelled).ToList();
            foreach (var s in sessions)
            {
                var regs = await uow.FacilityRegistrations.GetByGroupAsync(s.GroupId, ct);
                var reg = regs.FirstOrDefault(r => r.ParticipantId == participantId && r.Status == "active");
                if (reg is null) continue;
                if (!TryParseTime(s.StartTime, out var h, out var m)) continue;
                var start = s.Date.Date.AddHours(h).AddMinutes(m);
                var grp = await uow.FacilityGroups.GetByIdAsync(s.GroupId, ct);
                if (grp?.AttendanceMode == "off") continue;
                // Kullanıcı isteği: mobil QR giriş penceresi de seans bitişine kadar açık kalmalı.
                var end = TryParseTime(s.EndTime, out var eh, out var em)
                    ? s.Date.Date.AddHours(eh).AddMinutes(em)
                    : start.AddMinutes(grp?.EntryGraceMinutes ?? 0);
                if (now < start.AddMinutes(-openBefore) || now > end) continue;
                var delta = Math.Abs((now - start).TotalMinutes);
                if (delta < bestDelta) { bestDelta = delta; target = s; targetReg = reg; }
            }
        }
        if (target is null || targetReg is null) return false;

        var group = await uow.FacilityGroups.GetByIdAsync(target.GroupId, ct);
        if (group is null) return false;

        var existing = (await uow.FacilityAttendances.GetBySessionAsync(target.Id, ct))
            .FirstOrDefault(a => a.RegistrationId == targetReg.Id);
        if (existing is not null)
        {
            if (existing.CheckedInAt.HasValue) return true;
            existing.MarkCheckedIn("qr", $"qr-entry:{participantId}");
            uow.FacilityAttendances.Update(existing);
        }
        else
        {
            var created = FacilityAttendance.Create(module, target.FacilityId, group.Id, target.Id,
                targetReg.Id, targetReg.ParticipantId, targetReg.FullName, targetReg.Tckn, "present", "qr", $"qr-entry:{participantId}");
            created.MarkCheckedIn("qr", $"qr-entry:{participantId}");
            await uow.FacilityAttendances.AddAsync(created, ct);
        }
        await uow.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> EnforceAbsencesForSessionAsync(string module, Guid sessionId, CancellationToken ct)
    {
        var session = await GetSessionAsync(module, sessionId, ct);
        var group = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct);
        if (group is null) return 0;
        var roster = (await uow.FacilityRegistrations.GetByGroupAsync(session.GroupId, ct)).ToDictionary(r => r.Id);
        if (roster.Count == 0) return 0;

        var toRemove = await RecomputeUsageAsync(group, roster.Keys.ToList(), roster, ct);
        await uow.SaveChangesAsync(ct);
        foreach (var regId in toRemove)
            await registration.RemoveAsync(module, regId, "Devamsızlık hakkı doldu", ct);
        return toRemove.Count;
    }

    public async Task<FacilityStaticQrDto> GetStaticQrAsync(string module, Guid facilityId, CancellationToken ct)
    {
        var facility = await GetFacilityForModuleAsync(module, facilityId, ct);
        return ToStaticQrDto(facility);
    }

    public async Task<FacilityStaticQrDto> ToggleStaticQrAsync(string module, Guid facilityId, bool enabled, CancellationToken ct)
    {
        var facility = await GetFacilityForModuleAsync(module, facilityId, ct);
        if (enabled && string.IsNullOrWhiteSpace(facility.StaticQrCode))
            facility.RotateStaticQrCode(await GenerateStaticQrCodeAsync(ct));
        facility.SetStaticQrEnabled(enabled);
        uow.Facilities.Update(facility);
        await uow.SaveChangesAsync(ct);
        return ToStaticQrDto(facility);
    }

    public async Task<FacilityStaticQrDto> SetStaticQrModeAsync(string module, Guid facilityId, string mode, CancellationToken ct)
    {
        var facility = await GetFacilityForModuleAsync(module, facilityId, ct);
        facility.SetStaticQrMode(mode);
        uow.Facilities.Update(facility);
        await uow.SaveChangesAsync(ct);
        return ToStaticQrDto(facility);
    }

    public async Task<FacilityStaticQrDto> SetStaticQrTimingAsync(string module, Guid facilityId, int minExitMinutes, int reentryCooldownMinutes, CancellationToken ct)
    {
        var facility = await GetFacilityForModuleAsync(module, facilityId, ct);
        facility.SetStaticQrTiming(minExitMinutes, reentryCooldownMinutes);
        uow.Facilities.Update(facility);
        await uow.SaveChangesAsync(ct);
        return ToStaticQrDto(facility);
    }

    public async Task<FacilityStaticQrDto> RotateStaticQrAsync(string module, Guid facilityId, CancellationToken ct)
    {
        var facility = await GetFacilityForModuleAsync(module, facilityId, ct);
        facility.RotateStaticQrCode(await GenerateStaticQrCodeAsync(ct));
        uow.Facilities.Update(facility);
        await uow.SaveChangesAsync(ct);
        return ToStaticQrDto(facility);
    }

    public async Task<StaticQrScanResultDto> ScanStaticQrAsync(string staticCode, Guid participantId, CancellationToken ct, double? latitude = null, double? longitude = null)
    {
        static StaticQrScanResultDto Deny(string msg, string? errorCode = null) => new(false, msg, null, null, null, errorCode);

        if (string.IsNullOrWhiteSpace(staticCode))
            return Deny("Geçersiz QR kodu.", "INVALID_QR");

        var (baseCode, direction) = ParseStaticQrCode(staticCode.Trim());
        var facility = await uow.Facilities.GetByStaticQrCodeAsync(baseCode, ct);
        if (facility is null || !facility.StaticQrEnabled)
            return Deny("Geçersiz veya devre dışı QR kodu.", "INVALID_QR");

        if (!facility.IsActive)
            return Deny("Bu tesis şu anda kapalı.", "FACILITY_INACTIVE");
        var location = facility.ServiceFacilityId.HasValue
            ? await uow.ServiceFacilities.GetByIdAsync(facility.ServiceFacilityId.Value, ct) : null;
        // Kullanıcı isteği (2026-09-30): konum yüzünden reddedilen bir tarama "QR kodu geçersiz"
        // gibi görünmemeli — Library.ScanStaticQrAsync'teki ile aynı desen: konum-özel hata
        // kodlarını (LOCATION_REQUIRED/OUTSIDE_GEOFENCE) yakalayıp tesis adını içeren, konum
        // izni açmaya yönlendiren anlamlı bir mesajla StaticQrScanResultDto.ErrorCode üzerinden
        // frontend'e iletiyoruz (frontend bu koda göre "Konumu Aç" aksiyonu gösterir).
        try
        {
            Nexora.Application.Common.LocationAccessGuard.EnsureInside(location?.Latitude, location?.Longitude,
                config.GetValue("LocationValidation:DefaultRadiusMeters", Nexora.Application.Common.LocationAccessGuard.DefaultRadiusMeters), latitude, longitude);
        }
        catch (Nexora.Application.Common.Exceptions.ConflictException ex) when (ex.ErrorCode == "OUTSIDE_GEOFENCE")
        {
            return Deny($"Şu an {facility.Name} konumunda değilsiniz, giriş/çıkış yapamazsınız. Tesisin yakınına gelip tekrar deneyin.", "OUTSIDE_GEOFENCE");
        }
        catch (Nexora.Application.Common.Exceptions.ConflictException ex) when (ex.ErrorCode == "LOCATION_REQUIRED")
        {
            return Deny("Konumunuz alınamadı, işlem yapılamadı. Telefonunuzun konum servisini açın ve uygulamaya konum izni verin.", "LOCATION_REQUIRED");
        }
        catch (Nexora.Application.Common.Exceptions.ConflictException ex) when (ex.ErrorCode == "LOCATION_NOT_CONFIGURED")
        {
            return Deny(ex.Message, "LOCATION_NOT_CONFIGURED");
        }

        var participant = await uow.Participants.GetByIdAsync(participantId, ct);
        if (participant is null || string.IsNullOrWhiteSpace(participant.Tckn))
            return Deny("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var candidates = (await uow.FacilityRegistrations.GetActiveMainByTcknAsync(participant.Tckn, ct))
            .Where(r => r.Status == "active" && r.FacilityId == facility.Id)
            .Where(r => !r.PeriodEnd.HasValue || r.PeriodEnd.Value.Date >= LocalNow().Date)
            .ToList();

        if (candidates.Count == 0)
            return Deny("Bu tesiste kayıtlı bir seansınız bulunmuyor.", "NO_REGISTRATION");

        var now = LocalNow();
        var openBefore = config.GetValue("FacilitySettings:CheckinOpenMinutesBefore", 30);

        var evals = new List<DeviceCheckInEval>();
        foreach (var r in candidates)
        {
            var group = await uow.FacilityGroups.GetByIdAsync(r.GroupId, ct);
            if (group is null || group.AttendanceMode == "off") continue;

            var todaySessions = (await uow.FacilitySessions.GetByGroupAsync(r.GroupId, ct))
                .Where(s => !s.IsCancelled && s.Date.Date == now.Date)
                .OrderBy(s => s.StartTime)
                .ToList();

            FacilitySession? openSession = null;
            FacilityAttendance? openEntry = null;
            foreach (var s in todaySessions)
            {
                // Kod denetimi 2026-09-29 (kullanıcı isteği: zamana dayalı giriş/çıkış testinde
                // gerçek entegrasyon testiyle bulundu): CheckedOutAt.HasValue kontrolü olmadan bu
                // sorgu, çıkışı yapılmış (present/late statüsü hâlâ değişmemiş ama CheckedOutAt
                // set edilmiş) bir kaydı da "açık seans" sayıyordu — bu da aynı kişinin çıkıştan
                // sonra AYNI seansa bir daha asla giriş yapamamasına yol açıyordu (yapısal bug,
                // reentry-cooldown özelliğinden bağımsız, ondan önce de mevcuttu).
                var att = (await uow.FacilityAttendances.GetBySessionAsync(s.Id, ct))
                    .FirstOrDefault(a => a.RegistrationId == r.Id && (a.Status == "present" || a.Status == "late") && !a.CheckedOutAt.HasValue);
                if (att is not null) { openSession = s; openEntry = att; break; }
            }

            FacilitySession? eligible = null;
            foreach (var s in todaySessions)
            {
                if (!TryParseTime(s.StartTime, out var h, out var m)) continue;
                var start = s.Date.Date.AddHours(h).AddMinutes(m);
                // Kullanıcı isteği: giriş penceresi seans bitişine kadar açık kalmalı; EntryGraceMinutes
                // yalnızca present/late ayrımı için kullanılır, sert üst sınır değildir.
                var end = TryParseTime(s.EndTime, out var eh, out var em)
                    ? s.Date.Date.AddHours(eh).AddMinutes(em)
                    : start.AddMinutes(group.EntryGraceMinutes);
                if (now >= start.AddMinutes(-openBefore) && now <= end)
                { eligible = s; break; }
            }

            evals.Add(new DeviceCheckInEval(r, group, openSession, openEntry, eligible, todaySessions.Count > 0));
        }
        if (evals.Count == 0) return Deny("Grup bulunamadı.", "GROUP_NOT_FOUND");

        var mode = facility.StaticQrMode;

        // Güvenlik (kullanıcı isteği 2026-09-29): sabit/duvar QR'ı fotoğraflanıp paylaşılabilen,
        // kişiye özel olmayan statik bir koddur — bu yüzden hiçbir modda fiziksel kapı/turnike
        // TETİKLEMEZ. Yalnızca giriş/çıkış KAYDI düşer. Kapı açma yetkisi yalnız (a) kişiye özel
        // dönen turnike QR'ı (GetTurnstileQrAsync/QrPassService) ve (b) fiziksel cihaz/kiosk
        // taramasında (RunDeviceCheckInAsync) kalır — ikisi de burada değil, orada tetiklenir.
        if (mode == "split" && direction is null)
            return Deny("Bu tesiste giriş ve çıkış için ayrı QR kodları kullanılır. Kapıdaki Giriş veya Çıkış QR'ını okutun.", "INVALID_QR");

        var openEval = evals.FirstOrDefault(e => e.OpenEntry is not null && e.OpenEntry.CheckedOutAt is null);

        // Kullanıcı isteği (2026-09-29, revize akşam: "dakika bekleme kaldır, saniye cinsinden,
        // hızlı olsun; split modda da okuma süre ayarları olsun"): tek-QR modlarında
        // ("attendance"/"entry_exit") giriş/çıkış zamana dayalı ayrılır. İlk okutma GİRİŞ sayılır.
        // Facility.StaticQrMinExitSeconds dolana kadar aynı kişinin tekrar tekrar okutması yeni
        // bir giriş/çıkış ÜRETMEZ — hâlâ aynı açık giriş kaydı geçerlidir (idempotent: "giriş
        // zaten kaydedildi" bilgisi döner). Süre dolduktan SONRAKİ ilk okutma ÇIKIŞ olarak
        // işlenir. split modda (ayrı Giriş/Çıkış QR) yön zaten QR koduyla belirlenir ama aynı
        // min-süre koruması Çıkış QR'ı için de uygulanır (girer girmez art arda hızlı çıkış QR'ı
        // okutarak/cihaz çift okumasıyla anlık çift kayıt oluşmasını engeller).
        var wantExit = (mode is "attendance" or "entry_exit" && openEval is not null)
            || (mode == "split" && direction == StaticQrExitSuffix);
        if (wantExit && openEval is not null)
        {
            // Roster/manuel yoklamayla işaretlenmiş bir açık kayıtta CheckedInAt boş olabilir
            // (yalnız static-qr/cihaz girişleri bunu set eder) — bu durumda MarkedAt'e düşülür,
            // hâlâ makul bir "ne zamandan beri açık" referansı verir. İkisi de UTC (DateTime.UtcNow
            // ile set edilir) — LocalNow() Türkiye ofsetli olduğundan burada DateTime.UtcNow ile
            // kıyaslanır (LocalNow ile kıyaslamak sabit 3 saatlik hataya yol açardı).
            var entryMoment = openEval.OpenEntry!.CheckedInAt ?? openEval.OpenEntry.MarkedAt;
            var secondsSinceEntry = (DateTime.UtcNow - entryMoment).TotalSeconds;
            if (secondsSinceEntry < facility.StaticQrMinExitSeconds)
            {
                var remain = Math.Max(1, (int)Math.Ceiling(facility.StaticQrMinExitSeconds - secondsSinceEntry));
                if (mode is "attendance" or "entry_exit")
                    return new StaticQrScanResultDto(true,
                        $"Giriş zaten kaydedildi. Çıkış için en az {facility.StaticQrMinExitSeconds} sn sonra tekrar okutun (yaklaşık {remain} sn kaldı).",
                        openEval.Reg.FullName, openEval.Group.Name, "entry");
                // split + çıkış: giriş kaydı hâlâ geçerli sayılır, henüz çıkış işlenmez.
                return new StaticQrScanResultDto(true,
                    $"Giriş az önce kaydedildi. Çıkış için en az {facility.StaticQrMinExitSeconds} sn bekleyin (yaklaşık {remain} sn kaldı).",
                    openEval.Reg.FullName, openEval.Group.Name, "entry");
            }
        }
        if (wantExit)
        {
            if (openEval is null)
                return Deny("İçeride aktif bir kaydınız bulunmuyor. Giriş için Giriş QR'ını okutun.", "NO_ACTIVE_SESSION");
            openEval.OpenEntry!.MarkExit();
            uow.FacilityAttendances.Update(openEval.OpenEntry);
            await uow.SaveChangesAsync(ct);
            return new StaticQrScanResultDto(true, "Çıkış onaylandı.", openEval.Reg.FullName, openEval.Group.Name, "exit");
        }

        if (mode == "split" && direction == StaticQrEntrySuffix && openEval is not null)
            return new StaticQrScanResultDto(false, "Zaten içeride aktif bir kaydınız var.", openEval.Reg.FullName, openEval.Group.Name, null);

        var entryEval = evals.FirstOrDefault(e => e.Eligible is not null && (e.OpenSession is null || e.OpenSession.Id != e.Eligible.Id));
        if (entryEval is null)
        {
            var already = evals.FirstOrDefault(e => e.Eligible is not null && e.OpenSession is not null && e.OpenSession.Id == e.Eligible.Id);
            if (already is not null)
                return new StaticQrScanResultDto(false, "Bu seans için giriş zaten yapılmış.", already.Reg.FullName, already.Group.Name, null);
            var hasAnySessionToday = evals.Any(e => e.HasAnySessionToday);
            return Deny(hasAnySessionToday
                ? "Şu an giriş saatiniz değil. Seansınızın giriş penceresi dışındasınız."
                : "Bu tesiste bugün için tanımlı bir seansınız/programınız bulunmuyor.",
                hasAnySessionToday ? "OUTSIDE_SESSION_WINDOW" : "NO_SESSION_TODAY");
        }

        var reg2 = entryEval.Reg;
        var eligibleSession = entryEval.Eligible!;

        // Kullanıcı isteği (2026-09-29, revize akşam: varsayılan KAPALI, saniye cinsinden): bir
        // çıkıştan sonra aynı kişinin tekrar GİRİŞ sayılması için Facility.StaticQrReentryCooldownSeconds
        // kadar beklemesi gerekir (0 ise kontrol tamamen atlanır) — art arda hızlı giriş/çıkış/giriş
        // okutarak sahte devam kaydı üretilmesini engeller. Tek-QR (attendance/entry_exit) VE split
        // (ayrı Giriş/Çıkış QR) giriş yönü için aynı şekilde uygulanır; en son KAPANMIŞ kaydı (varsa)
        // bu kaydın grubunda arar.
        if (facility.StaticQrReentryCooldownSeconds > 0)
        {
            var lastClosed = (await uow.FacilityAttendances.GetByRegistrationAsync(reg2.Id, ct))
                .Where(a => a.GroupId == entryEval.Group.Id && a.CheckedOutAt.HasValue)
                .OrderByDescending(a => a.CheckedOutAt!.Value)
                .FirstOrDefault();
            if (lastClosed is not null)
            {
                var secondsSinceExit = (DateTime.UtcNow - lastClosed.CheckedOutAt!.Value).TotalSeconds;
                if (secondsSinceExit < facility.StaticQrReentryCooldownSeconds)
                {
                    var remain = Math.Max(1, (int)Math.Ceiling(facility.StaticQrReentryCooldownSeconds - secondsSinceExit));
                    return Deny($"Çok yakın zamanda çıkış yaptınız. Tekrar giriş için {remain} sn daha bekleyin.", "REENTRY_COOLDOWN_ACTIVE");
                }
            }
        }

        var staticEntryStatus = "present";
        if (entryEval.Group.LateTrackingEnabled && TryParseTime(eligibleSession.StartTime, out var sqh, out var sqm))
        {
            var staticSessionStart = eligibleSession.Date.Date.AddHours(sqh).AddMinutes(sqm);
            if (LocalNow() > staticSessionStart.AddMinutes(entryEval.Group.EntryGraceMinutes))
                staticEntryStatus = "late";
        }

        // Kod denetimi 2026-09-29 (kullanıcı isteği: zamana dayalı giriş/çıkış — gerçek entegrasyon
        // testiyle bulundu): IX_FacilityAttendances_Session_Registration_ActiveUnique (SessionId,
        // RegistrationId) benzersiz — aynı seans+kayıt için ikinci satır eklenemez (23505 hatası
        // verirdi). Bu yüzden AYNI seansta daha önce çıkış yapılmış bir kayıt varsa (yeni
        // zamana-dayalı giriş/çıkış modeliyle artık mümkün: gir→çık→tekrar gir aynı seansta) MEVCUT
        // satır ReenterAfterExit ile güncellenir; yoksa (bu seansta hiç kayıt yoksa) yeni satır
        // eklenir — eski davranış korunur.
        var existingClosedForSession = (await uow.FacilityAttendances.GetBySessionAsync(eligibleSession.Id, ct))
            .FirstOrDefault(a => a.RegistrationId == reg2.Id);
        if (existingClosedForSession is not null)
        {
            existingClosedForSession.ReenterAfterExit(staticEntryStatus, "static-qr", $"static-qr:{facility.Id}");
            uow.FacilityAttendances.Update(existingClosedForSession);
        }
        else
        {
            var attendance = FacilityAttendance.Create(reg2.Module, reg2.FacilityId, entryEval.Group.Id, eligibleSession.Id,
                reg2.Id, reg2.ParticipantId, reg2.FullName, reg2.Tckn, staticEntryStatus, "static-qr", $"static-qr:{facility.Id}");
            // Kod denetimi 2026-08-02: eskiden burada MarkCheckedIn("static-qr",...) çağrılıyordu — bu metod
            // Status'u her zaman "present"'e zorluyor ve yukarıda doğru hesaplanan "late" (geç geldi)
            // durumunu sessizce eziyordu. SetCheckedInAt yalnızca CheckedInAt'i set eder, Status'a dokunmaz.
            attendance.SetCheckedInAt();
            await uow.FacilityAttendances.AddAsync(attendance, ct);
        }
        eligibleSession.MarkAttendanceTaken();
        uow.FacilitySessions.Update(eligibleSession);
        await uow.SaveChangesAsync(ct);

        await RecomputeUsageAsync(entryEval.Group, [reg2.Id], new Dictionary<Guid, FacilityRegistration> { [reg2.Id] = reg2 }, ct);
        await uow.SaveChangesAsync(ct);

        return new StaticQrScanResultDto(true, "Giriş onaylandı.", reg2.FullName, entryEval.Group.Name, "entry");
    }

    private const string StaticQrEntrySuffix = "-giris";
    private const string StaticQrExitSuffix = "-cikis";

    private static (string BaseCode, string? Direction) ParseStaticQrCode(string code)
    {
        foreach (var suffix in new[] { StaticQrEntrySuffix, StaticQrExitSuffix })
            if (code.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                return (code[..^suffix.Length], suffix);
        return (code, null);
    }

    private async Task<Facility> GetFacilityForModuleAsync(string module, Guid facilityId, CancellationToken ct)
    {
        var facility = await uow.Facilities.GetByIdAsync(facilityId, ct);
        if (facility is null || facility.Module != module)
            throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        return facility;
    }

    private static FacilityStaticQrDto ToStaticQrDto(Facility facility)
    {
        var code = facility.StaticQrEnabled ? facility.StaticQrCode : null;
        var split = code is not null && facility.StaticQrMode == "split";
        return new(facility.StaticQrEnabled, facility.StaticQrMode, code,
            split ? code + StaticQrEntrySuffix : null,
            split ? code + StaticQrExitSuffix : null,
            facility.StaticQrMinExitSeconds,
            facility.StaticQrReentryCooldownSeconds);
    }

    private async Task<string> GenerateStaticQrCodeAsync(CancellationToken ct)
    {
        string code;
        do { code = "nxr-fac_" + Guid.NewGuid().ToString("N"); }
        while (await uow.Facilities.ExistsByStaticQrCodeAsync(code, ct));
        return code;
    }

    private async Task<FacilitySession> GetSessionAsync(string module, Guid sessionId, CancellationToken ct)
    {
        var session = await uow.FacilitySessions.GetByIdAsync(sessionId, ct);
        if (session is null || session.Module != module)
            throw new NotFoundException("Seans bulunamadı.", "SESSION_NOT_FOUND");
        return session;
    }

    private static string NormalizeStatus(string? status) => (status ?? "").Trim().ToLowerInvariant() switch
    {
        "present" or "geldi" or "katıldı" or "katildi" => "present",
        "late" or "geç" or "gec" => "late",
        _ => "absent",
    };
}
