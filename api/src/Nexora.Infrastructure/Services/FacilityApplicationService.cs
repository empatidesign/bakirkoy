using System.Text.Json;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Application.Features.Notifications;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class FacilityApplicationService(
    IUnitOfWork uow,
    ICurrentUser current,
    IFacilityRegistrationService registration,
    IFacilityNotificationService notification,
    IFacilitySettingsService facilitySettings,
    INotificationService inAppNotifications,
    INotificationDispatcher dispatcher,
    IExcelService excelService,
    IUserScopeService userScope,
    Nexora.Application.Common.Interfaces.ISmsService smsService,
    Microsoft.Extensions.Configuration.IConfiguration config,
    ISmsGovernanceService smsGovernance,
    IFacilityParticipationLimitGuard participationLimitGuard,
    IFacilityCrossProgramLimitGuard crossProgramLimitGuard,
    IAuditService audit) : IFacilityApplicationService
{
    private string SultangaziDistrictCode => Microsoft.Extensions.Configuration.ConfigurationBinder
        .GetValue(config, "Residency:SultangaziDistrictCode", ResidencyPolicy.DefaultSultangaziDistrictCode)!;

    public async Task<PagedResult<FacilityApplicationDto>> GetPagedAsync(string module, FacilityApplicationListParams p, CancellationToken ct)
    {
        var scopedRefIds = current.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, module, ct) : null;
        var instructorGroupIds = await userScope.GetInstructorGroupIdsAsync(current, module, ct);
        var paged = await uow.FacilityApplications.GetPagedAsync(module, p, scopedRefIds, ct, instructorGroupIds);
        var names = await BuildNamesAsync(paged.Items, ct);
        var items = new List<FacilityApplicationDto>(paged.Items.Count);
        foreach (var a in paged.Items)
            items.Add(await ToDtoAsync(a, names, ct));
        return new PagedResult<FacilityApplicationDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<FacilityApplicationStatsDto> GetStatsAsync(string module, Guid facilityId, CancellationToken ct)
    {
        await EnsureFacilityInScopeAsync(module, facilityId, ct);
        var (total, pending, approved, rejected) = await uow.FacilityApplications.GetStatusCountsAsync(module, facilityId, ct);
        return new FacilityApplicationStatsDto(total, pending, approved, rejected);
    }

    public async Task<FacilityApplicationDto> GetByIdAsync(string module, Guid id, CancellationToken ct)
    {
        var app = await GetOwnedAsync(module, id, ct);
        var names = await BuildNamesAsync([app], ct);
        return await ToDtoAsync(app, names, ct);
    }

    public async Task<FacilityApplicationDto> CreateAsync(string module, CreateFacilityApplicationRequest req, CancellationToken ct)
    {
        var facility = await uow.Facilities.GetByIdAsync(req.FacilityId, ct);
        if (facility is null || facility.Module != module)
            throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, req.FacilityId, ct);
        if (!facility.IsActive)
            throw new ConflictException("Bu tesis şu anda pasif durumdadır. Başvuru yapılamaz.", "FACILITY_INACTIVE");

        var branch = await uow.FacilityBranches.GetByIdAsync(req.BranchId, ct);
        if (branch is null || branch.Module != module)
            throw new NotFoundException("Program bulunamadı.", "BRANCH_NOT_FOUND");
        if (!branch.IsActive)
            throw new ConflictException("Seçilen program şu anda pasif durumdadır. Başvuru yapılamaz.", "BRANCH_INACTIVE");

        Participant? participant = null;
        if (req.ParticipantId.HasValue)
        {
            participant = await uow.Participants.GetByIdAsync(req.ParticipantId.Value, ct)
                ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
            if (participant.Status != ParticipantStatus.Active)
                throw new ConflictException("Pasif veya engellenen katılımcı başvuru yapamaz.", "PARTICIPANT_NOT_ELIGIBLE");
        }

        var grp = await EnsureGroupForApplicationAsync(module, req.GroupId, req.BranchId, req.FacilityId, ct);

        var effectiveBirthDate = req.BirthDate ?? participant?.BirthDate;
        if (effectiveBirthDate.HasValue)
        {
            var ageViolation = FacilityEligibilityRules.CheckAge(grp.AgeMin, grp.AgeMax, AgeOf(effectiveBirthDate.Value));
            if (ageViolation is not null)
                throw new ConflictException(ageViolation.Message, ageViolation.ErrorCode);
        }

        string? resolvedGenderCode = null;
        if (grp.Gender is "male" or "female")
        {
            // KRİTİK BUG DÜZELTMESİ (2026-08-05, kullanıcı bulgusu — canlı testte kanıtlandı):
            // eskiden bu kontrol yalnızca `participant is not null` iken çalışıyordu. Admin
            // panelinden ParticipantId'siz (serbest TCKN/ad-soyad ile) manuel başvuru açıldığında
            // hiçbir cinsiyet kaynağı olmadığı için kontrol tamamen atlanıyordu — "Kız Gençlik
            // Kampı"na "BUGTEST Erkek Kişi" adıyla sorunsuz eklenebildiği canlı testte kanıtlandı.
            // Artık ParticipantId varsa gerçek Participant.Gender kullanılıyor (öncekiyle aynı);
            // yoksa req.Gender (frontend'in TCKN/kimlik doğrulaması sırasında topladığı bilgi)
            // kullanılıyor — o da yoksa (veya "unknown" ise) grup cinsiyet kısıtlıyken başvuru
            // reddediliyor (belirsiz cinsiyetle kısıtlı gruba giriş açılmıyor).
            var participantGender = participant is not null
                ? participant.Gender.ToCode()
                : (string.IsNullOrWhiteSpace(req.Gender) ? GenderExtensions.UnknownCode : req.Gender.Trim().ToLowerInvariant());

            if (participantGender != grp.Gender)
                throw new ConflictException(
                    participantGender == GenderExtensions.UnknownCode
                        ? "Cinsiyet bilgisi belirtilmediği için bu gruba başvurulamıyor. Lütfen cinsiyet bilgisini girin veya kayıtlı bir katılımcı seçin."
                        : grp.Gender == "female" ? "Bu grup yalnızca kadın katılımcılara açıktır." : "Bu grup yalnızca erkek katılımcılara açıktır.",
                    "GENDER_NOT_ELIGIBLE");

            // Task 7 bug fix: persist the just-confirmed gender so AutoApprove's synchronous
            // internal ApproveAsync call below (and any later manual approval) can reuse it for
            // ParticipantId-null applicants instead of re-deriving "unknown" from a null
            // ParticipantId and wrongly re-rejecting an applicant whose gender was already
            // validated to match moments earlier in this same request.
            resolvedGenderCode = participantGender;
        }

        // BULGU-1: yaş ve cinsiyet burada kontrol ediliyordu ama ikamet/uyruk (ResidencyMode)
        // kontrolü yoktu — foreign_only bir gruba admin panelden T.C. vatandaşı adına başvuru
        // açılabiliyordu. Kural kaynağı FacilityEligibilityRules (vatandaş yolu ve doğrudan kayıt
        // yolu da aynı sınıfı kullanır).
        if (participant is not null)
        {
            var residency = Nexora.Domain.Common.FacilityEligibilityRules.CheckResidency(
                grp.ResidencyMode, participant, req.Tckn, SultangaziDistrictCode);
            if (residency is not null)
                throw new ConflictException(residency.Message, residency.ErrorCode);
        }

        if (grp.AcademyWhitelistEnabled && !FacilityAcademyWhitelist.IsAllowed(grp.AcademyWhitelistTcknsJson, req.Tckn))
            throw new ConflictException("Bu akademi grubuna yalnızca önceden tanımlı katılımcılar başvurabilir.", "ACADEMY_NOT_WHITELISTED");

        // Kullanıcı isteği: dönemi/hakkı dolan (expired) bir üyeliğin başvurusu artık aktif kabul
        // edilmemeli — aksi halde süresi dolan kişi aynı gruba bir daha başvuramazdı. Geçmiş yıldaki (2025) başvurular da aktif yılı engellemez.
        var currentYear = TurkeyTime.TodayDate().Year;
        var duplicates = await uow.FacilityApplications.FindAsync(
            a => a.GroupId == grp.Id && a.Tckn == req.Tckn && a.Status != "rejected" && a.Status != "expired" && a.AppliedAt.Year == currentYear, ct);
        if (duplicates.Count > 0)
            throw new ConflictException("Bu kişi bu gruba zaten başvurmuş.", "ALREADY_APPLIED");

        var rules = FacilityModuleRegistry.RulesFor(module);
        if (rules.DocumentTypes.Count > 0)
            FacilityDocumentRules.EnsureRequiredProvided(rules, FacilityDocumentRules.ProvidedTypeKeys(req.Documents));
        else if (rules.RequiresApplicationDocuments && DocCount(req.Documents) == 0)
            throw new ConflictException(rules.DocumentsRequiredMessage ?? "Bu başvuru için evrak yüklenmesi zorunludur.", "DOCUMENTS_REQUIRED");

        var settings = await uow.FacilitySettings.GetGeneralAsync(module, ct);
        var groupRule = FacilityDocumentRules.ResolveGroupRule(grp.ConditionsJson, FacilityDocumentRules.ParseLibraryLabels(settings?.SettingsJson));
        if (groupRule.DocumentTypes.Count > 0)
            FacilityDocumentRules.EnsureRequiredProvided(groupRule, FacilityDocumentRules.ProvidedTypeKeys(req.Documents));

        await EnsureParticipationLimitAsync(module, grp, req.ParticipantId, req.BirthDate, null, ct, req.Tckn);
        await crossProgramLimitGuard.EnsureAllowedAsync(module, req.BranchId, req.FacilityId, req.ParticipantId, req.Tckn, null, ct);

        var registeredCount = await uow.FacilityRegistrations.CountAsync(r => r.GroupId == grp.Id && r.Kind == "main" && r.Status == "active" && !r.IsDeleted, ct);
        var reserveCount = await uow.FacilityRegistrations.CountAsync(r => r.GroupId == grp.Id && r.Kind == "reserve" && r.Status == "active" && !r.IsDeleted, ct);

        var applicationStatus = "pending";
        if (grp.Capacity > 0 && registeredCount >= grp.Capacity)
        {
            // Bkz. FacilityRegistrationService.cs satır ~141 notu (QA madde 74) — ReserveCapacity=0
            // gerçek sıfırdır, "sınırsız yedek" değil. Eskiden bu kontrol yalnızca
            // ReserveCapacity>0 iken çalışıyordu; ReserveCapacity=0 olan gruplarda hiç
            // reddedilmeden "waitlist" statüsü veriliyordu.
            if (reserveCount >= grp.ReserveCapacity)
                throw new ConflictException("Grup ve yedek kontenjanı dolu.", "QUOTA_FULL");
            applicationStatus = "waitlist";
        }

        var application = FacilityApplication.Create(new FacilityApplicationData(
            module, req.FacilityId, req.BranchId, grp.Id, req.ParticipantId,
            req.FullName, req.Tckn, req.Phone, req.Email, req.BirthDate, req.GuardianPhone,
            RawOr(req.Documents, "[]"), resolvedGenderCode), applicationStatus);

        // Denetim bulgusu 2026-08-08 (butterfly ajanı, P1): admin manuel başvuru yolunda "waitlist"
        // statüsü verildiğinde eskiden hiçbir FacilityRegistration satırı açılmıyordu — reserveCount
        // sonsuza dek 0 kalıyor, yedek kontenjan sınırı asla uygulanmıyor, waitlist/terfi uç noktaları
        // bu kayıtları hiç göremiyordu (vatandaş yolunda RegisterAsync her zaman gerçek kayıt açar,
        // admin yolu bunu atlıyordu — asimetri). Artık waitlist durumunda da RegisterAsync çağrılıp
        // gerçek bir Kind=reserve kaydı açılıyor, tıpkı onay (approve) akışındaki gibi. Transaction
        // içine alındı: RegisterAsync kendi içinde (örn. waitlistEnabled=false ayarıyla) reddederse
        // application kaydı da birlikte geri alınsın — yarı-tamamlanmış tutarsız durum oluşmasın.
        if (applicationStatus == "waitlist")
        {
            await uow.BeginTransactionAsync(ct);
            try
            {
                await uow.FacilityApplications.AddAsync(application, ct);
                await uow.SaveChangesAsync(ct);
                await registration.RegisterAsync(module, new RegisterParticipantRequest(
                    grp.Id, application.Id, application.ParticipantId,
                    application.FullName, application.Tckn, application.Phone, application.BirthDate, application.GuardianPhone), ct);
                await uow.CommitAsync(ct);
            }
            catch
            {
                await uow.RollbackAsync(ct);
                throw;
            }
        }
        else
        {
            await uow.FacilityApplications.AddAsync(application, ct);
            await uow.SaveChangesAsync(ct);
        }

        if (applicationStatus == "pending" && grp.AutoApprove)
            return await ApproveAsync(module, application.Id, null, ct);

        var createFacilityName = (await uow.Facilities.GetByIdAsync(grp.FacilityId, ct))?.Name;
        var (createSessionDate, createSessionTime) = await GetNextSessionDateTimeAsync(grp.Id, ct);
        await notification.SendStatusAsync(module,
            applicationStatus == "waitlist" ? "application_waitlisted" : "application_pending",
            req.Phone, req.FullName,
            new FacilityNotificationVars(GroupName: grp.Name, FacilityName: createFacilityName, SessionDate: createSessionDate, SessionTime: createSessionTime), ct, application.ParticipantId);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "FacilityApplication",
            EntityId = application.Id,
            Module = module,
            Description = $"Tesis başvurusu oluşturuldu: {req.FullName} -> {grp.Name} ({applicationStatus})",
        }, ct);

        return await GetByIdAsync(module, application.Id, ct);
    }

    // K01/K02: tek-kaynak dinamik katılım limiti kontrolü — create + approve + bulk-approve yollarının hepsi kullanır.
    // Yaş sınıfı override→grup→genel önceliği, TurkeyTime pencere, aylık reset günü. excludeApplicationId ile
    // başvurunun kendi rezervasyonu (yedek→asıl aynı başvuru) ikinci kez sayılmaz.
    // K01/V06/Y05: sayım + kimlik-birleşim tek kaynağa (IFacilityParticipationLimitGuard) indirildi —
    // vatandaş/admin başvuru, doğrudan kayıt ve içe-aktarma yolları AYNI kontrolü kullanır.
    private async Task EnsureParticipationLimitAsync(string module, FacilityGroup grp, Guid? participantId, DateTime? birthDate, Guid? excludeApplicationId, CancellationToken ct, string? tckn = null)
        => await participationLimitGuard.EnsureWithinLimitAsync(module, grp, participantId, tckn, birthDate, excludeApplicationId, ct);

    public async Task<FacilityApplicationDto> ApproveAsync(string module, Guid id, ApproveFacilityApplicationRequest? req, CancellationToken ct)
    {
        var application = await GetOwnedAsync(module, id, ct);
        if (application.Status == "approved")
            throw new ConflictException("Bu başvuru zaten onaylanmış.", "ALREADY_APPROVED");
        // COM-APR-005: Admin panelinde "Onayla" butonu sadece status=pending iken aktif — reddedilmiş
        // bir başvuru arayüzden onaylanamıyor. Ama backend bunu kontrol etmiyordu; doğrudan API
        // çağrısıyla reddedilmiş bir başvuru onaylanabiliyordu (canlı testte kanıtlandı). İstemci
        // kontrolü atlatılsa da sunucu aynı kararı vermeli — bu yüzden burada da engelleniyor.
        if (application.Status == "rejected")
            throw new ConflictException("Reddedilmiş bir başvuru doğrudan onaylanamaz. Vatandaşın yeniden başvurması gerekir.", "INVALID_STATUS_TRANSITION");

        var targetGroupId = req?.GroupId ?? application.GroupId
            ?? throw new ConflictException("Bu başvuru bir gruba bağlı değil. Onaylamak için grup seçin.", "GROUP_REQUIRED");

        var grp = await uow.FacilityGroups.GetByIdAsync(targetGroupId, ct);
        if (grp is null || grp.Module != module)
            throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, grp.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, grp.Id, ct);
        if (!grp.IsActive)
            throw new ConflictException("Seçilen grup pasif durumdadır. Bu gruba kayıt açılamaz.", "GROUP_INACTIVE");
        if (grp.BranchId != application.BranchId)
            throw new ConflictException("Seçilen grup başvurulan programa ait değil.", "GROUP_BRANCH_MISMATCH");
        // KİMLİK 2026-08-27: PeriodEnd UTC saklanır (00:00 TR = 21:00 UTC bir önceki gün);
        // ToTurkey dönüşümü olmadan .Date karşılaştırması gece yarısı-03:00 arası son
        // günü hala geçerliyken dönemi yanlışlıkla bitmiş sayardı.
        if (grp.PeriodEnd.HasValue && TurkeyTime.ToTurkey(grp.PeriodEnd.Value).Date < TurkeyTime.TodayDate())
            throw new ConflictException("Bu grubun dönemi sona ermiştir. Onaylanamaz.", "PERIOD_ENDED");

        if (application.GroupId != grp.Id)
            application.AssignGroup(grp.Id, grp.FacilityId, grp.BranchId);

        // Hata #32: CreateAsync (başvuru formu) yaş/cinsiyet uygunluğunu kontrol ediyordu ama
        // ApproveAsync (onay — özellikle admin başka bir gruba yönlendirip onayladığında, req.GroupId)
        // bu kontrolü hiç yapmıyordu. Sonuç: başvuru formunda reddedilecek bir yaş/cinsiyet, onay
        // anında farklı bir gruba atanarak sorunsuz geçebiliyordu. Aynı paylaşılan kural kaynağı
        // (FacilityEligibilityRules — waitlist terfisinde IsRegistrationEligibleAsync'in de kullandığı)
        // burada da uygulanıyor.
        var approveBirthDate = application.BirthDate;
        Participant? approveParticipant = null;
        if (application.ParticipantId.HasValue)
        {
            approveParticipant = await uow.Participants.GetByIdAsync(application.ParticipantId.Value, ct);
            approveBirthDate ??= approveParticipant?.BirthDate;
        }

        if (approveBirthDate.HasValue)
        {
            var age = FacilityEligibilityRules.AgeAt(approveBirthDate.Value, TurkeyTime.TodayDate());
            var ageViolation = FacilityEligibilityRules.CheckAge(grp.AgeMin, grp.AgeMax, age);
            if (ageViolation is not null)
                throw new ConflictException(ageViolation.Message, ageViolation.ErrorCode);
        }

        // K01: onay yolu da dinamik katılım limitini uygular; ancak başvurunun KENDİ rezervasyonu
        // (yedekten asıla geçiş = aynı başvuru) ikinci kez sayılmaz → excludeCurrentApplication (a.Id != application.Id).
        await EnsureParticipationLimitAsync(module, grp, application.ParticipantId, approveBirthDate, application.Id, ct, application.Tckn);
        await crossProgramLimitGuard.EnsureAllowedAsync(module, grp.BranchId, grp.FacilityId, application.ParticipantId, application.Tckn, application.Id, ct);

        if (grp.Gender is "male" or "female")
        {
            // Task 7 bug fix: previously always fell back to "unknown" for ParticipantId-null
            // applications, even though CreateAsync already resolved and validated req.Gender
            // moments earlier and FacilityApplication now persists it (application.Gender). Using
            // the persisted value here (instead of hardcoding "unknown") fixes AutoApprove's
            // synchronous internal call to this same method wrongly re-rejecting a free-form
            // applicant whose gender was already confirmed to match the group.
            var approveGenderCode = approveParticipant is not null
                ? approveParticipant.Gender.ToCode()
                : (string.IsNullOrWhiteSpace(application.Gender) ? GenderExtensions.UnknownCode : application.Gender);

            if (approveGenderCode != grp.Gender)
                throw new ConflictException(
                    approveGenderCode == GenderExtensions.UnknownCode
                        ? "Cinsiyet bilgisi belirlenemediği için bu gruba onaylanamıyor."
                        : grp.Gender == "female" ? "Bu grup yalnızca kadın katılımcılara açıktır." : "Bu grup yalnızca erkek katılımcılara açıktır.",
                    "GENDER_NOT_ELIGIBLE");
        }

        var registrationResult = await registration.RegisterAsync(module, new RegisterParticipantRequest(
            grp.Id, application.Id, application.ParticipantId,
            application.FullName, application.Tckn, application.Phone, application.BirthDate, application.GuardianPhone), ct);

        var toReserve = registrationResult.Kind == "reserve";
        if (toReserve) application.Waitlist(current.Name);
        else application.Approve(current.Name);
        uow.FacilityApplications.Update(application);
        await uow.SaveChangesAsync(ct);

        var approveFacilityName = (await uow.Facilities.GetByIdAsync(grp.FacilityId, ct))?.Name;
        var (approveSessionDate, approveSessionTime) = await GetNextSessionDateTimeAsync(grp.Id, ct);
        await notification.SendStatusAsync(module, toReserve ? "application_waitlisted" : "application_approved",
            application.Phone, application.FullName,
            new FacilityNotificationVars(GroupName: grp.Name, FacilityName: approveFacilityName, SessionDate: approveSessionDate, SessionTime: approveSessionTime), ct, application.ParticipantId);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Approve,
            EntityType = "FacilityApplication",
            EntityId = application.Id,
            Module = module,
            Description = toReserve
                ? $"Tesis başvurusu bekleme listesine alındı: {application.FullName} -> {grp.Name}"
                : $"Tesis başvurusu onaylandı: {application.FullName} -> {grp.Name}",
        }, ct);

        return await GetByIdAsync(module, id, ct);
    }

    private static string DecideKind(int capacity, int reserveCapacity, int mainCount, int reserveCount)
    {
        if (capacity <= 0 || mainCount < capacity) return "main";
        // Bkz. FacilityRegistrationService.cs satır ~141 notu (QA madde 74) — reserveCapacity=0
        // gerçek sıfırdır, "sınırsız yedek" değil.
        if (reserveCount < reserveCapacity) return "reserve";
        return "reject";
    }

    public async Task<FacilityBulkApproveResultDto> BulkApproveAsync(string module, FacilityBulkApproveRequest req, CancellationToken ct)
    {
        if (req?.Ids is null || req.Ids.Count == 0)
            throw new ConflictException("Onaylanacak başvuru seçilmedi.", "NO_SELECTION");

        var scopedRefIds = current.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, module, ct) : null;
        var apps = new List<FacilityApplication>();
        foreach (var id in req.Ids.Distinct())
        {
            var a = await uow.FacilityApplications.GetByIdAsync(id, ct);
            if (a is not null && a.Module == module && a.Status == "pending" && a.GroupId.HasValue
                && (scopedRefIds is null || scopedRefIds.Contains(a.FacilityId)))
                apps.Add(a);
        }
        apps = apps.OrderBy(a => a.AppliedAt).ToList();

        if (req.Preview)
        {
            var sim = new Dictionary<Guid, (int Main, int Reserve, int Capacity, int ReserveCapacity)>();
            int pApproved = 0, pWaitlisted = 0, pRejected = 0, pSkipped = 0;
            foreach (var a in apps)
            {
                var gid = a.GroupId!.Value;
                if (!sim.TryGetValue(gid, out var s))
                {
                    var g = await uow.FacilityGroups.GetByIdAsync(gid, ct);
                    if (g is null || !g.IsActive || (g.PeriodEnd.HasValue && TurkeyTime.ToTurkey(g.PeriodEnd.Value).Date < TurkeyTime.TodayDate())) { pSkipped++; continue; }
                    var (mc, wc) = await uow.FacilityRegistrations.GetCountsByGroupAsync(gid, ct);
                    s = (mc, wc, g.Capacity, g.ReserveCapacity);
                }
                var kind = DecideKind(s.Capacity, s.ReserveCapacity, s.Main, s.Reserve);
                if (kind == "main") { s.Main++; pApproved++; }
                else if (kind == "reserve") { s.Reserve++; pWaitlisted++; }
                else pRejected++;
                sim[gid] = s;
            }
            return new FacilityBulkApproveResultDto(pApproved, pWaitlisted, pRejected, pSkipped);
        }

        int approved = 0, waitlisted = 0, rejected = 0, skipped = 0;
        foreach (var a in apps)
        {
            var grp = await uow.FacilityGroups.GetByIdAsync(a.GroupId!.Value, ct);
            if (grp is null || !grp.IsActive || (grp.PeriodEnd.HasValue && TurkeyTime.ToTurkey(grp.PeriodEnd.Value).Date < TurkeyTime.TodayDate())) { skipped++; continue; }
            var facilityName = (await uow.Facilities.GetByIdAsync(grp.FacilityId, ct))?.Name;
            var (bulkSessionDate, bulkSessionTime) = await GetNextSessionDateTimeAsync(grp.Id, ct);
            try
            {
                // K01: toplu onayda da dinamik katılım limiti (başvurunun kendi rezervasyonu hariç).
                await EnsureParticipationLimitAsync(module, grp, a.ParticipantId, a.BirthDate, a.Id, ct, a.Tckn);
                await crossProgramLimitGuard.EnsureAllowedAsync(module, grp.BranchId, grp.FacilityId, a.ParticipantId, a.Tckn, a.Id, ct);
                var reg = await registration.RegisterAsync(module, new RegisterParticipantRequest(
                    grp.Id, a.Id, a.ParticipantId, a.FullName, a.Tckn, a.Phone, a.BirthDate, a.GuardianPhone), ct);
                if (reg.Kind == "reserve")
                {
                    a.Waitlist(current.Name);
                    waitlisted++;
                    await notification.SendStatusAsync(module, "application_waitlisted", a.Phone, a.FullName,
                        new FacilityNotificationVars(GroupName: grp.Name, FacilityName: facilityName, SessionDate: bulkSessionDate, SessionTime: bulkSessionTime), ct, a.ParticipantId);
                }
                else
                {
                    a.Approve(current.Name);
                    approved++;
                    await notification.SendStatusAsync(module, "application_approved", a.Phone, a.FullName,
                        new FacilityNotificationVars(GroupName: grp.Name, FacilityName: facilityName, SessionDate: bulkSessionDate, SessionTime: bulkSessionTime), ct, a.ParticipantId);
                }
                uow.FacilityApplications.Update(a);
                await uow.SaveChangesAsync(ct);
            }
            catch (ConflictException ex) when (ex.ErrorCode == "QUOTA_FULL")
            {
                a.Reject("Grup ve yedek kontenjanı dolduğu için kaydınız yapılamadı.", current.Name);
                uow.FacilityApplications.Update(a);
                await uow.SaveChangesAsync(ct);
                rejected++;
                await notification.SendStatusAsync(module, "application_rejected", a.Phone, a.FullName,
                    new FacilityNotificationVars(GroupName: grp.Name, Reason: "Kontenjan ve yedek listesi dolu"), ct, a.ParticipantId);
            }
            catch (ConflictException)
            {
                skipped++;
            }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.BulkOperation,
            EntityType = "FacilityApplication",
            Module = module,
            Description = $"Toplu başvuru onayı: {approved} onaylandı, {waitlisted} beklemeye alındı, {rejected} reddedildi, {skipped} atlandı (toplam {apps.Count})",
        }, ct);

        return new FacilityBulkApproveResultDto(approved, waitlisted, rejected, skipped);
    }

    public async Task<FacilityApplicationDto> RejectAsync(string module, Guid id, string? reason, CancellationToken ct)
    {
        var application = await GetOwnedAsync(module, id, ct);

        if (application.Status is "approved" or "waitlist")
        {
            var existingRegistration = await FindRegistrationForApplicationAsync(application, ct);
            if (existingRegistration is not null)
                await registration.RemoveAsync(module, existingRegistration.Id, reason ?? "Başvuru reddedildi", ct);
        }

        application.Reject(reason, current.Name);
        uow.FacilityApplications.Update(application);
        await uow.SaveChangesAsync(ct);

        var rejectGroupName = application.GroupId.HasValue
            ? (await uow.FacilityGroups.GetByIdAsync(application.GroupId.Value, ct))?.Name
            : null;
        await notification.SendStatusAsync(module, "application_rejected", application.Phone, application.FullName,
            new FacilityNotificationVars(GroupName: rejectGroupName, Reason: reason), ct, application.ParticipantId);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Reject,
            EntityType = "FacilityApplication",
            EntityId = application.Id,
            Module = module,
            Description = $"Tesis başvurusu reddedildi: {application.FullName}" + (reason is not null ? $" — {reason}" : ""),
        }, ct);

        return await GetByIdAsync(module, id, ct);
    }

    public async Task<Guid?> GetRegistrationIdAsync(string module, Guid id, CancellationToken ct)
    {
        var application = await GetOwnedAsync(module, id, ct);
        var registration = await FindRegistrationForApplicationAsync(application, ct);
        return registration?.Id;
    }

    private async Task<FacilityRegistration?> FindRegistrationForApplicationAsync(FacilityApplication application, CancellationToken ct)
    {
        var byApplication = await uow.FacilityRegistrations.FindAsync(
            r => r.ApplicationId == application.Id && r.Status != "removed", ct);
        var match = byApplication.FirstOrDefault();
        if (match is not null) return match;

        if (!application.GroupId.HasValue || !application.ParticipantId.HasValue) return null;

        var byGroupParticipant = await uow.FacilityRegistrations.FindAsync(
            r => r.GroupId == application.GroupId.Value
                && r.ParticipantId == application.ParticipantId.Value
                && r.Status != "removed", ct);
        return byGroupParticipant.FirstOrDefault();
    }

    public async Task DeleteAsync(string module, Guid id, CancellationToken ct)
    {
        var application = await GetOwnedAsync(module, id, ct);

        if (application.Status is "approved" or "waitlist")
        {
            var existingRegistration = await FindRegistrationForApplicationAsync(application, ct);
            if (existingRegistration is not null)
                await registration.RemoveAsync(module, existingRegistration.Id, "Başvuru silindi", ct);
        }

        application.MarkDeleted(current.Name);
        uow.FacilityApplications.Update(application);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "FacilityApplication",
            EntityId = application.Id,
            Module = module,
            Description = $"Tesis başvurusu silindi: {application.FullName}",
        }, ct);
    }

    public async Task<(byte[] Content, string FileName)> ExportAsync(string module, FacilityApplicationListParams p, CancellationToken ct)
    {
        var paged = await GetPagedAsync(module, p with { Page = "1", Limit = "10000" }, ct);
        var moduleLabel = Nexora.Application.Features.ParticipantFacilities.Dtos.FacilityModuleLabels.For(module);

        var titleParts = new List<string>();
        var first = paged.Items.FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(first?.FacilityName) && p.FacilityId.HasValue) titleParts.Add(first.FacilityName!);
        if (!string.IsNullOrWhiteSpace(first?.GroupName) && p.GroupId.HasValue) titleParts.Add(first.GroupName!);
        if (!string.IsNullOrWhiteSpace(p.Status)) titleParts.Add(FacilityApplicationStatusLabel(p.Status));
        var reportTitle = titleParts.Count > 0 ? string.Join(" · ", titleParts) : "Tüm Başvurular";

        var bytes = excelService.BuildFacilityApplicationExport(paged.Items, reportTitle, moduleLabel);
        var namePart = titleParts.Count > 0 ? titleParts[0] : moduleLabel;
        var safeName = string.Concat(namePart.Where(c => !Path.GetInvalidFileNameChars().Contains(c))).Trim();
        return (bytes, $"{safeName}-basvurulari-{DateTime.Now:yyyyMMdd}.xlsx");
    }

    public async Task<FacilityManualMessageResultDto> SendManualMessageAsync(string module, FacilityManualMessageRequest req, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(req.Module) && !string.Equals(req.Module, module, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Modül bilgisi endpoint ile uyumlu değil.", "MODULE_MISMATCH");
        if (req.Ids is null || req.Ids.Count == 0)
            throw new ConflictException("Mesaj gönderilecek kayıt seçilmedi.", "NO_SELECTION");
        if (!req.Sms && !req.Notify)
            throw new ConflictException("En az bir kanal seçin (SMS veya bildirim).", "NO_CHANNEL");

        var settings = await facilitySettings.GetGeneralAsync(module, ct);
        var templates = ParseTemplates(settings.Settings);
        var template = templates.FirstOrDefault(t => t.Event == req.TemplateEvent);
        var hasTemplate = template.Event is not null;

        // Kullanıcı isteği (2026-10-06): Facility'ye artık Travel/SEDA ile aynı desende ayrı
        // SmsBody/NotifyBody şablon alanları eklendi (NotificationTemplatesSection.tsx artık iki
        // metin kutusu da gösteriyor — 2026-08-12'deki geri alma notu burada geçerliliğini
        // kaybetti, admin panel artık her iki kanalı da ayrı ayrı düzenleyebiliyor). SMS ve push
        // kanalları artık kendi şablon metinlerini kullanır; CustomText girilirse her iki kanala
        // da aynı serbest metin gider (önceki davranışla tutarlı).
        var smsBodyTemplate = req.CustomText ?? template.SmsBody ?? "";
        var notifyBodyTemplate = req.CustomText ?? template.NotifyBody ?? template.SmsBody ?? "";
        var smsEnabled = req.Sms && (req.CustomText is not null || (hasTemplate && template.SmsEnabled)) && !string.IsNullOrWhiteSpace(smsBodyTemplate);
        var notifyEnabled = req.Notify && !string.IsNullOrWhiteSpace(notifyBodyTemplate);

        if (!smsEnabled && !notifyEnabled)
            throw new ConflictException("Gönderilecek şablon veya metin boş.", "EMPTY_MESSAGE");

        // Şablon/validasyon geçtikten SONRA çağrılır: aksi halde boş şablon gibi
        // başarısız bir istek bile kullanıcının günlük SMS hakkını gereksiz yere
        // tüketirdi (2026-09-19 canlı testte tespit edildi).
        if (smsEnabled) await smsGovernance.EnsureCanSendAsync(module, req.TemplateEvent, req.Ids.Count, req.SmsOtp, ct);

        var recipientsList = await ResolveManualRecipientsAsync(module, req, ct);

        var recipients = 0;
        var smsSent = 0;
        var notifsSent = 0;
        var statusInfo = "Bilgilendirme";
        foreach (var recipient in recipientsList)
        {
            recipients++;

            if (notifyEnabled && recipient.ParticipantId is Guid pid)
            {
                var notifyBodyText = RenderManualMessage(notifyBodyTemplate, recipient.FullName, recipient.Vars);
                await inAppNotifications.CreateAsync(pid, statusInfo, notifyBodyText, "facility-manual",
                    "facility", recipient.RefId.ToString(), recipient.Vars.FacilityName, null, statusInfo, ct);
                notifsSent++;
            }

            if (smsEnabled && !string.IsNullOrWhiteSpace(recipient.Phone))
            {
                var smsBodyText = RenderManualMessage(smsBodyTemplate, recipient.FullName, recipient.Vars);
                try { if (await dispatcher.SendSmsAsync(recipient.Phone, smsBodyText, ct)) smsSent++; }
                catch { }
            }
        }

        return new FacilityManualMessageResultDto(recipients, smsSent, notifsSent, req.Sms && smsSent > 0 && smsService.IsMockMode);
    }

    private async Task<List<ManualMessageRecipient>> ResolveManualRecipientsAsync(string module, FacilityManualMessageRequest req, CancellationToken ct)
    {
        var ids = req.Ids.Distinct().ToList();
        var statusFilter = req.StatusFilter?.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return req.Target switch
        {
            "group" => await ResolveGroupRecipientsAsync(module, ids, statusFilter, ct),
            "application" => await ResolveApplicationRecipientsAsync(module, ids, statusFilter, ct),
            "registration" => await ResolveRegistrationRecipientsAsync(module, ids, statusFilter, ct),
            // Kullanıcı isteği (2026-08-11): "tüm soldaki modallar" — Eğitmenler modalındaki
            // seçili eğitmenlere de şablonlu SMS gönderilebilsin. Eğitmenler Participant DEĞİL
            // (ayrı bir FacilityInstructor kaydı), bu yüzden in-app bildirim gönderilemiyor
            // (ParticipantId=null), sadece SMS kanalı çalışır — recipient.ParticipantId null
            // olduğunda SendManualMessageAsync zaten in-app bildirimi otomatik atlıyor.
            "instructor" => await ResolveInstructorRecipientsAsync(module, ids, ct),
            // Kullanıcı isteği (2026-08-12): "gruplar dışında tüm tesisleri de seçilebilsin ...
            // bunu da tamamen ana yöneticiler olacak" — Tesis Dashboard'undaki tesis listesinden
            // (birden çok tesis/salon) seçilen tesislerdeki TÜM aktif kayıtlı katılımcılara toplu
            // şablonlu mesaj gönderilebilsin. Bu, tek bir tesisin kapsamına bağlı olmayan,
            // tesisler-arası bir işlem olduğu için SADECE SuperAdmin (ana yönetici) kullanabilir —
            // tesis müdürü/scoped kullanıcı bu hedefi kullanamaz (aşağıda kontrol ediliyor).
            "facility" => await ResolveFacilityRecipientsAsync(module, ids, ct),
            _ => throw new ConflictException("Geçersiz hedef türü.", "INVALID_TARGET"),
        };
    }

    private async Task<List<ManualMessageRecipient>> ResolveFacilityRecipientsAsync(string module, List<Guid> facilityIds, CancellationToken ct)
    {
        if (!current.IsSuperAdmin)
            throw new ForbiddenException("Birden çok tesise toplu mesaj gönderme yetkisi yalnızca ana yöneticilerde bulunur.", "SUPER_ADMIN_ONLY");

        var registrations = await uow.FacilityRegistrations.FindAsync(
            r => facilityIds.Contains(r.FacilityId) && r.Status == "active", ct);
        return await BuildRegistrationRecipientsAsync(module, registrations, ct);
    }

    private async Task<List<ManualMessageRecipient>> ResolveInstructorRecipientsAsync(string module, List<Guid> instructorIds, CancellationToken ct)
    {
        var instructors = await uow.FacilityInstructors.FindAsync(x => x.Module == module && instructorIds.Contains(x.Id), ct);
        return instructors
            .Select(i => new ManualMessageRecipient(i.Id, null, i.FullName, i.Phone, new FacilityNotificationVars()))
            .ToList();
    }

    private async Task<List<ManualMessageRecipient>> ResolveGroupRecipientsAsync(string module, List<Guid> groupIds, HashSet<string>? statusFilter, CancellationToken ct)
    {
        var groups = await uow.FacilityGroups.FindAsync(g => g.Module == module && groupIds.Contains(g.Id), ct);
        foreach (var facilityId in groups.Select(g => g.FacilityId).Distinct()) await EnsureFacilityInScopeAsync(module, facilityId, ct);
        var registrations = await uow.FacilityRegistrations.FindAsync(r => groupIds.Contains(r.GroupId) && r.Status == "active", ct);
        if (statusFilter is not null && statusFilter.Count > 0) registrations = registrations.Where(r => statusFilter.Contains(r.Kind) || statusFilter.Contains(r.Status)).ToList();
        return await BuildRegistrationRecipientsAsync(module, registrations, ct);
    }

    private async Task<List<ManualMessageRecipient>> ResolveRegistrationRecipientsAsync(string module, List<Guid> registrationIds, HashSet<string>? statusFilter, CancellationToken ct)
    {
        var registrations = await uow.FacilityRegistrations.FindAsync(r => registrationIds.Contains(r.Id) && r.Status != "removed", ct);
        if (statusFilter is not null && statusFilter.Count > 0) registrations = registrations.Where(r => statusFilter.Contains(r.Kind) || statusFilter.Contains(r.Status)).ToList();
        return await BuildRegistrationRecipientsAsync(module, registrations, ct);
    }

    private async Task<List<ManualMessageRecipient>> ResolveApplicationRecipientsAsync(string module, List<Guid> applicationIds, HashSet<string>? statusFilter, CancellationToken ct)
    {
        var apps = await uow.FacilityApplications.FindAsync(a => a.Module == module && applicationIds.Contains(a.Id) && a.ParticipantId != null, ct);
        if (statusFilter is not null && statusFilter.Count > 0) apps = apps.Where(a => statusFilter.Contains(a.Status)).ToList();
        foreach (var facilityId in apps.Select(a => a.FacilityId).Distinct()) await EnsureFacilityInScopeAsync(module, facilityId, ct);
        var groupIds = apps.Where(a => a.GroupId.HasValue).Select(a => a.GroupId!.Value).Distinct().ToList();
        var groups = groupIds.Count > 0 ? await uow.FacilityGroups.FindAsync(g => groupIds.Contains(g.Id), ct) : new();
        var facilities = await uow.Facilities.FindAsync(f => apps.Select(a => a.FacilityId).Distinct().Contains(f.Id), ct);
        var byGroup = groups.ToDictionary(g => g.Id);
        var byFacility = facilities.ToDictionary(f => f.Id);
        var result = new List<ManualMessageRecipient>();
        foreach (var app in apps)
        {
            FacilityGroup? group = app.GroupId.HasValue ? byGroup.GetValueOrDefault(app.GroupId.Value) : null;
            var (sessionDate, sessionTime) = group is null ? (null, null) : await GetNextSessionDateTimeAsync(group.Id, ct);
            result.Add(new ManualMessageRecipient(app.Id, app.ParticipantId, app.FullName, app.Phone, new FacilityNotificationVars(
                GroupName: group?.Name,
                FacilityName: byFacility.GetValueOrDefault(app.FacilityId)?.Name,
                SessionDate: sessionDate,
                SessionTime: sessionTime)));
        }
        return result;
    }

    private async Task<List<ManualMessageRecipient>> BuildRegistrationRecipientsAsync(string module, List<FacilityRegistration> registrations, CancellationToken ct)
    {
        var groupIds = registrations.Select(r => r.GroupId).Distinct().ToList();
        var groups = groupIds.Count > 0 ? await uow.FacilityGroups.FindAsync(g => g.Module == module && groupIds.Contains(g.Id), ct) : new();
        foreach (var facilityId in groups.Select(g => g.FacilityId).Distinct()) await EnsureFacilityInScopeAsync(module, facilityId, ct);
        var facilities = await uow.Facilities.FindAsync(f => groups.Select(g => g.FacilityId).Distinct().Contains(f.Id), ct);
        var byGroup = groups.ToDictionary(g => g.Id);
        var byFacility = facilities.ToDictionary(f => f.Id);
        var result = new List<ManualMessageRecipient>();
        foreach (var reg in registrations)
        {
            if (!byGroup.TryGetValue(reg.GroupId, out var group)) continue;
            var (sessionDate, sessionTime) = await GetNextSessionDateTimeAsync(group.Id, ct);
            result.Add(new ManualMessageRecipient(reg.Id, reg.ParticipantId, reg.FullName, reg.Phone, new FacilityNotificationVars(
                GroupName: group.Name,
                FacilityName: byFacility.GetValueOrDefault(group.FacilityId)?.Name,
                SessionDate: sessionDate,
                SessionTime: sessionTime)));
        }
        return result;
    }

    private static List<(string Event, bool SmsEnabled, string? SmsBody, bool NotifyEnabled, string? NotifyBody)> ParseTemplates(JsonElement settingsJson)
    {
        var result = new List<(string, bool, string?, bool, string?)>();
        if (settingsJson.ValueKind != JsonValueKind.Object) return result;
        if (!settingsJson.TryGetProperty("notificationTemplates", out var arr) || arr.ValueKind != JsonValueKind.Array) return result;
        foreach (var t in arr.EnumerateArray())
        {
            if (t.ValueKind != JsonValueKind.Object) continue;
            var ev = t.TryGetProperty("event", out var e) ? e.GetString() : null;
            if (string.IsNullOrWhiteSpace(ev)) continue;
            var smsEnabled = t.TryGetProperty("smsEnabled", out var se) && se.ValueKind == JsonValueKind.True;
            var smsBody = t.TryGetProperty("smsBody", out var sb) && sb.ValueKind == JsonValueKind.String ? sb.GetString() : null;
            var notifyEnabled = !t.TryGetProperty("notifyEnabled", out var ne) || ne.ValueKind != JsonValueKind.False;
            var notifyBody = t.TryGetProperty("notifyBody", out var nb) && nb.ValueKind == JsonValueKind.String ? nb.GetString() : smsBody;
            result.Add((ev, smsEnabled, smsBody, notifyEnabled, notifyBody));
        }
        return result;
    }

    private static string RenderManualMessage(string template, string fullName, FacilityNotificationVars v)
    {
        var name = fullName ?? string.Empty;
        var idx = name.IndexOf(' ');
        var first = idx > 0 ? name[..idx] : name;
        var last = idx > 0 ? name[(idx + 1)..] : string.Empty;
        return template
            .Replace("{{ad}}", first)
            .Replace("{{soyad}}", last)
            .Replace("{{grup}}", v.GroupName ?? string.Empty)
            .Replace("{{tesis}}", v.FacilityName ?? string.Empty)
            .Replace("{{tarih}}", v.Date ?? string.Empty)
            .Replace("{{red_nedeni}}", v.Reason ?? string.Empty)
            .Replace("{{sira}}", v.WaitlistPosition?.ToString() ?? string.Empty)
            .Replace("{{seans_tarihi}}", v.SessionDate ?? string.Empty)
            .Replace("{{devamsizlik_sayisi}}", v.AbsenceCount?.ToString() ?? string.Empty)
            .Replace("{{kalan_hak}}", v.RemainingRight?.ToString() ?? string.Empty)
            .Replace("{{limit}}", v.Limit?.ToString() ?? string.Empty)
            .Replace("{{seans_saati}}", v.SessionTime ?? string.Empty)
            .Replace("{{onay_suresi}}", v.ConfirmHours ?? string.Empty)
            .Replace("{{evrak_listesi}}", v.DocumentList ?? string.Empty)
            .Replace("{{iptal_nedeni}}", v.CancelReason ?? string.Empty);
    }

    private record ManualMessageRecipient(Guid RefId, Guid? ParticipantId, string FullName, string? Phone, FacilityNotificationVars Vars);

    private static string FacilityApplicationStatusLabel(string status) => status switch
    {
        "pending" => "Beklemede",
        "approved" => "Onaylı",
        "waitlist" => "Yedek",
        "rejected" => "Reddedildi",
        _ => status,
    };

    private async Task<FacilityGroup> EnsureGroupForApplicationAsync(string module, Guid? groupId, Guid branchId, Guid facilityId, CancellationToken ct)
    {
        if (!groupId.HasValue)
            throw new ConflictException("Grup seçimi zorunludur.", "GROUP_REQUIRED");

        var grp = await uow.FacilityGroups.GetByIdAsync(groupId.Value, ct);
        if (grp is null || grp.Module != module)
            throw new NotFoundException("Grup bulunamadı.", "GROUP_NOT_FOUND");
        if (!grp.IsActive)
            throw new ConflictException("Seçilen grup pasif durumdadır. Başvuru yapılamaz.", "GROUP_INACTIVE");
        if (grp.BranchId != branchId)
            throw new ConflictException("Seçilen grup bu programa ait değil.", "GROUP_BRANCH_MISMATCH");
        if (grp.FacilityId != facilityId)
            throw new ConflictException("Seçilen grup bu tesise ait değil.", "GROUP_FACILITY_MISMATCH");
        var windowBlock = Nexora.Domain.Common.FacilityApplicationWindow.Check(
            grp.Type, grp.ApplicationStartDate, grp.ApplicationEndDate,
            grp.PeriodStart, grp.PeriodEnd, grp.PeriodType, grp.PeriodMonths,
            TurkeyTime.TodayDate());
        if (windowBlock is not null)
            throw new ConflictException(windowBlock.Value.Message, windowBlock.Value.Code);
        return grp;
    }

    private static int AgeOf(DateTime birth)
    {
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    private async Task<FacilityApplication> GetOwnedAsync(string module, Guid id, CancellationToken ct)
    {
        var application = await uow.FacilityApplications.GetByIdAsync(id, ct);
        if (application is null || application.Module != module)
            throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        await EnsureFacilityInScopeAsync(module, application.FacilityId, ct);
        await userScope.EnsureInstructorGroupAsync(current, module, application.GroupId, ct);
        return application;
    }

    private async Task EnsureFacilityInScopeAsync(string module, Guid facilityId, CancellationToken ct)
    {
        if (current.Id is not Guid userId) return;
        var scoped = await userScope.GetScopedRefIdsAsync(userId, module, ct);
        if (scoped is not null && !scoped.Contains(facilityId))
            throw new ForbiddenException("Bu tesisin başvurularını düzenleme yetkiniz yok.", "FACILITY_OUT_OF_SCOPE");
    }

    private async Task<AppNames> BuildNamesAsync(IReadOnlyCollection<FacilityApplication> items, CancellationToken ct)
    {
        var facilityIds = items.Select(a => a.FacilityId).Distinct().ToList();
        var branchIds = items.Select(a => a.BranchId).Distinct().ToList();
        var groupIds = items.Where(a => a.GroupId.HasValue).Select(a => a.GroupId!.Value).Distinct().ToList();

        var facilities = facilityIds.Count > 0 ? await uow.Facilities.FindAsync(x => facilityIds.Contains(x.Id), ct) : new();
        var branches = branchIds.Count > 0 ? await uow.FacilityBranches.FindAsync(x => branchIds.Contains(x.Id), ct) : new();
        var groups = groupIds.Count > 0 ? await uow.FacilityGroups.FindAsync(x => groupIds.Contains(x.Id), ct) : new();

        return new AppNames(
            facilities.ToDictionary(x => x.Id, x => x.Name),
            branches.ToDictionary(x => x.Id, x => x.Name),
            groups.ToDictionary(x => x.Id, x => x.Name),
            groups.ToDictionary(x => x.Id, x => x.ConditionsJson ?? ""));
    }

    private async Task<FacilityApplicationDto> ToDtoAsync(FacilityApplication a, AppNames n, CancellationToken ct)
        => new(a.Id, a.Module, a.FacilityId, n.Facilities.GetValueOrDefault(a.FacilityId),
            a.BranchId, n.Branches.GetValueOrDefault(a.BranchId),
            a.GroupId, a.GroupId.HasValue ? n.Groups.GetValueOrDefault(a.GroupId.Value) : null,
            a.ParticipantId, a.FullName, a.Tckn, a.Phone, a.Email, a.BirthDate, a.GuardianPhone,
            await BuildDocumentsAsync(a.DocumentsJson, ct), a.AppliedAt, a.Status, a.RejectReason,
            ComputeHasMissing(a, n));

    private static bool ComputeHasMissing(FacilityApplication a, AppNames n)
    {
        if (!a.GroupId.HasValue) return false;
        if (!n.GroupConditions.TryGetValue(a.GroupId.Value, out var condJson)) return false;
        if (string.IsNullOrWhiteSpace(condJson)) return false;
        try
        {
            using var doc = JsonDocument.Parse(condJson);
            var root = doc.RootElement;
            var raw = string.IsNullOrWhiteSpace(a.DocumentsJson) ? "[]" : a.DocumentsJson;
            int uploaded;
            try { uploaded = DocCount(JsonSerializer.Deserialize<JsonElement>(raw)); }
            catch { uploaded = 0; }

            if (root.TryGetProperty("requiredDocumentIds", out var idsEl)
                && idsEl.ValueKind == JsonValueKind.Array
                && idsEl.GetArrayLength() > 0)
                return uploaded < idsEl.GetArrayLength();

            if (root.TryGetProperty("documentsRequired", out var reqEl)
                && reqEl.ValueKind == JsonValueKind.True)
                return uploaded == 0;

            return false;
        }
        catch { return false; }
    }

    private async Task<JsonElement> BuildDocumentsAsync(string documentsJson, CancellationToken ct)
    {
        JsonElement parsed;
        try { parsed = JsonSerializer.Deserialize<JsonElement>(string.IsNullOrWhiteSpace(documentsJson) ? "[]" : documentsJson); }
        catch { return JsonSerializer.Deserialize<JsonElement>("[]"); }
        if (parsed.ValueKind != JsonValueKind.Array) return JsonSerializer.Deserialize<JsonElement>("[]");

        var list = new List<Dictionary<string, string?>>();
        foreach (var d in parsed.EnumerateArray())
        {
            if (d.ValueKind != JsonValueKind.Object) continue;
            var item = new Dictionary<string, string?>();
            string? objectName = null;
            foreach (var prop in d.EnumerateObject())
            {
                var value = prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : prop.Value.ToString();
                item[prop.Name] = value;
                if (prop.Name.Equals("objectName", StringComparison.OrdinalIgnoreCase)) objectName = value;
            }
            if (!string.IsNullOrWhiteSpace(objectName) && !item.ContainsKey("url"))
                item["url"] = FileUrl.Private(objectName);
            list.Add(item);
        }
        return JsonSerializer.SerializeToElement(list);
    }

    private static int DocCount(JsonElement el) => el.ValueKind == JsonValueKind.Array ? el.GetArrayLength() : 0;

    private static string RawOr(JsonElement el, string fallback)
        => el.ValueKind == JsonValueKind.Undefined ? fallback : el.GetRawText();

    // Denetim bulgusu 2026-08-08 (badger ajanı, docs/sablon-sistemi-baglanti-denetimi-2026-08-08.md):
    // application_approved/application_pending/application_waitlisted bildirimlerinde SessionDate/
    // SessionTime hiç geçirilmiyordu — yalnızca waitlist_promoted (FacilityRegistrationService'teki
    // ayrı bir GetNextSessionDateTimeAsync ile) "en yakın seans" bilgisini gösteriyordu. Kullanıcı
    // özellikle "kayıt başarılı olduğunda... en yakın seans... hangi salon hangi seans" istedi. Aynı
    // mantık burada da uygulanıyor ki kayıt/onay/yedek mesajları da seans tarih/saatini içersin.
    // Kullanıcı talebi (2026-09-25, aynı ailede FacilityRegistrationService ile paralel düzeltme):
    // hak kazanılan GÜN HARİÇ sonraki ilk seans bildirilmeli — "> today" (eskiden ">= today" idi).
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

    private record AppNames(Dictionary<Guid, string> Facilities, Dictionary<Guid, string> Branches, Dictionary<Guid, string> Groups, Dictionary<Guid, string> GroupConditions);
}
