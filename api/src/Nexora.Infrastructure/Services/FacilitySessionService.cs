using System.Text.Json;
using Nexora.Domain.Common;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class FacilitySessionService(IUnitOfWork uow, ICurrentUser current, IFacilityNotificationService notification, IAuditService audit, IUserScopeService userScope) : IFacilitySessionService
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private static readonly Dictionary<string, DayOfWeek> DayMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["monday"] = DayOfWeek.Monday, ["mon"] = DayOfWeek.Monday, ["pazartesi"] = DayOfWeek.Monday, ["pzt"] = DayOfWeek.Monday, ["1"] = DayOfWeek.Monday,
        ["tuesday"] = DayOfWeek.Tuesday, ["tue"] = DayOfWeek.Tuesday, ["salı"] = DayOfWeek.Tuesday, ["sali"] = DayOfWeek.Tuesday, ["sal"] = DayOfWeek.Tuesday, ["2"] = DayOfWeek.Tuesday,
        ["wednesday"] = DayOfWeek.Wednesday, ["wed"] = DayOfWeek.Wednesday, ["çarşamba"] = DayOfWeek.Wednesday, ["carsamba"] = DayOfWeek.Wednesday, ["çar"] = DayOfWeek.Wednesday, ["car"] = DayOfWeek.Wednesday, ["3"] = DayOfWeek.Wednesday,
        ["thursday"] = DayOfWeek.Thursday, ["thu"] = DayOfWeek.Thursday, ["perşembe"] = DayOfWeek.Thursday, ["persembe"] = DayOfWeek.Thursday, ["per"] = DayOfWeek.Thursday, ["4"] = DayOfWeek.Thursday,
        ["friday"] = DayOfWeek.Friday, ["fri"] = DayOfWeek.Friday, ["cuma"] = DayOfWeek.Friday, ["cum"] = DayOfWeek.Friday, ["5"] = DayOfWeek.Friday,
        ["saturday"] = DayOfWeek.Saturday, ["sat"] = DayOfWeek.Saturday, ["cumartesi"] = DayOfWeek.Saturday, ["cmt"] = DayOfWeek.Saturday, ["6"] = DayOfWeek.Saturday,
        ["sunday"] = DayOfWeek.Sunday, ["sun"] = DayOfWeek.Sunday, ["pazar"] = DayOfWeek.Sunday, ["paz"] = DayOfWeek.Sunday, ["0"] = DayOfWeek.Sunday, ["7"] = DayOfWeek.Sunday,
    };

    public async Task<List<FacilitySessionDto>> GetCalendarAsync(string module, Guid facilityId, int year, int month, CancellationToken ct)
    {
        await EnsureFacilityInScopeAsync(module, facilityId, ct);
        var sessions = await uow.FacilitySessions.GetByMonthAsync(module, facilityId, year, month, ct);
        return await ToDtosAsync(await FilterInstructorSessionsAsync(module, sessions, ct), ct);
    }

    public async Task<List<FacilitySessionDto>> GetByDayAsync(string module, Guid facilityId, DateTime date, CancellationToken ct)
    {
        await EnsureFacilityInScopeAsync(module, facilityId, ct);
        var sessions = await uow.FacilitySessions.GetByDayAsync(module, facilityId, date, ct);
        return await ToDtosAsync(await FilterInstructorSessionsAsync(module, sessions, ct), ct);
    }

    public async Task<List<FacilitySessionDto>> GetByGroupAsync(string module, Guid groupId, CancellationToken ct)
    {
        var group = await EnsureGroupAsync(module, groupId, ct);
        var branchName = (await uow.FacilityBranches.GetByIdAsync(group.BranchId, ct))?.Name;
        var sessions = await uow.FacilitySessions.GetByGroupAsync(groupId, ct);
        return sessions.Select(s => ToDto(s, group.Name, group.AttendanceMode, branchName, group.AgeMin, group.AgeMax, group.LateTrackingEnabled)).ToList();
    }

    public async Task<GenerateSessionsResult> GenerateAsync(string module, Guid groupId, CancellationToken ct)
    {
        var group = await EnsureGroupAsync(module, groupId, ct);

        var facility = await uow.Facilities.GetByIdAsync(group.FacilityId, ct);
        if (facility is not null && !facility.IsActive)
            throw new ConflictException("Bu tesis şu anda pasif durumdadır. Seans üretilemez.", "FACILITY_INACTIVE");

        if (group.PeriodStart is null || group.PeriodEnd is null)
            throw new ConflictException("Seans üretmek için grupta period (başlangıç/bitiş) tanımlı olmalı.", "PERIOD_NOT_SET");

        // KİMLİK 2026-08-27: PeriodEnd UTC saklanır; ToTurkey dönüşümü olmadan .Date
        // karşılaştırması gece yarısı-03:00 arası dönemi yanlışlıkla bitmiş sayardı.
        if (TurkeyTime.ToTurkey(group.PeriodEnd.Value).Date < TurkeyTime.TodayDate())
            throw new ConflictException("Grubun dönemi tamamen geçmişte kaldığı için seans üretilemez. Lütfen dönem tarihlerini güncelleyin.", "PERIOD_IN_PAST");

        if (ParseSlots(group.ScheduleJson).Count == 0)
            throw new ConflictException("Grupta gün/saat planı tanımlı değil.", "SCHEDULE_NOT_SET");

        return await GenerateCoreAsync(module, group, ct);
    }

    public async Task<GenerateSessionsResult> GenerateIfEligibleAsync(string module, Guid groupId, CancellationToken ct)
    {
        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct);
        if (group is null || group.Module != module) return new GenerateSessionsResult(0, 0);

        var facility = await uow.Facilities.GetByIdAsync(group.FacilityId, ct);
        if (facility is not null && !facility.IsActive) return new GenerateSessionsResult(0, 0);

        if (group.PeriodStart is null || group.PeriodEnd is null) return new GenerateSessionsResult(0, 0);
        if (TurkeyTime.ToTurkey(group.PeriodEnd.Value).Date < TurkeyTime.TodayDate()) return new GenerateSessionsResult(0, 0);
        if (ParseSlots(group.ScheduleJson).Count == 0) return new GenerateSessionsResult(0, 0);

        return await GenerateCoreAsync(module, group, ct);
    }

    private async Task<GenerateSessionsResult> GenerateCoreAsync(string module, FacilityGroup group, CancellationToken ct)
    {
        if (group.PeriodStart is not { } periodStart || group.PeriodEnd is not { } periodEnd)
            return new GenerateSessionsResult(0, 0);
        var periodStartDate = periodStart.Date;
        var periodEndDate = periodEnd.Date;

        var groupId = group.Id;
        var today = TurkeyTime.TodayDate();
        var slots = ParseSlots(group.ScheduleJson);
        if (slots.Count == 0) return new GenerateSessionsResult(0, 0);

        var existing = await uow.FacilitySessions.GetByGroupAsync(groupId, ct);
        var existingKeys = existing.Select(s => (s.Date.Date, s.StartTime)).ToHashSet();

        var others = await uow.FacilitySessions.FindAsync(
            s => s.Module == module && s.FacilityId == group.FacilityId && s.GroupId != groupId
                 && s.Date >= periodStartDate && s.Date <= periodEndDate && !s.IsCancelled, ct);
        var occupied = others.Select(s => (s.Date.Date, s.StartTime, s.EndTime)).ToList();

        var instructorConflicts = new List<(DateTime, string, string)>();
        if (group.InstructorId.HasValue)
        {
            var instructorId = group.InstructorId.Value;
            var instructorGroups = await uow.FacilityGroups.FindAsync(
                g => g.InstructorId == instructorId && g.Id != groupId, ct);
            var instructorGroupIds = instructorGroups.Select(g => g.Id).ToList();
            if (instructorGroupIds.Count > 0)
            {
                var instructorSessions = await uow.FacilitySessions.FindAsync(
                    s => instructorGroupIds.Contains(s.GroupId)
                         && s.Date >= periodStartDate
                         && s.Date <= periodEndDate
                         && !s.IsCancelled, ct);
                instructorConflicts = instructorSessions
                    .Select(s => (s.Date.Date, s.StartTime, s.EndTime)).ToList();
            }
        }

        var toCreate = new List<FacilitySession>();
        var skipped = 0;

        for (var date = periodStartDate; date <= periodEndDate; date = date.AddDays(1))
        {
            if (date < today) continue;
            foreach (var slot in slots)
            {
                if (string.IsNullOrWhiteSpace(slot.Day) || string.IsNullOrWhiteSpace(slot.StartTime)) continue;
                if (!DayMap.TryGetValue(slot.Day.Trim(), out var dow) || dow != date.DayOfWeek) continue;
                if (existingKeys.Contains((date, slot.StartTime))) continue;
                if (occupied.Any(o => o.Item1 == date && TimesOverlap(o.Item2, o.Item3, slot.StartTime, slot.EndTime ?? "")))
                {
                    skipped++;
                    continue;
                }
                if (instructorConflicts.Any(o => o.Item1 == date && TimesOverlap(o.Item2, o.Item3, slot.StartTime, slot.EndTime ?? "")))
                {
                    skipped++;
                    continue;
                }

                toCreate.Add(FacilitySession.Create(module, group.FacilityId, groupId, date,
                    date.DayOfWeek.ToString().ToLowerInvariant(), slot.StartTime, slot.EndTime ?? "", current.Name));
                existingKeys.Add((date, slot.StartTime));
                occupied.Add((date, slot.StartTime, slot.EndTime ?? ""));
            }
        }

        if (toCreate.Count > 0)
        {
            await uow.FacilitySessions.AddRangeAsync(toCreate, ct);
            await uow.SaveChangesAsync(ct);
        }
        return new GenerateSessionsResult(toCreate.Count, skipped);
    }

    // Kullanıcı isteği: Program (grup) ScheduleJson'ı değiştiğinde (örn. haftada 5 günden 3 güne
    // düşürüldüğünde), henüz günü gelmemiş ve artık yeni programa uymayan seanslar otomatik
    // temizlenmeli — AMA yalnızca üzerinde başvuru/yoklama YOKSA. Üzerinde yoklama kaydı varsa
    // sessizce silinmez: confirmAttendanceDeletion=false iken ConflictException fırlatılır (mevcut
    // "ATTENDANCE_ENTERED_BUT_ABSENT_CONFIRM" desenindeki gibi, admin paneli onay modalı gösterip
    // aynı isteği confirmAttendanceDeletion=true ile tekrar gönderir). Geçmiş/gerçekleşmiş
    // seanslara hiç dokunulmaz. Bu metod grup güncellemesinden SONRA, yeni ScheduleJson ile
    // GenerateIfEligibleAsync'ten ÖNCE çağrılmalıdır.
    public async Task<ScheduleSyncResult> SyncAfterScheduleChangeAsync(string module, Guid groupId, bool confirmAttendanceDeletion, CancellationToken ct)
    {
        var group = await EnsureGroupAsync(module, groupId, ct);
        var today = TurkeyTime.TodayDate();
        var newSlots = ParseSlots(group.ScheduleJson);
        var validDows = newSlots
            .Where(s => !string.IsNullOrWhiteSpace(s.Day) && DayMap.ContainsKey(s.Day!.Trim()))
            .Select(s => DayMap[s.Day!.Trim()])
            .ToHashSet();
        var validSlotsByDow = newSlots
            .Where(s => !string.IsNullOrWhiteSpace(s.Day) && !string.IsNullOrWhiteSpace(s.StartTime) && DayMap.ContainsKey(s.Day!.Trim()))
            .GroupBy(s => DayMap[s.Day!.Trim()])
            .ToDictionary(g => g.Key, g => g.Select(s => (Start: s.StartTime!, End: s.EndTime ?? "")).ToHashSet());

        var periodStartDate = group.PeriodStart?.Date;
        var periodEndDate = group.PeriodEnd?.Date;

        var futureSessions = (await uow.FacilitySessions.GetByGroupAsync(groupId, ct))
            .Where(s => !s.IsCancelled && s.Date.Date >= today)
            .ToList();

        var staleSessions = futureSessions
            .Where(s => !validDows.Contains(s.Date.DayOfWeek)
                     || !validSlotsByDow.TryGetValue(s.Date.DayOfWeek, out var slots)
                     || !slots.Contains((s.StartTime, s.EndTime))
                     || (periodStartDate.HasValue && s.Date.Date < periodStartDate.Value)
                     || (periodEndDate.HasValue && s.Date.Date > periodEndDate.Value))
            .ToList();

        if (staleSessions.Count == 0)
            return new ScheduleSyncResult(0, 0, 0, false);

        var applications = await uow.FacilityApplications.FindAsync(
            a => a.GroupId == groupId && (a.Status == "pending" || a.Status == "approved" || a.Status == "waitlist"), ct);
        var registrations = await uow.FacilityRegistrations.GetByGroupAsync(groupId, ct);
        var hasParticipants = applications.Count > 0 || registrations.Any(r => r.Status == "active");

        // Kullanıcı bulgusu (spor_salonu_kapsamli_revize_test_gorevi.md madde 3): 7 günlük bir
        // program 5 güne düşürülüp (örn. Cumartesi/Pazar kapatılıp) kaydedildiğinde, grupta aktif
        // başvuru/kayıt varsa artık geçersiz olan seanslar (yoklaması olmasa bile) hiçbir zaman
        // silinemiyordu — sonsuza dek takvimde görünmeye devam ediyorlardı ve kullanıcıya hiç
        // onay/bilgi sorulmuyordu. Görev dosyası "kontrolsüz silinmemeli" + "kullanıcıya
        // bildirilmeli ve güvenli işlem yapılmalı" diyor — kalıcı sessiz koruma bu gereksinimi
        // karşılamıyor. Düzeltme: yoklamalı seanslarla AYNI onay kapısından geçirilip, onaylanırsa
        // silinmesine izin veriliyor (katılımcının GRUP üyeliği/kaydı ayrı bir varlık olduğu için
        // ve yalnızca takvimdeki artık geçersiz seans kaydı siliniyor — katılımcının kaydı/hakkı
        // etkilenmiyor).
        if (!confirmAttendanceDeletion)
        {
            var attendanceProtectedCount = 0;
            foreach (var s in staleSessions)
                if ((await uow.FacilityAttendances.GetBySessionAsync(s.Id, ct)).Count > 0)
                    attendanceProtectedCount++;
            var participantProtectedCount = hasParticipants ? staleSessions.Count - attendanceProtectedCount : 0;

            if (attendanceProtectedCount > 0 && participantProtectedCount > 0)
                throw new ConflictException(
                    $"Bu programda {attendanceProtectedCount} seansta yoklama kayıtları, {participantProtectedCount} seansta ise aktif başvuru/kayıt bulunmaktadır. " +
                    "Seans değişikliğinin uygulanabilmesi için bu seansların kaldırılması gerekiyor (katılımcıların grup kaydı/hakkı etkilenmez, yalnızca artık programa uymayan takvim kayıtları silinir). Devam etmek istiyor musunuz?",
                    "SCHEDULE_SYNC_ATTENDANCE_CONFIRM");
            if (attendanceProtectedCount > 0)
                throw new ConflictException(
                    $"Bu programda {attendanceProtectedCount} seansta yoklama kayıtları bulunmaktadır. Seans değişikliğinin uygulanabilmesi için mevcut yoklama kayıtlarının silinmesi gerekiyor. Yoklama kayıtlarını silmek istiyor musunuz?",
                    "SCHEDULE_SYNC_ATTENDANCE_CONFIRM");
            if (participantProtectedCount > 0)
                throw new ConflictException(
                    $"Bu programda {participantProtectedCount} seans artık yeni programa uymuyor ve grupta aktif başvuru/kayıt bulunmaktadır. " +
                    "Bu seansları kaldırmak istiyor musunuz? (Katılımcıların grup kaydı/hakkı etkilenmez, yalnızca artık geçersiz takvim kayıtları silinir.)",
                    "SCHEDULE_SYNC_ATTENDANCE_CONFIRM");
        }

        var protectedApplicationSessions = 0;
        var protectedAttendanceSessions = 0;
        var deletedWithAttendance = 0;
        var removable = new List<FacilitySession>();

        foreach (var s in staleSessions)
        {
            var atts = await uow.FacilityAttendances.GetBySessionAsync(s.Id, ct);
            if (atts.Count > 0)
            {
                foreach (var att in atts) uow.FacilityAttendances.Delete(att);
                removable.Add(s);
                deletedWithAttendance++;
                protectedAttendanceSessions++;
            }
            else if (hasParticipants)
            {
                // Onay verildiyse (confirmAttendanceDeletion=true) bu seans da kaldırılabilir —
                // katılımcının GRUP kaydı (FacilityRegistration/FacilityApplication) ayrı bir
                // varlık olduğu için etkilenmez, yalnızca artık geçersiz takvim kaydı silinir.
                removable.Add(s);
                protectedApplicationSessions++;
            }
            else
            {
                removable.Add(s);
            }
        }

        if (removable.Count > 0)
        {
            uow.FacilitySessions.DeleteRange(removable);
            await uow.SaveChangesAsync(ct);
        }

        return new ScheduleSyncResult(
            removable.Count - deletedWithAttendance - protectedApplicationSessions,
            protectedApplicationSessions,
            protectedAttendanceSessions,
            false);
    }

    public async Task<FacilitySessionDto> CreateManualAsync(string module, CreateManualSessionRequest req, CancellationToken ct)
    {
        var group = await EnsureGroupAsync(module, req.GroupId, ct);

        // Kod denetimi 2026-08-08 (crab ajanı bulgusu, P2): req.FacilityId ile group.FacilityId
        // eşleşmesi hiç doğrulanmıyordu — yanlış (veya kasıtlı manipüle edilmiş) bir facilityId
        // gönderilirse seans grubun gerçek tesisine değil, verilen (yanlış) tesise bağlanabiliyordu.
        if (req.FacilityId != group.FacilityId)
            throw new ConflictException("Seçilen tesis, grubun bağlı olduğu tesisle eşleşmiyor.", "FACILITY_GROUP_MISMATCH");

        if (!DateOnly.TryParse(req.Date, out var parsedDate))
            throw new ConflictException("Geçersiz tarih formatı. YYYY-AA-GG biçiminde giriniz.", "INVALID_DATE_FORMAT");

        var date = parsedDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        if (date.Date < TurkeyTime.TodayDate())
            throw new ConflictException("Geçmiş tarih girilemez.", "PAST_DATE");

        // Denetim bulgusu (docs/tesis-spor-egitim-derin-test-2026-08-31.md P2-2, 2026-09-05 canlı
        // testle doğrulandı): manuel seans oluşturma, grubun PeriodEnd tarihini hiç kontrol
        // etmiyordu — otomatik üretim (GenerateCoreAsync) katı biçimde periodStart..periodEnd
        // aralığında kalırken, manuel yoldan dönemi bitmiş bir programa ~2.5 yıl sonrası için
        // "hayalet" seans eklenebiliyordu. Bu seanslar yoklama/QR akışlarına ve otomatik devamsızlık
        // job'ına yem oluyor, dönemi bitmiş kayıtlara "gelmedi" yazılmasına yol açabiliyordu.
        if (group.PeriodEnd is { } periodEnd && date.Date > TurkeyTime.ToTurkey(periodEnd).Date)
            throw new ConflictException("Seans tarihi grubun dönem bitiş tarihinden sonra olamaz.", "SESSION_OUT_OF_PERIOD");

        var existing = await uow.FacilitySessions.FindAsync(
            s => s.Module == module && s.GroupId == req.GroupId && s.Date.Date == date.Date && s.StartTime == req.StartTime, ct);
        if (existing.Count > 0)
            throw new ConflictException("Bu grup için bu tarih ve saatte zaten bir seans mevcut.", "SESSION_ALREADY_EXISTS");

        // Denetim bulgusu (P1-3): GenerateCoreAsync (otomatik seans üretimi) aynı tesisteki başka
        // grupların seanslarını "occupied" listesiyle kontrol edip fiziksel çakışmayı engelliyordu
        // (aynı salon aynı anda iki grup kullanamaz), ama CreateManualAsync bu kontrolü hiç
        // yapmıyordu — yalnızca *aynı grup + aynı tarih + tam aynı saat* kontrolü vardı, farklı
        // grup veya kısmen çakışan saat aralığı serbestti. Canlı kanıt: G_A pazartesi 09:00-10:00
        // seansı üretilmiş bir grupken, aynı tesiste G_B için 09:30-10:30 manuel seans 201 Created
        // ile kabul ediliyordu (30dk fiziksel çakışma). Eğitmen çakışması da aynı şekilde
        // GenerateCoreAsync'te kontrol edilirken manuel yolda atlanıyordu.
        var sameFacilityOthers = await uow.FacilitySessions.FindAsync(
            s => s.Module == module && s.FacilityId == req.FacilityId && s.GroupId != req.GroupId
                 && s.Date.Date == date.Date && !s.IsCancelled, ct);
        var conflictingSession = sameFacilityOthers.FirstOrDefault(
            o => TimesOverlap(o.StartTime, o.EndTime, req.StartTime, req.EndTime));
        if (conflictingSession is not null)
            throw new ConflictException(
                "Bu tesiste aynı tarih ve saat aralığında başka bir grubun seansı var. Fiziksel çakışma oluşur.",
                "SESSION_FACILITY_CONFLICT");

        if (group.InstructorId.HasValue)
        {
            var instructorId = group.InstructorId.Value;
            var instructorGroupIds = (await uow.FacilityGroups.FindAsync(
                g => g.InstructorId == instructorId && g.Id != req.GroupId, ct)).Select(g => g.Id).ToList();
            if (instructorGroupIds.Count > 0)
            {
                var instructorSessions = await uow.FacilitySessions.FindAsync(
                    s => instructorGroupIds.Contains(s.GroupId) && s.Date.Date == date.Date && !s.IsCancelled, ct);
                var instructorConflict = instructorSessions.FirstOrDefault(
                    o => TimesOverlap(o.StartTime, o.EndTime, req.StartTime, req.EndTime));
                if (instructorConflict is not null)
                    throw new ConflictException(
                        "Bu eğitmen aynı tarih ve saat aralığında başka bir grupta görevli. Eğitmen çakışması oluşur.",
                        "SESSION_INSTRUCTOR_CONFLICT");
            }
        }

        var session = FacilitySession.Create(module, req.FacilityId, req.GroupId, date,
            date.DayOfWeek.ToString().ToLowerInvariant(), req.StartTime, req.EndTime, current.Name);

        await uow.FacilitySessions.AddAsync(session, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "FacilitySession",
            EntityId = session.Id,
            Module = module,
            Description = $"Manuel seans eklendi: {group.Name} {req.Date} {req.StartTime}",
        }, ct);

        return ToDto(session, group.Name, group.AttendanceMode);
    }

    public async Task<FacilitySessionDto> CancelAsync(string module, Guid id, string? reason, CancellationToken ct)
    {
        var session = await GetOwnedAsync(module, id, ct);
        var group = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct);
        if (session.Cancel(reason))
        {
            uow.FacilitySessions.Update(session);
            await uow.SaveChangesAsync(ct);
            var roster = await uow.FacilityRegistrations.GetByGroupAsync(session.GroupId, ct);
            await notification.NotifySessionCancelledAsync(session, group?.Name ?? "", roster, reason, ct);
        }

        var branchName = group is null ? null : (await uow.FacilityBranches.GetByIdAsync(group.BranchId, ct))?.Name;
        return ToDto(session, group?.Name, group?.AttendanceMode ?? "full", branchName, group?.AgeMin, group?.AgeMax, group?.LateTrackingEnabled ?? true);
    }

    public async Task<FacilitySessionDto> ReopenAsync(string module, Guid id, CancellationToken ct)
    {
        var session = await GetOwnedAsync(module, id, ct);
        var group = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct);
        if (session.Reopen())
        {
            uow.FacilitySessions.Update(session);
            await uow.SaveChangesAsync(ct);
            var roster = await uow.FacilityRegistrations.GetByGroupAsync(session.GroupId, ct);
            await notification.NotifySessionReopenedAsync(session, group?.Name ?? "", roster, ct);
        }
        var branchName = group is null ? null : (await uow.FacilityBranches.GetByIdAsync(group.BranchId, ct))?.Name;
        return ToDto(session, group?.Name, group?.AttendanceMode ?? "full", branchName, group?.AgeMin, group?.AgeMax, group?.LateTrackingEnabled ?? true);
    }

    public async Task<BulkSessionsResult> BulkCancelAsync(string module, BulkCancelSessionsRequest req, CancellationToken ct)
    {
        var (start, end, scopeLabel, groupIds) = await ResolveScopeAsync(module, req.FacilityId, req.GroupIds, req.StartDate, req.EndDate, ct);
        if (groupIds.Count == 0) return new BulkSessionsResult(0, 0);

        var sessions = (await uow.FacilitySessions.FindAsync(
            s => s.Module == module && groupIds.Contains(s.GroupId) && !s.IsCancelled
                 && s.Date >= start && s.Date <= end, ct)).ToList();
        if (sessions.Count == 0) return new BulkSessionsResult(0, 0);

        await uow.BeginTransactionAsync(ct);
        try
        {
            foreach (var s in sessions) { s.Cancel(req.Reason); uow.FacilitySessions.Update(s); }
            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        var affectedGroupIds = sessions.Select(s => s.GroupId).Distinct().ToList();
        var registrations = await uow.FacilityRegistrations.FindAsync(
            r => affectedGroupIds.Contains(r.GroupId) && r.Status == "active", ct);
        var distinct = registrations
            .GroupBy(r => r.ParticipantId.HasValue ? r.ParticipantId.Value.ToString() : r.Tckn)
            .Select(g => g.First())
            .ToList();

        await notification.NotifyBulkSessionsCancelledAsync(distinct, scopeLabel, start, end, req.Reason, ct);
        return new BulkSessionsResult(sessions.Count, distinct.Count);
    }

    public async Task<BulkSessionsResult> BulkReopenAsync(string module, BulkReopenSessionsRequest req, CancellationToken ct)
    {
        var (start, end, scopeLabel, groupIds) = await ResolveScopeAsync(module, req.FacilityId, req.GroupIds, req.StartDate, req.EndDate, ct);
        if (groupIds.Count == 0) return new BulkSessionsResult(0, 0);

        var sessions = (await uow.FacilitySessions.FindAsync(
            s => s.Module == module && groupIds.Contains(s.GroupId) && s.IsCancelled
                 && s.Date >= start && s.Date <= end, ct)).ToList();
        if (sessions.Count == 0) return new BulkSessionsResult(0, 0);

        foreach (var s in sessions) { s.Reopen(); uow.FacilitySessions.Update(s); }
        await uow.SaveChangesAsync(ct);

        var affectedGroupIds = sessions.Select(s => s.GroupId).Distinct().ToList();
        var registrations = await uow.FacilityRegistrations.FindAsync(
            r => affectedGroupIds.Contains(r.GroupId) && r.Status == "active", ct);
        var distinct = registrations
            .GroupBy(r => r.ParticipantId.HasValue ? r.ParticipantId.Value.ToString() : r.Tckn)
            .Select(g => g.First())
            .ToList();

        await notification.NotifyBulkSessionsReopenedAsync(distinct, scopeLabel, start, end, ct);
        return new BulkSessionsResult(sessions.Count, distinct.Count);
    }

    private async Task<(DateTime Start, DateTime End, string ScopeLabel, List<Guid> GroupIds)> ResolveScopeAsync(
        string module, Guid? facilityId, List<Guid>? groupIds, DateTime startDate, DateTime? endDate, CancellationToken ct)
    {
        var start = startDate.Date;
        var end = (endDate ?? startDate).Date;
        if (end < start)
            throw new ConflictException("Bitiş tarihi başlangıç tarihinden önce olamaz.", "INVALID_DATE_RANGE");

        if (groupIds is not null && groupIds.Count > 0)
        {
            var ids = new List<Guid>();
            var names = new List<string>();
            foreach (var gid in groupIds.Distinct())
            {
                var group = await EnsureGroupAsync(module, gid, ct);
                ids.Add(group.Id);
                names.Add(group.Name);
            }
            var label = names.Count <= 3 ? string.Join(", ", names) : $"seçili {names.Count} grup";
            return (start, end, label, ids);
        }
        if (facilityId.HasValue)
        {
            var facility = await uow.Facilities.GetByIdAsync(facilityId.Value, ct);
            if (facility is null || facility.Module != module)
                throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
            await EnsureFacilityInScopeAsync(module, facility.Id, ct);
            var groups = await uow.FacilityGroups.FindAsync(g => g.Module == module && g.FacilityId == facility.Id, ct);
            return (start, end, facility.Name, groups.Select(g => g.Id).ToList());
        }
        throw new ConflictException("Kapatma için tesis veya grup seçilmelidir.", "SCOPE_REQUIRED");
    }

    private async Task<FacilityGroup> EnsureGroupAsync(string module, Guid groupId, CancellationToken ct)
    {
        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct);
        if (group is null || group.Module != module)
            throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, group.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, group.Id, ct);
        return group;
    }

    private async Task EnsureFacilityInScopeAsync(string module, Guid facilityId, CancellationToken ct)
    {
        if (current.Id is not Guid userId) return;
        var scoped = await userScope.GetScopedRefIdsAsync(userId, module, ct);
        if (scoped is not null && !scoped.Contains(facilityId))
            throw new ForbiddenException("Bu tesisin seanslarını düzenleme yetkiniz yok.", "FACILITY_OUT_OF_SCOPE");
    }

    private async Task<List<FacilitySession>> FilterInstructorSessionsAsync(string module, List<FacilitySession> sessions, CancellationToken ct)
    {
        var groups = await userScope.GetInstructorGroupIdsAsync(current, module, ct);
        return groups is null ? sessions : sessions.Where(s => groups.Contains(s.GroupId)).ToList();
    }

    private async Task<FacilitySession> GetOwnedAsync(string module, Guid id, CancellationToken ct)
    {
        var session = await uow.FacilitySessions.GetByIdAsync(id, ct);
        if (session is null || session.Module != module)
            throw new NotFoundException("Seans bulunamadı.", "SESSION_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, session.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, session.GroupId, ct);
        return session;
    }

    private async Task<List<FacilitySessionDto>> ToDtosAsync(List<FacilitySession> sessions, CancellationToken ct)
    {
        var groupIds = sessions.Select(s => s.GroupId).Distinct().ToList();
        var groups = groupIds.Count > 0 ? await uow.FacilityGroups.FindAsync(g => groupIds.Contains(g.Id), ct) : new();
        var names = groups.ToDictionary(g => g.Id, g => g.Name);
        var modes = groups.ToDictionary(g => g.Id, g => g.AttendanceMode);
        var ageMins = groups.ToDictionary(g => g.Id, g => g.AgeMin);
        var ageMaxs = groups.ToDictionary(g => g.Id, g => g.AgeMax);
        var lateTracking = groups.ToDictionary(g => g.Id, g => g.LateTrackingEnabled);
        var branchIds = groups.Select(g => g.BranchId).Distinct().ToList();
        var branches = branchIds.Count > 0 ? await uow.FacilityBranches.FindAsync(b => branchIds.Contains(b.Id), ct) : new();
        var branchNames = branches.ToDictionary(b => b.Id, b => b.Name);
        var groupBranchIds = groups.ToDictionary(g => g.Id, g => g.BranchId);
        return sessions.Select(s => ToDto(s, names.GetValueOrDefault(s.GroupId), modes.GetValueOrDefault(s.GroupId, "full"),
            groupBranchIds.TryGetValue(s.GroupId, out var bId) ? branchNames.GetValueOrDefault(bId) : null,
            ageMins.GetValueOrDefault(s.GroupId), ageMaxs.GetValueOrDefault(s.GroupId), lateTracking.GetValueOrDefault(s.GroupId, true))).ToList();
    }

    private static FacilitySessionDto ToDto(FacilitySession s, string? groupName, string attendanceMode = "full", string? branchName = null, int? ageMin = null, int? ageMax = null, bool lateTrackingEnabled = true)
        => new(s.Id, s.Module, s.FacilityId, s.GroupId, groupName, s.Date, s.Day, s.StartTime, s.EndTime,
            s.AttendanceTakenAt.HasValue, s.IsCancelled, s.CancelReason, s.IsActive, attendanceMode, branchName, ageMin, ageMax, lateTrackingEnabled);

    private static List<ScheduleSlot> ParseSlots(string scheduleJson)
        => FacilityScheduleHelper.ParseSlots(scheduleJson)
            .Select(s => new ScheduleSlot(s.Day, s.StartTime, s.EndTime))
            .ToList();

    private static bool TimesOverlap(string aStart, string aEnd, string bStart, string bEnd)
    {
        if (string.IsNullOrEmpty(aStart) || string.IsNullOrEmpty(bStart)) return false;
        if (string.IsNullOrEmpty(aEnd) || string.IsNullOrEmpty(bEnd)) return string.CompareOrdinal(aStart, bStart) == 0;
        return string.CompareOrdinal(aStart, bEnd) < 0 && string.CompareOrdinal(bStart, aEnd) < 0;
    }

    private record ScheduleSlot(string? Day, string? StartTime, string? EndTime);
}
